//! Validates view-transition descriptors before a parser can discard invalid values.
//!
//! Callers rename `@view-transition` to a marker the output parser keeps as an unknown rule, so
//! descriptors are read from its decoded tokens.

use lightningcss::properties::custom::{Token, TokenOrValue};
use lightningcss::rules::CssRule;
use lightningcss::rules::unknown::UnknownAtRule;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

use crate::compiler::internal::lightning::{self, Options};
use crate::error::{Error, Result};

/// Checks every rule named `marker` in a token-preserving spelling of view-transition rules.
///
/// # Errors
///
/// Fails with the output parser's message when the stylesheet does not parse, and otherwise
/// with the first invalid rule's message, in document order.
pub fn validate(source: &str, marker: &str) -> Result<()> {
    let mut sheet = lightning::parse(&Options {
        code: source,
        filename: "view-transitions.css",
        ..Options::default()
    })?;

    sheet.visit(&mut Transitions { marker })
}

struct Transitions<'m> {
    marker: &'m str,
}

impl<'i> Visitor<'i> for Transitions<'_> {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Unknown(unknown) = &*rule
            && unknown.name.as_ref() == self.marker
        {
            transition(unknown)?;
        }

        rule.visit_children(self)
    }
}

fn transition(rule: &UnknownAtRule<'_>) -> Result<()> {
    let (true, Some(block)) = (rule.prelude.0.is_empty(), &rule.block) else {
        return Err(Error::message(
            "View-transition rules require a descriptor block and no prelude.",
        ));
    };

    let mut declaration = Vec::new();

    for token in &block.0 {
        match token {
            TokenOrValue::Token(Token::WhiteSpace(_) | Token::Comment(_)) => {}
            TokenOrValue::Token(Token::Semicolon) => {
                descriptor(&declaration)?;
                declaration.clear();
            }
            _ => declaration.push(token),
        }
    }

    descriptor(&declaration)
}

fn descriptor(declaration: &[&TokenOrValue<'_>]) -> Result<()> {
    if declaration.is_empty() {
        return Ok(());
    }

    let [
        TokenOrValue::Token(Token::Ident(name)),
        TokenOrValue::Token(Token::Colon),
        values @ ..,
    ] = declaration
    else {
        return Err(Error::message("Invalid view-transition descriptor."));
    };

    let names = values
        .iter()
        .map(|value| match value {
            TokenOrValue::DashedIdent(name) => Some(name.0.to_lowercase()),
            TokenOrValue::Token(Token::Ident(name)) => Some(name.to_lowercase()),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()
        .filter(|names| !names.is_empty());

    let Some(names) = names else {
        return Err(Error::message("Invalid view-transition descriptor."));
    };

    match name.to_lowercase().as_str() {
        "navigation" => {
            if !matches!(names.as_slice(), [only] if only == "auto" || only == "none") {
                return Err(Error::message("Invalid view-transition navigation."));
            }
        }
        "types" => {
            if names.iter().any(|name| {
                [
                    "default",
                    "inherit",
                    "initial",
                    "revert",
                    "revert-layer",
                    "unset",
                ]
                .contains(&name.as_str())
                    || (name == "none" && names.len() != 1)
            }) {
                return Err(Error::message("Invalid view-transition types."));
            }
        }
        _ => return Err(Error::message("Unknown view-transition descriptor.")),
    }

    Ok(())
}
