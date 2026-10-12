//! Validates descriptor grammars independently of the output parser's error recovery.

use css::lexer::{LexerError, SyntaxKind};
use css::{
    self as syntax, Ast, Context, GenerateError, Lexer, MatchValue, Node, NodeId, ParseOptions,
    SyntaxError, TokenType, Walk,
};

use crate::compiler::internal::lightning::{self, Options};
use crate::error::{Error, Result};
use crate::js;

/// One authored descriptor of a named at-rule.
#[derive(Clone, Copy, Debug)]
pub struct Descriptor<'a> {
    /// Descriptor name, in camelCase or CSS spelling.
    pub name: &'a str,
    /// At-rule name without `@`, such as `page`.
    pub rule: &'a str,
    /// Descriptor value.
    pub value: &'a str,
}

/// Checks one authored descriptor before it can introduce another CSS declaration.
///
/// # Errors
///
/// Fails with `Invalid @{rule} {name}: {reason}` when the value does not match the descriptor
/// grammar, and with the output parser's message when a page length expression is invalid.
pub fn check(descriptor: &Descriptor<'_>) -> Result<()> {
    let name = kebab(descriptor.name);
    let lexer = Lexer::get();

    // The pinned parser predates this page descriptor.
    let result = if descriptor.rule == "page" && name == "page-margin-safety" {
        lexer.match_syntax("none | clamp | add", descriptor.value)
    } else {
        lexer.match_atrule_descriptor(descriptor.rule, &name, descriptor.value)
    }
    .map_err(thrown)?;

    if let Some(error) = &result.error {
        return Err(Error::Message(format!(
            "Invalid @{} {name}: {}",
            descriptor.rule,
            error.message()
        )));
    }

    if descriptor.rule == "page"
        && (name == "bleed" || name == "size")
        && ["calc(", "min(", "max(", "clamp("]
            .iter()
            .any(|function| contains_ignore_ascii_case(descriptor.value, function))
    {
        let multiplier = if name == "size" { "+" } else { "" };
        let code = format!(
            "@property --page-length {{syntax: \"<length>{multiplier}\"; inherits: false; initial-value: {};}}",
            descriptor.value
        );

        lightning::parse(&Options {
            code: &code,
            filename: "page.css",
            ..Options::default()
        })?;
    }

    Ok(())
}

/// Checks a native custom-media query before statement serialization.
///
/// # Errors
///
/// Fails with `Invalid custom-media query: {reason}` when the query does not match `@media`.
pub fn media(query: &str) -> Result<()> {
    let result = Lexer::get()
        .match_atrule_prelude("media", query)
        .map_err(thrown)?;

    match &result.error {
        Some(error) => Err(Error::Message(format!(
            "Invalid custom-media query: {}",
            error.message()
        ))),
        None => Ok(()),
    }
}

/// Reviews every declaration in standard named descriptor rules.
///
/// Covers `@counter-style`, `@custom-media`, `@document`, `@font-face`,
/// `@font-palette-values`, and `@page`, at any nesting depth.
///
/// # Errors
///
/// Fails with the first invalid rule's message, in document order.
pub fn validate(source: &str) -> Result<()> {
    let ast = syntax::parse(source, &ParseOptions::default()).map_err(parse_failure)?;
    let mut rules = Vec::new();

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

        // Only U+212A lowercases to an ASCII letter, `k`, which no rule name contains, so ASCII
        // case folding matches `toLowerCase` here.
        let name = [
            "document",
            "custom-media",
            "page",
            "counter-style",
            "font-face",
            "font-palette-values",
        ]
        .into_iter()
        .find(|candidate| name.eq_ignore_ascii_case(candidate));

        match name {
            Some("document") => document(&ast, *block, *prelude)?,
            Some("custom-media") => custom_media(&ast, *block, *prelude)?,
            Some("page") => page(&ast, *block, *prelude)?,
            Some(name) => descriptors(&ast, name, *block, *prelude)?,
            None => {}
        }
    }

    Ok(())
}

fn document(ast: &Ast<'_>, block: Option<NodeId>, prelude: Option<NodeId>) -> Result<()> {
    let (Some(_), Some(prelude)) = (block, prelude) else {
        return Err(Error::message(
            "Document rules require matching functions and a block.",
        ));
    };

    let text = generate(ast, prelude)?;
    let result = Lexer::get()
        .match_atrule_prelude("document", text.as_str())
        .map_err(thrown)?;

    match &result.error {
        Some(error) => Err(Error::Message(format!(
            "Invalid document matching functions: {}",
            error.message()
        ))),
        None => Ok(()),
    }
}

fn custom_media(ast: &Ast<'_>, block: Option<NodeId>, prelude: Option<NodeId>) -> Result<()> {
    let (None, Some(prelude)) = (block, prelude) else {
        return Err(Error::message(
            "Custom-media requires a name and query without a block.",
        ));
    };

    let text = generate(ast, prelude)?;
    let first = syntax::tokenize(&text)
        .find(|token| token.kind != TokenType::WhiteSpace && token.kind != TokenType::Comment);

    let Some(first) = first.filter(|token| token.kind == TokenType::Ident) else {
        return Err(Error::message(
            "Custom-media requires a dashed name and query.",
        ));
    };

    let start = first.start as usize;
    let end = first.end as usize;
    let name = syntax::ident::decode(text.get(start..end).unwrap_or_default());

    // Names starting with `--` are longer than two UTF-16 units exactly when longer than two bytes.
    if !name.starts_with("--") || name.len() <= 2 {
        return Err(Error::message(
            "Custom-media requires a dashed name and query.",
        ));
    }

    media(js::trim(text.get(end..).unwrap_or_default()))
}

fn page(ast: &Ast<'_>, block: Option<NodeId>, prelude: Option<NodeId>) -> Result<()> {
    let text = match prelude {
        Some(prelude) => generate(ast, prelude)?,
        None => String::new(),
    };
    let result = Lexer::get()
        .match_atrule_prelude("page", text.as_str())
        .map_err(thrown)?;

    if let Some(error) = &result.error {
        return Err(Error::Message(format!(
            "Invalid page selector: {}",
            error.message()
        )));
    }

    let Some(block) = block else {
        return Err(Error::message("Page rules require a block."));
    };

    for child in ast.children(block) {
        let Some(Node::Declaration {
            property, value, ..
        }) = ast.get(*child)
        else {
            continue;
        };

        if [
            "bleed",
            "marks",
            "page-margin-safety",
            "page-orientation",
            "size",
        ]
        .contains(property)
        {
            check(&Descriptor {
                name: property,
                rule: "page",
                value: &generate(ast, *value)?,
            })?;
        }
    }

    Ok(())
}

fn descriptors(
    ast: &Ast<'_>,
    name: &str,
    block: Option<NodeId>,
    prelude: Option<NodeId>,
) -> Result<()> {
    let Some(block) = block else {
        return Err(Error::Message(format!("Expected @{name} descriptors.")));
    };

    let text = match prelude {
        Some(prelude) => generate(ast, prelude)?,
        None => String::new(),
    };
    let lexer = Lexer::get();
    let matched = lexer
        .match_atrule_prelude(name, text.as_str())
        .map_err(thrown)?;

    if let Some(error) = &matched.error {
        return Err(Error::Message(format!(
            "Invalid @{name} prelude: {}",
            error.message()
        )));
    }

    // Generated values keyed by lowercase descriptor name. Later declarations replace earlier ones.
    let mut declarations: Vec<(String, String)> = Vec::new();

    for child in ast.children(block) {
        let Some(Node::Declaration {
            important: None,
            property,
            value,
        }) = ast.get(*child)
        else {
            return Err(Error::Message(format!(
                "Expected non-important @{name} descriptors."
            )));
        };

        let text = generate(ast, *value)?;
        let parsed = parse_value(&text)?;
        let root = parsed.root();
        let result = lexer
            .match_atrule_descriptor(name, property, MatchValue::Node(&parsed, root))
            .map_err(thrown)?;

        if let Some(error) = &result.error {
            return Err(Error::Message(format!(
                "Invalid @{name} {property}: {}",
                error.message()
            )));
        }

        let key = property.to_lowercase();

        if name == "font-face" {
            font_face(&parsed, &key)?;
        }

        if name == "font-palette-values" && *property == "override-colors" {
            let mut relative = false;

            syntax::walk(&parsed, root, |id, _| {
                relative = result.trace(id).is_some_and(|trace| {
                    trace.iter().any(|entry| match entry.kind {
                        SyntaxKind::Keyword => entry.name.to_lowercase() == "currentcolor",
                        SyntaxKind::Type => [
                            "system-color",
                            "light-dark()",
                            "light-dark-color",
                            "contrast-color()",
                            "device-cmyk()",
                        ]
                        .contains(&entry.name),
                        _ => false,
                    })
                });

                if relative {
                    Walk::Break
                } else {
                    Walk::Continue
                }
            });

            if relative {
                return Err(Error::message("Palette overrides require absolute colors."));
            }
        }

        match declarations
            .iter_mut()
            .find(|(existing, _)| *existing == key)
        {
            Some(entry) => entry.1 = text,
            None => declarations.push((key, text)),
        }
    }

    if name == "counter-style" {
        counter_style(&declarations)?;
    }

    Ok(())
}

fn font_face(parsed: &Ast<'_>, key: &str) -> Result<()> {
    for node in parsed.children(parsed.root()) {
        match parsed.get(*node) {
            Some(Node::Percentage { value })
                if [
                    "size-adjust",
                    "ascent-override",
                    "descent-override",
                    "line-gap-override",
                    "font-stretch",
                ]
                .contains(&key)
                    && js::to_number(value) < 0.0 =>
            {
                return Err(Error::Message(format!(
                    "@font-face {key} cannot be negative."
                )));
            }
            Some(Node::Number { value }) if key == "font-weight" => {
                let weight = js::to_number(value);
                #[expect(
                    clippy::manual_range_contains,
                    reason = "NaN passes both comparisons, as in TypeScript."
                )]
                let outside = weight < 1.0 || weight > 1000.0;

                if outside {
                    return Err(Error::message("Font weight must be between 1 and 1000."));
                }
            }
            _ => {}
        }
    }

    Ok(())
}

/// The components of a descriptor value that counter-style checks read.
enum Component {
    Identifier(String),
    Number(f64),
    Other,
}

fn components(declarations: &[(String, String)], key: &str) -> Result<Option<Vec<Component>>> {
    let Some((_, text)) = declarations.iter().find(|(name, _)| name == key) else {
        return Ok(None);
    };

    let parsed = parse_value(text)?;

    Ok(Some(
        parsed
            .children(parsed.root())
            .iter()
            .map(|node| match parsed.get(*node) {
                Some(Node::Identifier { name }) => {
                    Component::Identifier(syntax::ident::decode(name).to_lowercase())
                }
                Some(Node::Number { value }) => Component::Number(js::to_number(value)),
                _ => Component::Other,
            })
            .collect(),
    ))
}

fn counter_style(declarations: &[(String, String)]) -> Result<()> {
    let system = match components(declarations, "system")?.as_deref() {
        Some([Component::Identifier(name), ..]) => name.clone(),
        _ => "symbolic".to_owned(),
    };
    let symbols = components(declarations, "symbols")?.map_or(0, |symbols| symbols.len());

    if system == "numeric" || system == "alphabetic" {
        if symbols < 2 {
            return Err(Error::message(
                "Numeric and alphabetic counters require at least two symbols.",
            ));
        }
    } else if system == "additive" {
        if !declarations
            .iter()
            .any(|(name, _)| name == "additive-symbols")
        {
            return Err(Error::message(
                "Additive counters require additive symbols.",
            ));
        }
    } else if system != "extends" && symbols == 0 {
        return Err(Error::message(
            "Counter systems require at least one symbol.",
        ));
    }

    if let Some(additive) = components(declarations, "additive-symbols")? {
        let mut previous = f64::INFINITY;

        for component in additive {
            let Component::Number(weight) = component else {
                continue;
            };

            if weight >= previous {
                return Err(Error::message(
                    "Additive symbol weights must strictly descend.",
                ));
            }

            previous = weight;
        }
    }

    if let Some(range) = components(declarations, "range")? {
        let mut bounds = Vec::new();

        for component in range {
            match component {
                Component::Number(value) => bounds.push(value),
                Component::Identifier(name) if name == "infinite" => {
                    let bound = if bounds.len() % 2 == 1 {
                        f64::INFINITY
                    } else {
                        f64::NEG_INFINITY
                    };

                    bounds.push(bound);
                }
                _ => {}
            }
        }

        if bounds
            .chunks(2)
            .any(|pair| matches!(pair, [lower, upper] if lower > upper))
        {
            return Err(Error::message(
                "Counter ranges must have increasing bounds.",
            ));
        }
    }

    Ok(())
}

/// Converts camelCase capitals to `-` and the lowercase letter, like the TypeScript replace.
fn kebab(name: &str) -> String {
    let mut output = String::with_capacity(name.len() + 4);

    for character in name.chars() {
        if character.is_ascii_uppercase() {
            output.push('-');
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
    }

    output
}

fn contains_ignore_ascii_case(haystack: &str, needle: &str) -> bool {
    haystack
        .as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

/// Parses a declaration value, failing with css-tree's message.
pub(crate) fn parse_value(text: &str) -> Result<Ast<'_>> {
    syntax::parse(text, &ParseOptions::context(Context::Value)).map_err(parse_failure)
}

/// Serializes a node, failing with css-tree's message.
pub(crate) fn generate(ast: &Ast<'_>, node: NodeId) -> Result<String> {
    syntax::generate(ast, node).map_err(|error: GenerateError| Error::message(error.message))
}

/// Converts a css-tree parse exception.
#[cold]
pub(crate) fn parse_failure(error: SyntaxError) -> Error {
    Error::Message(error.message.into_owned())
}

/// Converts a css-tree lexer exception.
#[cold]
pub(crate) fn thrown(error: LexerError) -> Error {
    Error::Message(error.message)
}
