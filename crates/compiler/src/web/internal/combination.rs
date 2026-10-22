//! Merges the grouped rules one element always applies together into one rule.
//!
//! The rules apply in order, so a later declaration overrides an earlier one of the same property
//! and specificity. The merged rule lists every surviving top-level declaration before every
//! nested block, the order every nesting implementation serializes, so a nested block moves
//! ahead of the top-level declarations that followed it. A nested declaration those declarations
//! always override is dropped. The merge fails when one only partly overrides it, or overrides
//! it under a specificity the merge cannot read, since moving it would change the cascade.

use std::sync::Arc;

use rustc_hash::FxHashSet;

use crate::internal::token::CssOutput;
use crate::js;
use crate::style::{Declaration, NamedStyle, Rule};
use crate::web::css;

/// A run of top-level declarations or one nested block, in application order.
enum Piece<'s> {
    Block(&'s Rule),
    Declarations(&'s [Declaration]),
}

/// How a nested block's selector compares with the merged rule's own selector.
#[derive(Clone, Copy, Eq, PartialEq)]
enum Scope {
    /// Matches the element at a higher specificity, or another element.
    Raised,
    /// Matches the element at the same specificity, under at-rule conditions alone.
    Same,
    /// Neither is known.
    Unknown,
}

/// The deepest nesting a merge reads, which bounds recursion through authored blocks.
const DEPTH: usize = 32;

/// Merges grouped rules that one element always applies together, in order, into the rules of
/// one grouped style. A rule without its own output mode takes `default`. Returns `None` when a
/// rule is not grouped, carries target branches or cascade layers, or a nested block cannot move
/// ahead of the declarations that follow it.
pub fn merge(name: &Arc<str>, rules: &[Rule], default: Option<CssOutput>) -> Option<Vec<Rule>> {
    let mut pieces: Vec<Piece<'_>> = Vec::new();

    for rule in rules {
        if rule.style.css_output.or(default) != Some(CssOutput::Grouped) {
            return None;
        }

        collect(rule, &mut pieces, 0)?;
    }

    let declarations: Vec<(usize, &Declaration)> = pieces
        .iter()
        .enumerate()
        .flat_map(|(index, piece)| match piece {
            Piece::Declarations(list) => list.iter().map(|item| (index, item)).collect(),
            Piece::Block(_) => Vec::new(),
        })
        .collect();
    let mut dropped: FxHashSet<*const Declaration> = FxHashSet::default();

    // Fallbacks repeat a property within one run, so only a later run overrides a declaration.
    for (position, (index, declaration)) in declarations.iter().enumerate() {
        let overridden = declarations
            .get(position + 1..)
            .unwrap_or_default()
            .iter()
            .any(|(later, other)| later > index && overrides(other, declaration));

        if overridden {
            dropped.insert(std::ptr::from_ref(*declaration));
        }
    }

    for (index, piece) in pieces.iter().enumerate() {
        let Piece::Block(rule) = piece else {
            continue;
        };
        let later: Vec<&Declaration> = declarations
            .iter()
            .filter(|(position, _)| *position > index)
            .map(|(_, declaration)| *declaration)
            .collect();

        if !later.is_empty() {
            let scope = scope(rule.condition.as_deref().unwrap_or("&"), Scope::Same);

            moved(&rule.style, scope, &later, &mut dropped, 0)?;
        }
    }

    let kept: Vec<Declaration> = declarations
        .iter()
        .filter(|(_, declaration)| !dropped.contains(&std::ptr::from_ref(*declaration)))
        .map(|(_, declaration)| (*declaration).clone())
        .collect();
    let mut output: Vec<Rule> = Vec::with_capacity(pieces.len());

    if !kept.is_empty() {
        output.push(Rule {
            condition: None,
            style: Arc::new(NamedStyle {
                css_output: Some(CssOutput::Grouped),
                declarations: kept,
                name: Arc::clone(name),
                ..NamedStyle::default()
            }),
        });
    }

    for piece in &pieces {
        if let Piece::Block(rule) = piece
            && let Some(style) = without(&rule.style, &dropped)
        {
            output.push(Rule {
                condition: rule.condition.clone(),
                style: Arc::new(style),
            });
        }
    }

    Some(output)
}

/// Lists a rule's pieces as the grouped emitter writes them, failing on layers and targets.
fn collect<'s>(rule: &'s Rule, output: &mut Vec<Piece<'s>>, depth: usize) -> Option<()> {
    if depth > DEPTH || rule.style.targets.is_some() {
        return None;
    }

    if let Some(condition) = &rule.condition {
        if layered(&rule.style, condition, 0) {
            return None;
        }

        output.push(Piece::Block(rule));
        return Some(());
    }

    match &rule.style.rules {
        Some(rules) => {
            for rule in rules {
                collect(rule, output, depth + 1)?;
            }
        }
        None if !rule.style.declarations.is_empty() => {
            output.push(Piece::Declarations(&rule.style.declarations));
        }
        None => {}
    }

    Some(())
}

/// Whether a block opens or contains a cascade layer, whose order a merge must not touch.
fn layered(style: &NamedStyle, condition: &str, depth: usize) -> bool {
    let condition = js::trim(condition);

    if condition
        .strip_prefix("@layer")
        .is_some_and(|rest| !rest.starts_with(js::is_word))
    {
        return true;
    }

    depth > DEPTH
        || style.targets.is_some()
        || style.rules.iter().flatten().any(|rule| {
            rule.condition
                .as_deref()
                .is_some_and(|condition| layered(&rule.style, condition, depth + 1))
                || (rule.condition.is_none() && layered(&rule.style, "", depth + 1))
        })
}

/// Whether `later` always wins over `earlier` on the same element at the same specificity.
fn overrides(later: &Declaration, earlier: &Declaration) -> bool {
    later.property == earlier.property && (later.important || !earlier.important)
}

/// Checks the declarations of a block that moves ahead of `later`, recording the ones `later`
/// always overrides. Fails when another one conflicts with `later`.
fn moved(
    style: &NamedStyle,
    scope: Scope,
    later: &[&Declaration],
    dropped: &mut FxHashSet<*const Declaration>,
    depth: usize,
) -> Option<()> {
    if depth > DEPTH {
        return None;
    }

    if let Some(rules) = &style.rules {
        for rule in rules {
            let inner = match &rule.condition {
                Some(condition) => self::scope(condition, scope),
                None => scope,
            };

            moved(&rule.style, inner, later, dropped, depth + 1)?;
        }

        return Some(());
    }

    for declaration in &style.declarations {
        if scope == Scope::Raised {
            continue;
        }

        if scope == Scope::Same && later.iter().any(|other| overrides(other, declaration)) {
            dropped.insert(std::ptr::from_ref(declaration));
            continue;
        }

        // Importance decides between declarations of different importance, whatever their order.
        if later.iter().any(|other| {
            other.important == declaration.important
                && css::overlaps(&other.property, &declaration.property)
        }) {
            return None;
        }
    }

    Some(())
}

/// The scope of a block under `condition`, nested in a block of scope `outer`.
fn scope(condition: &str, outer: Scope) -> Scope {
    let condition = js::trim(condition);

    if condition.starts_with('@') {
        let conditional = ["@media", "@container", "@supports"].iter().any(|prefix| {
            condition
                .strip_prefix(prefix)
                .is_some_and(|rest| !rest.starts_with(js::is_word))
        });

        return match outer {
            Scope::Raised => Scope::Raised,
            _ if conditional => outer,
            _ => Scope::Unknown,
        };
    }

    if condition == "&" {
        return outer;
    }

    if raised(condition) {
        Scope::Raised
    } else {
        Scope::Unknown
    }
}

/// Whether every selector of a list names the nesting parent outside any function and adds a
/// class, attribute, id, pseudo-class, or pseudo-element there, which raises its specificity.
fn raised(list: &str) -> bool {
    let bytes = list.as_bytes();
    let mut depth = 0_usize;
    let mut nested = false;
    let mut adds = false;
    let mut index = 0;

    while let Some(byte) = bytes.get(index).copied() {
        index += 1;

        match byte {
            b'\\' => index += 1,
            b'(' | b'[' => {
                // An attribute selector adds specificity before its brackets open.
                adds |= byte == b'[' && depth == 0;
                depth += 1;
            }
            b')' | b']' => depth = depth.saturating_sub(1),
            _ if depth > 0 => {}
            b',' => {
                if !(nested && adds) {
                    return false;
                }

                nested = false;
                adds = false;
            }
            b'&' => nested = true,
            b'.' | b'#' => adds = true,
            b':' => {
                if bytes.get(index) == Some(&b':') {
                    adds = true;
                    index += 1;
                    continue;
                }

                let start = index;

                while bytes
                    .get(index)
                    .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
                {
                    index += 1;
                }

                let name = list.get(start..index).unwrap_or_default();

                // Functional pseudo-classes other than `:nth-*()` take their arguments' specificity.
                adds |= !name.is_empty()
                    && (bytes.get(index) != Some(&b'(') || name.starts_with("nth-"));
            }
            _ => {}
        }
    }

    nested && adds
}

/// A copy of a block without the dropped declarations, or `None` when nothing remains.
fn without(style: &NamedStyle, dropped: &FxHashSet<*const Declaration>) -> Option<NamedStyle> {
    if let Some(rules) = &style.rules {
        let rules: Vec<Rule> = rules
            .iter()
            .filter_map(|rule| {
                without(&rule.style, dropped).map(|style| Rule {
                    condition: rule.condition.clone(),
                    style: Arc::new(style),
                })
            })
            .collect();

        return (!rules.is_empty()).then(|| NamedStyle {
            rules: Some(rules),
            ..style.clone()
        });
    }

    let declarations: Vec<Declaration> = style
        .declarations
        .iter()
        .filter(|declaration| !dropped.contains(&std::ptr::from_ref(*declaration)))
        .cloned()
        .collect();

    (!declarations.is_empty()).then(|| NamedStyle {
        declarations,
        ..style.clone()
    })
}
