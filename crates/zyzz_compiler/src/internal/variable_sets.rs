//! Builds variable sets: nested variable records, media and color-scheme values, and category
//! mappings that resolve declaration values to variables.

use std::sync::Arc;

use rustc_hash::FxHashSet;

use crate::data::{Data, Object, Property};
use crate::error::{Error, Result};
use crate::generated::literal::LENGTH_UNITS;
use crate::internal::literal::{self, Scalar};
use crate::internal::query::{self, Metadata as Queries};
use crate::internal::theme::{self, ClassName, Definition, TreeBuilder};
use crate::internal::token::{
    self, Contract, Expression, Group, Map, Mappings, Metadata, Part, Value,
};
use crate::internal::{condition, typography};
use crate::js;

fn invalid(path: &[Arc<str>], message: &str) -> Error {
    Error::Vars {
        message: message.to_owned(),
        path: path.iter().map(std::string::ToString::to_string).collect(),
    }
}

fn invalid_strings(path: &[String], message: &str) -> Error {
    Error::Vars {
        message: message.to_owned(),
        path: path.to_vec(),
    }
}

/// Wraps a variable set as a theme whose tokens are the set's variables.
///
/// # Errors
///
/// Returns [`Error::Vars`] when the input is not a variable set.
pub fn theme(variables: &Definition, mappings: Option<Mappings>) -> Result<Definition> {
    let metadata = &variables.metadata;

    if !metadata.contract.variable_set {
        return Err(invalid(&[], "Expected a variable set."));
    }

    let contract = Arc::new(Contract {
        mappings: mappings.or_else(|| metadata.contract.mappings.clone()),
        ..(*metadata.contract).clone()
    });
    let values = rebind(metadata, &contract)?;
    let tree = from(&Metadata {
        contract,
        values: Arc::new(values),
        ..metadata.clone()
    })?;

    Ok(Definition {
        class_name: ClassName::VariableSet,
        ..tree
    })
}

/// Rebuilds a definition's token tree from metadata.
///
/// # Errors
///
/// Returns [`Error::Vars`] when a referenced path is missing or cyclic.
pub fn from(metadata: &Metadata) -> Result<Definition> {
    build_tree(
        &metadata.values,
        &metadata.contract,
        metadata.queries.clone(),
        metadata.paths.clone(),
    )
}

/// Options for [`build`].
#[derive(Default)]
pub struct BuildOptions<'a> {
    /// Existing set this build extends.
    pub base: Option<&'a Metadata>,
    /// Whether the input derives new paths only.
    pub derived: bool,
}

/// Builds a variable set from authored records.
///
/// # Errors
///
/// Returns [`Error::Vars`] for invalid records, leaves, conditions, and overrides.
pub fn build(
    input: &Data,
    contract: &Arc<Contract>,
    options: &BuildOptions<'_>,
) -> Result<Definition> {
    let base = options.base;
    let mut values: Map<Value> = base.map(|base| (*base.values).clone()).unwrap_or_default();
    let mut paths: Map<Arc<[Arc<str>]>> =
        base.and_then(|base| base.paths.clone()).unwrap_or_default();
    // Segment keys keep dotted typography conditions distinct from nested paths.
    let mut leaves: FxHashSet<Vec<Arc<str>>> = FxHashSet::default();
    let mut categories: FxHashSet<Vec<Arc<str>>> = FxHashSet::default();

    if let Some(base) = base {
        for path in base.values.keys() {
            let parts: Vec<Arc<str>> = base
                .paths
                .as_ref()
                .and_then(|paths| paths.get(path))
                .map_or_else(
                    || path.split('.').map(Into::into).collect(),
                    |parts| parts.to_vec(),
                );

            for index in 1..parts.len() {
                categories.insert(parts.get(..index).unwrap_or_default().to_vec());
            }

            leaves.insert(parts);
        }
    }

    let mut fields: Vec<(Arc<str>, Data)> = record(input, &[])?;
    let queries = Queries {
        breakpoint: base
            .and_then(|base| base.queries.as_ref())
            .map(|queries| queries.breakpoint.clone())
            .unwrap_or_default(),
        container: base
            .and_then(|base| base.queries.as_ref())
            .map(|queries| queries.container.clone())
            .unwrap_or_default(),
        container_names: base
            .and_then(|base| base.queries.as_ref())
            .map(|queries| queries.container_names.clone())
            .unwrap_or_default(),
    };
    let mut query_fields = Object::new();

    for key in ["breakpoint", "container", "containerNames"] {
        let Some(position) = fields.iter().position(|(name, _)| &**name == key) else {
            continue;
        };
        let value = fields
            .get(position)
            .map_or(Data::Undefined, |(_, value)| value.clone());

        if base.is_some() {
            if key == "containerNames" {
                let Data::Array(names) = &value else {
                    return Err(invalid_strings(
                        &[key.to_owned()],
                        "Extensions cannot remove container identities.",
                    ));
                };

                if queries.container_names.iter().any(|name| {
                    !names
                        .iter()
                        .any(|candidate| candidate.as_str() == Some(name))
                }) {
                    return Err(invalid_strings(
                        &[key.to_owned()],
                        "Extensions cannot remove container identities.",
                    ));
                }
            } else {
                record(&value, &[key.into()])?;
            }
        }

        query_fields.insert(key, value.clone());

        let empty = value.as_object().is_none_or(Object::is_empty);

        if key != "container" || empty {
            fields.remove(position);
        }
    }

    // Query thresholds validate through the theme rules, then merge over the base.
    let mut merged = Object::new();

    for key in ["breakpoint", "container", "containerNames"] {
        if let Some(value) = query_fields.get(key) {
            if key == "containerNames" {
                merged.insert(key, value.clone());
            } else {
                let mut thresholds = Object::new();
                let current = if key == "breakpoint" {
                    &queries.breakpoint
                } else {
                    &queries.container
                };

                for (name, threshold) in current {
                    thresholds.insert(name.as_str(), Data::from(threshold.as_str()));
                }

                if let Some(object) = value.as_object() {
                    for (name, threshold) in object.iter() {
                        thresholds.insert(Arc::clone(name), threshold.clone());
                    }
                }

                merged.insert(key, Data::from(thresholds));
            }
        } else if base.is_some() {
            let existing = match key {
                "breakpoint" => thresholds(&queries.breakpoint),
                "container" => thresholds(&queries.container),
                _ => Data::Array(Arc::new(
                    queries
                        .container_names
                        .iter()
                        .map(|name| Data::from(name.as_str()))
                        .collect(),
                )),
            };

            if base.and_then(|base| base.queries.as_ref()).is_some() {
                merged.insert(key, existing);
            }
        }
    }

    let query_data = theme::define(&Data::from(merged), None)
        .map_err(|error| match error {
            Error::Theme { message, path } => Error::Theme { message, path },
            other => other,
        })?
        .metadata
        .queries;

    let mut builder = Builder {
        active: Vec::new(),
        base,
        categories: &categories,
        conditions: Vec::new(),
        contract,
        derived: options.derived,
        leaves: &leaves,
        paths: &mut paths,
        queries: query_data.as_deref(),
        values: &mut values,
    };

    if !fields.is_empty() {
        builder.visit(&Data::from(Object::from_entries(fields)), &[])?;
    }

    let conditions = std::mem::take(&mut builder.conditions);
    let empty = Queries::default();

    for path in conditions {
        let key = path.last().map(|key| &**key).unwrap_or_default();

        query::resolve(key, query_data.as_deref().unwrap_or(&empty))
            .and_then(|resolved| condition::normalize(&resolved))
            .map_err(|error| invalid(&path, &error.text()))?;
    }

    build_tree(
        &values,
        contract,
        query_data,
        (!paths.is_empty()).then_some(paths),
    )
}

fn thresholds(values: &indexmap::IndexMap<String, String, rustc_hash::FxBuildHasher>) -> Data {
    Data::from(Object::from_entries(values.iter().map(|(name, value)| {
        (Arc::from(name.as_str()), Data::from(value.as_str()))
    })))
}

struct Builder<'a> {
    active: Vec<*const Object>,
    base: Option<&'a Metadata>,
    categories: &'a FxHashSet<Vec<Arc<str>>>,
    conditions: Vec<Vec<Arc<str>>>,
    contract: &'a Arc<Contract>,
    derived: bool,
    leaves: &'a FxHashSet<Vec<Arc<str>>>,
    paths: &'a mut Map<Arc<[Arc<str>]>>,
    queries: Option<&'a Queries>,
    values: &'a mut Map<Value>,
}

/// Whether authored data is a variable leaf rather than a nested record.
fn is_leaf(input: &Data, path: &[Arc<str>]) -> bool {
    match input {
        Data::String(_) | Data::Number(_) | Data::Token(_) | Data::Expression(_) => true,
        Data::Object(object) if !path.is_empty() => {
            object.has("default")
                || (object.has("light") && object.has("dark"))
                || (object.len() <= 2 && (object.has("light") || object.has("dark")))
        }
        _ => false,
    }
}

impl Builder<'_> {
    fn visit(&mut self, input: &Data, path: &[Arc<str>]) -> Result<()> {
        if is_leaf(input, path) {
            if path.is_empty() {
                return Err(invalid(path, "Expected a variable record."));
            }

            if self.categories.contains(path) {
                return Err(invalid(
                    path,
                    "Extensions cannot replace a variable category with a leaf.",
                ));
            }

            let name: Arc<str> = path
                .iter()
                .map(|part| &**part)
                .collect::<Vec<_>>()
                .join(".")
                .into();
            let previous = self.base.and_then(|base| base.values.get(&*name));

            if previous.is_some() && self.derived {
                return Err(invalid(
                    path,
                    "Derived variables cannot replace existing paths.",
                ));
            }

            // Restating the base reference would make the variable reference itself.
            if previous.is_some()
                && let Data::Token(reference) = input
                && *reference.path == *name
                && (Arc::ptr_eq(&reference.contract, self.contract)
                    || (self.contract.identity.is_some()
                        && reference.contract.identity == self.contract.identity))
            {
                return Ok(());
            }

            let value = read(input, path, self.queries, &[])?;

            if let Some(previous) = previous
                && domain(previous) != domain(&value)
            {
                return Err(invalid(
                    path,
                    "Variable overrides must preserve their domain.",
                ));
            }

            if path.iter().any(|part| typography::condition(part)) {
                self.paths.insert(Arc::clone(&name), path.into());
            }

            self.values.insert(name, value);

            return Ok(());
        }

        if self.leaves.contains(path) {
            return Err(invalid(
                path,
                "Extensions cannot replace a variable leaf with a category.",
            ));
        }

        let entries = record(input, path)?;
        let identity = match input {
            Data::Object(object) => Arc::as_ptr(object),
            _ => std::ptr::null(),
        };

        if self.active.contains(&identity) {
            return Err(invalid(path, "Cyclic variables are not supported."));
        }

        self.active.push(identity);

        if entries.is_empty()
            && (self.base.is_none() || (!path.is_empty() && !self.categories.contains(path)))
        {
            return Err(invalid(path, "Variable records cannot be empty."));
        }

        for (key, value) in entries {
            let query = path.first().map(|part| &**part) == Some("typography")
                && typography::condition(&key);
            let mut next = path.to_vec();
            next.push(Arc::clone(&key));

            if query {
                self.conditions.push(next.clone());
            }

            if !query && (key.is_empty() || key.contains(['.', '!']) || key.starts_with('@')) {
                return Err(invalid(
                    &next,
                    "Expected a nonempty variable key without dots or conditions.",
                ));
            }

            self.visit(&value, &next)?;
        }

        self.active.retain(|candidate| *candidate != identity);

        Ok(())
    }
}

/// Lists references to every variable of a set as a tree, for building a named extension.
pub fn references(variables: &Definition, metadata: &Metadata) -> Data {
    let mut tree = TreeBuilder::default();

    for (path, value) in metadata.values.iter() {
        let parts: Vec<Arc<str>> = metadata
            .paths
            .as_ref()
            .and_then(|paths| paths.get(path))
            .map_or_else(
                || path.split('.').map(Into::into).collect(),
                |parts| parts.to_vec(),
            );
        let leaf = if parts.first().map(|part| &**part) == Some("typography") {
            value_data(value)
        } else {
            let mut source = Some(&variables.tokens);

            for part in &parts {
                source = source
                    .and_then(Data::as_object)
                    .and_then(|object| object.get(part));
            }

            source.cloned().unwrap_or(Data::Undefined)
        };

        tree.insert(&parts, leaf);
    }

    let Data::Object(object) = tree.finish() else {
        return Data::Undefined;
    };
    let mut object = (*object).clone();

    if let Some(queries) = &metadata.queries {
        if !queries.breakpoint.is_empty() {
            object.insert("breakpoint", thresholds(&queries.breakpoint));
        }

        if !queries.container.is_empty() {
            object.insert("container", thresholds(&queries.container));
        }

        if !queries.container_names.is_empty() {
            object.insert(
                "containerNames",
                Data::Array(Arc::new(
                    queries
                        .container_names
                        .iter()
                        .map(|name| Data::from(name.as_str()))
                        .collect(),
                )),
            );
        }
    }

    Data::from(object)
}

/// Converts a token value back into authored data.
pub fn value_data(value: &Value) -> Data {
    match value {
        Value::Composition(expression) => Data::Expression(Arc::clone(expression)),
        Value::Number(number) => Data::Number(*number),
        Value::Record(entries) => Data::from(Object::from_entries(
            entries
                .iter()
                .map(|(key, value)| (Arc::clone(key), value_data(value))),
        )),
        Value::Reference(reference) => Data::Token(Arc::clone(reference)),
        Value::String(text) => Data::String(Arc::clone(text)),
    }
}

fn build_tree(
    values: &Map<Value>,
    contract: &Arc<Contract>,
    queries: Option<Arc<Queries>>,
    paths: Option<Map<Arc<[Arc<str>]>>>,
) -> Result<Definition> {
    let values = rebind(
        &Metadata {
            contract: Arc::clone(contract),
            css_name: None,
            paths: None,
            queries: None,
            values: Arc::new(values.clone()),
        },
        contract,
    )?;
    let mut tree = TreeBuilder::default();

    for (path, value) in &values {
        let parts: Vec<Arc<str>> = paths
            .as_ref()
            .and_then(|paths| paths.get(path))
            .map_or_else(
                || path.split('.').map(Into::into).collect(),
                |parts| parts.to_vec(),
            );

        tree.insert(
            &parts,
            Data::Token(token::create(
                contract,
                domain(value),
                Arc::clone(path),
                value.clone(),
            )),
        );
    }

    let tokens = tree.finish();

    Ok(Definition {
        class_name: ClassName::Contract,
        metadata: Metadata {
            contract: Arc::clone(contract),
            css_name: None,
            paths,
            queries,
            values: Arc::new(values),
        },
        vars: tokens.clone(),
        tokens,
    })
}

/// Lists the data properties of a plain record.
fn record(input: &Data, path: &[Arc<str>]) -> Result<Vec<(Arc<str>, Data)>> {
    let Data::Object(object) = input else {
        return Err(invalid(path, "Expected a plain variable record."));
    };

    if object.exotic {
        return Err(invalid(path, "Expected a plain variable record."));
    }

    object
        .properties()
        .map(|(key, property)| match property {
            Property::Value(value) => Ok((Arc::clone(key), value.clone())),
            Property::Accessor => Err(invalid(path, "Vars require enumerable data properties.")),
        })
        .collect()
}

fn read(
    input: &Data,
    path: &[Arc<str>],
    queries: Option<&Queries>,
    active: &[*const Object],
) -> Result<Value> {
    match input {
        Data::Token(reference) => return Ok(Value::Reference(Arc::clone(reference))),
        Data::Expression(expression) => {
            let group = expression
                .group
                .as_deref()
                .filter(|group| *group == "color" || *group == "spacing");
            let Some(group) = group else {
                return Err(invalid(path, "Expected a composed variable value."));
            };
            let parts: Vec<Data> = expression
                .parts
                .iter()
                .map(|part| match part {
                    Part::Text(text) => Data::String(Arc::clone(text)),
                    Part::Reference(reference) => Data::Token(Arc::clone(reference)),
                    Part::Binding(binding) => Data::Binding(Arc::clone(binding)),
                })
                .collect();

            return compose(group, &parts).map(Value::Composition);
        }
        Data::Number(number) if number.is_finite() => return Ok(Value::Number(*number)),
        Data::String(text) if !js::trim(text).is_empty() && !text.contains([';', '{', '}']) => {
            return Ok(Value::String(Arc::clone(text)));
        }
        _ => {}
    }

    let identity = match input {
        Data::Object(object) => Arc::as_ptr(object),
        _ => std::ptr::null(),
    };

    if !identity.is_null() && active.contains(&identity) {
        return Err(invalid(path, "Cyclic variables are not supported."));
    }

    let entries = record(input, path)?;
    let mut next = active.to_vec();
    next.push(identity);
    let has = |key: &str| entries.iter().any(|(name, _)| &**name == key);
    let get = |key: &str| {
        entries
            .iter()
            .find(|(name, _)| &**name == key)
            .map(|(_, value)| value)
    };

    if has("default") {
        for (key, _) in &entries {
            if &**key != "default" && (!media_alias(key) || key.contains([';', '{', '}'])) {
                let mut failing = path.to_vec();
                failing.push(Arc::clone(key));

                return Err(invalid(&failing, "Expected an @media condition."));
            }
        }

        let empty = Queries::default();
        let mut result: Vec<(Arc<str>, Value)> = Vec::with_capacity(entries.len());

        for (key, value) in &entries {
            let mut failing = path.to_vec();
            failing.push(Arc::clone(key));

            let condition: Arc<str> = if &**key == "default" {
                Arc::clone(key)
            } else {
                query::resolve(key, queries.unwrap_or(&empty))
                    .and_then(|resolved| condition::normalize(&resolved))
                    .map_err(|error| invalid(&failing, &error.text()))?
                    .into()
            };
            let value = read(value, &failing, queries, &next)?;

            match result.iter_mut().find(|(name, _)| *name == condition) {
                Some(entry) => entry.1 = value,
                None => result.push((condition, value)),
            }
        }

        let expected = result
            .iter()
            .find(|(name, _)| &**name == "default")
            .map(|(_, value)| domain(value));

        if result
            .iter()
            .any(|(_, value)| Some(domain(value)) != expected)
        {
            return Err(invalid(path, "Conditional values must share one domain."));
        }

        return Ok(Value::Record(result.into()));
    }

    if entries.len() == 2
        && let (Some(light), Some(dark)) = (get("light"), get("dark"))
    {
        let mut light_path = path.to_vec();
        light_path.push("light".into());
        let mut dark_path = path.to_vec();
        dark_path.push("dark".into());
        let light = read(light, &light_path, queries, &next)?;
        let dark = read(dark, &dark_path, queries, &next)?;

        if domain(&light) != "color" || domain(&dark) != "color" {
            return Err(invalid(path, "Color schemes require colors."));
        }

        return Ok(Value::Record(Arc::from([
            ("light".into(), light),
            ("dark".into(), dark),
        ])));
    }

    Err(invalid(
        path,
        "Expected a scalar, a complete color pair, or media overrides with a default.",
    ))
}

/// Matches `^@media\s+\S`.
fn media_alias(key: &str) -> bool {
    key.strip_prefix("@media").is_some_and(|rest| {
        let trimmed = rest.trim_start_matches(js::is_whitespace);

        trimmed.len() < rest.len() && !trimmed.is_empty()
    })
}

const COLOR_FUNCTIONS: [&str; 13] = [
    "color",
    "color-mix",
    "contrast-color",
    "light-dark",
    "rgb",
    "rgba",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
];

/// The value domain of a variable: `color`, `spacing`, `number`, or `string`.
pub fn domain(value: &Value) -> Group {
    match value {
        Value::Reference(reference) => reference.group.clone(),
        Value::Composition(expression) => expression.group.clone().unwrap_or_default(),
        Value::Record(_) => value
            .field("default")
            .map_or_else(|| Group::from("color"), domain),
        Value::Number(number) if *number == 0.0 => Group::from("spacing"),
        Value::Number(_) => Group::from("number"),
        Value::String(text) => {
            let lower = text.to_ascii_lowercase();
            let color = lower.starts_with('#')
                || COLOR_FUNCTIONS.iter().any(|name| {
                    lower
                        .strip_prefix(name)
                        .is_some_and(|rest| rest.starts_with('('))
                })
                || (!text.contains(|character: char| {
                    character.is_ascii_digit() || matches!(character, '(' | ')' | '#')
                }) && literal::is_literal("color", Scalar::String(text)));

            if color {
                return Group::from("color");
            }

            if &**text == "0" || is_length(text) {
                return Group::from("spacing");
            }

            Group::from("string")
        }
    }
}

/// Matches `^[+-]?(?:[0-9]*\.[0-9]+|[0-9]+)(?:<length units>)$` case-insensitively.
fn is_length(text: &str) -> bool {
    let length = js::css_number_prefix(text, b"+-");
    let number = text.get(..length).unwrap_or_default();

    // The exponent form is not part of this pattern.
    if length == 0 || number.contains(['e', 'E']) {
        return false;
    }

    let unit = text.get(length..).unwrap_or_default();

    LENGTH_UNITS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(unit))
}

/// Validates category mappings, sorted like `localeCompare`.
///
/// # Errors
///
/// Returns [`Error::Vars`] for non-arrays, unknown properties, and duplicates.
pub fn mappings(input: &Data) -> Result<Option<Mappings>> {
    match input {
        Data::Undefined => return Ok(None),
        Data::Bool(false) => return Ok(Some(Mappings::Disabled)),
        _ => {}
    }

    let mut entries = record(input, &["mappings".into()])?;

    entries.sort_by(|(left, _), (right, _)| js::locale_compare(left, right));

    let mut categories = Map::default();

    for (category, value) in entries {
        let failing = ["mappings".into(), Arc::clone(&category)];
        let Data::Array(items) = &value else {
            return Err(invalid(
                &failing,
                "Expected an array of CSS property names.",
            ));
        };

        if category.is_empty()
            || items.iter().any(|item| {
                item.as_str()
                    .is_none_or(|property| literal::rule(property).is_none())
            })
        {
            return Err(invalid(
                &failing,
                "Expected an array of CSS property names.",
            ));
        }

        let properties: Vec<Arc<str>> = items
            .iter()
            .filter_map(|item| item.as_str().map(Arc::from))
            .collect();
        let unique: FxHashSet<&str> = properties.iter().map(|property| &**property).collect();

        if unique.len() != properties.len() {
            return Err(invalid(
                &failing,
                "Property mappings cannot contain duplicates.",
            ));
        }

        categories.insert(category, properties.into());
    }

    Ok(Some(Mappings::Categories(categories)))
}

/// Merges derived records into base records without replacing existing leaves.
///
/// # Errors
///
/// Returns [`Error::Vars`] when a derived record replaces an existing path.
pub fn merge(base: &Data, derived: &Data, path: &[Arc<str>]) -> Result<Data> {
    let mut result = Object::from_entries(record(base, path)?);

    for (key, value) in record(derived, path)? {
        let mut next = path.to_vec();
        next.push(Arc::clone(&key));

        if let Some(existing) = result.get(&key).cloned() {
            for entry in [&existing, &value] {
                let replaceable = match entry {
                    Data::Object(object) => {
                        !(object.has("default")
                            || (object.has("light") && object.has("dark"))
                            || (object.len() <= 2 && (object.has("light") || object.has("dark"))))
                    }
                    _ => false,
                };

                if !replaceable {
                    return Err(invalid(
                        &next,
                        "Derived variables cannot replace existing paths.",
                    ));
                }
            }

            result.insert(key, merge(&existing, &value, &next)?);
        } else {
            result.insert(key, value);
        }
    }

    Ok(Data::from(result))
}

/// Re-resolves internal references of a set against a new contract.
///
/// # Errors
///
/// Returns [`Error::Vars`] for missing or cyclic paths.
pub fn rebind(metadata: &Metadata, contract: &Arc<Contract>) -> Result<Map<Value>> {
    struct Rebinder<'a> {
        active: Vec<Arc<str>>,
        contract: &'a Arc<Contract>,
        metadata: &'a Metadata,
        values: Map<Value>,
    }

    impl Rebinder<'_> {
        fn owned(&self, reference: &token::Reference) -> bool {
            Arc::ptr_eq(&reference.contract, &self.metadata.contract)
                || (self.metadata.contract.identity.is_some()
                    && reference.contract.identity == self.metadata.contract.identity)
        }

        fn resolve(&mut self, value: &Value) -> Result<Value> {
            match value {
                Value::Reference(reference) => {
                    if !self.owned(reference) {
                        return Ok(value.clone());
                    }

                    let resolved = self.visit(&reference.path)?;

                    Ok(Value::Reference(token::create(
                        self.contract,
                        reference.group.clone(),
                        Arc::clone(&reference.path),
                        resolved,
                    )))
                }
                Value::Composition(expression) => {
                    let mut parts = Vec::with_capacity(expression.parts.len());

                    for part in &expression.parts {
                        parts.push(match part {
                            Part::Text(text) => Data::String(Arc::clone(text)),
                            Part::Reference(reference) => match self
                                .resolve(&Value::Reference(Arc::clone(reference)))?
                            {
                                Value::Reference(reference) => Data::Token(reference),
                                _ => return Err(invalid(&[], "Expected a variable reference.")),
                            },
                            Part::Binding(_) => {
                                return Err(invalid(&[], "Expected a variable reference."));
                            }
                        });
                    }

                    compose(expression.group.as_deref().unwrap_or_default(), &parts)
                        .map(Value::Composition)
                }
                Value::Record(entries) => {
                    let mut resolved = Vec::with_capacity(entries.len());

                    for (key, entry) in entries.iter() {
                        resolved.push((Arc::clone(key), self.resolve(entry)?));
                    }

                    Ok(Value::Record(resolved.into()))
                }
                other => Ok(other.clone()),
            }
        }

        fn visit(&mut self, path: &Arc<str>) -> Result<Value> {
            if let Some(value) = self.values.get(path) {
                return Ok(value.clone());
            }

            let segments: Vec<Arc<str>> = path.split('.').map(Into::into).collect();

            if self.active.contains(path) {
                return Err(invalid(&segments, "Cyclic variables are not supported."));
            }

            let Some(value) = self.metadata.values.get(path) else {
                return Err(invalid(&segments, "Referenced variable path is missing."));
            };

            self.active.push(Arc::clone(path));
            let resolved = self.resolve(value)?;
            self.active.retain(|candidate| candidate != path);
            self.values.insert(Arc::clone(path), resolved.clone());

            Ok(resolved)
        }
    }

    let mut rebinder = Rebinder {
        active: Vec::new(),
        contract,
        metadata,
        values: Map::default(),
    };

    for path in metadata.values.keys() {
        rebinder.visit(path)?;
    }

    Ok(metadata
        .values
        .keys()
        .map(|path| {
            (
                Arc::clone(path),
                rebinder
                    .values
                    .get(path)
                    .cloned()
                    .unwrap_or(Value::Number(0.0)),
            )
        })
        .collect())
}

/// Builds a composed variable value, as `Vars.compose` does.
///
/// # Errors
///
/// Returns [`Error::Vars`] for unsupported domains and parts.
pub fn compose(group: &str, parts: &[Data]) -> Result<Arc<Expression>> {
    if group != "color" && group != "spacing" {
        return Err(invalid(
            &[],
            "Compositions require a color or spacing domain.",
        ));
    }

    if parts.is_empty() {
        return Err(invalid(&[], "Compositions require nonempty CSS parts."));
    }

    let mut values = Vec::with_capacity(parts.len());

    for part in parts {
        values.push(match part {
            Data::Token(reference) => Part::Reference(Arc::clone(reference)),
            Data::Number(number) if number.is_finite() => Part::Text(js::number(*number).into()),
            Data::String(text) if !text.contains([';', '{', '}', '!']) => {
                Part::Text(Arc::clone(text))
            }
            _ => {
                return Err(invalid(
                    &[],
                    "Composition parts must be CSS text, finite numbers, or variable references.",
                ));
            }
        });
    }

    if !values
        .iter()
        .any(|part| !matches!(part, Part::Text(text) if js::trim(text).is_empty()))
    {
        return Err(invalid(&[], "Compositions require nonempty CSS parts."));
    }

    Ok(Arc::new(Expression {
        group: Some(Group::from(group)),
        parts: values,
    }))
}
