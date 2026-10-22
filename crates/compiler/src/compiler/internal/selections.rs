//! Folds selection components into the host elements they render.
//!
//! A selection component is a module-scope function component whose whole body is one host
//! element spreading one recipe application. The application's values are pure expressions of
//! the component's props: literals, prop reads, `!`, strict comparisons, logical operators, and
//! conditionals. Pure values can be evaluated anywhere and any number of times without changing
//! the result, so a use site may substitute its prop expressions into them. The element may
//! forward `children`, and the application may forward the caller's `className`.
//!
//! A use site that passes only props the component reads, plus `children`, `className`, and
//! `key`, renders the host element directly. Its prop expressions keep their authored text and
//! become the arguments of a module-scope selector, so each evaluates once, in source order.
//! Literal props fold into the selector, and a use site without expressions renders constant
//! attributes. A class-selection recipe with few class combinations reads every combination
//! from a constant table, and other recipes concatenate the selected classes.

use std::fmt::Write as _;
use std::sync::Arc;

use oxc_ast::ast::{
    BinaryOperator, BindingPattern, CallExpression, Expression, FormalParameters,
    IdentifierReference, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXChild,
    JSXElement, JSXElementName, JSXExpression, LogicalOperator, ObjectPropertyKind, PropertyKey,
    PropertyKind, UnaryOperator,
};
use oxc_semantic::{Semantic, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::recipes::Positions;
use crate::js;
use crate::runtime::recipe as runtime;

/// The host element a selection component renders, and how its props select a recipe's choices.
#[derive(Clone, Debug, PartialEq)]
pub struct Selection {
    /// Whether choices select with `data-*` attributes instead of classes.
    pub attributes: bool,
    /// Recipe axes in definition order.
    pub axes: Box<[Axis]>,
    /// Whether the element renders the caller's `children`.
    pub children: bool,
    /// The recipe's compiled class list.
    pub classes: Arc<str>,
    /// Whether the caller's `className` reaches the host element, merged after the selection.
    pub forwards: bool,
    /// Props the selection reads, in first-read order. Use sites may pass only these.
    pub props: Box<[Arc<str>]>,
    /// Host element name.
    pub tag: Arc<str>,
}

/// One recipe axis of a selection.
#[derive(Clone, Debug, PartialEq)]
pub struct Axis {
    /// Each choice with the class it adds, empty for a silent choice or attribute selection.
    pub choices: Box<[(Arc<str>, Arc<str>)]>,
    /// Default choice.
    pub default: Option<Arc<str>>,
    /// Axis name.
    pub name: Arc<str>,
    /// The authored selection, or `None` when the application omits the axis.
    pub value: Option<Value>,
}

/// A pure expression of a component's props.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    /// `test ? consequent : alternate`.
    Conditional(Box<[Value; 3]>),
    /// `left === right`, or `left !== right` when negated.
    Equal(Box<[Value; 2]>, bool),
    /// A literal.
    Literal(Literal),
    /// `left && right`, `left || right`, or `left ?? right`.
    Logical(Box<[Value; 2]>, Logical),
    /// `!value`.
    Not(Box<Value>),
    /// A read of the named prop.
    Prop(Arc<str>),
}

/// A primitive literal.
#[derive(Clone, Debug, PartialEq)]
pub enum Literal {
    /// `true` or `false`.
    Boolean(bool),
    /// `null`.
    Null,
    /// A finite number.
    Number(f64),
    /// A string.
    String(Arc<str>),
    /// `undefined`.
    Undefined,
}

/// A short-circuiting operator.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Logical {
    /// `&&`.
    And,
    /// `??`.
    Coalesce,
    /// `||`.
    Or,
}

/// A recipe application spread alone onto a host element, which a selection may read.
#[derive(Clone, Copy, Debug)]
pub struct Recipe<'o> {
    /// The recipe's compiled class list.
    pub classes: &'o str,
    /// Selection metadata.
    pub definition: &'o runtime::Definition,
    /// End of the call.
    pub end: u32,
    /// The callee the application reads before initialization, as `styles.chip`, when an
    /// evaluation can precede the definition's initialization.
    pub guard: Option<&'o str>,
}

/// The deepest value expression a selection reads, which bounds recursion.
const DEPTH: usize = 32;

/// The most class combinations a constant table holds. Larger recipes concatenate classes.
const TABLE: usize = 64;

/// How a component reads its props.
pub enum Params<'a> {
    /// `(props) => ...`, read as `props.name`.
    Object(SymbolId),
    /// `({ name, other: alias }) => ...`, with each key's binding.
    Pattern(Vec<(&'a str, SymbolId)>),
}

impl<'a> Params<'a> {
    /// How a component's only parameter reads its props, when it binds a name or a pattern of
    /// distinct keys without defaults or a rest element.
    pub fn new(params: &'a FormalParameters<'a>) -> Option<Self> {
        let [param] = params.items.as_slice() else {
            return None;
        };

        if params.rest.is_some() || param.initializer.is_some() || !param.decorators.is_empty() {
            return None;
        }

        Some(match &param.pattern {
            BindingPattern::BindingIdentifier(identifier) => {
                Self::Object(identifier.symbol_id.get()?)
            }
            BindingPattern::ObjectPattern(pattern) => {
                if pattern.rest.is_some() {
                    return None;
                }

                let mut bindings: Vec<(&'a str, SymbolId)> = Vec::new();

                for property in &pattern.properties {
                    let PropertyKey::StaticIdentifier(key) = &property.key else {
                        return None;
                    };
                    let BindingPattern::BindingIdentifier(value) = &property.value else {
                        return None;
                    };

                    if property.computed || bindings.iter().any(|(seen, _)| *seen == key.name) {
                        return None;
                    }

                    bindings.push((key.name.as_str(), value.symbol_id.get()?));
                }

                Self::Pattern(bindings)
            }
            _ => return None,
        })
    }
}

impl Params<'_> {
    /// The prop an expression reads directly.
    pub fn read(&self, semantic: &Semantic<'_>, expression: &Expression<'_>) -> Option<Arc<str>> {
        match (self, unwrap(expression)) {
            (Self::Object(symbol), Expression::StaticMemberExpression(member)) => {
                let Expression::Identifier(object) = &member.object else {
                    return None;
                };

                (!member.optional && resolve(semantic, object) == Some(*symbol))
                    .then(|| Arc::from(member.property.name.as_str()))
            }
            (Self::Pattern(bindings), Expression::Identifier(identifier)) => {
                let symbol = resolve(semantic, identifier)?;

                bindings
                    .iter()
                    .find(|(_, binding)| *binding == symbol)
                    .map(|(key, _)| Arc::from(*key))
            }
            _ => None,
        }
    }
}

/// The selection a function component forms, with its recipe application, when the expression
/// it returns is one host element spreading one selectable recipe application. `strings`
/// reports whether `String` reads the global, which attribute selection calls.
pub fn candidate<'a>(
    params: &'a FormalParameters<'a>,
    expression: &'a Expression<'a>,
    semantic: &Semantic<'a>,
    recipes: &FxHashMap<u32, Recipe<'_>>,
    strings: bool,
) -> Option<(Selection, &'a CallExpression<'a>)> {
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
    let recipe = recipes.get(&call.span.start)?;
    let [oxc_ast::ast::Argument::ObjectExpression(object)] = call.arguments.as_slice() else {
        return None;
    };

    if recipe.end != call.span.end {
        return None;
    }

    let definition = recipe.definition;
    let attributes = definition.prefix.is_none();

    // Choice tests compare strings, while the runtime stringifies values, so a number or other
    // value could stringify to a numeric choice name. Attribute selection calls `String`.
    if (attributes && !strings)
        || (!attributes
            && definition
                .axes
                .values()
                .flatten()
                .any(|name| name.parse::<f64>().is_ok() || name.trim() != &**name))
    {
        return None;
    }

    let mut values: Vec<(&str, Value)> = Vec::new();
    let mut forwards = false;
    let mut props: Vec<Arc<str>> = Vec::new();

    for property in &object.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return None;
        };

        if property.computed || property.method || property.kind != PropertyKind::Init {
            return None;
        }

        let key = match &property.key {
            PropertyKey::StaticIdentifier(identifier) => identifier.name.as_str(),
            PropertyKey::StringLiteral(literal) => literal.value.as_str(),
            _ => return None,
        };

        if key == "className" {
            if forwards || params.read(semantic, &property.value).as_deref() != Some("className") {
                return None;
            }

            forwards = true;
            continue;
        }

        if !definition.axes.contains_key(key) || values.iter().any(|(seen, _)| *seen == key) {
            return None;
        }

        values.push((
            key,
            pure(&property.value, &params, semantic, &mut props, 0)?,
        ));
    }

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

    let positions = Positions::new(&definition.axes);
    let axes = definition
        .axes
        .iter()
        .map(|(axis, choices)| Axis {
            choices: choices
                .iter()
                .map(|choice| {
                    let silent = definition
                        .silent
                        .as_ref()
                        .and_then(|silent| silent.get(axis))
                        .is_some_and(|names| names.contains(choice));
                    let class = definition
                        .prefix
                        .as_deref()
                        .filter(|_| !silent)
                        .and_then(|prefix| positions.class(prefix, axis, choice, None))
                        .map_or_else(String::new, |class| format!(" {class}"));

                    (Arc::clone(choice), Arc::from(class))
                })
                .collect(),
            default: definition.defaults.get(axis).cloned().flatten(),
            name: Arc::clone(axis),
            value: values
                .iter()
                .find(|(key, _)| *key == &**axis)
                .map(|(_, value)| value.clone()),
        })
        .collect();

    Some((
        Selection {
            attributes,
            axes,
            children,
            classes: Arc::from(recipe.classes),
            forwards,
            props: props.into_boxed_slice(),
            tag: Arc::from(tag.name.as_str()),
        },
        call,
    ))
}

/// A pure expression of a component's props, recording each prop it reads. Props that React or
/// the element itself owns never select.
fn pure(
    expression: &Expression<'_>,
    params: &Params<'_>,
    semantic: &Semantic<'_>,
    props: &mut Vec<Arc<str>>,
    depth: usize,
) -> Option<Value> {
    if depth > DEPTH {
        return None;
    }

    if let Some(prop) = params.read(semantic, expression) {
        if matches!(&*prop, "children" | "className" | "key" | "ref") {
            return None;
        }

        if !props.contains(&prop) {
            props.push(Arc::clone(&prop));
        }

        return Some(Value::Prop(prop));
    }

    let mut next =
        |expression: &Expression<'_>| pure(expression, params, semantic, props, depth + 1);

    Some(match unwrap(expression) {
        Expression::ParenthesizedExpression(inner) => return next(&inner.expression),
        Expression::BinaryExpression(binary) => {
            let negated = match binary.operator {
                BinaryOperator::StrictEquality => false,
                BinaryOperator::StrictInequality => true,
                _ => return None,
            };

            Value::Equal(
                Box::new([next(&binary.left)?, next(&binary.right)?]),
                negated,
            )
        }
        Expression::ConditionalExpression(conditional) => Value::Conditional(Box::new([
            next(&conditional.test)?,
            next(&conditional.consequent)?,
            next(&conditional.alternate)?,
        ])),
        Expression::LogicalExpression(logical) => {
            let operator = match logical.operator {
                LogicalOperator::And => Logical::And,
                LogicalOperator::Coalesce => Logical::Coalesce,
                LogicalOperator::Or => Logical::Or,
            };

            Value::Logical(
                Box::new([next(&logical.left)?, next(&logical.right)?]),
                operator,
            )
        }
        Expression::UnaryExpression(unary) => match unary.operator {
            UnaryOperator::LogicalNot => Value::Not(Box::new(next(&unary.argument)?)),
            UnaryOperator::UnaryNegation => match unwrap(&unary.argument) {
                Expression::NumericLiteral(number) => {
                    Value::Literal(Literal::Number(-number.value))
                }
                _ => return None,
            },
            UnaryOperator::Void => {
                next(&unary.argument)?;
                Value::Literal(Literal::Undefined)
            }
            _ => return None,
        },
        // An unresolved `undefined` reads the global's constant value.
        Expression::Identifier(identifier)
            if identifier.name == "undefined" && resolve(semantic, identifier).is_none() =>
        {
            Value::Literal(Literal::Undefined)
        }
        other => Value::Literal(literal(other)?),
    })
}

/// The primitive a literal expression evaluates to.
pub fn literal(expression: &Expression<'_>) -> Option<Literal> {
    Some(match unwrap(expression) {
        Expression::BooleanLiteral(literal) => Literal::Boolean(literal.value),
        Expression::NullLiteral(_) => Literal::Null,
        Expression::NumericLiteral(literal) if literal.value.is_finite() => {
            Literal::Number(literal.value)
        }
        Expression::StringLiteral(literal) => Literal::String(Arc::from(literal.value.as_str())),
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => {
            Literal::String(Arc::from(template.quasis.first()?.value.cooked.as_deref()?))
        }
        _ => return None,
    })
}

/// Whether JSX drops a text child, as it drops whitespace that spans lines.
pub fn insignificant(text: &str) -> bool {
    text.bytes()
        .all(|byte| matches!(byte, b' ' | b'\t' | b'\n' | b'\r'))
        && text.contains(['\n', '\r'])
}

fn resolve(semantic: &Semantic<'_>, reference: &IdentifierReference<'_>) -> Option<SymbolId> {
    semantic
        .scoping()
        .get_reference(reference.reference_id.get()?)
        .symbol_id()
}

/// Module-scope selectors and class tables that folded use sites call.
pub struct Helpers<'h> {
    /// Selector names by parameter count and body, so use sites of one shape share a selector.
    functions: FxHashMap<(usize, String), String>,
    /// Whether a selector calls the runtime `merge`.
    pub merges: bool,
    /// Names generated so far, numbered from zero for each base.
    next: FxHashMap<&'static str, usize>,
    /// Local name of the runtime `Props` namespace.
    runtime: &'h str,
    /// Module-scope declarations in creation order.
    pub statements: Vec<String>,
    /// Table names by contents.
    tables: FxHashMap<String, String>,
    /// Whether a name is already bound in the module.
    taken: &'h dyn Fn(&str) -> bool,
    /// Annotates selector parameters for TypeScript modules.
    typed: bool,
}

impl<'h> Helpers<'h> {
    /// Starts an empty set of helpers.
    pub fn new(runtime: &'h str, taken: &'h dyn Fn(&str) -> bool, typed: bool) -> Self {
        Self {
            functions: FxHashMap::default(),
            merges: false,
            next: FxHashMap::default(),
            runtime,
            statements: Vec::new(),
            tables: FxHashMap::default(),
            taken,
            typed,
        }
    }

    /// A module name with `base` that no binding uses.
    fn name(&mut self, base: &'static str) -> String {
        loop {
            let next = self.next.entry(base).or_default();
            let name = format!("{base}{next}");

            *next += 1;

            if !(self.taken)(&name) {
                return name;
            }
        }
    }

    /// The name of a selector returning `body` from `count` parameters.
    fn function(&mut self, count: usize, body: String, local: bool) -> String {
        let key = (count, body);

        if let Some(name) = self.functions.get(&key) {
            return name.clone();
        }

        let (_, body) = &key;

        let name = self.name("__zyzzSelect");
        let annotation = if self.typed { ":unknown" } else { "" };
        let mut text = String::with_capacity(body.len() + name.len() + count * 12 + 32);

        let _ = write!(text, "function {name}(");

        for index in 0..count {
            if index > 0 {
                text.push(',');
            }

            let _ = write!(text, "p{index}{annotation}");
        }

        text.push_str("){");

        if local {
            let _ = write!(text, "let v{annotation};");
        }

        text.push_str("return ");
        text.push_str(body);
        text.push('}');
        self.statements.push(text);
        self.functions.insert(key, name.clone());
        name
    }

    /// The name of a constant table of class lists.
    fn table(&mut self, entries: &[String]) -> String {
        let mut contents = String::from("[");

        for (index, entry) in entries.iter().enumerate() {
            if index > 0 {
                contents.push(',');
            }

            js::write_string(&mut contents, entry);
        }

        contents.push(']');

        if let Some(name) = self.tables.get(&contents) {
            return name.clone();
        }

        let name = self.name("__zyzzClasses");

        self.statements.push(format!("const {name}={contents};"));
        self.tables.insert(contents, name.clone());
        name
    }
}

/// What a use site passes for a prop.
#[derive(Clone)]
enum Binding {
    /// A literal value.
    Known(Literal),
    /// The selector parameter at an index.
    Param(usize),
}

/// A value with use-site props substituted and constant parts evaluated.
enum Term {
    Conditional(Box<[Term; 3]>),
    Equal(Box<[Term; 2]>, bool),
    Known(Literal),
    Logical(Box<[Term; 2]>, Logical),
    Not(Box<Term>),
    Param(usize),
}

impl Literal {
    /// ECMAScript `ToBoolean`.
    fn truthy(&self) -> bool {
        match self {
            Self::Boolean(value) => *value,
            Self::Null | Self::Undefined => false,
            Self::Number(value) => *value != 0.0 && !value.is_nan(),
            Self::String(value) => !value.is_empty(),
        }
    }

    /// ECMAScript `IsStrictlyEqual`.
    fn equals(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Boolean(left), Self::Boolean(right)) => left == right,
            (Self::Null, Self::Null) | (Self::Undefined, Self::Undefined) => true,
            #[expect(clippy::float_cmp, reason = "Strict equality compares exact numbers.")]
            (Self::Number(left), Self::Number(right)) => left == right,
            (Self::String(left), Self::String(right)) => left == right,
            _ => false,
        }
    }

    /// ECMAScript `String(value)`, for values other than `null` and `undefined`.
    fn text(&self) -> Option<String> {
        match self {
            Self::Boolean(value) => Some(value.to_string()),
            Self::Null | Self::Undefined => None,
            Self::Number(value) => Some(js::number(*value)),
            Self::String(value) => Some(value.to_string()),
        }
    }
}

/// Substitutes a use site's props into a value and evaluates its constant parts.
fn reduce(value: &Value, props: &FxHashMap<&str, Binding>) -> Term {
    match value {
        Value::Literal(literal) => Term::Known(literal.clone()),
        Value::Prop(name) => match props.get(&**name) {
            Some(Binding::Known(literal)) => Term::Known(literal.clone()),
            Some(Binding::Param(index)) => Term::Param(*index),
            None => Term::Known(Literal::Undefined),
        },
        Value::Not(inner) => match reduce(inner, props) {
            Term::Known(literal) => Term::Known(Literal::Boolean(!literal.truthy())),
            inner => Term::Not(Box::new(inner)),
        },
        Value::Equal(operands, negated) => {
            let [left, right] = &**operands;

            match (reduce(left, props), reduce(right, props)) {
                (Term::Known(left), Term::Known(right)) => {
                    Term::Known(Literal::Boolean(left.equals(&right) != *negated))
                }
                (left, right) => Term::Equal(Box::new([left, right]), *negated),
            }
        }
        Value::Logical(operands, operator) => {
            let [left, right] = &**operands;

            match reduce(left, props) {
                Term::Known(literal) => {
                    let short = match operator {
                        Logical::And => !literal.truthy(),
                        Logical::Coalesce => !matches!(literal, Literal::Null | Literal::Undefined),
                        Logical::Or => literal.truthy(),
                    };

                    if short {
                        Term::Known(literal)
                    } else {
                        reduce(right, props)
                    }
                }
                left => Term::Logical(Box::new([left, reduce(right, props)]), *operator),
            }
        }
        Value::Conditional(operands) => {
            let [test, consequent, alternate] = &**operands;

            match reduce(test, props) {
                Term::Known(literal) if literal.truthy() => reduce(consequent, props),
                Term::Known(_) => reduce(alternate, props),
                test => Term::Conditional(Box::new([
                    test,
                    reduce(consequent, props),
                    reduce(alternate, props),
                ])),
            }
        }
    }
}

impl Term {
    /// Whether the term always evaluates to a boolean.
    fn boolean(&self) -> bool {
        match self {
            Self::Known(literal) => matches!(literal, Literal::Boolean(_)),
            Self::Equal(..) | Self::Not(_) => true,
            Self::Logical(operands, Logical::Coalesce) => operands[0].boolean(),
            Self::Logical(operands, _) => operands.iter().all(Self::boolean),
            Self::Conditional(operands) => operands[1].boolean() && operands[2].boolean(),
            Self::Param(_) => false,
        }
    }

    /// Writes the term as an expression.
    fn write(&self, output: &mut String) {
        match self {
            Self::Known(literal) => write_literal(output, literal),
            Self::Param(index) => {
                let _ = write!(output, "p{index}");
            }
            Self::Not(inner) => {
                output.push('!');
                inner.operand(output);
            }
            Self::Equal(operands, negated) => {
                operands[0].operand(output);
                output.push_str(if *negated { "!==" } else { "===" });
                operands[1].operand(output);
            }
            Self::Logical(operands, operator) => {
                operands[0].operand(output);
                output.push_str(match operator {
                    Logical::And => "&&",
                    Logical::Coalesce => "??",
                    Logical::Or => "||",
                });
                operands[1].operand(output);
            }
            Self::Conditional(operands) => {
                operands[0].test(output);
                output.push('?');
                operands[1].operand(output);
                output.push(':');
                operands[2].operand(output);
            }
        }
    }

    /// Writes the term parenthesized unless it is a literal or parameter.
    fn operand(&self, output: &mut String) {
        if matches!(self, Self::Param(_))
            || matches!(self, Self::Known(literal) if !matches!(literal, Literal::Number(value) if *value < 0.0) && !matches!(literal, Literal::Undefined))
        {
            self.write(output);
        } else {
            output.push('(');
            self.write(output);
            output.push(')');
        }
    }

    /// Writes the term as a condition, where double negation reads the same truthiness.
    fn test(&self, output: &mut String) {
        if let Self::Not(inner) = self
            && let Self::Not(value) = &**inner
        {
            value.test(output);
        } else {
            self.operand(output);
        }
    }
}

fn write_literal(output: &mut String, literal: &Literal) {
    match literal {
        Literal::Boolean(value) => output.push_str(if *value { "true" } else { "false" }),
        Literal::Null => output.push_str("null"),
        Literal::Number(value) => js::write_number(output, *value),
        Literal::String(value) => js::write_string(output, value),
        Literal::Undefined => output.push_str("void 0"),
    }
}

/// The slot of the class a literal selection adds on an axis, `0` adding none. `undefined`
/// selects the default, and `null` or an unknown choice selects nothing, as at runtime.
fn slot(axis: &Axis, slots: &[&str], literal: &Literal) -> usize {
    let choice = match literal {
        Literal::Undefined => axis.default.as_deref().map(str::to_owned),
        literal => literal.text(),
    };

    choice
        .and_then(|choice| axis.choices.iter().find(|(name, _)| **name == *choice))
        .and_then(|(_, class)| slots.iter().position(|slot| *slot == &**class))
        .unwrap_or(0)
}

/// Writes the slot an axis selects for a term that is not constant, through `write`. Returns
/// the slot instead when every value selects the same one, since a pure term can be dropped.
fn write_axis(
    output: &mut String,
    axis: &Axis,
    slots: &[&str],
    term: &Term,
    local: &mut bool,
    write: &dyn Fn(&mut String, usize),
) -> Option<usize> {
    if term.boolean() {
        let selected = slot(axis, slots, &Literal::Boolean(true));
        let otherwise = slot(axis, slots, &Literal::Boolean(false));

        if selected == otherwise {
            return Some(selected);
        }

        output.push('(');
        term.test(output);
        output.push('?');
        write(output, selected);
        output.push(':');
        write(output, otherwise);
        output.push(')');
        return None;
    }

    let fallback = slot(axis, slots, &Literal::Undefined);
    let mut outcomes: Vec<(usize, Vec<&str>)> = Vec::new();

    for (choice, _) in &axis.choices {
        let selected = slot(axis, slots, &Literal::String(Arc::clone(choice)));

        if selected == 0 {
            continue;
        }

        match outcomes
            .iter_mut()
            .find(|(outcome, _)| *outcome == selected)
        {
            Some((_, choices)) => choices.push(choice),
            None => outcomes.push((selected, vec![choice])),
        }
    }

    if outcomes.is_empty() && fallback == 0 {
        return Some(0);
    }

    let mut first = true;
    let mut read = |output: &mut String| reference(output, term, &mut first, local);

    output.push('(');

    if fallback != 0 {
        read(output);
        output.push_str("===void 0?");
        write(output, fallback);
        output.push(':');
    }

    for (outcome, choices) in &outcomes {
        for (index, choice) in choices.iter().enumerate() {
            if index > 0 {
                output.push_str("||");
            }

            // A boolean selects the choice its string names, as the runtime stringifies values.
            if matches!(&**choice, "true" | "false") {
                read(output);
                let _ = write!(output, "==={choice}||");
            }

            read(output);
            output.push_str("===");
            js::write_string(output, choice);
        }

        output.push('?');
        write(output, *outcome);
        output.push(':');
    }

    write(output, 0);
    output.push(')');
    None
}

/// Writes a read of a term that a selection tests several times: a parameter directly, or the
/// local `v`, assigned at the first read.
fn reference(output: &mut String, term: &Term, first: &mut bool, local: &mut bool) {
    if let Term::Param(index) = term {
        let _ = write!(output, "p{index}");
    } else if *first {
        output.push_str("(v=");
        term.write(output);
        output.push(')');
        *local = true;
    } else {
        output.push('v');
    }

    *first = false;
}

/// Attributes that replace a use site's props, either constant or one selector call.
enum Rendered {
    /// Attribute text.
    Constant(String),
    /// Text before and after the selector's arguments.
    Call(String, &'static str),
}

/// Plans a use site that passes only the selection's props, `children`, `className`, and
/// `key`, pushing its edits. Returns whether it folds.
pub fn use_site(
    element: &JSXElement<'_>,
    selection: &Selection,
    anchors: &[Arc<str>],
    source: &str,
    helpers: &mut Helpers<'_>,
    edits: &mut Vec<(u32, u32, String)>,
) -> bool {
    let opening = &element.opening_element;

    if opening.type_arguments.is_some()
        || (!selection.children
            && !element.children.iter().all(
                |child| matches!(child, JSXChild::Text(text) if insignificant(text.value.as_str())),
            ))
    {
        return false;
    }

    // Each prop becomes one argument or literal, in source order. The key stays an attribute.
    let mut run: Vec<(Span, Option<Span>)> = Vec::new();
    let mut props: FxHashMap<&str, Binding> = FxHashMap::default();
    let mut class_name: Option<Binding> = None;
    let mut key = None;
    let mut count = 0;

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

        let (binding, value) = match &attribute.value {
            None => (Binding::Known(Literal::Boolean(true)), None),
            Some(JSXAttributeValue::StringLiteral(literal)) => {
                // JSX strings decode character references and keep line breaks, which a
                // JavaScript string spells differently.
                let raw = source
                    .get(
                        literal.span.start as usize + 1
                            ..(literal.span.end as usize).saturating_sub(1),
                    )
                    .unwrap_or_default();

                if raw.contains(['&', '\n', '\r']) {
                    return false;
                }

                (Binding::Known(Literal::String(Arc::from(raw))), None)
            }
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                let Some(expression) = container.expression.as_expression() else {
                    return false;
                };

                if matches!(container.expression, JSXExpression::EmptyExpression(_)) {
                    return false;
                }

                if let Some(literal) = literal(expression) {
                    (Binding::Known(literal), None)
                } else {
                    count += 1;
                    (Binding::Param(count - 1), Some(expression.span()))
                }
            }
            Some(_) => return false,
        };

        if name == "className" {
            if !selection.forwards || class_name.is_some() {
                return false;
            }

            class_name = Some(binding);
        } else if selection.props.iter().any(|prop| &**prop == name) {
            if props.insert(name, binding).is_some() {
                return false;
            }
        } else {
            return false;
        }

        run.push((attribute.span, value));
    }

    // A key between props would evaluate inside the selector's arguments, and one before them
    // would evaluate before a read the element name made first.
    match key {
        Some(index) if index == 0 && !anchors.is_empty() && !run.is_empty() => return false,
        Some(index) if index != 0 && index + 1 != opening.attributes.len() => return false,
        _ => {}
    }

    let Some(rendered) = render(
        selection,
        &props,
        class_name.as_ref(),
        count,
        anchors,
        helpers,
    ) else {
        return false;
    };
    let name = opening.name.span();

    match (&rendered, run.first(), run.last()) {
        (Rendered::Constant(text), Some(first), Some(last)) => {
            edits.push((name.start, name.end, selection.tag.to_string()));
            edits.push((first.0.start, last.0.end, text.clone()));
        }
        (Rendered::Constant(text), _, _) => {
            edits.push((name.start, name.end, format!("{} {text}", selection.tag)));
        }
        (Rendered::Call(open, close), Some(first), Some(last)) => {
            let mut text = open.clone();
            let mut previous = first.0.start;
            let mut arguments = 0;

            edits.push((name.start, name.end, selection.tag.to_string()));

            // Arguments keep their authored text, so rewrites inside them still apply.
            for (_, value) in &run {
                let Some(value) = value else {
                    continue;
                };

                if arguments > 0 {
                    text.push(',');
                }

                edits.push((previous, value.start, std::mem::take(&mut text)));
                previous = value.end;
                arguments += 1;
            }

            text.push_str(close);
            edits.push((previous, last.0.end, text));
        }
        (Rendered::Call(..), _, _) => return false,
    }

    if let Some(closing) = &element.closing_element {
        let name = closing.name.span();

        edits.push((name.start, name.end, selection.tag.to_string()));
    }

    true
}

/// The attributes a use site renders.
fn render(
    selection: &Selection,
    props: &FxHashMap<&str, Binding>,
    class_name: Option<&Binding>,
    count: usize,
    anchors: &[Arc<str>],
    helpers: &mut Helpers<'_>,
) -> Option<Rendered> {
    let terms: Vec<Term> = selection
        .axes
        .iter()
        .map(|axis| {
            axis.value
                .as_ref()
                .map_or(Term::Known(Literal::Undefined), |value| {
                    reduce(value, props)
                })
        })
        .collect();
    let mut local = false;
    let mut prefix = String::new();

    for anchor in anchors {
        prefix.push_str(anchor);
        prefix.push_str("&&");
    }

    if selection.attributes {
        return Some(attributes(
            selection, &terms, class_name, count, &prefix, helpers,
        ));
    }

    let classes = classes(selection, &terms, &mut local, helpers)?;
    let merged = match (class_name, classes) {
        (None, classes) => classes,
        (Some(Binding::Known(literal)), Classes::Known(classes)) => {
            Classes::Known(merge(&classes, literal.text().as_deref()))
        }
        (Some(Binding::Known(literal)), Classes::Code(code, filled)) => {
            match literal.text().filter(|text| !text.is_empty()) {
                None => Classes::Code(code, filled),
                // Every class list is non-empty, so merging appends the override.
                Some(text) if filled => {
                    let mut output = code;

                    output.push('+');
                    js::write_string(&mut output, &format!(" {text}"));
                    Classes::Code(output, true)
                }
                Some(text) => {
                    let mut output = format!("{}.merge({code},", helpers.runtime);

                    js::write_string(&mut output, &text);
                    output.push(')');
                    helpers.merges = true;
                    Classes::Code(output, false)
                }
            }
        }
        (Some(Binding::Param(index)), classes) => {
            let mut output = format!("{}.merge(", helpers.runtime);

            match classes {
                Classes::Known(classes) => js::write_string(&mut output, &classes),
                Classes::Code(code, _) => output.push_str(&code),
            }

            let _ = write!(output, ",p{index})");
            helpers.merges = true;
            Classes::Code(output, false)
        }
    };
    let body = match merged {
        Classes::Known(classes) if count == 0 => {
            let mut text = format!("className={{{prefix}");

            js::write_string(&mut text, &classes);
            text.push('}');
            return Some(Rendered::Constant(text));
        }
        Classes::Known(classes) => js::quote(&classes),
        Classes::Code(code, _) => code,
    };
    let name = helpers.function(count, body, local);

    Some(Rendered::Call(format!("className={{{prefix}{name}("), ")}"))
}

/// The props an attribute-selection recipe renders for each term: the class list, then each
/// selected axis's `data-*` attribute in axis order, as the runtime assigns them.
fn attributes(
    selection: &Selection,
    terms: &[Term],
    class_name: Option<&Binding>,
    count: usize,
    prefix: &str,
    helpers: &mut Helpers<'_>,
) -> Rendered {
    let classes = &*selection.classes;
    let mut local = false;
    let mut code = String::from("{className:");

    match class_name {
        None => js::write_string(&mut code, classes),
        Some(Binding::Known(literal)) => {
            js::write_string(&mut code, &merge(classes, literal.text().as_deref()));
        }
        Some(Binding::Param(index)) => {
            let _ = write!(code, "{}.merge(", helpers.runtime);
            js::write_string(&mut code, classes);
            let _ = write!(code, ",p{index})");
            helpers.merges = true;
        }
    }

    let mut constant = format!("className={{{prefix}");

    js::write_string(&mut constant, &merge(classes, None));
    constant.push('}');

    for (axis, term) in selection.axes.iter().zip(terms) {
        let attribute = format!("data-{}", axis.name);

        code.push(',');
        js::write_string(&mut code, &attribute);
        code.push(':');

        match term {
            Term::Known(literal) => {
                let value = match literal {
                    Literal::Undefined => axis.default.as_deref().map(str::to_owned),
                    literal => literal.text(),
                };

                match value {
                    Some(value) => {
                        js::write_string(&mut code, &value);
                        let _ = write!(constant, " {attribute}={{");
                        js::write_string(&mut constant, &value);
                        constant.push('}');
                    }
                    // A key the runtime leaves out reads as undefined, which renders nothing.
                    None => code.push_str("void 0"),
                }
            }
            term if term.boolean() => {
                term.test(&mut code);
                code.push_str("?\"true\":\"false\"");
            }
            term => {
                let mut first = true;

                code.push('(');
                reference(&mut code, term, &mut first, &mut local);

                if let Some(fallback) = &axis.default {
                    code.push_str("===void 0?");
                    js::write_string(&mut code, fallback);
                    code.push(':');
                    reference(&mut code, term, &mut first, &mut local);
                    code.push_str("===null?void 0:String(");
                } else {
                    code.push_str("==null?void 0:String(");
                }

                reference(&mut code, term, &mut first, &mut local);
                code.push_str("))");
            }
        }
    }

    code.push('}');

    if count == 0 {
        return Rendered::Constant(constant);
    }

    let name = helpers.function(count, code, local);

    Rendered::Call(format!("{{...{prefix}{name}("), ")}")
}

/// A class list known at compile time, or code computing it with whether it is never empty.
enum Classes {
    Code(String, bool),
    Known(String),
}

/// `Props.merge`.
fn merge(classes: &str, external: Option<&str>) -> String {
    match external {
        Some(external) if !classes.is_empty() && !external.is_empty() => {
            format!("{classes} {external}")
        }
        Some(external) if !external.is_empty() => external.to_owned(),
        _ => classes.to_owned(),
    }
}

/// The class list a class-selection recipe renders for each term, or `None` when a base list
/// that starts with whitespace would join differently.
fn classes(
    selection: &Selection,
    terms: &[Term],
    local: &mut bool,
    helpers: &mut Helpers<'_>,
) -> Option<Classes> {
    // Each axis adds one of its distinct classes, the first of which adds none.
    let slots: Vec<Vec<&str>> = selection
        .axes
        .iter()
        .map(|axis| {
            let mut slots = vec![""];

            for (_, class) in &axis.choices {
                if !slots.contains(&&**class) {
                    slots.push(class);
                }
            }

            slots
        })
        .collect();
    let base = &*selection.classes;

    if base.starts_with(js::is_whitespace) {
        return None;
    }

    // The runtime trims the joined list only when a choice adds a class.
    let join = |added: &str| {
        if added.is_empty() {
            base.to_owned()
        } else {
            format!("{base}{added}")
                .trim_start_matches(js::is_whitespace)
                .to_owned()
        }
    };
    let size = slots
        .iter()
        .try_fold(1usize, |size, slots| size.checked_mul(slots.len()))
        .filter(|size| *size <= TABLE);

    let Some(size) = size else {
        let mut code = String::new();
        let mut constant = String::from(base);

        for ((axis, slots), term) in selection.axes.iter().zip(&slots).zip(terms) {
            let write = |output: &mut String, slot: usize| {
                js::write_string(output, slots.get(slot).copied().unwrap_or_default());
            };
            let mut text = String::new();
            let selected = match term {
                Term::Known(literal) => Some(slot(axis, slots, literal)),
                term => write_axis(&mut text, axis, slots, term, local, &write),
            };

            if let Some(selected) = selected {
                constant.push_str(slots.get(selected).copied().unwrap_or_default());
                continue;
            }

            if !constant.is_empty() || code.is_empty() {
                if !code.is_empty() {
                    code.push('+');
                }

                js::write_string(&mut code, &std::mem::take(&mut constant));
            }

            code.push('+');
            code.push_str(&text);
        }

        if code.is_empty() {
            return Some(Classes::Known(join(
                constant.get(base.len()..).unwrap_or_default(),
            )));
        }

        if !constant.is_empty() {
            code.push('+');
            js::write_string(&mut code, &constant);
        }

        // Concatenation trims only when the base is empty, where an empty list reads the same.
        return Some(if base.is_empty() {
            Classes::Code(format!("({code}).trimStart()"), false)
        } else {
            Classes::Code(code, true)
        });
    };

    // Strides index the table in axis order, so the last axis varies fastest.
    let mut strides = vec![1usize; slots.len()];

    for index in (0..slots.len().saturating_sub(1)).rev() {
        strides[index] = strides[index + 1] * slots.get(index + 1).map_or(1, Vec::len);
    }

    let mut constant = 0;
    let mut code = String::new();

    for (((axis, slots), term), stride) in
        selection.axes.iter().zip(&slots).zip(terms).zip(&strides)
    {
        let write = |output: &mut String, slot: usize| {
            let _ = write!(output, "{}", slot * stride);
        };
        let mut text = String::new();
        let selected = match term {
            Term::Known(literal) => Some(slot(axis, slots, literal)),
            term => write_axis(&mut text, axis, slots, term, local, &write),
        };

        if let Some(selected) = selected {
            constant += selected * stride;
        } else {
            if !code.is_empty() {
                code.push('+');
            }

            code.push_str(&text);
        }
    }

    let entries: Vec<String> = (0..size)
        .map(|index| {
            let mut added = String::new();

            for (slots, stride) in slots.iter().zip(&strides) {
                added.push_str(
                    slots
                        .get((index / stride) % slots.len())
                        .copied()
                        .unwrap_or_default(),
                );
            }

            join(&added)
        })
        .collect();

    if code.is_empty() {
        return entries.get(constant).cloned().map(Classes::Known);
    }

    let filled = entries.iter().all(|entry| !entry.is_empty());
    let table = helpers.table(&entries);

    if constant > 0 {
        let _ = write!(code, "+{constant}");
    }

    Some(Classes::Code(format!("{table}[{code}]"), filled))
}
