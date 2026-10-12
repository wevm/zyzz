//! Derives emitted names from authored bindings rather than source locations.

use std::borrow::Cow;

use oxc_ast::AstKind;
use oxc_ast::ast::{BindingPattern, FunctionType, PropertyKey, TSNamespaceDeclarationBody};
use oxc_semantic::Semantic;
use rustc_hash::FxHashMap;
use smallvec::SmallVec;

use crate::compiler::internal::statics;
use crate::internal::identity;

/// Readable declaration paths of calls, keyed by call start offset.
#[derive(Debug, Default)]
pub struct Names {
    /// Byte range of each call's path in `text`.
    ranges: FxHashMap<u32, (u32, u32)>,
    /// Every path, concatenated.
    text: String,
}

impl Names {
    /// The path of the call starting at an offset. A call outside any named declaration is
    /// named `style`.
    pub fn get(&self, start: u32) -> Option<&str> {
        self.ranges
            .get(&start)
            .and_then(|(from, to)| self.text.get(*from as usize..*to as usize))
    }

    /// Every call start and its path, in no particular order.
    pub fn iter(&self) -> impl Iterator<Item = (u32, &str)> {
        self.ranges.iter().filter_map(|(start, (from, to))| {
            self.text
                .get(*from as usize..*to as usize)
                .map(|name| (*start, name))
        })
    }
}

/// Collects readable declaration paths for calls in constants and namespaces.
///
/// Each call's path comes from its ancestors in the semantic node tree, so only calls are
/// visited. Calls sharing a start offset share their ancestors' segments, and the last in source
/// order keeps the entry, as a walk in source order would.
pub fn collect(semantic: &Semantic<'_>) -> Names {
    let nodes = semantic.nodes();
    let mut names = Names::default();
    let mut ancestors: SmallVec<[AstKind<'_>; 16]> = SmallVec::new();
    let mut parts: SmallVec<[Cow<'_, str>; 8]> = SmallVec::new();

    for node in nodes.iter() {
        let AstKind::CallExpression(call) = node.kind() else {
            continue;
        };

        ancestors.clear();
        ancestors.extend(nodes.ancestor_kinds(node.id()));
        parts.clear();

        // Ancestors run innermost first; each one's parent follows it.
        for (index, ancestor) in ancestors.iter().enumerate().rev() {
            if let Some(part) = part(*ancestor, ancestors.get(index + 1).copied()) {
                parts.push(part);
            }
        }

        let from = names.text.len();

        if parts.is_empty() {
            names.text.push_str("style");
        }

        for (index, part) in parts.iter().enumerate() {
            if index > 0 {
                names.text.push('-');
            }

            identity::write_name(&mut names.text, part);
        }

        names.ranges.insert(
            call.span.start,
            (
                u32::try_from(from).unwrap_or(u32::MAX),
                u32::try_from(names.text.len()).unwrap_or(u32::MAX),
            ),
        );
    }

    names
}

/// The name segment an ancestor contributes, as ESTree reports its declaration.
fn part<'a>(ancestor: AstKind<'a>, parent: Option<AstKind<'a>>) -> Option<Cow<'a, str>> {
    match ancestor {
        // A dotted namespace is one ESTree declaration with a qualified name.
        AstKind::TSNamespaceDeclaration(namespace) => {
            let dotted = matches!(
                namespace.body,
                TSNamespaceDeclarationBody::TSNamespaceDeclaration(_)
            ) || matches!(parent, Some(AstKind::TSNamespaceDeclaration(_)));

            (!dotted).then(|| Cow::Borrowed(namespace.id.name.as_str()))
        }
        AstKind::TSGlobalDeclaration(_) => Some(Cow::Borrowed("global")),
        AstKind::VariableDeclarator(declarator) => match &declarator.id {
            BindingPattern::BindingIdentifier(id) => Some(Cow::Borrowed(id.name.as_str())),
            _ => None,
        },
        AstKind::ObjectProperty(property) if !property.computed => key(&property.key),
        AstKind::BindingProperty(property) if !property.computed => key(&property.key),
        AstKind::AssignmentTargetPropertyProperty(property) if !property.computed => {
            key(&property.name)
        }
        AstKind::AssignmentTargetPropertyIdentifier(property) => {
            Some(Cow::Borrowed(property.binding.name.as_str()))
        }
        AstKind::Function(function) if function.r#type == FunctionType::FunctionDeclaration => {
            function
                .id
                .as_ref()
                .map(|id| Cow::Borrowed(id.name.as_str()))
        }
        _ => None,
    }
}

/// An identifier key's name or a literal key's `String(value)` spelling.
fn key<'a>(key: &PropertyKey<'a>) -> Option<Cow<'a, str>> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(Cow::Borrowed(identifier.name.as_str())),
        key => statics::key_literal(key),
    }
}
