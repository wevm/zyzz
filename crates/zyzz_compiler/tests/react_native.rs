//! Verifies native table compilation, recipe selection tables, and runtime encodings through the
//! public crate functions, from authored data to the JSON the native compiler emits.

use std::sync::Arc;

use serde_json::Value as Json;
use zyzz_compiler::data::{Data, Object};
use zyzz_compiler::error::Error;
use zyzz_compiler::internal::recipe;
use zyzz_compiler::react_native::internal::scalar::{self, Value};
use zyzz_compiler::react_native::internal::{calculation, color};
use zyzz_compiler::react_native::style_sheet::{self, Options, Tables};
use zyzz_compiler::react_native::variants;
use zyzz_compiler::runtime::internal::native_media::{self, Operand, Operator, Query};
use zyzz_compiler::runtime::{appearance, native, native_dynamic, native_static, native_vars};
use zyzz_compiler::style;
use zyzz_compiler::vars;

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

/// Reads a nested property, such as a token reference from a variable set.
fn read(value: &Data, path: &[&str]) -> Data {
    path.iter().fold(value.clone(), |node, key| {
        node.as_object()
            .and_then(|object| object.get(key))
            .cloned()
            .unwrap_or(Data::Undefined)
    })
}

fn object(entries: &[(&str, Data)]) -> Data {
    Data::from(Object::from_entries(
        entries
            .iter()
            .map(|(key, value)| (Arc::from(*key), value.clone())),
    ))
}

fn define(styles: &Data) -> style::Definition {
    style::define(styles, &style::Options::default()).expect("valid styles")
}

fn json(tables: &Tables) -> String {
    let mut output = String::new();

    tables.write_json(&mut output);
    output
}

fn table(tables: &Tables, set: &str, scheme: &str) -> Arc<Object> {
    style_sheet::select(tables, set, Some(scheme)).expect("existing table")
}

fn style(table: &Object, name: &str) -> String {
    let mut output = String::new();

    if let Some(Data::Object(style)) = table.get(name) {
        style_sheet::write_table(&mut output, style);
    }

    output
}

fn same(left: &Object, right: &Object, name: &str) -> bool {
    match (left.get(name), right.get(name)) {
        (Some(Data::Object(left)), Some(Data::Object(right))) => Arc::ptr_eq(left, right),
        _ => false,
    }
}

mod compile {
    use super::*;

    #[test]
    fn converts_shorthands_colors_and_line_heights() {
        let styles = define(&data(
            r#"{"card":{"padding":"1px 2px","margin":"-1rem calc(2px * 3)","color":"hsl(120deg 100% 50%)","fontSize":"10px","lineHeight":1.5,"flex":"2 1 10px","borderRadius":"4px","gap":"1px","inset":"0 50%"}}"#,
        ));
        let output = style_sheet::compile(
            &styles,
            &Options {
                units: data(r#"{"px":2,"rem":20}"#),
                ..Options::default()
            },
        )
        .expect("native styles");

        insta::assert_snapshot!(style(&table(&output, "default", "light"), "card"), @r##"{"paddingTop":2,"paddingRight":4,"paddingBottom":2,"paddingLeft":4,"marginTop":-20,"marginRight":12,"marginBottom":-20,"marginLeft":12,"color":"#00ff00ff","fontSize":20,"flexBasis":20,"flexGrow":2,"flexShrink":1,"borderTopLeftRadius":8,"borderTopRightRadius":8,"borderBottomRightRadius":8,"borderBottomLeftRadius":8,"columnGap":2,"rowGap":2,"top":0,"right":"50%","bottom":0,"left":"50%","lineHeight":30}"##);
    }

    #[test]
    fn converts_transforms_shadows_and_origins() {
        let styles = define(&data(
            r#"{"card":{"transform":"translate(8px, -4px) rotate(0.25turn) scale(2)","transformOrigin":"top left","boxShadow":"inset 1rem -2px 3px -1px rgb(100% 0% 0% / 50%), 0 1px blue","textShadow":"1px -2px 3px hsl(120deg 100% 50%)","fontVariant":"small-caps tabular-nums"},"matrix":{"transform":"matrix(1,2,3,4,5,6) translate(8px,-4px) scale(2,3)"}}"#,
        ));
        let output = style_sheet::compile(
            &styles,
            &Options {
                units: data(r#"{"px":2,"rem":20}"#),
                ..Options::default()
            },
        )
        .expect("native styles");
        let light = table(&output, "default", "light");

        insta::assert_snapshot!(style(&light, "card"), @r##"{"transform":[{"translateX":16},{"translateY":-8},{"rotate":"90deg"},{"scale":2}],"transformOrigin":["0%","0%",0],"boxShadow":[{"offsetX":20,"offsetY":-4,"blurRadius":6,"spreadDistance":-2,"color":"#ff000080","inset":true},{"offsetX":0,"offsetY":2,"blurRadius":0,"spreadDistance":0,"color":"blue","inset":false}],"textShadowColor":"#00ff00ff","textShadowOffset":{"width":2,"height":-4},"textShadowRadius":6,"fontVariant":["small-caps","tabular-nums"]}"##);
        insta::assert_snapshot!(style(&light, "matrix"), @r#"{"transform":[{"matrix":[2,4,0,0,9,12,0,0,0,0,1,0,2,12,0,1]}]}"#);
    }

    #[test]
    fn composes_rotations_and_skews_with_engine_trigonometry() {
        // These angles round differently in common libm implementations than in V8.
        let styles = define(&data(
            r#"{"card":{"transform":"matrix(1,0,0,1,5,6) rotate(-705.6deg) rotateX(-663.8deg) skewY(-20deg) perspective(500px)"}}"#,
        ));
        let output = style_sheet::compile(&styles, &Options::default()).expect("native styles");

        insta::assert_snapshot!(style(&table(&output, "default", "light"), "card"), @r#"{"transform":[{"matrix":[1.0189366573464582,0.05257596754973373,-0.3024536119533534,0,-0.13834509384907342,0.5388185657832816,0.8309844692743291,0,0.19665743389957888,-0.8168775640985277,0.5562956155003035,-0.002,5,6,0,1]}]}"#);
    }

    #[test]
    fn compiles_set_and_scheme_tables_with_shared_identities() {
        let set = vars::define(
            &data(r##"{"color":{"ink":{"light":"#000","dark":"#fff"},"paper":"white"}}"##),
            None,
            None,
        )
        .expect("variable set");
        let tokens = Data::Theme(Arc::new(set.clone()));
        let styles = define(&object(&[
            (
                "text",
                object(&[("color", read(&set.tokens, &["color", "ink"]))]),
            ),
            (
                "paper",
                object(&[("backgroundColor", read(&set.tokens, &["color", "paper"]))]),
            ),
            ("plain", object(&[("opacity", Data::Number(0.5))])),
        ]));
        let output = style_sheet::compile(
            &styles,
            &Options {
                vars: object(&[("brand", tokens)]),
                ..Options::default()
            },
        )
        .expect("native styles");
        let light = table(&output, "brand", "light");
        let dark = table(&output, "brand", "dark");

        insta::assert_snapshot!(json(&output), @r##"{"brand":{"light":{"text":{"color":"#000"},"paper":{"backgroundColor":"white"},"plain":{"opacity":0.5}},"dark":{"text":{"color":"#fff"},"paper":{"backgroundColor":"white"},"plain":{"opacity":0.5}}}}"##);
        insta::assert_snapshot!(
            format!(
                "text {} paper {} plain {}",
                same(&light, &dark, "text"),
                same(&light, &dark, "paper"),
                same(&light, &dark, "plain"),
            ),
            @"text false paper true plain true"
        );

        let scalar = style_sheet::compile(
            &define(&data(r#"{"card":{"opacity":0.5}}"#)),
            &Options {
                vars: object(&[
                    ("one", Data::Theme(Arc::new(set.clone()))),
                    ("two", Data::Theme(Arc::new(set))),
                ]),
                ..Options::default()
            },
        )
        .expect("native styles");

        // Scalar-only definitions share one table across every set and scheme.
        insta::assert_snapshot!(
            Arc::ptr_eq(&table(&scalar, "one", "light"), &table(&scalar, "two", "dark")),
            @"true"
        );
    }

    #[test]
    fn applies_native_and_platform_branches_in_order() {
        let styles = define(&data(
            r#"{"card":{"opacity":0.2,"lineHeight":1.5,"fontSize":"10px","targets":{"native":{"opacity":0.5,"lineHeight":12},"ios":{"opacity":0.7}}}}"#,
        ));
        let ios = style_sheet::compile(
            &styles,
            &Options {
                platform: Data::from("ios"),
                ..Options::default()
            },
        )
        .expect("native styles");
        let android = style_sheet::compile(
            &styles,
            &Options {
                platform: Data::from("android"),
                ..Options::default()
            },
        )
        .expect("native styles");

        insta::assert_snapshot!(style(&table(&ios, "default", "light"), "card"), @r#"{"opacity":0.7,"fontSize":10,"lineHeight":12}"#);
        insta::assert_snapshot!(style(&table(&android, "default", "light"), "card"), @r#"{"opacity":0.5,"fontSize":10,"lineHeight":12}"#);

        let error = style_sheet::compile(&styles, &Options::default()).expect_err("platform");

        insta::assert_snapshot!(error.text(), @r#"["card","targets"]: Platform branches require an explicit platform."#);
    }

    #[test]
    fn reports_every_declaration_diagnostic_in_order() {
        let styles = define(&data(
            r#"{"card":{"color":"currentColor","padding":"1em","fontFamily":"Inter","lineHeight":1.5,"transform":"skew(10deg)"}}"#,
        ));
        let error = style_sheet::compile(&styles, &Options::default()).expect_err("diagnostics");

        insta::assert_snapshot!(error.text(), @r#"
        ["default","light","card","color"]: Use an absolute sRGB color supported by native conversion.
        ["default","light","card","padding"]: Use zero, px, or rem with an explicit rem conversion.
        ["default","light","card","fontFamily"]: Provide an explicit fonts mapping for this family.
        ["default","light","card","transform","skew"]: Transform function is outside the native subset.
        ["default","light","card","lineHeight"]: Numeric lineHeight requires an explicit fontSize in the same style.
        ["default","dark","card","color"]: Use an absolute sRGB color supported by native conversion.
        ["default","dark","card","padding"]: Use zero, px, or rem with an explicit rem conversion.
        ["default","dark","card","fontFamily"]: Provide an explicit fonts mapping for this family.
        ["default","dark","card","transform","skew"]: Transform function is outside the native subset.
        ["default","dark","card","lineHeight"]: Numeric lineHeight requires an explicit fontSize in the same style.
        "#);

        let Error::StyleSheet(diagnostics) = error else {
            panic!("expected StyleSheet.CompileError");
        };

        insta::assert_snapshot!(
            diagnostics
                .iter()
                .map(|diagnostic| diagnostic.code.as_str())
                .collect::<Vec<_>>()
                .join(" "),
            @"unsupported_value unsupported_value unsupported_value unsupported_feature unsupported_value unsupported_value unsupported_value unsupported_value unsupported_feature unsupported_value"
        );
    }

    #[test]
    fn rejects_options_and_structures_outside_the_native_boundary() {
        let styles = define(&data(r#"{"card":{"padding":"1px"}}"#));
        let failures = [
            Options {
                units: data(r#"{"px":0}"#),
                ..Options::default()
            },
            Options {
                platform: Data::from("web"),
                ..Options::default()
            },
            Options {
                fonts: data(r#"{"Inter":" "}"#),
                ..Options::default()
            },
            Options {
                vars: data("{}"),
                ..Options::default()
            },
            Options {
                vars: data(r#"{"brand":1}"#),
                ..Options::default()
            },
        ]
        .iter()
        .map(|options| {
            style_sheet::compile(&styles, options)
                .err()
                .map(|error| error.text())
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join("\n");

        insta::assert_snapshot!(failures, @r#"
        ["units","px"]: Unit scales must be positive finite px or rem conversions.
        ["platform"]: Expected an explicit ios or android platform.
        ["fonts","Inter"]: Font mappings require nonempty family names.
        ["vars"]: Supply at least one set, or omit vars for a default table.
        ["vars","brand"]: Expected a Theme.define or Config set handle.
        "#);

        let nested = define(&data(r#"{"card":{":hover":{"opacity":0.5}}}"#));
        let error = style_sheet::compile(&nested, &Options::default()).expect_err("conditions");

        insta::assert_snapshot!(error.text(), @r#"["card"]: Selectors, queries, and nested rules are not supported on native."#);
    }
}

mod select {
    use super::*;

    #[test]
    fn returns_the_compiled_table_and_rejects_unknown_selections() {
        let output = style_sheet::compile(
            &define(&data(r#"{"card":{"opacity":1}}"#)),
            &Options::default(),
        )
        .expect("native styles");
        let selected = style_sheet::select(&output, "default", Some("dark")).expect("table");

        insta::assert_snapshot!(Arc::ptr_eq(&selected, &output.sets[0].1.dark), @"true");

        let errors = [
            ("missing", Some("light")),
            ("default", Some("dim")),
            ("default", None),
        ]
        .iter()
        .map(|(set, scheme)| {
            style_sheet::select(&output, set, *scheme)
                .err()
                .map(|error| error.text())
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join("\n");

        insta::assert_snapshot!(errors, @"
        Select an existing set label and light or dark colorScheme.
        Select an existing set label and light or dark colorScheme.
        Select an existing set label and light or dark colorScheme.
        ");
    }
}

mod variants_compile {
    use super::*;

    fn recipe() -> recipe::Definition {
        let rule = |matches: recipe::Matches, json: &str| recipe::Rule {
            matches,
            value: define(&data(json)),
        };
        let choices = |axis: &str, values: &[&str]| -> (Arc<str>, Vec<Arc<str>>) {
            (
                axis.into(),
                values.iter().map(|value| Arc::from(*value)).collect(),
            )
        };

        recipe::Definition {
            axes: vec![
                choices("size", &["small", "large"]),
                choices("active", &["true", "false"]),
            ],
            defaults: vec![
                ("size".into(), Some("small".into())),
                ("active".into(), Some("false".into())),
            ],
            rules: vec![
                rule(
                    Vec::new(),
                    r#"{"base":{"fontSize":"10px","lineHeight":1.5,"targets":{"native":{"opacity":0.2}}}}"#,
                ),
                rule(
                    vec![choices("size", &["small"])],
                    r#"{"small":{"fontSize":"12px"}}"#,
                ),
                rule(
                    vec![choices("size", &["large"])],
                    r#"{"large":{"fontSize":"20px"}}"#,
                ),
                rule(
                    vec![choices("active", &["true"])],
                    r#"{"on":{"opacity":0.5}}"#,
                ),
                rule(
                    vec![choices("size", &["large"]), choices("active", &["true"])],
                    r#"{"both":{"targets":{"native":{"transform":[{"rotate":"90deg"}]}}}}"#,
                ),
            ],
        }
    }

    #[test]
    fn compiles_every_mixed_radix_selection() {
        let definition = variants::compile(&recipe(), &Options::default()).expect("recipe tables");
        let light = table(&definition.styles, "default", "light");

        insta::assert_snapshot!(light.len(), @"9");
        insta::assert_snapshot!(style(&light, "1"), @r#"{"fontSize":20,"opacity":0.5,"transform":[{"rotate":"90deg"}],"lineHeight":30}"#);
        insta::assert_snapshot!(style(&light, "8"), @r#"{"fontSize":10,"opacity":0.2,"lineHeight":15}"#);

        let mut output = String::new();

        definition.write_json(&mut output);
        insta::assert_snapshot!(output.get(..80).unwrap_or_default(), @r#"{"axes":{"size":["small","large"],"active":["true","false"]},"defaults":{"size":"#);
    }

    #[test]
    fn rejects_invalid_and_unbounded_recipes() {
        let mut invalid = recipe();

        invalid.defaults = vec![("size".into(), Some("medium".into()))];

        let mut unbounded = recipe();

        unbounded.axes = (0..9)
            .map(|index| (Arc::from(format!("axis{index}")), vec![Arc::from("on")]))
            .collect();
        unbounded.defaults = Vec::new();
        unbounded.rules = Vec::new();

        let mut duplicate = recipe();

        duplicate.axes = vec![("size".into(), vec!["small".into(), "small".into()])];

        let errors = [invalid, unbounded, duplicate]
            .iter()
            .map(|recipe| {
                variants::compile(recipe, &Options::default())
                    .err()
                    .map(|error| error.text())
                    .unwrap_or_default()
            })
            .collect::<Vec<_>>()
            .join("\n");

        insta::assert_snapshot!(errors, @"
        Defaults must select a declared axis and choice.
        Native recipes support at most 256 selections, including null choices.
        Recipe axes require unique string choices.
        ");
    }
}

mod serialize {
    use super::*;

    fn fragments() -> Tables {
        style_sheet::compile(
            &define(&data(r#"{"0":{"opacity":0.5},"1":{"fontSize":"10px"}}"#)),
            &Options::default(),
        )
        .expect("native styles")
    }

    fn axes() -> recipe::Axes {
        vec![("tone".into(), vec!["quiet".into(), "loud".into()])]
    }

    #[test]
    fn writes_native_tables() {
        let options = native::Options {
            axes: axes(),
            defaults: vec![("tone".into(), None)],
            styles: table(&fragments(), "default", "light"),
        };

        insta::assert_snapshot!(options.to_json(), @r#"{"axes":{"tone":["quiet","loud"]},"defaults":{"tone":null},"styles":{"0":{"opacity":0.5},"1":{"fontSize":10}}}"#);
    }

    #[test]
    fn writes_static_programs() {
        let options = native_static::Options {
            axes: axes(),
            defaults: vec![("tone".into(), Some("quiet".into()))],
            rules: vec![native_static::Rule {
                matches: vec![("tone".into(), vec!["loud".into()])],
                steps: vec![
                    native_static::Step::Style("0".into()),
                    native_static::Step::LineHeight(1.25),
                ],
            }],
            styles: table(&fragments(), "default", "light"),
        };

        insta::assert_snapshot!(options.to_json(), @r#"{"axes":{"tone":["quiet","loud"]},"defaults":{"tone":"quiet"},"rules":[{"matches":[["tone",["loud"]]],"steps":["0",1.25]}],"styles":{"0":{"opacity":0.5},"1":{"fontSize":10}}}"#);
    }

    #[test]
    fn writes_dynamic_programs() {
        let options = native_dynamic::Options {
            axes: axes(),
            defaults: vec![("tone".into(), Some("quiet".into()))],
            fonts: Data::Undefined,
            payloads: Some(native_dynamic::Payloads {
                defaults: Some(vec![(
                    "tone".into(),
                    vec![("size".into(), Value::Number(2.0))],
                )]),
                payloads: vec![native_dynamic::Payload {
                    axis: "tone".into(),
                    choice: "loud".into(),
                    slots: vec![vec![("size".into(), "--size".into())]],
                }],
            }),
            program: native_dynamic::Program {
                rules: vec![native_dynamic::Rule {
                    matches: Vec::new(),
                    steps: vec![
                        native_dynamic::Step::Style("1".into()),
                        native_dynamic::Step::Assign {
                            parts: vec![
                                native_dynamic::Part::Slot {
                                    number: true,
                                    slot: "--size".into(),
                                },
                                native_dynamic::Part::String("px".into()),
                            ],
                            property: "width".into(),
                        },
                    ],
                }],
                slots: vec![("size".into(), "--size".into())],
            },
            styles: table(&fragments(), "default", "light"),
            units: data(r#"{"px":2}"#),
        };

        insta::assert_snapshot!(options.to_json(), @r#"{"axes":{"tone":["quiet","loud"]},"defaults":{"tone":"quiet"},"payloads":[{"axis":"tone","choice":"loud","slots":[{"size":"--size"}]}],"defaultPayloads":{"tone":{"size":2}},"units":{"px":2},"program":{"slots":{"size":"--size"},"rules":[{"matches":[],"steps":[{"style":"1"},{"property":"width","parts":[{"slot":"--size","number":true},"px"]}]}]},"styles":{"0":{"opacity":0.5},"1":{"fontSize":10}}}"#);
    }

    #[test]
    fn writes_variable_profiles_and_media_queries() {
        let profile = |value: f64| native_vars::Profile {
            dark: Object::from_entries([(
                "spacing".into(),
                object(&[("2", Data::Number(value)), ("page", Data::from("auto"))]),
            )]),
            light: Object::from_entries([(
                "color".into(),
                object(&[(
                    "ink",
                    Data::Array(Arc::new(vec![Data::from(
                        "Native variable color.ink: Unsupported.",
                    )])),
                )]),
            )]),
        };
        let wide = Query::Compare {
            left: Operand::Width,
            operator: Operator::GreaterEqual,
            right: Operand::Number(640.0),
        };
        let options = native_vars::Options {
            default_vars: Some("base".into()),
            media: Some(native_vars::Media {
                profiles: vec![
                    ("0".into(), vec![("base".into(), profile(4.0))]),
                    ("1".into(), vec![("base".into(), profile(8.0))]),
                ],
                queries: vec![Query::Or(vec![wide.clone(), Query::Not(Box::new(wide))])],
            }),
            profiles: vec![("base".into(), profile(4.0))],
            unnamed: false,
        };

        insta::assert_snapshot!(options.to_json(), @r#"{"defaultVars":"base","media":{"profiles":{"0":{"base":{"dark":{"spacing":{"2":4,"page":"auto"}},"light":{"color":{"ink":["Native variable color.ink: Unsupported."]}}}},"1":{"base":{"dark":{"spacing":{"2":8,"page":"auto"}},"light":{"color":{"ink":["Native variable color.ink: Unsupported."]}}}}},"queries":[{"kind":"or","queries":[{"kind":"compare","left":"width","operator":">=","right":640},{"kind":"not","query":{"kind":"compare","left":"width","operator":">=","right":640}}]}]},"profiles":{"base":{"dark":{"spacing":{"2":4,"page":"auto"}},"light":{"color":{"ink":["Native variable color.ink: Unsupported."]}}}},"unnamed":false}"#);

        let mut queries = String::new();

        native_media::write_queries(
            &mut queries,
            &[Query::And(vec![Query::Compare {
                left: Operand::Width,
                operator: Operator::Greater,
                right: Operand::Height,
            }])],
        );
        insta::assert_snapshot!(queries, @r#"[{"kind":"and","queries":[{"kind":"compare","left":"width","operator":">","right":"height"}]}]"#);
    }

    #[test]
    fn writes_appearance_scripts() {
        let script = appearance::script(&[("dark<x>".into(), "z-theme-a".into())], None);

        insta::assert_snapshot!(script, @r#"(()=>{try{const value=JSON.parse(localStorage.getItem("zyzz")||"null");if(!value||typeof value!=="object"||Array.isArray(value))return;const root=document.documentElement;const catalog=new Map([["dark\u003cx\u003e","z-theme-a"]]);if(Object.hasOwn(value,"set")&&typeof value.set==="string"&&catalog.has(value.set)){root.classList.remove(...catalog.values());root.classList.add(catalog.get(value.set))}const schemes=new Map([["dark","z_scheme-dark"],["light","z_scheme-light"],["light dark","z_scheme-light-dark"]]);if(Object.hasOwn(value,"colorScheme")){if(value.colorScheme===null){root.classList.remove(...schemes.values());root.style.removeProperty("color-scheme")}else if(schemes.has(value.colorScheme)){root.classList.remove(...schemes.values());root.classList.add(schemes.get(value.colorScheme));root.style.colorScheme=value.colorScheme}}}catch{}})();"#);
    }
}

mod scalar_conversion {
    use super::*;

    fn options() -> scalar::Options {
        scalar::Options::read(
            &data(r#"{"Inter":"Inter-Regular"}"#),
            &data(r#"{"rem":16}"#),
        )
    }

    #[test]
    fn converts_portable_domains() {
        let options = options();
        let results = [
            ("textDecorationLine", Value::from("line-through underline")),
            ("aspectRatio", Value::from("16 / 9")),
            ("fontFamily", Value::from("Inter")),
            ("fontWeight", Value::Number(450.0)),
            ("width", Value::from("-1%")),
            ("left", Value::from("-1%")),
            ("letterSpacing", Value::from("-0.5rem")),
            ("zIndex", Value::Number(1.5)),
        ]
        .iter()
        .map(|(property, value)| {
            let kind = scalar::property(property).expect("portable property");

            match scalar::convert(kind, value, &options) {
                Ok(value) => format!("{property}: {}", value.to_js_string()),
                Err(error) => format!("{property}: {}", error.text()),
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

        insta::assert_snapshot!(results, @"
        textDecorationLine: underline line-through
        aspectRatio: 1.7777777777777777
        fontFamily: Inter-Regular
        fontWeight: Use normal, bold, or numeric weights 100 through 900 in steps of 100.
        width: Invalid native percentage.
        left: -1%
        letterSpacing: -8
        zIndex: Unsupported native numeric value.
        ");
    }

    #[test]
    fn evaluates_calculations_and_colors() {
        let options = options();
        let lengths = [
            "calc(1rem + 2px)",
            "calc(2 * (1px + 1px))",
            "calc(1px+2px)",
            "calc(1px / 0)",
        ]
        .iter()
        .map(|input| match calculation::length(input, &options) {
            Ok(value) => format!("{input}: {}", zyzz_compiler::js::number(value)),
            Err(error) => format!("{input}: {}", error.text()),
        })
        .collect::<Vec<_>>()
        .join("\n");

        insta::assert_snapshot!(lengths, @"
        calc(1rem + 2px): 18
        calc(2 * (1px + 1px)): 4
        calc(1px+2px): Unsupported native calc expression.
        calc(1px / 0): Native calc requires compatible number and length operands.
        ");

        let colors = [
            "RED",
            "#ABC",
            "rgb(255 0 0 / 50%)",
            "hwb(90deg 20% 30%)",
            "hsl(1turn, 50%, 50%)",
            "currentColor",
        ]
        .iter()
        .map(|input| {
            format!(
                "{input}: {}",
                color::parse(input).unwrap_or_else(|| "undefined".to_owned())
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

        insta::assert_snapshot!(colors, @"
        RED: red
        #ABC: #abc
        rgb(255 0 0 / 50%): #ff000080
        hwb(90deg 20% 30%): #73b333ff
        hsl(1turn, 50%, 50%): #bf4040ff
        currentColor: undefined
        ");
        insta::assert_snapshot!(
            format!("{:?}", calculation::parts(" 1px calc(1px + 2px)  3px ").expect("parts")),
            @r#"["1px", "calc(1px + 2px)", "3px"]"#
        );
    }
}
