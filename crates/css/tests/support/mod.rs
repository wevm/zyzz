//! Shared rendering for integration tests: prints syntax trees with css-tree's field order and
//! JSON-quoted values, the format the expectations were produced in from css-tree.

use std::fmt::Write as _;

use css::{Ast, Node, NodeId};

/// Quotes a string like `JSON.stringify`.
pub(crate) fn quote(value: &str) -> String {
    let mut quoted = String::with_capacity(value.len() + 2);

    quoted.push('"');

    for code in value.chars() {
        match code {
            '"' => quoted.push_str("\\\""),
            '\\' => quoted.push_str("\\\\"),
            '\n' => quoted.push_str("\\n"),
            '\r' => quoted.push_str("\\r"),
            '\t' => quoted.push_str("\\t"),
            code if (code as u32) < 0x20 => {
                let _ = write!(quoted, "\\u{:04x}", code as u32);
            }
            code => quoted.push(code),
        }
    }

    quoted.push('"');
    quoted
}

/// Renders a node and its descendants, one node per line, indented by depth.
pub(crate) fn render(ast: &Ast<'_>, id: NodeId) -> String {
    let mut lines = Vec::new();

    render_node(ast, id, 0, &mut lines);
    lines.join("\n")
}

fn push_field(fields: &mut Vec<String>, name: &str, value: Option<&str>) {
    if let Some(value) = value {
        fields.push(format!("{name}={}", quote(value)));
    }
}

fn render_node(ast: &Ast<'_>, id: NodeId, depth: usize, lines: &mut Vec<String>) {
    let Some(node) = ast.get(id) else {
        return;
    };
    let mut fields: Vec<String> = Vec::new();
    let mut children: Vec<(&str, NodeId)> = Vec::new();

    match node {
        Node::AnPlusB { a, b } => {
            push_field(&mut fields, "a", a.as_deref());
            push_field(&mut fields, "b", b.as_deref());
        }
        Node::Atrule {
            block,
            name,
            prelude,
        } => {
            push_field(&mut fields, "name", Some(name));
            children.extend(prelude.map(|prelude| ("prelude", prelude)));
            children.extend(block.map(|block| ("block", block)));
        }
        Node::AttributeSelector {
            flags,
            matcher,
            name,
            value,
        } => {
            children.push(("name", *name));
            push_field(&mut fields, "matcher", *matcher);
            children.extend(value.map(|value| ("value", value)));
            push_field(&mut fields, "flags", *flags);
        }
        Node::ClassSelector { name }
        | Node::Combinator { name }
        | Node::IdSelector { name }
        | Node::Identifier { name }
        | Node::Layer { name }
        | Node::TypeSelector { name }
        | Node::Function { name, .. }
        | Node::PseudoClassSelector { name, .. }
        | Node::PseudoElementSelector { name, .. } => push_field(&mut fields, "name", Some(name)),
        Node::Comment { value }
        | Node::Hash { value }
        | Node::Number { value }
        | Node::Percentage { value }
        | Node::Raw { value }
        | Node::UnicodeRange { value }
        | Node::WhiteSpace { value } => push_field(&mut fields, "value", Some(value)),
        Node::Operator { value } | Node::String { value } | Node::Url { value } => {
            push_field(&mut fields, "value", Some(value));
        }
        Node::Condition { kind, .. } => push_field(&mut fields, "kind", Some(kind.as_str())),
        Node::Declaration {
            important,
            property,
            value,
        } => {
            fields.push(match important {
                None => "important=false".to_owned(),
                Some("important") => "important=true".to_owned(),
                Some(other) => format!("important={}", quote(other)),
            });
            fields.push(format!("property={}", quote(property)));
            children.push(("value", *value));
        }
        Node::Dimension { unit, value } => {
            push_field(&mut fields, "value", Some(value));
            push_field(&mut fields, "unit", Some(unit));
        }
        Node::Feature { kind, name, value } => {
            push_field(&mut fields, "kind", Some(kind.as_str()));
            push_field(&mut fields, "name", Some(name));
            children.extend(value.map(|value| ("value", value)));
        }
        Node::FeatureFunction {
            feature,
            kind,
            value,
        } => {
            push_field(&mut fields, "kind", Some(kind.as_str()));
            push_field(&mut fields, "feature", Some(feature));
            children.extend(value.map(|value| ("value", value)));
        }
        Node::FeatureRange {
            kind,
            left,
            left_comparison,
            middle,
            right,
            right_comparison,
        } => {
            push_field(&mut fields, "kind", Some(kind.as_str()));
            children.push(("left", *left));
            push_field(&mut fields, "leftComparison", Some(left_comparison));
            children.push(("middle", *middle));
            push_field(&mut fields, "rightComparison", *right_comparison);
            children.extend(right.map(|right| ("right", right)));
        }
        Node::GeneralEnclosed { function, kind, .. } => {
            push_field(&mut fields, "kind", Some(kind.as_str()));
            push_field(&mut fields, "function", *function);
        }
        Node::MediaQuery {
            condition,
            media_type,
            modifier,
        } => {
            push_field(&mut fields, "modifier", *modifier);
            push_field(&mut fields, "mediaType", *media_type);
            children.extend(condition.map(|condition| ("condition", condition)));
        }
        Node::Nth { nth, selector } => {
            children.push(("nth", *nth));
            children.extend(selector.map(|selector| ("selector", selector)));
        }
        Node::Ratio { left, right } => {
            children.push(("left", *left));
            children.extend(right.map(|right| ("right", right)));
        }
        Node::Rule { block, prelude } => {
            children.push(("prelude", *prelude));
            children.push(("block", *block));
        }
        Node::Scope { limit, root } => {
            children.extend(root.map(|root| ("root", root)));
            children.extend(limit.map(|limit| ("limit", limit)));
        }
        Node::SupportsDeclaration { declaration } => children.push(("declaration", *declaration)),
        _ => {}
    }

    let suffix = if fields.is_empty() {
        String::new()
    } else {
        format!(" {}", fields.join(" "))
    };

    lines.push(format!(
        "{}{}{suffix}",
        "  ".repeat(depth),
        node.type_name()
    ));

    for (name, child) in children {
        lines.push(format!("{}.{name}", "  ".repeat(depth + 1)));
        render_node(ast, child, depth + 2, lines);
    }

    for &child in ast.children(id) {
        render_node(ast, child, depth + 1, lines);
    }
}
