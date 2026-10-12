//! Verifies native variable profiles from authored variable sets to the JSON `NativeVars.create`
//! receives, including deferred leaf diagnostics, category mappings, and media alternatives.

use std::sync::Arc;

use compiler::compiler::internal::native_vars::{self, Options};
use compiler::data::{Data, Object};
use compiler::internal::theme::Definition;
use compiler::internal::variable_sets;
use compiler::js::Record;
use compiler::react_native::internal::scalar;
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

fn set(json: &str) -> Arc<Definition> {
    Arc::new(vars::define(&data(json), None, None).expect("variable set"))
}

fn compile(sets: &[(&str, Arc<Definition>)], scalar: &scalar::Options) -> String {
    let vars: Record<Arc<Definition>> = sets
        .iter()
        .map(|(name, set)| (Arc::from(*name), Arc::clone(set)))
        .collect();

    native_vars::compile(&Options {
        default_vars: &Arc::from("default"),
        scalar,
        unnamed: false,
        vars: &vars,
    })
    .expect("profiles")
    .to_json()
}

mod compile {
    use super::*;

    #[test]
    fn converts_leaves_and_defers_unsupported_values() {
        let brand = set(
            r##"{"color":{"ink":{"light":"#000","dark":"#fff"},"bad":"bogus-color"},"spacing":{"gap":"4px","page":"1rem"},"typography":{"body":{"fontSize":"16px","lineHeight":1.5,"fontWeight":"bold","fontFamily":"Inter"},"caption":{"lineHeight":"1.25"}},"radius":{"card":"8px"},"aspectRatio":{"wide":"16 / 9"}}"##,
        );
        let scalar = scalar::Options::read(
            &data(r#"{"Inter":"Inter-Regular"}"#),
            &data(r#"{"px":2,"rem":16}"#),
        );

        insta::assert_snapshot!(compile(&[("default", brand)], &scalar), @r##"{"defaultVars":"default","profiles":{"default":{"dark":{"color":{"ink":"#fff","bad":["Native variable color.bad: Use an absolute sRGB color supported by native conversion."]},"spacing":{"gap":8,"page":16},"typography":{"body":{"fontSize":32,"lineHeight":48,"fontWeight":"bold","fontFamily":"Inter-Regular"},"caption":{"lineHeight":["Native variable typography.caption.lineHeight: Native line height requires fontSize: typography.caption.lineHeight."]}},"radius":{"card":16},"aspectRatio":{"wide":["Native variable aspectRatio.wide: Native aspect ratios require numeric variable values."]}},"light":{"color":{"ink":"#000","bad":["Native variable color.bad: Use an absolute sRGB color supported by native conversion."]},"spacing":{"gap":8,"page":16},"typography":{"body":{"fontSize":32,"lineHeight":48,"fontWeight":"bold","fontFamily":"Inter-Regular"},"caption":{"lineHeight":["Native variable typography.caption.lineHeight: Native line height requires fontSize: typography.caption.lineHeight."]}},"radius":{"card":16},"aspectRatio":{"wide":["Native variable aspectRatio.wide: Native aspect ratios require numeric variable values."]}}}},"unnamed":false}"##);
    }

    #[test]
    fn converts_mapped_categories_through_every_target() {
        let base = set(r#"{"spacing":{"gap":"4px","inset":"-2px"}}"#);
        let mappings = variable_sets::mappings(&data(r#"{"spacing":["width","marginTop"]}"#))
            .expect("mappings");
        let mapped = Arc::new(variable_sets::theme(&base, mappings).expect("theme"));

        insta::assert_snapshot!(compile(&[("default", mapped)], &scalar::Options::default()), @r#"{"defaultVars":"default","profiles":{"default":{"dark":{"spacing":{"gap":4,"inset":["Native variable spacing.inset: Converted length is outside the native property domain."]}},"light":{"spacing":{"gap":4,"inset":["Native variable spacing.inset: Converted length is outside the native property domain."]}}}},"unnamed":false}"#);
    }

    #[test]
    fn precompiles_profiles_for_each_media_selection() {
        let media = set(
            r##"{"spacing":{"gap":{"default":"2px","@media (width >= 768px)":"4px","@media (hover: hover)":"8px"}},"color":{"ink":{"default":{"light":"#000","dark":"#fff"},"@media (orientation: landscape)":"red"}}}"##,
        );

        insta::assert_snapshot!(compile(&[("default", media)], &scalar::Options::default()), @r##"{"defaultVars":"default","media":{"profiles":{"10":{"default":{"dark":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"#fff"}},"light":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"#000"}}}},"11":{"default":{"dark":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"red"}},"light":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"red"}}}},"00":{"default":{"dark":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"#fff"}},"light":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"#000"}}}},"01":{"default":{"dark":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"red"}},"light":{"spacing":{"gap":["Native variable spacing.gap: Media-conditioned variables require a web target."]},"color":{"ink":"red"}}}}},"queries":[{"kind":"compare","left":"width","operator":">=","right":768},{"kind":"compare","left":"width","operator":">","right":"height"}]},"profiles":{"default":{"dark":{"spacing":{"gap":["Native variable spacing.gap: Native media-conditioned variables require the native Provider window dimensions."]},"color":{"ink":["Native variable color.ink: Native media-conditioned variables require the native Provider window dimensions."]}},"light":{"spacing":{"gap":["Native variable spacing.gap: Native media-conditioned variables require the native Provider window dimensions."]},"color":{"ink":["Native variable color.ink: Native media-conditioned variables require the native Provider window dimensions."]}}}},"unnamed":false}"##);
    }

    #[test]
    fn rejects_a_ninth_distinct_condition() {
        let branches: Vec<String> = (0..9)
            .map(|index| format!(r#""@media (width >= {index}px)":"{index}px""#))
            .collect();
        let many = set(&format!(
            r#"{{"spacing":{{"gap":{{"default":"1px",{}}}}}}}"#,
            branches.join(",")
        ));
        let vars: Record<Arc<Definition>> = [(Arc::from("default"), many)].into_iter().collect();
        let error = native_vars::compile(&Options {
            default_vars: &Arc::from("default"),
            scalar: &scalar::Options::default(),
            unnamed: true,
            vars: &vars,
        })
        .expect_err("too many conditions");

        insta::assert_snapshot!(error.text(), @"Native media supports at most eight distinct conditions per definition.");
    }
}
