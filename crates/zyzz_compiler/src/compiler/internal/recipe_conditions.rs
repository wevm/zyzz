//! Partitions named recipe queries into mutually exclusive CSS regions.

use std::sync::Arc;

use oxc_ast::ast::Expression;
use oxc_span::{GetSpan, Span};
use zyzz_css_syntax::{Ast, Context, Node, ParseOptions, Walk};

use crate::error::{Error, Result};
use crate::internal::query::{self, Metadata};
use crate::js;

/// One named condition and its positive and negative grouping rules.
#[derive(Clone, Debug)]
pub struct Condition {
    /// The negated query list, as an intersection of grouping rules.
    pub inactive: Vec<String>,
    /// Authored name the selection callable uses.
    pub name: Arc<str>,
    /// The resolved positive grouping rule.
    pub rule: String,
    /// Span of the authored value, for diagnostics and mapping.
    pub span: Span,
}

fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

/// Resolves theme thresholds and derives a logical complement without evaluation.
///
/// # Errors
///
/// Returns `Themes.InvalidError` for reserved names, non-string values, and conditions other than
/// well-formed `@media` and `@supports` rules.
pub fn read(name: &str, node: &Expression<'_>, queries: Option<&Metadata>) -> Result<Condition> {
    let span = node.span();

    if name == "__proto__" {
        return Err(invalid(
            "Recipe condition names cannot use __proto__.",
            span,
        ));
    }

    let Expression::StringLiteral(literal) = node else {
        return Err(invalid(
            "Recipe conditions require static media or supports strings.",
            span,
        ));
    };
    let fallback = Metadata::default();
    let rule = query::resolve(&literal.value, queries.unwrap_or(&fallback))
        .map_err(|error| invalid(&error.text(), span))?;
    let complement = (|| {
        let uncommented = query::strip_comments(&rule);
        let Some((kind, text)) = split(&uncommented) else {
            return Err("Recipe conditions support only @media and @supports.".to_owned());
        };

        if kind == "supports" {
            return supports(text).map(|()| vec![format!("@supports not ({text})")]);
        }

        media(text)
    })();

    match complement {
        Ok(inactive) => Ok(Condition {
            inactive,
            name: Arc::from(name),
            rule,
            span,
        }),
        Err(message) => Err(invalid(&message, span)),
    }
}

/// Matches `^@(media|supports)(?=[\s(])\s*([\s\S]+)$`.
fn split(rule: &str) -> Option<(&'static str, &str)> {
    let (kind, rest) = if let Some(rest) = rule.strip_prefix("@media") {
        ("media", rest)
    } else {
        ("supports", rule.strip_prefix("@supports")?)
    };
    let first = rest.chars().next()?;

    if !js::is_whitespace(first) && first != '(' {
        return None;
    }

    let text = rest.trim_start_matches(js::is_whitespace);

    if !text.is_empty() {
        return Some((kind, text));
    }

    // The greedy whitespace run backtracks one character so the text is not empty.
    let last = rest
        .char_indices()
        .next_back()
        .map_or(0, |(index, _)| index);

    Some((kind, rest.get(last..).unwrap_or_default()))
}

/// Parses the complete rule so malformed braces or trailing rules cannot become part of a
/// synthesized condition.
fn supports(text: &str) -> std::result::Result<(), String> {
    const MALFORMED: &str = "Malformed supports condition.";

    let source = format!("@supports {text}{{}}");
    let ast = zyzz_css_syntax::parse(&source, &ParseOptions::default())
        .map_err(|error| error.message.into_owned())?;
    let Some(Node::StyleSheet { children }) = ast.get(ast.root()) else {
        return Err(MALFORMED.to_owned());
    };
    let [entry] = ast.list(*children) else {
        return Err(MALFORMED.to_owned());
    };
    let Some(Node::Atrule {
        block: Some(block),
        prelude: Some(prelude),
        ..
    }) = ast.get(*entry)
    else {
        return Err(MALFORMED.to_owned());
    };

    if !ast.children(*block).is_empty() {
        return Err(MALFORMED.to_owned());
    }

    let complete = zyzz_css_syntax::walk(&ast, *prelude, |_, node| {
        if matches!(node, Node::Raw { .. }) {
            Walk::Break
        } else {
            Walk::Continue
        }
    });

    if complete {
        Ok(())
    } else {
        Err(MALFORMED.to_owned())
    }
}

fn media(text: &str) -> std::result::Result<Vec<String>, String> {
    const MALFORMED: &str = "Malformed media condition.";

    let mut ast: Ast<'_> =
        zyzz_css_syntax::parse(text, &ParseOptions::context(Context::MediaQueryList))
            .map_err(|error| error.message.into_owned())?;
    let Some(Node::MediaQueryList { children }) = ast.get(ast.root()) else {
        return Err(MALFORMED.to_owned());
    };
    let queries = ast.list(*children).to_vec();

    if queries.is_empty() {
        return Err(MALFORMED.to_owned());
    }

    let mut inactive = Vec::with_capacity(queries.len());

    for query in queries {
        let Some(Node::MediaQuery {
            condition,
            media_type,
            modifier,
        }) = ast.get_mut(query)
        else {
            return Err(MALFORMED.to_owned());
        };

        if media_type.is_some() {
            *modifier = if modifier.is_some_and(|modifier| modifier.eq_ignore_ascii_case("not")) {
                None
            } else {
                Some("not")
            };

            let generated =
                zyzz_css_syntax::generate(&ast, query).map_err(|error| error.message.to_owned())?;

            inactive.push(format!("@media {generated}"));
            continue;
        }

        let Some(condition) = *condition else {
            return Err(MALFORMED.to_owned());
        };
        let generated =
            zyzz_css_syntax::generate(&ast, condition).map_err(|error| error.message.to_owned())?;

        inactive.push(format!("@media not ({generated})"));
    }

    Ok(inactive)
}

/// One grouping rule of a region, with the span of the condition that owns it.
#[derive(Clone, Debug)]
pub struct RegionRule {
    /// The grouping rule.
    pub rule: String,
    /// Span of the authored condition.
    pub span: Span,
}

/// One satisfiable candidate truth region. CSS discards impossible intersections.
#[derive(Clone, Debug, Default)]
pub struct Region {
    /// Active condition indexes in authored priority order.
    pub active: Vec<u32>,
    /// Nested grouping rules that define the region.
    pub rules: Vec<RegionRule>,
}

/// Enumerates condition states only, never combinations of axis choices.
///
/// # Errors
///
/// Returns `Themes.InvalidError` for more than eight conditions.
pub fn regions(conditions: &[Condition]) -> Result<Vec<Region>> {
    // A compile-time ceiling bounds generated output before allocating regions.
    if let Some(ninth) = conditions.get(8) {
        return Err(invalid(
            "Recipes support at most eight named conditions (256 CSS regions).",
            ninth.span,
        ));
    }

    let mut result = vec![Region::default()];

    for (index, condition) in (0_u32..).zip(conditions) {
        result = result
            .into_iter()
            .flat_map(|region| {
                let mut inactive = region.clone();
                let mut active = region;

                inactive
                    .rules
                    .extend(condition.inactive.iter().map(|rule| RegionRule {
                        rule: rule.clone(),
                        span: condition.span,
                    }));
                active.active.push(index);
                active.rules.push(RegionRule {
                    rule: condition.rule.clone(),
                    span: condition.span,
                });

                [inactive, active]
            })
            .collect();
    }

    Ok(result)
}
