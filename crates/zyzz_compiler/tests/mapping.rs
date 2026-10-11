//! Verifies string edits, source map generation, and source map queries through the public
//! mapping modules. Expected values match `magic-string` 1.2, `@jridgewell/gen-mapping` 0.3,
//! `@jridgewell/trace-mapping` 0.3, `@jridgewell/sourcemap-codec` 1.6, and
//! `@jridgewell/resolve-uri` 3.1 for the same inputs.

use std::fmt::Write;

use zyzz_compiler::mapping::codec::{self, Original, Segment};
use zyzz_compiler::mapping::gen_mapping::{GenMapping, Mapping, Position};
use zyzz_compiler::mapping::magic_string::{Bundle, MagicString, MapOptions};
use zyzz_compiler::mapping::trace_mapping::{self, OriginalPosition, TraceMap};

/// The byte offset of the first occurrence of a pattern.
fn find(source: &str, pattern: &str) -> u32 {
    u32::try_from(source.find(pattern).expect("pattern in source")).expect("small source")
}

fn length(source: &str) -> u32 {
    u32::try_from(source.len()).expect("small source")
}

fn error<T>(result: zyzz_compiler::error::Result<T>) -> String {
    result.map_or_else(|error| error.text(), |_| "ok".to_owned())
}

/// Formats a position as `originalPositionFor` serializes it.
fn position(position: &OriginalPosition<'_>) -> String {
    serde_json::json!({
        "source": position.source,
        "line": position.line,
        "column": position.column,
        "name": position.name,
    })
    .to_string()
}

/// A map with unordered columns, a named segment, sourceless segments, an empty source, and
/// trailing empty lines.
fn encoded() -> GenMapping {
    let mut map = GenMapping::new(Some("out.css"));
    let mapped = |line, column, source, original_line, original_column, name| Mapping {
        generated: Position { column, line },
        name,
        original: Some(Position {
            column: original_column,
            line: original_line,
        }),
        source: Some(source),
    };
    let sourceless = |line, column| Mapping {
        generated: Position { column, line },
        name: None,
        original: None,
        source: None,
    };

    map.set_source_content("b.ts", Some("b content"));
    map.add_mapping(&mapped(1, 4, "a.ts", 2, 1, None));
    map.add_mapping(&mapped(1, 0, "b.ts", 1, 0, Some("card")));
    map.add_mapping(&mapped(1, 4, "b.ts", 3, 2, None));
    map.add_mapping(&sourceless(3, 2));
    map.add_mapping(&mapped(3, 5, "", 1, 1, None));
    map.add_mapping(&mapped(3, 6, "a.ts", 9, 9, Some("")));
    map.add_mapping(&sourceless(6, 0));
    map
}

mod generate_map {
    use super::*;

    #[test]
    fn maps_edits_by_utf16_columns() {
        let source = "const é = style({ color: 'red' })\nconst 😀 = é\n";
        let mut string = MagicString::new(source);
        let newline = find(source, "\nconst 😀");

        string
            .overwrite(find(source, "style("), find(source, ")") + 1, "\"a1b2\"")
            .expect("overwrite");
        string.prepend_right(0, "/* x */").expect("prepend");
        string
            .append_left(length(source), "export {}\n")
            .expect("append");
        string.remove(newline, newline + 1).expect("remove");

        insta::assert_snapshot!(string.to_string(), @r#"
        /* x */const é = "a1b2"const 😀 = é
        export {}
        "#);
        insta::assert_snapshot!(
            string
                .generate_map(&MapOptions {
                    hires: true,
                    include_content: true,
                    source: Some("src\\app.ts"),
                })
                .to_json(),
            @r#"{"version":3,"sources":["src/app.ts"],"sourcesContent":["const é = style({ color: 'red' })\nconst 😀 = é\n"],"names":[],"mappings":"OAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,MACV,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;;"}"#
        );
        insta::assert_snapshot!(
            string
                .generate_map(&MapOptions {
                    source: Some("app.ts"),
                    ..MapOptions::default()
                })
                .to_json(),
            @r#"{"version":3,"sources":["app.ts"],"names":[],"mappings":"OAAA,UAAU,MACV;;"}"#
        );
    }
}

mod overwrite {
    use super::*;

    #[test]
    fn drops_insertions_that_update_keeps() {
        let mut updated = MagicString::new("abcdef");
        let mut overwritten = MagicString::new("abcdef");

        updated
            .append_left(2, "<")
            .and_then(|string| string.prepend_right(2, "["))
            .and_then(|string| string.append_left(4, "]"))
            .and_then(|string| string.update(2, 4, "CD"))
            .expect("update");
        overwritten
            .append_left(2, "<")
            .and_then(|string| string.prepend_right(2, "["))
            .and_then(|string| string.append_left(4, "]"))
            .and_then(|string| string.prepend_right(3, "|"))
            .and_then(|string| string.overwrite(2, 4, "CD"))
            .expect("overwrite");

        insta::assert_snapshot!(updated.to_string(), @"ab<[CD]ef");
        insta::assert_snapshot!(overwritten.to_string(), @"ab<CDef");
        insta::assert_snapshot!(updated.slice(2, 4).expect("slice"), @"[CD]");
    }

    #[test]
    fn reports_invalid_ranges_with_utf16_offsets() {
        let source = "a😀bc\nd😀ef";
        let mut string = MagicString::new(source);
        let end = length(source);

        string
            .overwrite(find(source, "d"), end, "X")
            .expect("overwrite");

        insta::assert_snapshot!(error(string.overwrite(find(source, "e"), end, "Y")), @r#"[MagicString] cannot split a chunk that has already been edited (1:3 – "d😀ef")"#);
        insta::assert_snapshot!(error(string.update(1, 1, "Y")), @"[MagicString] cannot overwrite a zero-length range at 1, use appendLeft() or prependRight()");
        insta::assert_snapshot!(error(string.overwrite(5, 1, "Y")), @"[MagicString] end must be greater than start (start: 3, end: 1)");
        insta::assert_snapshot!(error(string.remove(0, end + 2)), @"[MagicString] range 0–13 is out of bounds");
        insta::assert_snapshot!(error(string.overwrite(0, end + 1, "Y")), @"[MagicString] end 12 is out of bounds");
        insta::assert_snapshot!(error(string.slice(find(source, "e"), end)), @"[MagicString] cannot use edited character 9 as slice start anchor");
        insta::assert_snapshot!(error(string.slice(0, find(source, "e"))), @"[MagicString] cannot use edited character 9 as slice end anchor");
    }
}

mod bundle {
    use super::*;

    #[test]
    fn hoists_snipped_statements() {
        let css = ".a{}\n@-zyzz-ns- x url(é);\n.b{}";
        let (start, end) = (find(css, "@"), find(css, ";") + 1);
        let original = MagicString::with_filename(css, "bundle.css");
        let mut remaining = original.clone();
        let mut output = Bundle::new("");

        remaining.remove(start, end).expect("remove");
        output
            .add_source(original.snip(start, end).expect("snip"), Some("bundle.css"))
            .and_then(|bundle| bundle.add_source(remaining, Some("bundle.css")))
            .and_then(|bundle| bundle.add_source(MagicString::new("/* unnamed */"), None))
            .expect("sources");

        insta::assert_snapshot!(output.to_string(), @"
        @-zyzz-ns- x url(é);.a{}

        .b{}/* unnamed */
        ");
        insta::assert_snapshot!(
            output
                .generate_map(&MapOptions {
                    hires: true,
                    include_content: true,
                    source: None,
                })
                .to_json(),
            @r#"{"version":3,"sources":["bundle.css"],"sourcesContent":[".a{}\n@-zyzz-ns- x url(é);\n.b{}"],"names":[],"mappings":"AACA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CADnB,CAAC,CAAC,CAAC;;AAEH,CAAC,CAAC,CAAC"}"#
        );
        insta::assert_snapshot!(
            output
                .generate_map(&MapOptions {
                    hires: true,
                    ..MapOptions::default()
                })
                .to_json(),
            @r#"{"version":3,"sources":["bundle.css"],"sourcesContent":[null],"names":[],"mappings":"AACA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CADnB,CAAC,CAAC,CAAC;;AAEH,CAAC,CAAC,CAAC"}"#
        );
    }

    #[test]
    fn rejects_a_filename_with_different_content() {
        let mut output = Bundle::new("\n");

        output
            .add_source(MagicString::new("a"), Some("x.css"))
            .expect("first source");

        insta::assert_snapshot!(error(output.add_source(MagicString::new("b"), Some("x.css"))), @r#"[MagicString] duplicate filename "x.css" with different content, use unique filenames"#);
    }
}

mod to_encoded_map {
    use super::*;

    #[test]
    fn orders_segments_and_drops_trailing_empty_lines() {
        let mut empty = GenMapping::new(None);

        empty.add_mapping(&Mapping {
            generated: Position { column: 0, line: 3 },
            name: None,
            original: None,
            source: None,
        });

        insta::assert_snapshot!(encoded().to_encoded_map().to_json(), @r#"{"version":3,"file":"out.css","names":["card"],"sources":["b.ts","a.ts"],"sourcesContent":["b content",null],"mappings":"AAAAA,ICCC,ADCC;;E,G,CCMO;;;A","ignoreList":[]}"#);
        insta::assert_snapshot!(empty.to_encoded_map().to_json(), @r#"{"version":3,"names":[],"sources":[],"sourcesContent":[],"mappings":";;A","ignoreList":[]}"#);
    }
}

mod original_position_for {
    use super::*;

    #[test]
    fn finds_the_greatest_lower_bound() {
        let trace = TraceMap::new(&encoded().to_encoded_map());
        let mut output = String::new();

        for (line, column) in [
            (1, 0),
            (1, 3),
            (1, 4),
            (1, 9),
            (2, 0),
            (3, 1),
            (3, 3),
            (3, 7),
            (9, 0),
        ] {
            let found = trace.original_position_for(line, column).expect("position");

            writeln!(output, "{line} {column} {}", position(&found)).expect("write");
        }

        insta::assert_snapshot!(output, @r#"
        1 0 {"source":"b.ts","line":1,"column":0,"name":"card"}
        1 3 {"source":"b.ts","line":1,"column":0,"name":"card"}
        1 4 {"source":"a.ts","line":2,"column":1,"name":null}
        1 9 {"source":"b.ts","line":3,"column":2,"name":null}
        2 0 {"source":null,"line":null,"column":null,"name":null}
        3 1 {"source":null,"line":null,"column":null,"name":null}
        3 3 {"source":null,"line":null,"column":null,"name":null}
        3 7 {"source":"a.ts","line":9,"column":9,"name":null}
        9 0 {"source":null,"line":null,"column":null,"name":null}
        "#);
        insta::assert_snapshot!(error(trace.original_position_for(0, 0)), @"`line` must be greater than 0 (lines start at line 1)");
        insta::assert_snapshot!(error(trace.original_position_for(1, -1)), @"`column` must be greater than or equal to 0 (columns start at column 0)");
    }
}

mod mappings {
    use super::*;

    #[test]
    fn lists_segments_with_resolved_sources() {
        let trace = TraceMap::new(&encoded().to_encoded_map());
        let rooted = TraceMap::from_json(
            r#"{"version":3,"sourceRoot":"http://host/a/","sources":["../b/./c.ts",null,"/d.ts"],"names":[],"mappings":"AAAA,CCAA,CCAA"}"#,
        )
        .expect("map");
        let items: Vec<_> = trace
            .mappings()
            .map(|item| {
                serde_json::json!([
                    item.generated_line,
                    item.generated_column,
                    item.source,
                    item.original_line,
                    item.original_column,
                    item.name
                ])
            })
            .collect();

        insta::assert_snapshot!(serde_json::Value::Array(items), @r#"[[1,0,"b.ts",1,0,"card"],[1,4,"a.ts",2,1,null],[1,4,"b.ts",3,2,null],[3,2,null,null,null,null],[3,5,null,null,null,null],[3,6,"a.ts",9,9,null],[6,0,null,null,null,null]]"#);
        insta::assert_snapshot!(serde_json::json!(rooted.resolved_sources), @r#"["http://host/b/c.ts","http://host/a/","http://host/a/d.ts"]"#);
    }
}

mod resolve {
    use super::*;

    #[test]
    fn normalizes_relative_and_absolute_urls() {
        let mut output = String::new();

        for (input, base) in [
            ("dir/../a.ts", ""),
            ("./a/./b/../c", ""),
            ("../../x", ""),
            ("a/../..", ""),
            ("http://h/a/../b", ""),
            ("//cdn/x/./y", ""),
            ("/abs/../z", ""),
            ("?q", "http://h/p/f.js"),
            ("#h", "dir/f.js"),
            ("../x", "http://h/a/b/"),
            ("x", "//cdn/dir/file"),
            ("file:///C:/a/../b", ""),
            ("", ""),
        ] {
            writeln!(
                output,
                "{input:?} {base:?} {:?}",
                trace_mapping::resolve(input, base)
            )
            .expect("write");
        }

        insta::assert_snapshot!(output, @r##"
        "dir/../a.ts" "" "a.ts"
        "./a/./b/../c" "" "./a/c"
        "../../x" "" "../../x"
        "a/../.." "" ".."
        "http://h/a/../b" "" "http://h/b"
        "//cdn/x/./y" "" "//cdn/x/y"
        "/abs/../z" "" "/z"
        "?q" "http://h/p/f.js" "http://h/p/f.js?q"
        "#h" "dir/f.js" "dir/f.js#h"
        "../x" "http://h/a/b/" "http://h/a/x"
        "x" "//cdn/dir/file" "//cdn/dir/x"
        "file:///C:/a/../b" "" "file:///C:/b"
        "" "" ""
        "##);
    }
}

mod encode {
    use super::*;

    #[test]
    fn truncates_deltas_to_32_bits() {
        let mappings = vec![
            vec![
                Segment::mapped(0, 0, 0, 0),
                Segment {
                    column: 1 << 31,
                    original: Some(Original {
                        column: 3,
                        line: -(1 << 31),
                        name: Some(0),
                        source: 1,
                    }),
                },
            ],
            Vec::new(),
            vec![Segment::generated(5)],
        ];

        insta::assert_snapshot!(codec::encode(&mappings), @"AAAA,ACBGA;;K");
    }
}

mod decode {
    use super::*;

    #[test]
    fn reads_malformed_input_as_javascript_does() {
        let mut output = String::new();

        for input in [
            "AAAA;;CAAC,EAAE",
            "gggggggggC",
            "D,BA",
            "é,CAAA",
            "A,,A;",
            "",
        ] {
            let lines: Vec<String> = codec::decode(input)
                .iter()
                .map(|line| {
                    line.iter()
                        .map(|segment| match segment.original {
                            Some(original) => format!(
                                "[{},{},{},{}{}]",
                                segment.column,
                                original.source,
                                original.line,
                                original.column,
                                original
                                    .name
                                    .map(|name| format!(",{name}"))
                                    .unwrap_or_default()
                            ),
                            None => format!("[{}]", segment.column),
                        })
                        .collect::<Vec<_>>()
                        .join(",")
                })
                .collect();

            writeln!(
                output,
                "{input:?} [{}]",
                lines
                    .iter()
                    .map(|line| format!("[{line}]"))
                    .collect::<Vec<_>>()
                    .join(",")
            )
            .expect("write");
        }

        insta::assert_snapshot!(output, @r#"
        "AAAA;;CAAC,EAAE" [[[0,0,0,0]],[],[[1,0,0,1],[3,0,0,3]]]
        "gggggggggC" [[[8192]]]
        "D,BA" [[[-2147483649,0,0,0],[-1]]]
        "é,CAAA" [[[0],[1,0,0,0]]]
        "A,,A;" [[[0],[0,0,0,0]],[]]
        "" [[]]
        "#);
    }
}
