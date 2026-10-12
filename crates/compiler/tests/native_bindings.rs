//! Verifies native binding programs from callback declarations to the JSON `NativeDynamic.create`
//! and `NativeStatic.create` receive.

use std::fmt::Write;
use std::sync::Arc;

use compiler::compiler::internal::native_bindings::{self, Options};
use compiler::compiler::source::Call;
use compiler::data::{Data, Object};
use compiler::internal::binding::{self, Domain};
use compiler::internal::recipe;
use compiler::internal::theme::Definition;
use compiler::internal::token::{Expression, Part, Reference};
use compiler::js::Record;
use compiler::style::{self, Declaration, NamedStyle, Rule, Value};
use compiler::vars;
use serde_json::Value as Json;

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

fn theme() -> Arc<Definition> {
    Arc::new(
        vars::define(
            &data(r##"{"color":{"ink":{"light":"#000","dark":"#fff"}},"spacing":{"gap":"4px"}}"##),
            None,
            None,
        )
        .expect("variable set"),
    )
}

fn token(set: &Definition, path: &[&str]) -> Arc<Reference> {
    let node = path.iter().fold(set.tokens.clone(), |node, key| {
        node.as_object()
            .and_then(|object| object.get(key))
            .cloned()
            .unwrap_or(Data::Undefined)
    });

    match node {
        Data::Token(reference) => reference,
        other => panic!("expected a token, found {other:?}"),
    }
}

fn slot(name: &str, domain: Domain) -> Arc<binding::Reference> {
    Arc::new(binding::Reference {
        domain,
        dynamic: false,
        name: name.to_owned(),
        zero: false,
    })
}

fn declaration(property: &str, value: Value) -> Declaration {
    Declaration {
        important: false,
        property: property.into(),
        value,
    }
}

fn styles(name: &str, declarations: Vec<Declaration>) -> style::Definition {
    style::Definition {
        labels: None,
        styles: vec![Arc::new(NamedStyle {
            declarations,
            name: name.into(),
            ..NamedStyle::default()
        })],
    }
}

fn base(value: style::Definition) -> recipe::Definition {
    recipe::Definition {
        axes: Vec::new(),
        defaults: Vec::new(),
        rules: vec![recipe::Rule {
            matches: Vec::new(),
            value,
        }],
    }
}

fn call() -> Call<'static> {
    let mut slots = Record::new();

    slots.insert("width", slot("--zw", Domain::Length));
    slots.insert("size", slot("--zs", Domain::Length));

    Call {
        slots: Some(slots),
        ..Call::default()
    }
}

fn catalog(theme: &Arc<Definition>) -> Record<Arc<Definition>> {
    [(Arc::from("default"), Arc::clone(theme))]
        .into_iter()
        .collect()
}

fn suffixed(name: &str, suffix: &str) -> Value {
    Value::Expression(Arc::new(Expression {
        group: None,
        parts: vec![
            Part::Binding(slot(name, Domain::Length)),
            Part::Text(suffix.into()),
        ],
    }))
}

fn prepare_error(declarations: Vec<Declaration>, rules: Option<Vec<Rule>>) -> String {
    let recipe = base(style::Definition {
        labels: None,
        styles: vec![Arc::new(NamedStyle {
            declarations,
            name: "card".into(),
            rules,
            ..NamedStyle::default()
        })],
    });

    native_bindings::prepare(&recipe, &call(), &Options::default())
        .map_or_else(|error| error.text(), |_| "ok".to_owned())
}

mod compile {
    use super::*;

    #[test]
    fn resolves_tokens_for_the_selected_set_and_scheme() {
        let theme = theme();
        let catalog = catalog(&theme);
        let recipe = recipe::Definition {
            axes: vec![("tone".into(), vec!["a".into(), "b".into()])],
            defaults: vec![("tone".into(), Some("a".into()))],
            rules: vec![
                recipe::Rule {
                    matches: Vec::new(),
                    value: styles(
                        "base",
                        vec![
                            declaration("color", Value::Token(token(&theme, &["color", "ink"]))),
                            declaration("width", Value::Binding(slot("--zw", Domain::Length))),
                            declaration("lineHeight", Value::String("20px".into())),
                            declaration("opacity", Value::Number(0.5)),
                        ],
                    ),
                },
                recipe::Rule {
                    matches: vec![("tone".into(), vec!["b".into()])],
                    value: styles(
                        "b",
                        vec![
                            declaration(
                                "paddingTop",
                                Value::Token(token(&theme, &["spacing", "gap"])),
                            ),
                            declaration("marginTop", suffixed("--zs", "px")),
                        ],
                    ),
                },
            ],
        };
        let options = |color_scheme| Options {
            color_scheme: Some(color_scheme),
            units: data(r#"{"px":2}"#),
            vars: Some(&catalog),
            ..Options::default()
        };
        let prepared =
            native_bindings::prepare(&recipe, &call(), &options("light")).expect("prepared");
        let light = native_bindings::compile(&recipe, &call(), &options("light"), Some(&prepared))
            .expect("light");
        let dark =
            native_bindings::compile(&recipe, &call(), &options("dark"), None).expect("dark");

        insta::assert_snapshot!(light.to_json(), @r##"{"axes":{"tone":["a","b"]},"defaults":{"tone":"a"},"units":{"px":2},"program":{"slots":{"width":"--zw","size":"--zs"},"rules":[{"matches":[],"steps":[{"style":"0"},{"property":"width","parts":[{"slot":"--zw"}]},{"property":"lineHeight","parts":["20px"]},{"style":"1"}]},{"matches":[["tone",["b"]]],"steps":[{"style":"2"},{"property":"marginTop","parts":[{"slot":"--zs"},"px"]}]}]},"styles":{"0":{"color":"#000"},"1":{"opacity":0.5},"2":{"paddingTop":8}}}"##);
        insta::assert_snapshot!(dark.to_json(), @r##"{"axes":{"tone":["a","b"]},"defaults":{"tone":"a"},"units":{"px":2},"program":{"slots":{"width":"--zw","size":"--zs"},"rules":[{"matches":[],"steps":[{"style":"0"},{"property":"width","parts":[{"slot":"--zw"}]},{"property":"lineHeight","parts":["20px"]},{"style":"1"}]},{"matches":[["tone",["b"]]],"steps":[{"style":"2"},{"property":"marginTop","parts":[{"slot":"--zs"},"px"]}]}]},"styles":{"0":{"color":"#fff"},"1":{"opacity":0.5},"2":{"paddingTop":8}}}"##);
        insta::assert_snapshot!(
            native_bindings::compile(&recipe, &call(), &options("blue"), Some(&prepared))
                .map_or_else(|error| error.text(), |_| "ok".to_owned()),
            @"Select an existing set label and light or dark colorScheme."
        );
    }
}

mod finite {
    use super::*;

    #[test]
    fn lowers_line_heights_to_static_steps() {
        let theme = theme();
        let catalog = catalog(&theme);
        let mut recipe = base(styles(
            "base",
            vec![
                declaration("color", Value::Token(token(&theme, &["color", "ink"]))),
                declaration("lineHeight", Value::String("20px".into())),
            ],
        ));

        recipe.rules.push(recipe::Rule {
            matches: Vec::new(),
            value: styles(
                "multiplier",
                vec![declaration("lineHeight", Value::Number(1.5))],
            ),
        });

        let options = Options {
            color_scheme: Some("dark"),
            units: data(r#"{"px":2}"#),
            vars: Some(&catalog),
            ..Options::default()
        };
        let compiled =
            native_bindings::compile(&recipe, &Call::default(), &options, None).expect("compiled");

        insta::assert_snapshot!(native_bindings::finite(&compiled).expect("static").to_json(), @r##"{"axes":{},"defaults":{},"rules":[{"matches":[],"steps":["0","1"]},{"matches":[],"steps":[1.5]}],"styles":{"0":{"color":"#fff"},"1":{"lineHeight":40}}}"##);
    }

    #[test]
    fn rejects_runtime_bindings() {
        let recipe = base(styles(
            "base",
            vec![declaration(
                "width",
                Value::Binding(slot("--zw", Domain::Length)),
            )],
        ));
        let compiled = native_bindings::compile(
            &recipe,
            &call(),
            &Options {
                color_scheme: Some("light"),
                ..Options::default()
            },
            None,
        )
        .expect("compiled");

        insta::assert_snapshot!(native_bindings::finite(&compiled).map_or_else(|error| error.text(), |_| "ok".to_owned()), @"Static native recipes cannot contain runtime bindings.");
    }
}

mod prepare {
    use super::*;

    #[test]
    fn rejects_unsupported_declarations() {
        let width = || Value::Binding(slot("--zw", Domain::Length));
        let mut output = String::new();
        let cases = [
            (
                "importance",
                vec![Declaration {
                    important: true,
                    ..declaration("opacity", Value::Number(1.0))
                }],
                None,
            ),
            (
                "fallback",
                vec![
                    declaration("opacity", Value::Number(1.0)),
                    declaration("opacity", Value::Number(0.5)),
                ],
                None,
            ),
            ("compound", vec![declaration("transform", width())], None),
            (
                "undeclared",
                vec![declaration(
                    "width",
                    Value::Binding(slot("--zx", Domain::Length)),
                )],
                None,
            ),
            (
                "suffix",
                vec![declaration("width", suffixed("--zw", "em"))],
                None,
            ),
            (
                "calculation",
                vec![declaration("width", suffixed("--zw", " calc(1px)"))],
                None,
            ),
            (
                "nested",
                Vec::new(),
                Some(vec![Rule {
                    condition: Some("@media (width > 1px)".into()),
                    style: Arc::new(NamedStyle {
                        declarations: vec![declaration("opacity", Value::Number(1.0))],
                        name: "card".into(),
                        ..NamedStyle::default()
                    }),
                }]),
            ),
            (
                "conversion",
                vec![declaration("color", Value::String("bogus-color".into()))],
                None,
            ),
        ];

        for (name, declarations, rules) in cases {
            writeln!(output, "{name}: {}", prepare_error(declarations, rules)).expect("write");
        }

        insta::assert_snapshot!(output, @r#"
        importance: Importance and fallback declarations are not supported on native.
        fallback: Importance and fallback declarations are not supported on native.
        compound: Dynamic native property is unsupported: transform.
        undeclared: Native bindings require declared runtime scalar fields.
        suffix: Native dynamic expressions support a scalar with a px, rem, or percent suffix.
        calculation: ok
        nested: Selectors, queries, and nested rules are not supported on native.
        conversion: ["default","light","0","color"]: Use an absolute sRGB color supported by native conversion.
        ["default","dark","0","color"]: Use an absolute sRGB color supported by native conversion.
        "#);
    }
}
