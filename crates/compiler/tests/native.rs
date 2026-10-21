//! Verifies native module compilation from extracted definitions to rewritten source, adapter
//! edits, and recipe tables. Expected values come from the TypeScript compiler on the same
//! sources, whose extraction names definitions by module hash and UTF-16 offset.

use std::sync::Arc;

use compiler::compiler::internal::packed_styles;
use compiler::compiler::internal::syntax;
use compiler::compiler::internal::themes::{self, Context, Link, LinkKind, Output};
use compiler::compiler::native::{self, Options};
use compiler::compiler::source::{Call, Extracted};
use compiler::data::{Data, Object};
use compiler::error::Error;
use compiler::internal::recipe;
use compiler::internal::theme::{ClassName, Definition};
use compiler::internal::token::{Contract, Metadata};
use compiler::js::{self, Record};
use compiler::style::{self, NamedStyle};
use oxc_allocator::Allocator;
use rustc_hash::FxHashSet;
use serde_json::{Value as Json, json};

/// Converts JSON text into statically evaluated data, keeping key order.
fn data(json: &str) -> Data {
    fn convert(value: &Json) -> Data {
        match value {
            Json::Null => Data::Null,
            Json::Bool(value) => Data::Bool(*value),
            Json::Number(number) => Data::Number(number.as_f64().unwrap_or(f64::NAN)),
            Json::String(text) => Data::string(text.as_str()),
            Json::Array(items) => Data::Array(Arc::new(items.iter().map(convert).collect())),
            Json::Object(object) => Data::from(Object::from_entries(
                object
                    .iter()
                    .map(|(key, value)| (Arc::from(key.as_str()), convert(value))),
            )),
        }
    }

    convert(&serde_json::from_str(json).expect("valid JSON"))
}

/// Validated styles of one definition.
fn styles(name: &str, declarations: &str) -> Vec<Arc<NamedStyle>> {
    let json = format!("{{{}:{declarations}}}", js::quote(name));

    style::define(&data(&json), &style::Options::default())
        .expect("valid styles")
        .styles
}

/// The extraction of plain definition calls, each given by its call text, extracted name, and
/// declarations. Calls appear in source order.
fn extracted<'a>(source: &str, definitions: &[(&str, &str, &str)]) -> Extracted<'a> {
    let mut calls = Vec::new();
    let mut definition = style::Definition::default();
    let mut from = 0;

    for (text, name, declarations) in definitions {
        let start = from + source[from..].find(text).expect("call text");

        from = start + text.len();

        calls.push(Call {
            end: u32::try_from(start + text.len()).expect("offset"),
            name: Arc::from(*name),
            start: u32::try_from(start).expect("offset"),
            ..Call::default()
        });
        definition.styles.extend(styles(name, declarations));
    }

    Extracted {
        calls,
        collected_themes: false,
        contribution_calls: Vec::new(),
        contribution_starts: Vec::new(),
        contributions: Vec::new(),
        namespaces: Vec::new(),
        native_vars: Vec::new(),
        static_theme_references: Vec::new(),
        styles: definition,
        theme_aliases: Vec::new(),
        theme_appearances: Vec::new(),
        theme_calls: Vec::new(),
        theme_exports: None,
        theme_references: Vec::new(),
        theme_scripts: Vec::new(),
        theme_selections: Vec::new(),
        variable_calls: Vec::new(),
        vars: Record::new(),
    }
}

/// Edits serialized as the TypeScript compiler's `JSON.stringify` writes them.
fn edits(output: &native::Output) -> String {
    Json::Array(
        output
            .edits
            .iter()
            .map(|edit| {
                json!({
                    "start": edit.start,
                    "end": edit.end,
                    "code": edit.code,
                    "expression": edit.expression,
                })
            })
            .collect(),
    )
    .to_string()
}

/// Recipe tables serialized as `JSON.stringify(output.recipes)`.
fn recipes(output: &native::Output) -> String {
    let mut json = String::new();

    js::write_object(&mut json, output.recipes.iter(), |output, definition| {
        definition.write_json(output);
    });
    json
}

fn compile(
    options: &Options<'_, '_>,
    definitions: &[(&str, &str, &str)],
) -> Result<native::Output, Error> {
    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, options.source, options.module_id);

    native::compile(options, &extracted(options.source, definitions), &parsed)
}

mod compile {
    use super::*;

    #[test]
    fn selects_static_tables_for_the_compiled_scheme() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "card.ts",
            source: "import {style} from 'zyzz';export const card=style({opacity:0.5});",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[(
                "style({opacity:0.5})",
                "style-1slxe42dbli7u-45",
                r#"{"opacity":0.5}"#,
            )],
        )
        .expect("compiles");

        insta::assert_snapshot!(output.code, @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';




        import {style} from 'zyzz';export const card=(__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}}) as import('zyzz/runtime').Native.Callable<{}>);
        "#);
        insta::assert_snapshot!(edits(&output), @r#"[{"start":45,"end":65,"code":"(__zyzzNative.create({\"axes\":{},\"defaults\":{},\"styles\":{\"0\":{\"opacity\":0.5}}}) as import('zyzz/runtime').Native.Callable<{}>)","expression":true},{"start":0,"end":0,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\n\n","expression":false}]"#);
        insta::assert_snapshot!(recipes(&output), @r#"{"style-1slxe42dbli7u-45":{"axes":{},"defaults":{},"styles":{"default":{"light":{"0":{"opacity":0.5}},"dark":{"0":{"opacity":0.5}}}}}}"#);
    }

    #[test]
    fn shares_table_factories_in_runtime_output() {
        let options = Options {
            color_scheme: Some("dark"),
            module_id: "cards.js",
            runtime: true,
            source: "import {style} from 'zyzz';const a=style({opacity:0.25});const b=style({opacity:0.25});export const all=[a(),b()];",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[
                (
                    "style({opacity:0.25})",
                    "style-1flh14t4f56k3-35",
                    r#"{"opacity":0.25}"#,
                ),
                (
                    "style({opacity:0.25})",
                    "style-1flh14t4f56k3-65",
                    r#"{"opacity":0.25}"#,
                ),
            ],
        )
        .expect("compiles");

        insta::assert_snapshot!(output.code, @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';
        const __zyzzNativeFactory0=(v0)=>__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":v0}}});



        import {style} from 'zyzz';const a=__zyzzNativeFactory0(0.25);const b=__zyzzNativeFactory0(0.25);export const all=[a(),b()];
        "#);
        insta::assert_snapshot!(edits(&output), @r#"[{"start":35,"end":56,"code":"__zyzzNativeFactory0(0.25)","expression":true},{"start":65,"end":86,"code":"__zyzzNativeFactory0(0.25)","expression":true},{"start":0,"end":0,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\nconst __zyzzNativeFactory0=(v0)=>__zyzzNative.create({\"axes\":{},\"defaults\":{},\"styles\":{\"0\":{\"opacity\":v0}}});\n\n\n\n","expression":false}]"#);
    }

    #[test]
    fn retains_every_set_and_scheme_in_contextual_output() {
        let options = Options {
            color_scheme: Some("light"),
            contextual: true,
            module_id: "cards.ts",
            source: "import {style} from 'zyzz';const a=style({opacity:0.25});const b=style({opacity:0.5});",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[
                (
                    "style({opacity:0.25})",
                    "style-1fkjajbusomzp-35",
                    r#"{"opacity":0.25}"#,
                ),
                (
                    "style({opacity:0.5})",
                    "style-1fkjajbusomzp-65",
                    r#"{"opacity":0.5}"#,
                ),
            ],
        )
        .expect("compiles");

        insta::assert_snapshot!(output.code, @r#"

        import {Native as __zyzzNative,NativeContext as __zyzzNativeContext} from 'zyzz/runtime';

        const __zyzzNativeContextFactory0=<const T0 extends (input:never)=>import('zyzz/runtime').Native.Props<object>,>(__zyzzNativeTable0:T0)=>__zyzzNativeContext.create({"default":{"light":__zyzzNativeTable0,"dark":__zyzzNativeTable0}},"default");


        import {style} from 'zyzz';const a=__zyzzNativeContextFactory0((__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.25}}}) as import('zyzz/runtime').Native.Callable<{}>));const b=__zyzzNativeContextFactory0((__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}}) as import('zyzz/runtime').Native.Callable<{}>));
        "#);
        insta::assert_snapshot!(recipes(&output), @r#"{"style-1fkjajbusomzp-35":{"axes":{},"defaults":{},"styles":{"default":{"light":{"0":{"opacity":0.25}},"dark":{"0":{"opacity":0.25}}}}},"style-1fkjajbusomzp-65":{"axes":{},"defaults":{},"styles":{"default":{"light":{"0":{"opacity":0.5}},"dark":{"0":{"opacity":0.5}}}}}}"#);
    }

    #[test]
    fn binds_cx_imports_and_reexports_to_the_runtime_composer() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "compose.ts",
            source: "import {cx,style as s} from 'zyzz';export {cx as mix,style} from 'zyzz';export const props=cx({style:{opacity:1}});",
            ..Options::default()
        };
        let output = compile(&options, &[]).expect("compiles");

        insta::assert_snapshot!(output.code, @r"

        import {Native as __zyzzNative} from 'zyzz/runtime';



        const cx=__zyzzNative.compose;
        const __zyzzNativeCompose=__zyzzNative.compose;
        import {style as s} from 'zyzz';export {style} from 'zyzz';export {__zyzzNativeCompose as mix};export const props=cx({style:{opacity:1}});
        ");
        insta::assert_snapshot!(edits(&output), @r#"[{"start":0,"end":35,"code":"import {style as s} from 'zyzz';","expression":false},{"start":35,"end":72,"code":"export {style} from 'zyzz';export {__zyzzNativeCompose as mix};","expression":false},{"start":0,"end":0,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\nconst cx=__zyzzNative.compose;\nconst __zyzzNativeCompose=__zyzzNative.compose;\n","expression":false}]"#);
        insta::assert_snapshot!(recipes(&output), @"{}");
    }

    #[test]
    fn places_the_prelude_after_the_hashbang_and_directives() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "prologue.js",
            source: "#!/usr/bin/env node\n'use client';\nimport {style} from 'zyzz';const card=style({opacity:0.5});",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[(
                "style({opacity:0.5})",
                "style-oupwfl1hkyodd-72",
                r#"{"opacity":0.5}"#,
            )],
        )
        .expect("compiles");

        insta::assert_snapshot!(output.code, @r#"
        #!/usr/bin/env node
        'use client';
        import {Native as __zyzzNative} from 'zyzz/runtime';





        import {style} from 'zyzz';const card=__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}});
        "#);
        insta::assert_snapshot!(edits(&output), @r#"[{"start":72,"end":92,"code":"__zyzzNative.create({\"axes\":{},\"defaults\":{},\"styles\":{\"0\":{\"opacity\":0.5}}})","expression":true},{"start":33,"end":33,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\n\n","expression":false}]"#);
    }

    #[test]
    fn reports_edits_and_maps_in_utf16_offsets() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "unicode.js",
            source: "/* 😀 */import {style} from 'zyzz';const card=style({opacity:0.5});",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[(
                "style({opacity:0.5})",
                "style-dox5ihvhnhuz-46",
                r#"{"opacity":0.5}"#,
            )],
        )
        .expect("compiles");

        insta::assert_snapshot!(edits(&output), @r#"[{"start":46,"end":66,"code":"__zyzzNative.create({\"axes\":{},\"defaults\":{},\"styles\":{\"0\":{\"opacity\":0.5}}})","expression":true},{"start":0,"end":0,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\n\n","expression":false}]"#);
        insta::assert_snapshot!(output.map, @r#"{"version":3,"sources":["unicode.js"],"sourcesContent":["/* 😀 */import {style} from 'zyzz';const card=style({opacity:0.5});"],"names":[],"mappings":";;;;;;AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,6EAAoB"}"#);
        insta::assert_snapshot!(recipes(&output), @r#"{"style-dox5ihvhnhuz-46":{"axes":{},"defaults":{},"styles":{"default":{"light":{"0":{"opacity":0.5}},"dark":{"0":{"opacity":0.5}}}}}}"#);
    }

    #[test]
    fn names_helpers_around_module_identifiers() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "collisions.js",
            source: "import {style} from 'zyzz';const __zyzzNativeStatic=1;const card=style({opacity:0.5});",
            ..Options::default()
        };
        let output = compile(
            &options,
            &[(
                "style({opacity:0.5})",
                "style-1oqdulp4ew72d-65",
                r#"{"opacity":0.5}"#,
            )],
        )
        .expect("compiles");

        insta::assert_snapshot!(output.code, @r#"

        import {Native as __zyzzNative_} from 'zyzz/runtime';




        import {style} from 'zyzz';const __zyzzNativeStatic=1;const card=__zyzzNative_.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}});
        "#);
    }

    #[test]
    fn overlays_packed_library_exports_without_replacing_explicit_ones() {
        let style = styles("card", r#"{"opacity":0.5}"#);
        let link = Link {
            binding: "card".into(),
            call: themes::Call::default(),
            definition: Arc::new(Definition {
                class_name: ClassName::Contract,
                metadata: Metadata {
                    contract: Arc::new(Contract::default()),
                    css_name: None,
                    paths: None,
                    queries: None,
                    values: Arc::default(),
                },
                tokens: Data::Undefined,
                vars: Data::Undefined,
            }),
            kind: LinkKind::StyleReference,
            members: None,
            style: Some(Arc::new(packed_styles::Definition {
                attributes: Vec::new(),
                class_name: None,
                dynamic: None,
                native_context: None,
                output: None,
                packed: true,
                prefixes: Vec::new(),
                slots: Vec::new(),
                static_recipe: Some(recipe::Definition {
                    axes: Vec::new(),
                    defaults: Vec::new(),
                    rules: vec![recipe::Rule {
                        matches: Vec::new(),
                        value: style::Definition {
                            labels: None,
                            styles: style.clone(),
                        },
                    }],
                }),
                style: style.first().cloned().unwrap_or_default(),
            })),
        };
        let mut exports = Record::new();
        let mut libraries = Record::new();

        exports.insert("card", link);
        libraries.insert("library", exports);

        let context = Context {
            constants: None,
            factories: None,
            identifiers: Some(FxHashSet::default()),
            libraries: Some(libraries),
            links: Record::new(),
            owners: None,
            style_classes: None,
        };
        let options = Options {
            color_scheme: Some("light"),
            context: Some(&context),
            module_id: "app.js",
            source: "import {card,other} from 'library';export * from 'library';export const a=card();",
            ..Options::default()
        };
        let output = compile(&options, &[]).expect("compiles");

        insta::assert_snapshot!(output.code, @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';



        const card=__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}});
        const __zyzzNativeExport1=__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}});export {__zyzzNativeExport1 as "card"};
        import {other} from "library";export * from 'library';export const a=card();
        "#);
    }

    #[test]
    fn rejects_web_controls_html_output_and_star_reexports_from_zyzz() {
        let options = Options {
            color_scheme: Some("light"),
            module_id: "star.js",
            source: "export * from 'zyzz';",
            ..Options::default()
        };

        insta::assert_snapshot!(compile(&options, &[]).expect_err("rejects").text(), @"Native modules require named re-exports from zyzz.");

        let options = Options {
            source: "import {style} from 'zyzz';const card=style({opacity:0.5});",
            ..options
        };
        let allocator = Allocator::default();
        let parsed = syntax::parse(&allocator, options.source, options.module_id);
        let mut module = extracted(
            options.source,
            &[("style({opacity:0.5})", "card", r#"{"opacity":0.5}"#)],
        );

        module.theme_selections.push("config".into());

        let error = native::compile(&options, &module, &parsed).expect_err("rejects");

        assert!(matches!(error, Error::Native(_)));
        insta::assert_snapshot!(error.text(), @"Native static modules do not support CSS contributions, variables, or web set controls.");

        module.theme_selections.clear();

        if let Some(call) = module.calls.first_mut() {
            call.output = Some(Output::Html);
        }

        let error = native::compile(&options, &module, &parsed).expect_err("rejects");

        insta::assert_snapshot!(error.text(), @"Native source compilation does not support named conditions or HTML output.");
    }
}
