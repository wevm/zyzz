//! Round-trips packed library contracts through `Contract.read` and `Contract.write`.

use zyzz_compiler::compiler::internal::{contract, identifiers};

/// Reads a contract and writes it back, as a repacking library graph does.
fn repack(text: &str, module_id: &str) -> String {
    let validate = |_: &str, _: &str| -> zyzz_compiler::error::Result<()> { Ok(()) };
    let identifier = |value: &str| identifiers::read(value);
    let hooks = contract::Hooks {
        identifier: &identifier,
        validate: &validate,
    };
    let mut identities = rustc_hash::FxHashMap::default();
    let library = contract::read(text, &mut identities, module_id, &hooks)
        .unwrap_or_else(|error| panic!("{}", error.text()));
    let class_rules: Vec<_> = library
        .class_rules
        .iter()
        .map(|(name, rule)| (std::sync::Arc::clone(name), std::sync::Arc::clone(rule)))
        .collect();

    contract::write(&contract::Write {
        class_rules: &class_rules,
        configurations: &[],
        links: &library.links,
        module_id,
        stylesheets: &library.stylesheets,
        themes: &library.themes,
    })
    .unwrap_or_else(|error| panic!("{}", error.text()))
}

mod write {
    use super::repack;

    #[test]
    fn configuration_options() {
        let text = r##"{"exports":{"style":{"variableConfig":true,"binding":"src-aliases-fXnyWRfEg8H-style","kind":"style","theme":"src-aliases-fXnyWRfEg8H-themeConfig-theme","options":{"theme":{"color":{"brand":"#06c"}}}}},"themes":{"src-aliases-fXnyWRfEg8H-theme":{"cssName":"theme","variableSet":true,"identity":"src-aliases-fXnyWRfEg8H-theme","tokens":{"color":{"brand":"#06c"}}},"src-aliases-fXnyWRfEg8H-themeConfig-theme":{"cssName":"theme","cssOutput":"atomic","variableSet":true,"identity":"src-aliases-fXnyWRfEg8H-themeConfig","tokens":{"color":{"brand":"#06c"}}}},"version":31}"##;

        assert_eq!(repack(text, "example/aliases.ts"), text);
    }

    #[test]
    fn rule_references_and_sections() {
        let text = r#"{"stylesheets":[{"source":"statements.ts","namespaces":[],"key":"0","css":"@custom-media --z-custommedia-query true;","layers":[],"start":57,"content":"import {customMedia} from 'zyzz/web';\nexport const query=customMedia(true);"}],"exports":{"query":{"binding":"--z-custommedia-query","kind":"rule-reference","name":"--z-custommedia-query","reference":"customMedia"}},"themes":{},"version":31}"#;

        assert_eq!(repack(text, "statements.ts"), text);
    }

    #[test]
    fn variables() {
        let text = r#"{"exports":{"gap":{"binding":"--z-gap","kind":"variables","variables":{"value":{"name":"--z-gap","type":"length","variable":true}},"source":"library"}},"themes":{},"version":31}"#;

        assert_eq!(repack(text, "library.js"), text);
    }

    #[test]
    fn packed_styles() {
        let text = r#"{"exports":{"button":{"binding":"z-style-illRZq-button","kind":"style-reference","style":{"attributes":[],"slots":[],"staticRecipe":{"axes":{},"defaults":{},"rules":[{"matches":[],"value":{"styles":[{"declarations":[],"name":"style-15sihh01ggr9so-66"}]}}]},"style":{"declarations":[],"name":"style-15sihh01ggr9so-66","cssOutput":"atomic"},"className":"z-style-illRZq-button"}}},"themes":{},"version":31}"#;

        insta::assert_snapshot!(repack(text, "example/syntax.tsx"), @r#"{"exports":{"button":{"binding":"z-style-illRZq-button","kind":"style-reference","style":{"attributes":[],"className":"z-style-illRZq-button","slots":[],"staticRecipe":{"axes":{},"defaults":{},"rules":[{"matches":[],"value":{"styles":[{"declarations":[],"name":"style-15sihh01ggr9so-66"}]}}]},"style":{"declarations":[],"name":"style-15sihh01ggr9so-66","cssOutput":"atomic"}}}},"themes":{},"version":31}"#);
    }
}
