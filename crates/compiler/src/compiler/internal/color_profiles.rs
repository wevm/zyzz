//! Checks custom color-profile descriptors before source or packed publication.
//!
//! The output parser keeps `@color-profile` as an unknown rule, so descriptors are read from its
//! decoded tokens.

use lightningcss::properties::custom::{Token, TokenOrValue};
use lightningcss::rules::CssRule;
use lightningcss::rules::unknown::UnknownAtRule;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

use crate::compiler::internal::lightning::{self, Options};
use crate::error::{Error, Result};

/// Validates complete profile blocks, including decoded component and intent tokens.
///
/// # Errors
///
/// Fails with the output parser's message when the stylesheet does not parse, and otherwise
/// with the first invalid profile's message, in document order.
pub fn validate(source: &str) -> Result<()> {
    let mut sheet = lightning::parse(&Options {
        code: source,
        filename: "color-profiles.css",
        ..Options::default()
    })?;

    sheet.visit(&mut Profiles)
}

struct Profiles;

impl<'i> Visitor<'i> for Profiles {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Unknown(unknown) = &*rule
            && unknown.name.as_ref() == "color-profile"
        {
            profile(unknown)?;
        }

        rule.visit_children(self)
    }
}

fn profile(rule: &UnknownAtRule<'_>) -> Result<()> {
    let named = match rule.prelude.0.as_slice() {
        [TokenOrValue::DashedIdent(_)] => true,
        [TokenOrValue::Token(Token::Ident(name))] => name.to_lowercase() == "device-cmyk",
        _ => false,
    };

    let (true, Some(block)) = (named, &rule.block) else {
        return Err(Error::message(
            "Expected a color-profile name and descriptor block.",
        ));
    };

    let mut declaration = Vec::new();
    let mut src = false;

    for token in &block.0 {
        match token {
            TokenOrValue::Token(Token::WhiteSpace(_) | Token::Comment(_)) => {}
            TokenOrValue::Token(Token::Semicolon) => {
                descriptor(&declaration, &mut src)?;
                declaration.clear();
            }
            _ => declaration.push(token),
        }
    }

    descriptor(&declaration, &mut src)?;

    if !src {
        return Err(Error::message("Color-profile requires a src descriptor."));
    }

    Ok(())
}

fn descriptor(declaration: &[&TokenOrValue<'_>], src: &mut bool) -> Result<()> {
    if declaration.is_empty() {
        return Ok(());
    }

    let [
        TokenOrValue::Token(Token::Ident(name)),
        TokenOrValue::Token(Token::Colon),
        values @ ..,
    ] = declaration
    else {
        return Err(Error::message("Invalid color-profile descriptor."));
    };

    match name.to_lowercase().as_str() {
        "src" => {
            if !matches!(values, [TokenOrValue::Url(_)]) {
                return Err(Error::message("Color-profile src requires one URL."));
            }

            *src = true;
        }
        "rendering-intent" => {
            let valid = matches!(
                values,
                [TokenOrValue::Token(Token::Ident(intent))] if [
                    "absolute-colorimetric",
                    "relative-colorimetric",
                    "perceptual",
                    "saturation",
                ]
                .contains(&intent.to_lowercase().as_str())
            );

            if !valid {
                return Err(Error::message("Invalid color-profile rendering intent."));
            }
        }
        "components" => {
            let invalid = values.len() % 2 != 1
                || values.iter().enumerate().any(|(index, token)| {
                    if index % 2 == 1 {
                        return !matches!(token, TokenOrValue::Token(Token::Comma));
                    }

                    match token {
                        TokenOrValue::DashedIdent(name) => name.0.to_lowercase() == "none",
                        TokenOrValue::Token(Token::Ident(name)) => name.to_lowercase() == "none",
                        _ => true,
                    }
                });

            if invalid {
                return Err(Error::message(
                    "Color-profile components require comma-separated identifiers other than none.",
                ));
            }
        }
        _ => return Err(Error::message("Unknown color-profile descriptor.")),
    }

    Ok(())
}
