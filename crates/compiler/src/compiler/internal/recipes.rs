//! Lowers static recipe structure into ordered ordinary style conditions.
//!
//! The expanded body is a synthesized object whose grouping keys carry the spans of the authored
//! nodes they come from, so declaration mapping still points at authored source.

use std::borrow::Cow;
use std::fmt::Write as _;
use std::sync::Arc;

use oxc_allocator::{Box as ArenaBox, CloneIn, Vec as ArenaVec};
use oxc_ast::ast::{
    ArrayExpressionElement, Expression, ObjectExpression, ObjectProperty, ObjectPropertyKind,
    PropertyKey, PropertyKind, UnaryOperator,
};
use oxc_ast::builder::AstBuilder;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use crate::compiler::internal::expression::{self, Template};
use crate::compiler::internal::recipe_conditions::{self, Region};
use crate::compiler::internal::recipe_payloads::{self, Payloads, Scalar};
use crate::compiler::internal::statics::key_name;
use crate::error::{Error, Result};
use crate::internal::identity;
use crate::internal::query::Metadata;
use crate::internal::recipe;
use crate::js::{self, Record};
use crate::runtime::recipe as runtime;

/// Source inputs for finite recipe lowering.
#[derive(Clone, Copy)]
pub struct Options<'s, 'a> {
    /// Stable module and call identity.
    pub identity: &'s str,
    /// Static resolution hooks for payload callbacks.
    pub payloads: recipe_payloads::Options<'s, 'a>,
    /// Bound query aliases.
    pub queries: Option<&'s Metadata>,
    /// Original source, for payload type signatures.
    pub source: &'a str,
}

/// A recipe expanded into ordinary conditions.
pub struct Expanded<'s, 'a> {
    /// Payload slot bindings, for dynamic reads in the expanded body.
    pub bindings: Payloads<'s, 'a>,
    /// The expanded style body.
    pub body: &'a ObjectExpression<'a>,
    /// Ordered dynamic alternatives, for recipes with payloads and no conditions.
    pub dynamic_recipe: Option<recipe::Definition<&'a ObjectExpression<'a>>>,
    /// Selection metadata.
    pub recipe: runtime::Definition,
    /// Ordered static alternatives, for recipes without payloads or conditions.
    pub static_recipe: Option<recipe::Definition<&'a ObjectExpression<'a>>>,
    /// Payload type signatures by axis and choice.
    pub types: Record<Record<Arc<str>>>,
}

fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

fn object<'a>(node: &'a Expression<'a>) -> Result<&'a ObjectExpression<'a>> {
    match node {
        Expression::ObjectExpression(object) => Ok(object),
        _ => Err(invalid(
            "Recipes require static object bodies.",
            node.span(),
        )),
    }
}

type Entries<'a> = Vec<(String, &'a ObjectProperty<'a>)>;

fn entries<'a>(node: &'a Expression<'a>) -> Result<Entries<'a>> {
    let node = object(node)?;
    let mut result: Entries<'a> = Vec::with_capacity(node.properties.len());

    for property in &node.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return Err(invalid(
                "Recipe structure requires explicit static keys.",
                property.span(),
            ));
        };

        if property.computed
            || property.method
            || property.shorthand
            || property.kind != PropertyKind::Init
        {
            return Err(invalid(
                "Recipe structure requires explicit static keys.",
                property.span,
            ));
        }

        let Some(key) = key_name(property)
            .map(Cow::into_owned)
            .filter(|key| result.iter().all(|(seen, _)| seen != key))
        else {
            return Err(invalid("Recipe keys must be unique.", property.span));
        };

        result.push((key, &**property));
    }

    Ok(result)
}

fn field<'a>(entries: &Entries<'a>, name: &str) -> Option<&'a ObjectProperty<'a>> {
    entries
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, property)| *property)
}

fn choice(node: &Expression<'_>, choices: &[Arc<str>]) -> Result<Option<Arc<str>>> {
    let value = match node {
        Expression::NullLiteral(_) => return Ok(None),
        Expression::StringLiteral(literal) => literal.value.as_str(),
        Expression::BooleanLiteral(literal) => {
            if literal.value {
                "true"
            } else {
                "false"
            }
        }
        _ => {
            return Err(invalid(
                "Selections require literal choice names, booleans, or null.",
                node.span(),
            ));
        }
    };

    match choices.iter().find(|choice| ***choice == *value) {
        Some(choice) => Ok(Some(Arc::clone(choice))),
        None => Err(invalid("Unknown recipe choice.", node.span())),
    }
}

/// An attribute selector with a CSS string, escaping control characters, quotes, and backslashes.
fn predicate(attribute: &str, value: &str) -> String {
    let mut output = format!("[{attribute}=\"");

    for character in value.chars() {
        if character <= '\u{1f}' || character == '\u{7f}' || character == '"' || character == '\\' {
            let _ = write!(output, "\\{:x} ", u32::from(character));
        } else {
            output.push(character);
        }
    }

    output.push_str("\"]");
    output
}

/// The data attribute of a conditional choice, as `ConditionalRecipe.attribute` names it.
pub fn attribute(axis: &str, condition: usize) -> String {
    format!("data-zyzz-condition-{condition}-{axis}")
}

/// The class prefix of a class-selection recipe, as `Identity.recipe` derives it from the
/// definition identity. Generated names use `zv` nowhere else, and the fixed-length hash keeps
/// one recipe's prefix from starting another's.
pub fn prefix(identity: &str) -> String {
    let hash = identity::compact(identity);

    format!("zv{}", hash.get(..8).unwrap_or(&hash))
}

/// The class of one choice, by its position among every choice of the recipe in axis order, as
/// `Recipe.choice` names it. A conditional selection appends `_` and its condition index.
pub fn class(prefix: &str, index: usize, condition: Option<usize>) -> String {
    let index = js::radix(index as u64, 36);

    match condition {
        Some(condition) => format!("{prefix}{index}_{condition}"),
        None => format!("{prefix}{index}"),
    }
}

/// Axis positions and choice positions among every choice of a recipe, in axis order, read once
/// so naming each choice class is a lookup.
pub struct Positions<'r> {
    axes: FxHashMap<&'r str, usize>,
    choices: FxHashMap<(&'r str, &'r str), usize>,
}

impl<'r> Positions<'r> {
    /// Reads the positions of every declared axis and choice.
    pub fn new(axes: &'r Record<Vec<Arc<str>>>) -> Self {
        let mut positions = Self {
            axes: FxHashMap::default(),
            choices: FxHashMap::default(),
        };

        for (axis, choices) in axes.iter() {
            positions.axes.insert(axis, positions.axes.len());

            for choice in choices {
                positions
                    .choices
                    .insert((axis, choice), positions.choices.len());
            }
        }

        positions
    }

    /// The class of a declared choice, as [`class`] names it.
    pub fn class(
        &self,
        prefix: &str,
        axis: &str,
        choice: &str,
        condition: Option<usize>,
    ) -> Option<String> {
        self.choices
            .get(&(axis, choice))
            .map(|index| class(prefix, *index, condition))
    }
}

/// The class marking that a condition overrides an axis, with a choice or `null`, as
/// `Recipe.overridden` names it. Its `-` separator keeps it apart from choice classes.
pub fn overridden(prefix: &str, axis: usize, condition: usize) -> String {
    format!("{prefix}{axis}-{condition}")
}

/// The attributes and choice-class prefixes an application of a recipe owns, which a later
/// application of the same recipe in one composition replaces.
pub fn ownership(recipe: &runtime::Definition) -> (Vec<Arc<str>>, Vec<Arc<str>>) {
    if let Some(prefix) = &recipe.prefix {
        return (Vec::new(), vec![Arc::clone(prefix)]);
    }

    let conditions = recipe.conditions.as_ref().map_or(0, Vec::len);
    let attributes = recipe
        .axes
        .keys()
        .flat_map(|axis| {
            std::iter::once(Arc::from(format!("data-{axis}")))
                .chain((0..conditions).map(|condition| Arc::from(attribute(axis, condition))))
        })
        .collect();

    (attributes, Vec::new())
}

/// How selections reach the element, read from the recipe's `selection` field.
enum Selection {
    /// `data-*` attributes, the default.
    Attribute,
    /// One class per choice and context, under this prefix.
    Class(String),
}

impl Selection {
    /// The selector matching one choice in a context.
    fn choice(
        &self,
        positions: &Positions<'_>,
        axis: &str,
        choice: &str,
        condition: Option<usize>,
    ) -> String {
        match self {
            Self::Attribute => {
                let name = condition.map_or_else(
                    || format!("data-{axis}"),
                    |condition| attribute(axis, condition),
                );
                let value = condition.map_or_else(|| choice.to_owned(), |_| format!("s{choice}"));

                predicate(&name, &value)
            }
            Self::Class(prefix) => format!(
                ".{}",
                positions
                    .class(prefix, axis, choice, condition)
                    .unwrap_or_default()
            ),
        }
    }

    /// Selectors that exclude every later condition of an axis.
    fn excluded(&self, positions: &Positions<'_>, axis: &str, sources: &[Option<usize>]) -> String {
        let mut output = String::new();

        for condition in sources.iter().flatten() {
            match self {
                Self::Attribute => {
                    let _ = write!(output, ":not([{}])", attribute(axis, *condition));
                }
                Self::Class(prefix) => {
                    let index = positions.axes.get(axis).copied().unwrap_or_default();
                    let _ = write!(output, ":not(.{})", overridden(prefix, index, *condition));
                }
            }
        }

        output
    }
}

fn is_axis(axis: &str) -> bool {
    let mut characters = axis.chars();

    characters
        .next()
        .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

const RESERVED_AXES: [&str; 7] = [
    "class",
    "className",
    "conditions",
    "key",
    "ref",
    "style",
    "vars",
];

const FIELDS: [&str; 6] = [
    "base",
    "variants",
    "defaultVariants",
    "compoundVariants",
    "conditions",
    "selection",
];

struct Rule<'a> {
    /// Payload model indexes, one per condition context, for dynamic choices.
    bodies: Option<Vec<usize>>,
    matches: Vec<(Arc<str>, Vec<Arc<str>>)>,
    property: &'a ObjectProperty<'a>,
    suffix: String,
}

/// The expanded grouping tree before it becomes AST, with groups and leaves in push order.
#[derive(Default)]
struct Tree<'a> {
    groups: Vec<(String, Span, Tree<'a>)>,
    leaves: Vec<ObjectPropertyKind<'a>>,
    order: Vec<Slot>,
}

enum Slot {
    Group(usize),
    Leaf(usize),
}

impl<'a> Tree<'a> {
    /// The group for a grouping rule, created on first use.
    fn group(&mut self, rule: &str, span: Span) -> &mut Self {
        let index = self
            .groups
            .iter()
            .position(|(key, ..)| key == rule)
            .unwrap_or_else(|| {
                self.order.push(Slot::Group(self.groups.len()));
                self.groups.push((rule.to_owned(), span, Tree::default()));
                self.groups.len() - 1
            });

        &mut self.groups[index].2
    }

    fn push(&mut self, property: ObjectPropertyKind<'a>) {
        self.order.push(Slot::Leaf(self.leaves.len()));
        self.leaves.push(property);
    }
}

struct Builder<'a> {
    allocator: &'a oxc_allocator::Allocator,
    ast: AstBuilder<'a>,
}

impl<'a> Builder<'a> {
    fn group(&self, span: Span, key: &str, value: Expression<'a>) -> ObjectPropertyKind<'a> {
        let raw: &'a str = self.allocator.alloc_str(&js::quote(key));
        let key = PropertyKey::new_string_literal(
            span,
            self.allocator.alloc_str(key),
            Some(raw.into()),
            &self.ast,
        );

        ObjectPropertyKind::new_object_property(
            span,
            PropertyKind::Init,
            key,
            value,
            false,
            false,
            false,
            &self.ast,
        )
    }

    /// Builds grouping properties. Nested grouping objects carry the recipe object's span.
    fn properties(&self, tree: Tree<'a>, span: Span) -> Vec<ObjectPropertyKind<'a>> {
        let mut groups: Vec<Option<(String, Span, Tree<'a>)>> =
            tree.groups.into_iter().map(Some).collect();
        let mut leaves: Vec<Option<ObjectPropertyKind<'a>>> =
            tree.leaves.into_iter().map(Some).collect();

        tree.order
            .into_iter()
            .filter_map(|slot| match slot {
                Slot::Group(index) => {
                    let (rule, key, tree) = groups.get_mut(index)?.take()?;
                    let properties =
                        ArenaVec::from_iter_in(self.properties(tree, span), &self.allocator);

                    Some(self.group(
                        key,
                        &rule,
                        Expression::new_object_expression(span, properties, &self.ast),
                    ))
                }
                Slot::Leaf(index) => leaves.get_mut(index)?.take(),
            })
            .collect()
    }
}

/// Expands every finite alternative while retaining authored style-node locations.
///
/// # Errors
///
/// Returns `Themes.InvalidError` for unknown fields, invalid axes, choices, defaults, compounds,
/// conditions, and payload callbacks.
pub fn expand<'s, 'a>(
    node: &'a Expression<'a>,
    options: Options<'s, 'a>,
) -> Result<Expanded<'s, 'a>> {
    let recipe_node = object(node)?;
    let allocator = options.payloads.allocator;
    let builder = Builder {
        allocator,
        ast: AstBuilder::new(allocator),
    };
    let mut bindings = recipe_payloads::create(options.payloads);
    let mut payloads: Vec<runtime::Payload> = Vec::new();
    let mut validators: Vec<usize> = Vec::new();
    let mut types: Record<Record<Arc<str>>> = Record::new();
    let mut default_payloads: Record<Record<runtime::Scalar>> = Record::new();
    let mut properties: Vec<ObjectPropertyKind<'a>> = Vec::new();
    let fields = entries(node)?;
    let mut axes: Record<Vec<Arc<str>>> = Record::new();
    let mut defaults: Record<Option<Arc<str>>> = Record::new();

    for (key, property) in &fields {
        if !FIELDS.contains(&key.as_str()) {
            return Err(invalid(
                &format!("Unknown recipe field: {key}."),
                property.span,
            ));
        }
    }

    let selection = match field(&fields, "selection") {
        None => Selection::Attribute,
        Some(property) => match &property.value {
            Expression::StringLiteral(literal) if literal.value == "attribute" => {
                Selection::Attribute
            }
            Expression::StringLiteral(literal) if literal.value == "class" => {
                Selection::Class(prefix(options.identity))
            }
            _ => {
                return Err(invalid(
                    "Recipe selection must be 'attribute' or 'class'.",
                    property.value.span(),
                ));
            }
        },
    };

    let mut named = Vec::new();

    if let Some(conditions) = field(&fields, "conditions") {
        for (name, property) in entries(&conditions.value)? {
            // Uncompiled authoring numbers conditions in `Object.keys` order, which moves array
            // indexes first, so condition classes would not match.
            if matches!(selection, Selection::Class(_)) && js::array_index(&name).is_some() {
                return Err(invalid(
                    "Class-selection condition names cannot be array indexes.",
                    property.span,
                ));
            }

            named.push(recipe_conditions::read(
                &name,
                &property.value,
                options.queries,
            )?);
        }
    }

    let regions: Vec<Region> = recipe_conditions::regions(&named)?;
    let base = field(&fields, "base");

    if let Some(base) = base {
        let value = object(&base.value)?;
        let targets = value.properties.iter().any(|property| {
            matches!(property, ObjectPropertyKind::ObjectProperty(property)
            if !property.computed && match &property.key {
                PropertyKey::StaticIdentifier(identifier) => identifier.name == "targets",
                PropertyKey::StringLiteral(literal) => literal.value == "targets",
                _ => false,
            })
        });

        if !named.is_empty() || targets {
            properties.push(builder.group(
                value.span,
                "&",
                base.value.clone_in_with_semantic_ids(allocator),
            ));
        } else {
            properties.extend(
                value
                    .properties
                    .iter()
                    .map(|property| property.clone_in_with_semantic_ids(allocator)),
            );
        }
    }

    let mut rules: Vec<Rule<'a>> = Vec::new();

    if let Some(variants) = field(&fields, "variants") {
        for (axis, property) in entries(&variants.value)? {
            if !is_axis(&axis)
                || axis.starts_with("zyzz-condition-")
                || RESERVED_AXES.contains(&axis.as_str())
            {
                return Err(invalid(
                    "Recipe axes require lowercase data-attribute names and cannot use reserved props.",
                    property.span,
                ));
            }

            let choices = entries(&property.value)?;

            if choices.is_empty() {
                return Err(invalid(
                    "Recipe axes require at least one choice.",
                    property.span,
                ));
            }

            for (key, property) in &choices {
                let lone = matches!(&property.key, PropertyKey::StringLiteral(literal) if literal.lone_surrogates);

                if matches!(property.key, PropertyKey::NumericLiteral(_))
                    || key.contains('\0')
                    || lone
                {
                    return Err(invalid(
                        "Recipe choice names require CSS-safe strings.",
                        property.span,
                    ));
                }

                // Uncompiled authoring numbers choices in `Object.keys` order, which moves array
                // indexes first and omits `__proto__`, so class names would not match.
                if matches!(selection, Selection::Class(_))
                    && (js::array_index(key).is_some() || key == "__proto__")
                {
                    return Err(invalid(
                        "Class-selection choice names cannot be array indexes or __proto__.",
                        property.span,
                    ));
                }
            }

            let names: Vec<Arc<str>> = choices
                .iter()
                .map(|(key, _)| Arc::from(key.as_str()))
                .collect();

            axes.insert(axis.as_str(), names);

            let count = axes.len();

            for (index, (key, style)) in choices.iter().enumerate() {
                if key == "__proto__"
                    && matches!(
                        style.value,
                        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)
                    )
                {
                    return Err(invalid(
                        "Dynamic choice names cannot use __proto__.",
                        style.span,
                    ));
                }

                let mut models = Vec::with_capacity(named.len() + 1);

                for context in 0..=named.len() {
                    let identity = format!("{}-{count}-{index}-{context}", options.identity);

                    models.push(bindings.read(&style.value, &identity)?);
                }

                let models: Option<Vec<usize>> = models.into_iter().collect();

                if let Some(models) = &models
                    && let Some(first) = models.first().and_then(|index| bindings.model(*index))
                {
                    let span = first.read.type_annotation.span();
                    let signature = options
                        .source
                        .get(span.start as usize..span.end as usize)
                        .unwrap_or_default();

                    if !types.contains_key(&axis) {
                        types.insert(axis.as_str(), Record::new());
                    }

                    if let Some(signatures) = types.get_mut(&axis) {
                        signatures.insert(key.as_str(), Arc::from(signature));
                    }

                    payloads.push(runtime::Payload {
                        axis: Arc::from(axis.as_str()),
                        choice: Arc::from(key.as_str()),
                        slots: models
                            .iter()
                            .filter_map(|index| bindings.model(*index))
                            .map(|model| {
                                let mut slots = Record::new();

                                for (field, slot) in model.read.slots.iter() {
                                    slots.insert(Arc::clone(field), Arc::from(slot.name.as_str()));
                                }

                                slots
                            })
                            .collect(),
                    });
                    validators.push(models.first().copied().unwrap_or_default());
                }

                rules.push(Rule {
                    bodies: models,
                    matches: vec![(Arc::from(axis.as_str()), vec![Arc::from(key.as_str())])],
                    property: style,
                    suffix: String::new(),
                });
            }
        }
    }

    if let Some(default_variants) = field(&fields, "defaultVariants") {
        for (axis, property) in entries(&default_variants.value)? {
            let Some(choices) = axes.get(&axis).cloned() else {
                return Err(invalid("Unknown default variant axis.", property.span));
            };

            if matches!(&property.value, Expression::Identifier(identifier) if identifier.name == "undefined")
            {
                continue;
            }

            if matches!(property.value, Expression::ObjectExpression(_)) {
                let selections = entries(&property.value)?;
                let selected = selections.first();
                let payload = selected.and_then(|(choice, _)| {
                    payloads
                        .iter()
                        .position(|item| *item.axis == *axis && *item.choice == **choice)
                });
                let (1, Some((choice, selected)), Some(payload)) =
                    (selections.len(), selected, payload)
                else {
                    return Err(invalid(
                        "Dynamic defaults require exactly one declared dynamic choice.",
                        property.span,
                    ));
                };
                let declared = payloads
                    .get(payload)
                    .and_then(|payload| payload.slots.first())
                    .cloned()
                    .unwrap_or_default();
                let validator = validators.get(payload).copied().unwrap_or_default();
                let mut values: Record<runtime::Scalar> = Record::new();

                for (field, input) in entries(&selected.value)? {
                    let value = scalar(&input.value);
                    let (true, Some(value)) = (declared.contains_key(&field), value) else {
                        return Err(invalid(
                            "Dynamic defaults require complete scalar payloads.",
                            input.span,
                        ));
                    };
                    let accepted = match &value {
                        runtime::Scalar::Number(number) => {
                            bindings.accepts_value(validator, &field, &Scalar::Number(*number))?
                        }
                        runtime::Scalar::String(text) => {
                            bindings.accepts_value(validator, &field, &Scalar::String(text))?
                        }
                    };

                    if !accepted {
                        return Err(invalid(
                            "Dynamic default does not match its declared payload type.",
                            input.span,
                        ));
                    }

                    values.insert(field.as_str(), value);
                }

                if values.len() != declared.len() {
                    return Err(invalid(
                        "Dynamic defaults require complete scalar payloads.",
                        property.span,
                    ));
                }

                defaults.insert(axis.as_str(), Some(Arc::from(choice.as_str())));
                default_payloads.insert(axis.as_str(), values);
            } else {
                let selected = choice(&property.value, &choices)?;

                if payloads
                    .iter()
                    .any(|item| *item.axis == *axis && selected.as_deref() == Some(&*item.choice))
                {
                    return Err(invalid(
                        "Dynamic choices require a scoped payload.",
                        property.span,
                    ));
                }

                defaults.insert(axis.as_str(), selected);
            }
        }
    }

    if let Some(compounds) = field(&fields, "compoundVariants") {
        let Expression::ArrayExpression(array) = &compounds.value else {
            return Err(invalid("Compounds require a static array.", compounds.span));
        };

        for (index, element) in array.elements.iter().enumerate() {
            if element.is_elision() {
                return Err(invalid("Compounds require dense entries.", compounds.span));
            }

            let Some(element) = element.as_expression() else {
                return Err(invalid(
                    "Recipes require static object bodies.",
                    element.span(),
                ));
            };
            let fields = entries(element)?;
            let (Some(when), Some(style), 2) = (
                field(&fields, "when"),
                field(&fields, "style"),
                fields.len(),
            ) else {
                return Err(invalid(
                    "Compounds require only when and style.",
                    element.span(),
                ));
            };
            let mut matches = Vec::new();

            for (axis, property) in entries(&when.value)? {
                let Some(choices) = axes.get(&axis) else {
                    return Err(invalid("Unknown compound variant axis.", property.span));
                };
                let values: Vec<(Option<&Expression<'a>>, Span)> = match &property.value {
                    Expression::ArrayExpression(array) => {
                        if array.elements.is_empty()
                            || array
                                .elements
                                .iter()
                                .any(ArrayExpressionElement::is_elision)
                        {
                            return Err(invalid(
                                "Compound matches require nonempty choices.",
                                property.span,
                            ));
                        }

                        array
                            .elements
                            .iter()
                            .map(|element| (element.as_expression(), element.span()))
                            .collect()
                    }
                    value => vec![(Some(value), value.span())],
                };
                let mut selected = Vec::with_capacity(values.len());

                for (value, span) in values {
                    // A spread is not a literal choice.
                    let Some(value) = value else {
                        return Err(invalid(
                            "Selections require literal choice names, booleans, or null.",
                            span,
                        ));
                    };
                    let Some(value) = choice(value, choices)? else {
                        return Err(invalid("Compounds match choice names, not null.", span));
                    };

                    selected.push(value);
                }

                matches.push((Arc::from(axis.as_str()), selected));
            }

            // Distinct zero-specificity suffixes preserve repeated compound groups.
            rules.push(Rule {
                bodies: None,
                matches,
                property: style,
                suffix: format!(":where(*, .__zyzz-compound-{index})"),
            });
        }
    }

    // A choice class that no selector reads changes nothing, so applications omit it.
    let silent = matches!(selection, Selection::Class(_))
        .then(|| {
            let mut silent: Record<Vec<Arc<str>>> = Record::new();

            for rule in &rules {
                let ([(axis, choices)], true, None) =
                    (rule.matches.as_slice(), rule.suffix.is_empty(), &rule.bodies)
                else {
                    continue;
                };
                let Some(choice) = choices.first() else {
                    continue;
                };
                let empty = matches!(&rule.property.value, Expression::ObjectExpression(body) if body.properties.is_empty());
                let compounded = rules.iter().any(|other| {
                    !other.suffix.is_empty()
                        && other
                            .matches
                            .iter()
                            .any(|(name, names)| name == axis && names.contains(choice))
                });

                if !empty || compounded {
                    continue;
                }

                match silent.get_mut(axis) {
                    Some(names) => names.push(Arc::clone(choice)),
                    None => silent.insert(Arc::clone(axis), vec![Arc::clone(choice)]),
                }
            }

            silent
        })
        .filter(|silent| !silent.is_empty());
    let positions = Positions::new(&axes);
    let mut tree = Tree::default();

    for region in &regions {
        let mut target = &mut tree;

        for rule in &region.rules {
            target = target.group(&rule.rule, rule.span);
        }

        let sources: Vec<Option<usize>> = std::iter::once(None)
            .chain(region.active.iter().copied().map(Some))
            .collect();

        for rule in &rules {
            if let Some(bodies) = &rule.bodies {
                let Some((axis, choices)) = rule.matches.first() else {
                    continue;
                };
                let first = choices.first().map_or("", |choice| &**choice);

                for (index, condition) in sources.iter().enumerate() {
                    let excluded = selection.excluded(
                        &positions,
                        axis,
                        sources.get(index + 1..).unwrap_or_default(),
                    );
                    let selector = format!(
                        "&:where({}{excluded})",
                        selection.choice(&positions, axis, first, *condition)
                    );
                    let model = condition.map_or(0, |condition| condition + 1);
                    let Some(body) = bodies
                        .get(model)
                        .copied()
                        .and_then(|index| bindings.model(index).map(|model| (index, model.body)))
                    else {
                        continue;
                    };
                    let copy =
                        ArenaBox::new_in(body.1.clone_in_with_semantic_ids(allocator), &allocator);

                    bindings.record_copy(body.0, &copy)?;
                    target.push(builder.group(
                        rule.property.key.span(),
                        &selector,
                        Expression::ObjectExpression(copy),
                    ));
                }

                continue;
            }

            object(&rule.property.value)?;

            let mut selector = String::from("&");

            for (axis, choices) in &rule.matches {
                let alternatives: Vec<String> = sources
                    .iter()
                    .enumerate()
                    .flat_map(|(index, condition)| {
                        let excluded = selection.excluded(
                            &positions,
                            axis,
                            sources.get(index + 1..).unwrap_or_default(),
                        );

                        choices
                            .iter()
                            .map(|choice| {
                                selection.choice(&positions, axis, choice, *condition) + &excluded
                            })
                            .collect::<Vec<_>>()
                    })
                    .collect();

                let _ = write!(selector, ":where({})", alternatives.join(","));
            }

            selector.push_str(&rule.suffix);
            target.push(builder.group(
                rule.property.key.span(),
                &selector,
                rule.property.value.clone_in_with_semantic_ids(allocator),
            ));
        }
    }

    properties.extend(builder.properties(tree, recipe_node.span));

    let body: &'a ObjectExpression<'a> = allocator.alloc(ObjectExpression::new(
        recipe_node.span,
        ArenaVec::from_iter_in(properties, &allocator),
        &builder.ast,
    ));
    let alternatives = named.is_empty().then(|| recipe::Definition {
        axes: axes
            .iter()
            .map(|(axis, choices)| (Arc::clone(axis), choices.clone()))
            .collect(),
        defaults: defaults
            .iter()
            .map(|(axis, choice)| (Arc::clone(axis), choice.clone()))
            .collect(),
        rules: base
            .and_then(|base| object(&base.value).ok())
            .map(|value| recipe::Rule {
                matches: Vec::new(),
                value,
            })
            .into_iter()
            .chain(rules.iter().filter_map(|rule| {
                let value = match &rule.bodies {
                    Some(bodies) => bodies
                        .first()
                        .and_then(|index| bindings.model(*index))
                        .map(|model| model.body),
                    None => object(&rule.property.value).ok(),
                }?;

                Some(recipe::Rule {
                    matches: rule.matches.clone(),
                    value,
                })
            }))
            .collect(),
    });
    let dynamic = !payloads.is_empty();
    let recipe = runtime::Definition {
        axes,
        conditions: (!named.is_empty()).then(|| {
            named
                .iter()
                .map(|condition| Arc::clone(&condition.name))
                .collect()
        }),
        default_payloads: dynamic.then_some(default_payloads),
        defaults,
        payloads: dynamic.then_some(payloads),
        prefix: match selection {
            Selection::Attribute => None,
            Selection::Class(prefix) => Some(Arc::from(prefix)),
        },
        silent,
    };
    let (dynamic_recipe, static_recipe) = if dynamic {
        (alternatives, None)
    } else {
        (None, alternatives)
    };

    Ok(Expanded {
        bindings,
        body,
        dynamic_recipe,
        recipe,
        static_recipe,
        types,
    })
}

/// A literal scalar default: a string, number, signed number, or literal template.
fn scalar(node: &Expression<'_>) -> Option<runtime::Scalar> {
    match node {
        Expression::TemplateLiteral(template) => {
            match expression::template(template, 0, &mut |_, _| None, "")? {
                Template::Text(text) => Some(runtime::Scalar::String(Arc::from(text))),
                Template::Expression(_) => None,
            }
        }
        Expression::StringLiteral(literal) => {
            Some(runtime::Scalar::String(Arc::from(literal.value.as_str())))
        }
        Expression::NumericLiteral(literal) => Some(runtime::Scalar::Number(literal.value)),
        Expression::UnaryExpression(unary)
            if matches!(
                unary.operator,
                UnaryOperator::UnaryNegation | UnaryOperator::UnaryPlus
            ) =>
        {
            let Expression::NumericLiteral(literal) = &unary.argument else {
                return None;
            };

            Some(runtime::Scalar::Number(
                if unary.operator == UnaryOperator::UnaryNegation {
                    -literal.value
                } else {
                    literal.value
                },
            ))
        }
        _ => None,
    }
}
