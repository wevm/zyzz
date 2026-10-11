//! Normalizes explicit configuration into isolated typed authoring contracts.
//!
//! [`create`] validates options exactly as `Config.create` does and returns the configured
//! catalog as data. Bound `style`, `variants`, selection, and root-control helpers are runtime
//! closures, so the model keeps only what they close over.

use std::sync::Arc;

use rustc_hash::{FxHashMap, FxHashSet};

use crate::data::{Data, Object, Property};
use crate::error::{Error, Result};
use crate::generated::literal::RULE_ORDER;
use crate::internal::theme::{self, ClassName, Definition};
use crate::internal::token::{self, Composition, Contract, CssOutput, Mappings};
use crate::internal::{identity, shorthands, variable_sets};
use crate::js::{self, Record};
use crate::vars;

/// Options a configuration accepts after variable sets are normalized.
const OPTIONS: [&str; 11] = [
    "composition",
    "cssOutput",
    "id",
    "defaultLayer",
    "defaultTheme",
    "layers",
    "output",
    "shorthands",
    "storageKey",
    "theme",
    "themes",
];

/// Layer name segments CSS reserves.
const RESERVED_LAYERS: [&str; 6] = [
    "default",
    "inherit",
    "initial",
    "revert",
    "revert-layer",
    "unset",
];

/// The renderer props format bound helpers produce.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Output {
    /// HTML attribute props.
    Html,
    /// React props, the default.
    React,
}

/// The theme mode a configuration binds.
#[derive(Clone, Debug)]
pub enum Catalog {
    /// Token-free authoring. A bound empty theme exists when shorthands, a default layer, or an id
    /// give the contract meaning.
    None(Option<Arc<Definition>>),
    /// One theme, available as `theme`.
    Theme(Arc<Definition>),
    /// Named alternatives, available as `themes`, and the default available as `theme`.
    Themes {
        /// The default catalog key.
        default_theme: Arc<str>,
        /// Handles in catalog order.
        themes: Record<Arc<Definition>>,
    },
}

/// A validated configuration.
#[derive(Clone, Debug)]
pub struct Configuration {
    /// Bound theme handles.
    pub catalog: Catalog,
    /// The contract every handle and bound helper shares. It carries the composition, CSS
    /// output, default layer, shorthands, and identity.
    pub contract: Arc<Contract>,
    /// The consumer-owned id.
    pub id: Option<Arc<str>>,
    /// The options after variable sets become theme or themes entries, in authored order.
    pub input: Object,
    /// Ordered layer names.
    pub layers: Option<Vec<Arc<str>>>,
    /// Renderer props format.
    pub output: Option<Output>,
    /// Shorthands validated by [`shorthands::read`].
    pub shorthands: Option<token::Map<Arc<[Arc<str>]>>>,
    /// Preference storage key shared by `script()` and `appearance`.
    pub storage_key: Option<Arc<str>>,
    /// Whether the options configured variable sets through `vars`.
    pub variable_mode: bool,
}

#[cold]
fn invalid(message: impl Into<String>) -> Error {
    Error::Config(message.into())
}

/// Reads the own properties of a plain configuration record.
fn record(value: &Data) -> Result<Vec<(Arc<str>, Data)>> {
    let object = match value {
        Data::Object(object) if !object.exotic => object,
        // A raw variable set is its own reference tree.
        Data::Theme(definition)
            if definition.metadata.contract.variable_set
                && definition.class_name == ClassName::Contract =>
        {
            return Ok(definition
                .tokens
                .as_object()
                .map(|tree| {
                    tree.iter()
                        .map(|(key, value)| (Arc::clone(key), value.clone()))
                        .collect()
                })
                .unwrap_or_default());
        }
        // Theme definitions expose `className` as their first accessor.
        Data::Theme(_) => {
            return Err(invalid("Configuration records cannot contain accessors."));
        }
        _ => return Err(invalid("Expected a plain configuration record.")),
    };

    object
        .properties()
        .map(|(key, property)| match property {
            Property::Value(value) => Ok((Arc::clone(key), value.clone())),
            Property::Accessor => Err(invalid("Configuration records cannot contain accessors.")),
        })
        .collect()
}

fn get<'d>(entries: &'d [(Arc<str>, Data)], key: &str) -> &'d Data {
    entries
        .iter()
        .find(|(name, _)| &**name == key)
        .map_or(&Data::Undefined, |(_, value)| value)
}

fn has(entries: &[(Arc<str>, Data)], key: &str) -> bool {
    entries.iter().any(|(name, _)| &**name == key)
}

fn set(entries: &mut Vec<(Arc<str>, Data)>, key: &str, value: Data) {
    match entries.iter_mut().find(|(name, _)| &**name == key) {
        Some(entry) => entry.1 = value,
        None => entries.push((Arc::from(key), value)),
    }
}

/// Reads a theme definition, or defines one from a plain token record.
fn definition(value: &Data) -> Result<Arc<Definition>> {
    if let Data::Theme(definition) = value {
        return Ok(Arc::clone(definition));
    }

    let tokens = Data::from(Object::from_entries(record(value)?));

    theme::define(&tokens, None)
        .map(Arc::new)
        .map_err(|error| match error {
            Error::Config(_) => error,
            other => invalid(other.text()),
        })
}

/// Wraps a variable set, or defines one, and rejects tokens that two mapped categories share.
fn normalize(value: &Data, mappings: Option<&Mappings>) -> Result<Arc<Definition>> {
    let variables = match value {
        Data::Theme(definition) => Arc::clone(definition),
        _ => Arc::new(vars::define(value, None, None)?),
    };
    let theme = variable_sets::theme(&variables, mappings.cloned())?;
    let Some(Mappings::Categories(categories)) = mappings else {
        return Ok(Arc::new(theme));
    };
    let mut names: FxHashMap<String, Arc<str>> = FxHashMap::default();

    for path in theme.metadata.values.keys() {
        let mut segments = path.split('.');
        let category = segments.next().unwrap_or_default();
        let parts = segments.collect::<Vec<_>>().join(".");
        let targets: Vec<&str> = match categories.get(category) {
            Some(properties) => properties.iter().map(|property| &**property).collect(),
            None => RULE_ORDER
                .iter()
                .copied()
                .filter(|property| token::accepts(category, property))
                .collect(),
        };

        for property in targets {
            let key = format!("{property}:{parts}");

            if let Some(previous) = names.get(&key)
                && (categories.contains_key(category)
                    || categories.contains_key(previous.split('.').next().unwrap_or_default()))
            {
                return Err(invalid(format!(
                    "Ambiguous variable token {parts} for {property}."
                )));
            }

            names.insert(key, Arc::clone(path));
        }
    }

    Ok(Arc::new(theme))
}

/// Matches `^(?:--|-?[_a-zA-Z])[\w-]*(?:\.(?:--|-?[_a-zA-Z])[\w-]*)*$`.
fn layer_name(layer: &str) -> bool {
    layer.split('.').all(|part| {
        let bytes = part.as_bytes();
        let body = if part.starts_with("--") {
            2
        } else {
            let sign = usize::from(bytes.first() == Some(&b'-'));

            match bytes.get(sign) {
                Some(byte) if byte.is_ascii_alphabetic() || *byte == b'_' => sign + 1,
                _ => return false,
            }
        };

        bytes
            .get(body..)
            .unwrap_or_default()
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    })
}

/// Sorts paths like `Array.prototype.sort` without a comparator.
fn sorted<'k>(keys: impl Iterator<Item = &'k str>) -> Vec<&'k str> {
    let mut keys: Vec<&str> = keys.collect();

    keys.sort_by(|left, right| js::code_units(left).cmp(js::code_units(right)));

    keys
}

/// The query thresholds a definition declares, sorted for comparison.
fn query_signature(definition: &Definition) -> [Vec<&str>; 3] {
    let Some(queries) = definition.metadata.queries.as_deref() else {
        return [Vec::new(), Vec::new(), Vec::new()];
    };

    [
        sorted(queries.breakpoint.keys().map(String::as_str)),
        sorted(queries.container.keys().map(String::as_str)),
        sorted(queries.container_names.iter().map(String::as_str)),
    ]
}

/// Binds a theme to the configuration contract as a handle.
fn handle(
    theme: &Definition,
    contract: &Arc<Contract>,
    id: Option<&str>,
    name: &str,
) -> Result<Arc<Definition>> {
    let original = token::bind(theme, contract, None)?;
    let class_name = identity::require_id(id, "Config.create").map(|identity| {
        Arc::from(format!(
            "z-theme-{}-{}",
            identity.get(3..).unwrap_or_default(),
            identity::name(name)
        ))
    });

    Ok(Arc::new(Definition {
        class_name: ClassName::Fixed(class_name),
        ..original
    }))
}

/// Validates options and binds themes to an isolated configuration contract.
///
/// # Errors
///
/// Returns `Config.InvalidError` for invalid options, themes, defaults, and layer names, and
/// `Vars.InvalidError` for invalid variable sets and mappings.
pub fn create(options: &Data) -> Result<Configuration> {
    let mut input = record(options)?;
    let variable_mode = !get(&input, "vars").is_undefined();
    let variable_catalog = variable_mode && !get(&input, "defaultVars").is_undefined();
    let variable_mappings = variable_sets::mappings(get(&input, "mappings"))?;

    if variable_mode {
        if !get(&input, "theme").is_undefined()
            || !get(&input, "themes").is_undefined()
            || !get(&input, "defaultTheme").is_undefined()
        {
            return Err(invalid("Use vars without theme options."));
        }

        let vars = get(&input, "vars").clone();
        let default_vars = get(&input, "defaultVars").clone();
        let mut rest: Vec<(Arc<str>, Data)> = input
            .into_iter()
            .filter(|(key, _)| !matches!(&**key, "vars" | "defaultVars" | "mappings"))
            .collect();

        if variable_catalog {
            set(&mut rest, "defaultTheme", default_vars);

            let mut themes = Object::new();

            for (name, value) in record(&vars)? {
                themes.insert(
                    name,
                    Data::Theme(normalize(&value, variable_mappings.as_ref())?),
                );
            }

            set(&mut rest, "themes", Data::from(themes));
        } else {
            set(
                &mut rest,
                "theme",
                Data::Theme(normalize(&vars, variable_mappings.as_ref())?),
            );
        }

        input = rest;
    } else if !get(&input, "mappings").is_undefined() || !get(&input, "defaultVars").is_undefined()
    {
        return Err(invalid("mappings and defaultVars require vars."));
    }

    for (key, _) in &input {
        if !OPTIONS.contains(&&**key) {
            return Err(invalid(format!("Unknown configuration option: {key}")));
        }
    }

    let id = match get(&input, "id") {
        Data::Undefined => None,
        Data::String(id) if !id.is_empty() => Some(Arc::clone(id)),
        _ => return Err(invalid("id must be a nonempty string.")),
    };
    let storage_key = match get(&input, "storageKey") {
        Data::Undefined => None,
        Data::String(key) if !key.is_empty() => Some(Arc::clone(key)),
        _ => return Err(invalid("storageKey must be a nonempty string.")),
    };
    let output = match get(&input, "output") {
        Data::Undefined => None,
        Data::String(output) if &**output == "html" => Some(Output::Html),
        Data::String(output) if &**output == "react" => Some(Output::React),
        _ => return Err(invalid("output must be html or react.")),
    };
    let css_output = match get(&input, "cssOutput") {
        Data::Undefined => None,
        Data::String(value) if CssOutput::parse(value).is_some() => CssOutput::parse(value),
        _ => return Err(invalid("cssOutput must be atomic or grouped.")),
    };
    let composition = match get(&input, "composition") {
        Data::Undefined => None,
        Data::String(value) if Composition::parse(value).is_some() => Composition::parse(value),
        _ => return Err(invalid("composition must be independent or ordered.")),
    };

    if !get(&input, "theme").is_undefined() && !get(&input, "themes").is_undefined() {
        return Err(invalid("Use either theme or themes, not both."));
    }

    let default_layer = match get(&input, "defaultLayer") {
        Data::Undefined => None,
        Data::String(layer) => Some(Arc::clone(layer)),
        _ => return Err(invalid("defaultLayer must be a CSS layer name.")),
    };
    let layers = get(&input, "layers");

    if !layers.is_undefined() || default_layer.is_some() {
        let layers: &[Data] = match layers {
            Data::Undefined => &[],
            Data::Array(layers) => layers,
            _ => return Err(invalid("layers must be an array.")),
        };
        let mut candidates: Vec<&Data> = layers.iter().collect();
        let extra = default_layer
            .as_ref()
            .map(|layer| Data::String(Arc::clone(layer)));

        if let Some(extra) = &extra
            && !layers.iter().any(|layer| layer.same(extra))
        {
            candidates.push(extra);
        }

        let mut seen: FxHashSet<&str> = FxHashSet::default();

        for layer in candidates {
            let Some(layer) = layer.as_str().filter(|layer| {
                layer_name(layer)
                    && !layer.split('.').any(|part| {
                        RESERVED_LAYERS
                            .iter()
                            .any(|reserved| reserved.eq_ignore_ascii_case(part))
                    })
            }) else {
                return Err(invalid(
                    "Layer names must be plain CSS identifiers, optionally dotted.",
                ));
            };

            if !seen.insert(layer) {
                return Err(invalid(format!("Duplicate layer: {layer}")));
            }
        }
    }

    let shorthands = match get(&input, "shorthands") {
        Data::Undefined => None,
        value => Some(shorthands::read(value).map_err(|error| invalid(error.text()))?),
    };
    let contract = Arc::new(Contract {
        complete: id.is_some(),
        composition,
        css_output: Some(css_output.unwrap_or(CssOutput::Atomic)),
        default_layer: default_layer.clone(),
        identity: id
            .as_deref()
            .map(|id| identity::require_id(Some(id), "Config.create"))
            .transpose()?
            .map(Arc::from),
        mappings: if variable_mode {
            variable_mappings.clone()
        } else {
            None
        },
        shorthands: shorthands.clone(),
        variable_set: variable_mode,
    });
    let themes = get(&input, "themes").clone();
    let default_theme = get(&input, "defaultTheme").clone();
    let catalog = if themes.is_undefined() {
        if !default_theme.is_undefined() {
            return Err(invalid("defaultTheme requires a named themes catalog."));
        }

        match get(&input, "theme") {
            Data::Undefined => Catalog::None(
                (shorthands.is_some() || default_layer.is_some() || id.is_some())
                    .then(|| {
                        token::bind(
                            &theme::define(&Data::from(Object::new()), None)?,
                            &contract,
                            None,
                        )
                    })
                    .transpose()?
                    .map(Arc::new),
            ),
            value => Catalog::Theme(handle(
                &*definition(value)?,
                &contract,
                id.as_deref(),
                "theme",
            )?),
        }
    } else {
        let entries = record(&themes)?;
        let Data::String(default_theme) = default_theme else {
            return Err(invalid("defaultTheme must name a theme in the catalog."));
        };

        if !has(&entries, &default_theme) {
            return Err(invalid("defaultTheme must name a theme in the catalog."));
        }

        let mut definitions: Vec<(Arc<str>, Arc<Definition>)> = Vec::with_capacity(entries.len());

        for (name, value) in &entries {
            if name.is_empty() {
                return Err(invalid("Theme names must be nonempty."));
            }

            definitions.push((Arc::clone(name), definition(value)?));
        }

        let Some(base) = definitions
            .iter()
            .find(|(name, _)| *name == default_theme)
            .map(|(_, definition)| Arc::clone(definition))
        else {
            return Err(invalid("defaultTheme must name a theme in the catalog."));
        };
        let paths = sorted(base.metadata.values.keys().map(|path| &**path));

        for (name, value) in &definitions {
            let candidate = sorted(value.metadata.values.keys().map(|path| &**path));
            let compatible = query_signature(&base) == query_signature(value)
                && paths.len() == candidate.len()
                && paths.iter().zip(&candidate).all(|(path, other)| {
                    path == other
                        && (!variable_mode
                            || base.metadata.values.get(*path).map(variable_sets::domain)
                                == value.metadata.values.get(*path).map(variable_sets::domain))
                });

            if !compatible {
                return Err(invalid(format!(
                    "Theme {} must have the default theme's complete token paths and domains.",
                    js::quote(name)
                )));
            }
        }

        let mut themes = Record::new();

        for (name, value) in &definitions {
            themes.insert(
                Arc::clone(name),
                handle(value, &contract, id.as_deref(), name)?,
            );
        }

        Catalog::Themes {
            default_theme,
            themes,
        }
    };

    let layers = match get(&input, "layers") {
        Data::Array(layers) => Some(
            layers
                .iter()
                .filter_map(|layer| layer.as_str().map(Arc::from))
                .collect(),
        ),
        _ => None,
    };

    Ok(Configuration {
        catalog,
        contract,
        id,
        input: Object::from_entries(input),
        layers,
        output,
        shorthands,
        storage_key,
        variable_mode,
    })
}
