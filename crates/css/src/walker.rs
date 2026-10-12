//! Depth-first traversal like css-tree's `walk`.
//!
//! Children are visited in css-tree's field order for each node type, such as an at-rule's
//! prelude before its block.

use crate::ast::{Ast, Node, NodeId};

/// What to do after visiting a node.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Walk {
    /// Stop the whole traversal, like css-tree's `this.break`.
    Break,
    /// Visit the node's children.
    #[default]
    Continue,
    /// Skip the node's children, like css-tree's `this.skip`.
    Skip,
}

/// Visits `root` and its descendants in pre-order, like `walk(ast, fn)`.
///
/// Returns `false` when `enter` stopped the traversal with [`Walk::Break`].
pub fn walk<'a>(
    ast: &Ast<'a>,
    root: NodeId,
    mut enter: impl FnMut(NodeId, &Node<'a>) -> Walk,
) -> bool {
    walk_node(ast, root, Traversal::Full, &mut enter)
}

/// Visits only nodes of one css-tree type, like `walk(ast, { visit, enter })`.
///
/// For `Atrule`, `Rule`, and `Declaration`, css-tree descends only through the stylesheet,
/// rules, at-rules, blocks, and, for declarations, declaration lists, so at-rules inside a
/// `Raw` or value are never found. Like css-tree, the callback cannot stop or prune the walk.
pub fn walk_visit<'a>(
    ast: &Ast<'a>,
    root: NodeId,
    node_type: &str,
    mut enter: impl FnMut(NodeId, &Node<'a>),
) {
    let traversal = match node_type {
        "Atrule" | "Rule" => Traversal::Rules,
        "Declaration" => Traversal::Declarations,
        _ => Traversal::Full,
    };

    walk_node(ast, root, traversal, &mut |id, node| {
        if node.type_name() == node_type {
            enter(id, node);
        }

        Walk::Continue
    });
}

/// Which node types the traversal descends through.
#[derive(Clone, Copy, Eq, PartialEq)]
enum Traversal {
    Declarations,
    Full,
    Rules,
}

fn walk_node<'a>(
    ast: &Ast<'a>,
    id: NodeId,
    traversal: Traversal,
    enter: &mut impl FnMut(NodeId, &Node<'a>) -> Walk,
) -> bool {
    let Some(node) = ast.get(id) else {
        return true;
    };

    match enter(id, node) {
        Walk::Break => return false,
        Walk::Skip => return true,
        Walk::Continue => {}
    }

    let descends = match traversal {
        Traversal::Full => true,
        Traversal::Rules => matches!(
            node,
            Node::StyleSheet { .. } | Node::Atrule { .. } | Node::Rule { .. } | Node::Block { .. }
        ),
        Traversal::Declarations => matches!(
            node,
            Node::StyleSheet { .. }
                | Node::Atrule { .. }
                | Node::Rule { .. }
                | Node::Block { .. }
                | Node::DeclarationList { .. }
        ),
    };

    if !descends {
        return true;
    }

    let fields: [Option<NodeId>; 3] = match node {
        Node::Atrule { block, prelude, .. } => [*prelude, *block, None],
        Node::AttributeSelector { name, value, .. } => [Some(*name), *value, None],
        Node::Declaration { value, .. } => [Some(*value), None, None],
        Node::Feature { value, .. } | Node::FeatureFunction { value, .. } => [*value, None, None],
        Node::FeatureRange {
            left,
            middle,
            right,
            ..
        } => [Some(*left), Some(*middle), *right],
        Node::MediaQuery { condition, .. } => [*condition, None, None],
        Node::Nth { nth, selector } => [Some(*nth), *selector, None],
        Node::Ratio { left, right } => [Some(*left), *right, None],
        Node::Rule { block, prelude } => [Some(*prelude), Some(*block), None],
        Node::Scope { limit, root } => [*root, *limit, None],
        Node::SupportsDeclaration { declaration } => [Some(*declaration), None, None],
        _ => {
            for &child in ast.children(id) {
                if !walk_node(ast, child, traversal, enter) {
                    return false;
                }
            }

            return true;
        }
    };

    for child in fields.into_iter().flatten() {
        if !walk_node(ast, child, traversal, enter) {
            return false;
        }
    }

    true
}
