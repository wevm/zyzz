//! Verifies native media preparation from authored rules and conditional variables to window
//! queries and the styles and sets each selection activates.

use std::fmt::Write;
use std::sync::Arc;

use compiler::compiler::internal::native_media;
use compiler::data::{Data, Object};
use compiler::internal::theme::Definition;
use compiler::internal::token::{Reference, Value as TokenValue};
use compiler::js::{self, Record};
use compiler::react_native::internal::scalar;
use compiler::runtime::internal::native_media::write_queries;
use compiler::style::{Declaration, NamedStyle, Rule, Value};
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

/// Reads a token reference from a set's token tree.
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

fn declaration(property: &str, value: Value) -> Declaration {
    Declaration {
        important: false,
        property: property.into(),
        value,
    }
}

fn rule(condition: Option<&str>, declarations: Vec<Declaration>) -> Rule {
    Rule {
        condition: condition.map(Into::into),
        style: Arc::new(NamedStyle {
            declarations,
            name: "card".into(),
            ..NamedStyle::default()
        }),
    }
}

/// Formats a token value compactly: strings quoted, references by path, records by entry.
fn describe(value: &TokenValue) -> String {
    match value {
        TokenValue::Number(number) => js::number(*number),
        TokenValue::String(text) => js::quote(text),
        TokenValue::Reference(reference) => format!("ref({})", reference.path),
        TokenValue::Composition(_) => "expr".to_owned(),
        TokenValue::Record(entries) => format!(
            "{{{}}}",
            entries
                .iter()
                .map(|(key, value)| format!("{key}:{}", describe(value)))
                .collect::<Vec<_>>()
                .join(",")
        ),
    }
}

fn prepare_error(condition: &str) -> String {
    let styles = [Arc::new(NamedStyle {
        name: "card".into(),
        rules: Some(vec![rule(
            Some(condition),
            vec![declaration("opacity", Value::Number(1.0))],
        )]),
        ..NamedStyle::default()
    })];

    native_media::prepare(Some(&styles), None, &scalar::Options::default())
        .map_or_else(|error| error.text(), |media| format!("{}", media.is_some()))
}

mod prepare {
    use super::*;

    #[test]
    fn selects_media_rules_and_variable_branches() {
        let media = Arc::new(
            vars::define(
                &data(
                    r#"{"spacing":{"gap":{"default":"2px","@media (width >= 768px)":"4px","@media (hover: hover)":"8px"},"page":{"default":"1rem","@media (width >= 768px)":"2rem"}}}"#,
                ),
                None,
                None,
            )
            .expect("variable set"),
        );
        let styles = [Arc::new(NamedStyle {
            declarations: vec![declaration(
                "paddingTop",
                Value::Token(token(&media, &["spacing", "gap"])),
            )],
            name: "card".into(),
            rules: Some(vec![
                rule(
                    Some("@media (width >= 768px)"),
                    vec![declaration("opacity", Value::Number(0.5))],
                ),
                rule(
                    Some("@media (orientation: portrait)"),
                    vec![declaration(
                        "marginTop",
                        Value::Token(token(&media, &["spacing", "page"])),
                    )],
                ),
                rule(None, vec![declaration("zIndex", Value::Number(1.0))]),
            ]),
            ..NamedStyle::default()
        })];
        let catalog: Record<Arc<Definition>> = [(Arc::from("default"), Arc::clone(&media))]
            .into_iter()
            .collect();
        let prepared =
            native_media::prepare(Some(&styles), Some(&catalog), &scalar::Options::default())
                .expect("media")
                .expect("conditions");
        let mut queries = String::new();
        let mut selected = String::new();

        write_queries(&mut queries, &prepared.queries);

        for selection in prepared.selections() {
            let chosen = prepared.select(&selection);
            let style = chosen.style(&styles[0]);
            let vars = chosen.vars().expect("catalog");
            let values = &vars.get("default").expect("set").metadata.values;
            let padding = match &style.declarations[0].value {
                Value::Token(reference) => describe(&reference.value),
                _ => String::new(),
            };
            let rules: Vec<String> = style
                .rules
                .iter()
                .flatten()
                .map(|rule| {
                    format!(
                        "{}={}",
                        rule.condition.as_deref().unwrap_or("-"),
                        rule.style.declarations[0].property
                    )
                })
                .collect();

            writeln!(
                selected,
                "{selection} padding {padding} rules [{}] gap {} page {}",
                rules.join(", "),
                describe(&values["spacing.gap"]),
                describe(&values["spacing.page"])
            )
            .expect("write");
        }

        insta::assert_snapshot!(queries, @r#"[{"kind":"compare","left":"width","operator":">=","right":768},{"kind":"compare","left":"width","operator":"<=","right":"height"}]"#);
        insta::assert_snapshot!(selected, @r#"
        00 padding {default:"2px",@media (hover: hover):"8px"} rules [-=zIndex] gap {default:"2px",@media (hover: hover):"8px"} page "1rem"
        01 padding {default:"2px",@media (hover: hover):"8px"} rules [-=marginTop, -=zIndex] gap {default:"2px",@media (hover: hover):"8px"} page "1rem"
        10 padding {default:"2px",@media (hover: hover):"8px"} rules [-=opacity, -=zIndex] gap {default:"2px",@media (hover: hover):"8px"} page "2rem"
        11 padding {default:"2px",@media (hover: hover):"8px"} rules [-=opacity, -=marginTop, -=zIndex] gap {default:"2px",@media (hover: hover):"8px"} page "2rem"
        "#);
    }

    #[test]
    fn rejects_unsupported_rule_conditions() {
        let mut output = String::new();

        for condition in [
            "@media print",
            "@media (width > 10em)",
            "@media (hover: hover)",
            "@media (width > 1px) or (height > 1px) and (width < 2px)",
            "@media )",
            "@media (100px < width <= 2rem)",
            "@media screen and (min-width: 0)",
        ] {
            writeln!(output, "{condition}: {}", prepare_error(condition)).expect("write");
        }

        insta::assert_snapshot!(output, @"
        @media print: Native media types support all or screen without negation.
        @media (width > 10em): Use zero, px, or rem with an explicit rem conversion.
        @media (hover: hover): Unsupported native media feature.
        @media (width > 1px) or (height > 1px) and (width < 2px): Unsupported native media condition.
        @media ): Identifier or parenthesis is expected
        @media (100px < width <= 2rem): Provide units.rem for rem lengths.
        @media screen and (min-width: 0): true
        ");
    }
}
