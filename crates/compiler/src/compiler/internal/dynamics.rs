//! Folds dynamic style components into the host elements they render.
//!
//! A dynamic style component is a module-scope function component whose whole body is one host
//! element spreading one folded application of a typed `style` callback. Each value the
//! application passes is a template of the component's props: literals, prop reads, templates,
//! and `+`. The element may forward `children`.
//!
//! A use site that passes only props the values read, plus `children` and `key`, renders the
//! host element with the application's class list and inline style, its prop expressions
//! substituted into the values. Only expressions that read values without calls or conversions
//! substitute, so a read the substitution repeats, drops, or reorders returns the same result. A
//! substituted template converts props to strings when the element is created rather than when
//! the component renders, which reads the same for the primitive values CSS properties accept.

use std::sync::Arc;

use oxc_ast::ast::{
    BinaryOperator, CallExpression, Expression, FormalParameters, JSXAttributeItem,
    JSXAttributeName, JSXAttributeValue, JSXChild, JSXElement, JSXElementName, JSXExpression,
    ObjectPropertyKind,
};
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use crate::compiler::internal::expression;
use crate::compiler::internal::selections::{Params, insignificant};
use crate::js;

/// The host element a dynamic style component renders, and the inline style its props fill.
#[derive(Clone, Debug, PartialEq)]
pub struct Dynamic {
    /// Whether the element renders the caller's `children`.
    pub children: bool,
    /// The application's compiled class list.
    pub classes: Arc<str>,
    /// Props the values read, in first-read order. Use sites may pass only these.
    pub props: Box<[Arc<str>]>,
    /// The inline style object's source, with each prop read left as a part to substitute.
    pub style: Box<[Part]>,
    /// Host element name.
    pub tag: Arc<str>,
}

/// A run of an inline style's source.
#[derive(Clone, Debug, PartialEq)]
pub enum Part {
    /// A read of the named prop.
    Prop(Arc<str>),
    /// Source text.
    Text(Arc<str>),
}

/// A dynamic application spread alone onto a host element, folded to its props.
#[derive(Clone, Copy, Debug)]
pub struct Application<'o> {
    /// The application's compiled class list.
    pub classes: &'o str,
    /// End of the call.
    pub end: u32,
    /// Each field of the folded style: the text before the authored value, the text after it,
    /// and the value's span.
    pub fields: &'o [(String, &'static str, Span)],
    /// The callee the application reads before initialization, as `styles.dot`, when an
    /// evaluation can precede the definition's initialization.
    pub guard: Option<&'o str>,
}

/// The deepest value expression a style reads, which bounds recursion.
const DEPTH: usize = 32;

/// The dynamic style component a function forms, with its application, when the expression it
/// returns is one host element spreading one folded dynamic application.
pub fn candidate<'a>(
    params: &'a FormalParameters<'a>,
    expression: &'a Expression<'a>,
    semantic: &Semantic<'a>,
    applications: &FxHashMap<u32, Application<'_>>,
    source: &str,
) -> Option<(Dynamic, &'a CallExpression<'a>)> {
    let params = Params::new(params)?;
    let Expression::JSXElement(element) = expression else {
        return None;
    };
    let opening = &element.opening_element;
    let JSXElementName::Identifier(tag) = &opening.name else {
        return None;
    };

    if opening.type_arguments.is_some() {
        return None;
    }

    let [JSXAttributeItem::SpreadAttribute(spread)] = opening.attributes.as_slice() else {
        return None;
    };
    let Expression::CallExpression(call) = &spread.argument else {
        return None;
    };
    let application = applications.get(&call.span.start)?;
    let [oxc_ast::ast::Argument::ObjectExpression(object)] = call.arguments.as_slice() else {
        return None;
    };

    if application.end != call.span.end || application.fields.len() != object.properties.len() {
        return None;
    }

    let mut props: Vec<Arc<str>> = Vec::new();
    let mut style: Vec<Part> = Vec::new();
    let mut text = String::from("{");

    for (index, ((opening, close, span), property)) in application
        .fields
        .iter()
        .zip(&object.properties)
        .enumerate()
    {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return None;
        };

        if property.value.span() != *span {
            return None;
        }

        let mut reads: Vec<(Span, Arc<str>)> = Vec::new();

        template(&property.value, &params, semantic, &mut reads, 0)?;

        if index > 0 {
            text.push(',');
        }

        text.push_str(opening);

        let mut previous = span.start;

        for (read, prop) in reads {
            text.push_str(source.get(previous as usize..read.start as usize)?);
            style.push(Part::Text(Arc::from(std::mem::take(&mut text))));

            if !props.contains(&prop) {
                props.push(Arc::clone(&prop));
            }

            style.push(Part::Prop(prop));
            previous = read.end;
        }

        text.push_str(source.get(previous as usize..span.end as usize)?);
        text.push_str(close);
    }

    text.push('}');
    style.push(Part::Text(Arc::from(text)));

    let mut children = false;

    for child in &element.children {
        match child {
            JSXChild::Text(text) if insignificant(text.value.as_str()) => {}
            JSXChild::ExpressionContainer(container) if !children => {
                let expression = container.expression.as_expression()?;

                if params.read(semantic, expression).as_deref() != Some("children") {
                    return None;
                }

                children = true;
            }
            _ => return None,
        }
    }

    Some((
        Dynamic {
            children,
            classes: Arc::from(application.classes),
            props: props.into_boxed_slice(),
            style: style.into_boxed_slice(),
            tag: Arc::from(tag.name.as_str()),
        },
        call,
    ))
}

/// Records the prop reads of a template of props in source order, or returns `None` when the
/// expression reads anything else. Props that React or the element itself owns never fill a
/// value.
fn template(
    expression: &Expression<'_>,
    params: &Params<'_>,
    semantic: &Semantic<'_>,
    reads: &mut Vec<(Span, Arc<str>)>,
    depth: usize,
) -> Option<()> {
    if depth > DEPTH {
        return None;
    }

    if let Some(prop) = params.read(semantic, expression) {
        if matches!(&*prop, "children" | "className" | "key" | "ref") {
            return None;
        }

        reads.push((expression.span(), prop));
        return Some(());
    }

    let mut next =
        |expression: &Expression<'_>| template(expression, params, semantic, reads, depth + 1);

    match expression {
        Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::StringLiteral(_) => Some(()),
        Expression::ParenthesizedExpression(inner) => next(&inner.expression),
        Expression::BinaryExpression(binary) if binary.operator == BinaryOperator::Addition => {
            next(&binary.left)?;
            next(&binary.right)
        }
        Expression::TemplateLiteral(template) => {
            template.expressions.iter().try_for_each(&mut next)
        }
        _ => None,
    }
}

/// Plans a use site that passes only the component's props, `children`, and `key`, pushing its
/// edits. Returns whether it folds. `rewritten` reports names that other edits rewrite.
pub fn use_site(
    element: &JSXElement<'_>,
    dynamic: &Dynamic,
    anchors: &[Arc<str>],
    source: &str,
    semantic: &Semantic<'_>,
    rewritten: &dyn Fn(&str) -> bool,
    edits: &mut Vec<(u32, u32, String)>,
) -> bool {
    let opening = &element.opening_element;

    if opening.type_arguments.is_some()
        || (!dynamic.children
            && !element.children.iter().all(
                |child| matches!(child, JSXChild::Text(text) if insignificant(text.value.as_str())),
            ))
    {
        return false;
    }

    let mut run: Vec<Span> = Vec::new();
    let mut values: FxHashMap<&str, String> = FxHashMap::default();
    let mut key = None;

    for (index, attribute) in opening.attributes.iter().enumerate() {
        let JSXAttributeItem::Attribute(attribute) = attribute else {
            return false;
        };
        let JSXAttributeName::Identifier(name) = &attribute.name else {
            return false;
        };
        let name = name.name.as_str();

        if name == "key" {
            if key.is_some() || attribute.value.is_none() {
                return false;
            }

            key = Some(index);
            continue;
        }

        if !dynamic.props.iter().any(|prop| &**prop == name) {
            return false;
        }

        let value = match &attribute.value {
            None => "true".to_owned(),
            Some(JSXAttributeValue::StringLiteral(literal)) => {
                // JSX strings decode character references and keep line breaks, which a
                // JavaScript string spells differently.
                let Some(raw) = source.get(
                    literal.span.start as usize + 1..(literal.span.end as usize).saturating_sub(1),
                ) else {
                    return false;
                };

                if raw.contains(['&', '\n', '\r']) {
                    return false;
                }

                js::quote(raw)
            }
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                let Some(expression) = container.expression.as_expression() else {
                    return false;
                };

                if matches!(container.expression, JSXExpression::EmptyExpression(_))
                    || !expression::reorderable(expression, semantic, rewritten)
                {
                    return false;
                }

                let span = expression.span();
                let Some(text) = source.get(span.start as usize..span.end as usize) else {
                    return false;
                };

                match expression {
                    Expression::BooleanLiteral(_)
                    | Expression::Identifier(_)
                    | Expression::NullLiteral(_)
                    | Expression::NumericLiteral(_)
                    | Expression::StringLiteral(_) => text.to_owned(),
                    _ => format!("({text})"),
                }
            }
            Some(_) => return false,
        };

        if values.insert(name, value).is_some() {
            return false;
        }

        run.push(attribute.span);
    }

    // A key between props would fall inside the replaced range, and one before them would
    // evaluate before a read the element name made first.
    match key {
        Some(index) if index == 0 && !anchors.is_empty() && !run.is_empty() => return false,
        Some(index) if index != 0 && index + 1 != opening.attributes.len() => return false,
        _ => {}
    }

    let mut text = String::from("className={");

    for anchor in anchors {
        text.push_str(anchor);
        text.push_str("&&");
    }

    js::write_string(&mut text, &dynamic.classes);
    text.push_str("} style={");

    for part in &dynamic.style {
        match part {
            Part::Text(source) => text.push_str(source),
            // An omitted prop reads `undefined`.
            Part::Prop(prop) => text.push_str(values.get(&**prop).map_or("void 0", String::as_str)),
        }
    }

    text.push('}');

    let name = opening.name.span();

    match (run.first(), run.last()) {
        (Some(first), Some(last)) => {
            edits.push((name.start, name.end, dynamic.tag.to_string()));
            edits.push((first.start, last.end, text));
        }
        _ => edits.push((name.start, name.end, format!("{} {text}", dynamic.tag))),
    }

    if let Some(closing) = &element.closing_element {
        let name = closing.name.span();

        edits.push((name.start, name.end, dynamic.tag.to_string()));
    }

    true
}
