//! Grammar matching through the public `Lexer`: properties, syntax strings, at-rule preludes,
//! descriptors, and traces. Expectations, including iteration counts, come from css-tree 3.2.1.

use insta::assert_snapshot;
use zyzz_css_syntax::lexer::{LexerError, MatchResult};
use zyzz_css_syntax::{Context, Lexer, MatchValue, ParseOptions, Walk, parse, walk};

fn outcome(result: Result<MatchResult<'_>, LexerError>) -> String {
    match result {
        Ok(result) => match &result.error {
            Some(error) => format!("error ({}): {}", result.iterations, error.message()),
            None => format!("matched ({})", result.iterations),
        },
        Err(error) => format!("thrown: {error}"),
    }
}

#[test]
fn match_property_values() {
    let lexer = Lexer::get();

    assert_snapshot!(outcome(lexer.match_property("margin", "1px auto calc(2px + 3%)")), @"matched (49)");
    assert_snapshot!(outcome(lexer.match_property("color", "bogus")), @r"
    error (38): Mismatch
      syntax: <color>
       value: bogus
      --------^
    ");
    assert_snapshot!(outcome(lexer.match_property("width", "revert-layer")), @"matched (4)");
    assert_snapshot!(outcome(lexer.match_property("-webkit-width", "1px")), @"matched (12)");
    assert_snapshot!(outcome(lexer.match_property("color", "red \\9")), @"matched (22)");
}

#[test]
fn match_property_reports_inapplicable_values() {
    let lexer = Lexer::get();

    assert_snapshot!(outcome(lexer.match_property("color", "var(--x)")), @"error (0): Matching for a tree with var() is not supported");
    assert_snapshot!(outcome(lexer.match_property("--x", "red")), @"error (0): Lexer matching doesn't applicable for custom properties");
    assert_snapshot!(outcome(lexer.match_property("colour", "red")), @"error (0): Unknown property `colour`");
}

#[test]
fn match_syntax_strings() {
    let lexer = Lexer::get();

    assert_snapshot!(outcome(lexer.match_syntax("none | clamp | add", "auto")), @r"
    error (3): Mismatch
      syntax: none | clamp | add
       value: auto
      --------^
    ");
    assert_snapshot!(outcome(lexer.match_syntax("<string> <nope>", "\"a\" x")), @"thrown: Bad syntax reference: <nope>");
    assert_snapshot!(outcome(lexer.match_syntax("<string> ||", "\"a\"")), @r"
    thrown: Unexpected combinator
      <string> ||
    -------------^
    ");
}

#[test]
fn match_atrule_preludes() {
    let lexer = Lexer::get();

    assert_snapshot!(outcome(lexer.match_atrule_prelude("media", "(color); @import \"bad.css\"")), @r#"
    error (919): Mismatch
      syntax: <media-query-list>
       value: (color); @import "bad.css"
      ---------------^
    "#);
    assert_snapshot!(outcome(lexer.match_atrule_prelude("document", "domain(123)")), @r"
    error (30): Mismatch
      syntax: [ <url> | url-prefix( <string> ) | domain( <string> ) | media-document( <string> ) | regexp( <string> ) ]#
       value: domain(123)
      ---------------^
    ");
    assert_snapshot!(outcome(lexer.match_atrule_prelude("page", "")), @"matched (5)");
    assert_snapshot!(outcome(lexer.match_atrule_prelude("font-face", "x")), @"error (0): At-rule `@font-face` should not contain a prelude");
    assert_snapshot!(outcome(lexer.match_atrule_prelude("function", "--f()")), @"error (0): Unknown at-rule `@function`");
    assert_snapshot!(outcome(lexer.match_atrule_prelude("keyframes", "")), @"error (0): At-rule `@keyframes` should contain a prelude");
}

#[test]
fn match_atrule_descriptors() {
    let lexer = Lexer::get();

    assert_snapshot!(outcome(lexer.match_atrule_descriptor("counter-style", "pad", "nope")), @r"
    error (100): Mismatch
      syntax: <integer [0,∞]> && <symbol>
       value: nope
      --------^
    ");
    assert_snapshot!(outcome(lexer.match_atrule_descriptor("font-face", "font-weight", "garbage")), @r"
    error (11): Mismatch
      syntax: <font-weight-absolute>{1,2}
       value: garbage
      --------^
    ");
    assert_snapshot!(outcome(lexer.match_atrule_descriptor("font-face", "colour", "red")), @"error (0): Unknown at-rule descriptor `colour`");
    assert_snapshot!(outcome(lexer.match_atrule_descriptor("media", "x", "y")), @"error (0): At-rule `@media` has no known descriptors");
}

#[test]
fn match_atrule_descriptor_nodes_with_traces() {
    let lexer = Lexer::get();
    let invalid = parse("-1 red", &ParseOptions::context(Context::Value)).expect("value parses");

    assert_snapshot!(outcome(lexer.match_atrule_descriptor("font-palette-values", "override-colors", MatchValue::Node(&invalid, invalid.root()))), @r"
    error (8): Mismatch
      syntax: [ <integer [0,∞]> <color> ]#
       value: -1 red
      --------^
    ");

    let value = parse(
        "0 color-mix(in srgb, red, currentColor), 1 #fff",
        &ParseOptions::context(Context::Value),
    )
    .expect("value parses");
    let result = lexer
        .match_atrule_descriptor(
            "font-palette-values",
            "override-colors",
            MatchValue::Node(&value, value.root()),
        )
        .expect("matching does not throw");
    let mut lines = Vec::new();

    walk(&value, value.root(), |id, node| {
        let trace = result.trace(id).map_or_else(
            || "null".to_owned(),
            |entries| {
                if entries.is_empty() {
                    return "[]".to_owned();
                }

                entries
                    .iter()
                    .map(|entry| format!("{}:{}", entry.kind.as_str(), entry.name))
                    .collect::<Vec<_>>()
                    .join(" > ")
            },
        );

        lines.push(format!("{}: {trace}", node.type_name()));
        Walk::Continue
    });

    assert_snapshot!(lines.join("\n"), @r"
    Value: null
    Number: Type:integer
    Function: Type:color > Type:color-base > Type:color-mix()
    Identifier: Type:color > Type:color-base > Type:color-mix() > Type:color-interpolation-method > Keyword:in
    Identifier: Type:color > Type:color-base > Type:color-mix() > Type:color-interpolation-method > Type:rectangular-color-space > Keyword:srgb
    Operator: Type:color > Type:color-base > Type:color-mix()
    Identifier: Type:color > Type:color-base > Type:color-mix() > Type:color > Type:color-base > Type:named-color > Keyword:red
    Operator: Type:color > Type:color-base > Type:color-mix()
    Identifier: Type:color > Type:color-base > Type:color-mix() > Type:color > Keyword:currentColor
    Operator: []
    Number: Type:integer
    Hash: Type:color > Type:color-base > Type:hex-color
    ");
}
