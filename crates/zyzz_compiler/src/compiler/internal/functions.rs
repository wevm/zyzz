//! Checks CSS function arguments and defaults against native syntax definitions.

use zyzz_css_syntax::{self as syntax, Ast, Context, Lexer, Node, NodeId, ParseOptions, TokenType};

use crate::compiler::internal::descriptors::{generate, parse_failure, parse_value, thrown};
use crate::compiler::internal::lightning::{self, Options};
use crate::error::{Error, Result};
use crate::internal::function_syntax;
use crate::js;

/// Checks a complete static value against a function parameter syntax.
///
/// A value wrapped in `{}` is checked without the braces. Values that call `var()`, `env()`,
/// `attr()`, or a custom function are left to CSS, as is the universal syntax `*`. Returns the
/// first syntax alternative that accepts the value, or `None` when the check was skipped.
///
/// # Errors
///
/// Fails with css-tree's message when the value does not parse, and with
/// `Invalid CSS function argument for its declared syntax.` when no alternative accepts it.
pub fn value(syntax: &str, input: &str) -> Result<Option<String>> {
    let text = js::trim(input);
    let body = text
        .strip_prefix('{')
        .and_then(|inner| inner.strip_suffix('}'))
        .unwrap_or(text);
    let parsed = parse_value(body)?;
    let mut computed = false;

    syntax::walk(&parsed, parsed.root(), |_, node| {
        if let Node::Function { name, .. } = node
            && substitution(&syntax::ident::decode(name))
        {
            computed = true;
        }

        syntax::Walk::Continue
    });

    let normalized = js::trim(syntax);
    let definition = if normalized.starts_with("type(") {
        js::trim(js::slice(
            normalized,
            5,
            js::utf16_len(normalized).saturating_sub(1),
        ))
    } else {
        normalized
    };

    if computed || definition == "*" {
        return Ok(None);
    }

    let mut alternatives = Vec::new();
    let mut start = 0;

    for token in syntax::tokenize(definition) {
        let from = token.start as usize;
        let to = token.end as usize;

        if token.kind == TokenType::Delim && definition.get(from..to) == Some("|") {
            alternatives.push(js::trim(definition.get(start..from).unwrap_or_default()));
            start = to;
        }
    }

    alternatives.push(js::trim(definition.get(start..).unwrap_or_default()));

    for alternative in alternatives {
        if accepts(alternative, body, &parsed) {
            return Ok(Some(alternative.to_owned()));
        }
    }

    Err(Error::message(
        "Invalid CSS function argument for its declared syntax.",
    ))
}

/// Matches `/^(?:--|var$|env$|attr$)/i` against a decoded function name.
fn substitution(name: &str) -> bool {
    name.starts_with("--")
        || ["var", "env", "attr"]
            .iter()
            .any(|function| name.eq_ignore_ascii_case(function))
}

/// Whether one syntax alternative accepts a value. Failures fall through to the next one.
fn accepts(alternative: &str, body: &str, parsed: &Ast<'_>) -> bool {
    if alternative.starts_with('<') {
        if alternative.starts_with("<string>") {
            return Lexer::get()
                .match_syntax(alternative, body)
                .is_ok_and(|result| result.error.is_none());
        }

        let code = format!(
            "@property --argument{{syntax:{};inherits:false;initial-value:{body};}}",
            js::quote(alternative)
        );

        return lightning::parse(&Options {
            code: &code,
            filename: "argument.css",
            ..Options::default()
        })
        .is_ok();
    }

    let mut multiplier = "";
    let mut atom = alternative;

    for token in syntax::tokenize(alternative) {
        let from = token.start as usize;
        let to = token.end as usize;
        let text = alternative.get(from..to).unwrap_or_default();

        if token.kind == TokenType::Delim && to == alternative.len() && (text == "+" || text == "#")
        {
            multiplier = text;
            atom = alternative.get(..from).unwrap_or_default();
        }
    }

    let expected = syntax::ident::decode(atom);
    let mut count = 0;
    let mut comma = false;

    for node in parsed.children(parsed.root()) {
        match parsed.get(*node) {
            Some(Node::Operator { value })
                if value == "," && multiplier == "#" && count > 0 && !comma =>
            {
                comma = true;
                continue;
            }
            Some(Node::Identifier { name })
                if syntax::ident::decode(name) == expected
                    && (count == 0 || (multiplier == "+" || (multiplier == "#" && comma))) => {}
            _ => return false,
        }

        count += 1;
        comma = false;
    }

    count > 0 && !comma
}

/// Validates packed function headers and body contexts before parser recovery.
///
/// # Errors
///
/// Fails with the first invalid `@function` rule's message, in document order, including
/// css-tree parse messages from parameter defaults and result values.
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

        // ASCII case folding matches `toLowerCase` for names without `k`.
        if !name.eq_ignore_ascii_case("function") {
            continue;
        }

        let (Some(prelude), Some(block)) = (prelude, block) else {
            return Err(Error::message(
                "CSS functions require parameters and a body.",
            ));
        };

        header(&generate(&ast, *prelude)?)?;
        body(&ast, *block)?;
    }

    Ok(())
}

fn header(prelude: &str) -> Result<()> {
    let mut opening = 0;
    let mut closing = None;
    let mut depth = 0_i64;
    let mut commas = Vec::new();

    for token in syntax::tokenize(prelude) {
        let start = token.start as usize;
        let end = token.end as usize;

        match token.kind {
            TokenType::Function | TokenType::LeftParenthesis => {
                if depth == 0 {
                    let name = syntax::ident::decode(
                        prelude
                            .get(start..end.saturating_sub(1))
                            .unwrap_or_default(),
                    );

                    if start != 0
                        || token.kind != TokenType::Function
                        || !name.starts_with("--")
                        || name.len() <= 2
                    {
                        return Err(Error::message(
                            "CSS function names require a dashed identifier.",
                        ));
                    }

                    opening = end;
                }

                depth += 1;
            }
            TokenType::RightParenthesis => {
                depth -= 1;

                if depth == 0 {
                    closing = Some(start);
                    break;
                }
            }
            TokenType::Comma if depth == 1 => commas.push(start),
            _ => {}
        }
    }

    let Some(closing) = closing else {
        return Err(Error::message("Unclosed CSS function parameters."));
    };

    let mut names: Vec<String> = Vec::new();
    let mut start = opening;

    commas.push(closing);

    for end in commas {
        let parameter = js::trim(prelude.get(start..end).unwrap_or_default());

        start = end + 1;

        if parameter.is_empty() && end == closing && opening == closing {
            continue;
        }

        parameter_syntax(parameter, &mut names)?;
    }

    let returns = js::trim(prelude.get(closing + 1..).unwrap_or_default());

    if !returns.is_empty()
        && !returns
            .strip_prefix("returns ")
            .is_some_and(function_syntax::accepts)
    {
        return Err(Error::message("Invalid CSS function return syntax."));
    }

    Ok(())
}

fn parameter_syntax(parameter: &str, names: &mut Vec<String>) -> Result<()> {
    let mut name = String::new();
    let mut offset = 0;
    let mut colon = None;
    let mut depth = 0_i64;

    for token in syntax::tokenize(parameter) {
        let from = token.start as usize;

        if from == 0 && token.kind == TokenType::Ident {
            offset = token.end as usize;
            name = syntax::ident::decode(parameter.get(..offset).unwrap_or_default()).into_owned();
        }

        match token.kind {
            TokenType::Function | TokenType::LeftParenthesis => depth += 1,
            TokenType::RightParenthesis => depth -= 1,
            TokenType::Colon if depth == 0 && colon.is_none() => colon = Some(from),
            _ => {}
        }
    }

    if !name.starts_with("--") || name.len() <= 2 || names.contains(&name) {
        return Err(Error::message(
            "CSS function parameters require unique dashed names.",
        ));
    }

    names.push(name);

    let declared = js::trim(
        parameter
            .get(offset..colon.unwrap_or(parameter.len()))
            .unwrap_or_default(),
    );
    let syntax = if declared.is_empty() { "*" } else { declared };

    if !function_syntax::accepts(syntax) {
        return Err(Error::message("Invalid CSS function parameter syntax."));
    }

    if let Some(colon) = colon {
        value(syntax, parameter.get(colon + 1..).unwrap_or_default())?;
    }

    Ok(())
}

fn body(ast: &Ast<'_>, block: NodeId) -> Result<()> {
    let text = generate(ast, block)?;
    let inner = text
        .get(1..text.len().saturating_sub(1))
        .unwrap_or_default();
    let declarations = syntax::parse(inner, &ParseOptions::context(Context::DeclarationList))
        .map_err(parse_failure)?;

    for node in declarations.children(declarations.root()) {
        match declarations.get(*node) {
            Some(Node::Atrule {
                block: Some(block),
                name,
                prelude: Some(prelude),
            }) if ["media", "supports", "container"].contains(name) => {
                let condition = generate(&declarations, *prelude)?;
                let result = Lexer::get()
                    .match_atrule_prelude(name, condition.as_str())
                    .map_err(thrown)?;

                if result.error.is_some() {
                    return Err(Error::message("Invalid CSS function condition."));
                }

                body(&declarations, *block)?;
            }
            Some(Node::Declaration {
                important: None,
                property,
                value: declared,
            }) if *property == "result" || property.starts_with("--") => {
                value("*", &generate(&declarations, *declared)?)?;
            }
            _ => return Err(Error::message("Invalid CSS function body context.")),
        }
    }

    Ok(())
}
