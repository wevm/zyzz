//! Checks complete keyframe selectors, including named timeline ranges.

use lightningcss::rules::CssRule;
use lightningcss::rules::keyframes::KeyframeSelector;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

use crate::compiler::internal::lightning::{self, Options};
use crate::error::{Error, Result};

/// Rejects ordinary offsets outside 0–100% and importance in transported keyframes.
///
/// # Errors
///
/// Fails with the output parser's message when the stylesheet does not parse, and otherwise
/// with the first invalid keyframe's message, in document order.
pub fn validate(source: &str) -> Result<()> {
    let mut sheet = lightning::parse(&Options {
        code: source,
        filename: "keyframes.css",
        ..Options::default()
    })?;

    sheet.visit(&mut Frames)
}

struct Frames;

impl<'i> Visitor<'i> for Frames {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Keyframes(keyframes) = &*rule {
            for frame in &keyframes.keyframes {
                if frame.selectors.iter().any(|selector| {
                    matches!(selector, KeyframeSelector::Percentage(offset) if offset.0 < 0.0 || offset.0 > 1.0)
                }) {
                    return Err(Error::message(
                        "Ordinary keyframe offsets must be within 0–100%.",
                    ));
                }

                if !frame.declarations.important_declarations.is_empty() {
                    return Err(Error::message("Keyframes forbid important declarations."));
                }
            }
        }

        rule.visit_children(self)
    }
}

/// Whether a keyframe selector list parses, with ordinary offsets within 0–100%.
///
/// Named timeline range percentages are unrestricted.
pub fn accepts(selector: &str) -> bool {
    let code = format!("@keyframes zyzz {{{selector}{{opacity:0}}}}");
    let Ok(sheet) = lightning::parse(&Options {
        code: &code,
        filename: "keyframe.css",
        ..Options::default()
    }) else {
        return false;
    };

    let [CssRule::Keyframes(rule)] = sheet.rules.0.as_slice() else {
        return false;
    };

    let [frame] = rule.keyframes.as_slice() else {
        return false;
    };

    !frame.selectors.is_empty()
        && frame.selectors.iter().all(|selector| match selector {
            KeyframeSelector::Percentage(offset) => offset.0 >= 0.0 && offset.0 <= 1.0,
            _ => true,
        })
}
