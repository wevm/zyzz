//! Validates native property registration descriptors and independent initial values.

use zyzz_css_syntax::{self as syntax, Ast, Node, ParseOptions, Walk};

use crate::compiler::internal::descriptors::{generate, parse_failure, parse_value};
use crate::compiler::internal::functions;
use crate::compiler::internal::identifiers::{self, Separator};
use crate::error::{Error, Result};
use crate::internal::function_syntax;
use crate::js;

/// Rejects declaration delimiters inside an authored initial value.
///
/// # Errors
///
/// Fails with css-tree's message when the value does not parse as one declaration value.
pub fn initial(value: &str) -> Result<()> {
    parse_value(value).map(|_| ())
}

/// Validates `@property` registrations before output-parser recovery can discard them.
///
/// Returns whether any registration's syntax string contains a backslash, which the transport
/// in [`crate::compiler::internal::at_rules`] must shield from the output parser.
///
/// # Errors
///
/// Fails with the first invalid registration's message, in document order.
pub fn validate(source: &str) -> Result<bool> {
    let ast = syntax::parse(source, &ParseOptions::default()).map_err(parse_failure)?;
    let mut rules = Vec::new();
    let mut escaped = false;

    syntax::walk_visit(&ast, ast.root(), "Atrule", |id, _| rules.push(id));

    for id in rules {
        let Some(Node::Atrule {
            block,
            name,
            prelude,
        }) = ast.get(id)
        else {
            continue;
        };

        // ASCII case folding matches `toLowerCase` for names without `k`.
        if !name.eq_ignore_ascii_case("property") {
            continue;
        }

        let text = match prelude {
            Some(prelude) => generate(&ast, *prelude)?,
            None => String::new(),
        };
        let names = identifiers::list(&text, Separator::Space);

        // Names starting with `--` are longer than two UTF-16 units exactly when longer than two bytes.
        let (Some([name]), Some(block)) = (names.as_deref(), block) else {
            return Err(invalid_registration());
        };

        if !name.starts_with("--") || name.len() <= 2 {
            return Err(invalid_registration());
        }

        // Generated values keyed by lowercase descriptor name. Later declarations replace earlier ones.
        let mut values: Vec<(String, String)> = Vec::new();

        for child in ast.children(*block) {
            let Some(Node::Declaration {
                important: None,
                property,
                value,
            }) = ast.get(*child)
            else {
                return Err(Error::message(
                    "Expected non-important property descriptors.",
                ));
            };

            let key = property.to_lowercase();

            if !["syntax", "inherits", "initial-value"].contains(&key.as_str()) {
                return Err(Error::message("Unknown property descriptor."));
            }

            let text = generate(&ast, *value)?;

            parse_value(&text)?;

            match values.iter_mut().find(|(existing, _)| *existing == key) {
                Some(entry) => entry.1 = text,
                None => values.push((key, text)),
            }
        }

        let descriptor = |key: &str| {
            values
                .iter()
                .find(|(name, _)| name == key)
                .map(|(_, text)| text.as_str())
        };

        let syntax = match descriptor("syntax") {
            Some(text) => {
                let parsed = parse_value(text)?;

                match parsed.children(parsed.root()) {
                    [only] => match parsed.get(*only) {
                        Some(Node::String { value }) => Some(value.to_string()),
                        _ => None,
                    },
                    _ => None,
                }
            }
            None => None,
        };

        if syntax.as_ref().is_some_and(|syntax| syntax.contains('\\')) {
            escaped = true;
        }

        let Some(syntax) = syntax.filter(|syntax| {
            function_syntax::accepts(&format!("type({syntax})")) && !syntax.contains("<string>")
        }) else {
            return Err(Error::message(
                "Property registration requires a supported syntax string.",
            ));
        };

        let inherited = match descriptor("inherits") {
            Some(text) => {
                let parsed = parse_value(text)?;

                identifiers::list(&generate(&parsed, parsed.root())?, Separator::Space)
            }
            None => None,
        };

        if !matches!(inherited.as_deref(), Some([value]) if value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("false"))
        {
            return Err(Error::message(
                "Property registration requires boolean inherits.",
            ));
        }

        let universal = js::trim(&syntax) == "*";

        let Some(initial) = descriptor("initial-value") else {
            if universal {
                continue;
            }

            return Err(Error::message(
                "Non-universal property registrations require an initial value.",
            ));
        };

        if universal {
            continue;
        }

        let initial = parse_value(initial)?;
        let matched = generate(&initial, initial.root())
            .and_then(|text| functions::value(&syntax, &text))
            .map_err(|_| {
                Error::message("Registered initial values must match the declared syntax.")
            })?;

        if matched.is_some_and(|matched| {
            !matched.starts_with('<') || matched.starts_with("<custom-ident>")
        }) {
            continue;
        }

        if dependent(&initial) {
            return Err(Error::message(
                "Registered initial values must be computationally independent.",
            ));
        }
    }

    Ok(escaped)
}

#[cold]
fn invalid_registration() -> Error {
    Error::message("Property registration requires a custom-property name and descriptors.")
}

/// Whether an initial value depends on font metrics, containers, substitutions, or context.
fn dependent(initial: &Ast<'_>) -> bool {
    !syntax::walk(initial, initial.root(), |_, node| {
        let found = match node {
            Node::Dimension { unit, .. } => [
                "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax", "em", "ex", "ch", "cap", "ic", "lh",
                "rem", "rex", "rch", "rcap", "ric", "rlh",
            ]
            .iter()
            .any(|candidate| unit.eq_ignore_ascii_case(candidate)),
            Node::Function { name, .. } => {
                let name = syntax::ident::decode(name);

                [
                    "var",
                    "env",
                    "attr",
                    "light-dark",
                    "contrast-color",
                    "anchor",
                    "anchor-size",
                    "sibling-index",
                    "sibling-count",
                ]
                .iter()
                .any(|candidate| name.eq_ignore_ascii_case(candidate))
            }
            Node::Identifier { name } => {
                let name = syntax::ident::decode(name);

                [
                    "currentcolor",
                    "inherit",
                    "initial",
                    "unset",
                    "revert",
                    "revert-layer",
                ]
                .iter()
                .any(|candidate| name.eq_ignore_ascii_case(candidate))
            }
            _ => false,
        };

        if found { Walk::Break } else { Walk::Continue }
    })
}
