//! Converts authored variables to static native value profiles, mirroring `NativeVars.compile`.
//!
//! Every set produces a light and a dark tree of converted leaves. A leaf that cannot convert holds
//! its diagnostic as a one-element string array, so reading it reports the failure while the rest
//! of the profile stays usable. Media-conditioned values add one profile set per media selection.
//! [`Shared`] carries the profiles a source graph assigns to one module.

use std::sync::Arc;

use indexmap::IndexMap;
use rustc_hash::{FxBuildHasher, FxHashMap};

use crate::compiler::internal::native_media;
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::generated::literal;
use crate::internal::theme::Definition;
use crate::internal::token::{Map, Mappings, Metadata, Part, Reference, Value as TokenValue};
use crate::internal::variable_sets;
use crate::js::{self, Record};
use crate::react_native::internal::calculation;
use crate::react_native::internal::scalar::{self, Kind, Value as Scalar};
use crate::react_native::style_sheet::ColorScheme;
use crate::runtime::native_vars::{EncodedTree, Media, Options as Output, Profile, Profiles};

/// Compiler inputs for resolved native variables.
#[derive(Clone, Copy, Debug)]
pub struct Options<'a> {
    /// Configuration fallback set name.
    pub default_vars: &'a Arc<str>,
    /// Unit and font mappings.
    pub scalar: &'a scalar::Options,
    /// Whether the input is a standalone definition instead of a named catalog.
    pub unnamed: bool,
    /// Compatible authored sets by name.
    pub vars: &'a Record<Arc<Definition>>,
}

/// Static profile artifacts of one source module, owned by the graph that compiles it.
#[derive(Clone, Debug, Default)]
pub struct Shared {
    /// Exported profile constant names by serialized profile, in definition order.
    pub definitions: IndexMap<String, String, FxBuildHasher>,
    /// Profiles another module defines, by the UTF-8 start offset of the reading argument.
    pub reads: FxHashMap<u32, Import>,
}

/// A profile constant a read takes from its defining module.
#[derive(Clone, Debug, Default)]
pub struct Import {
    /// Exported constant name.
    pub name: String,
    /// Specifier of the defining module, absent when the reading module defines the profile.
    pub source: Option<String>,
}

/// Resolves every variable of every set and scheme with the style compiler's unit and font
/// mappings.
///
/// # Errors
///
/// Returns the media preparation errors of [`native_media::prepare`], such as a ninth distinct
/// condition. Conversion failures of single variables become deferred leaf diagnostics instead.
pub fn compile(options: &Options<'_>) -> Result<Output> {
    let media = native_media::prepare(None, Some(options.vars), options.scalar)?;
    let alternatives = match &media {
        Some(media) => {
            let mut profiles = Vec::new();

            for selection in media.selections() {
                let vars = media.select(&selection).vars().unwrap_or_default();
                let compiled = compile(&Options {
                    vars: &vars,
                    ..*options
                })?;

                profiles.push((Arc::from(selection), compiled.profiles));
            }

            Some(Media {
                profiles,
                queries: media.queries.clone(),
            })
        }
        None => None,
    };
    let mut profiles: Profiles = Vec::with_capacity(options.vars.len());

    for (name, theme) in options.vars.iter() {
        let profile = |scheme| {
            Converter {
                active: Vec::new(),
                media: media.is_some(),
                metadata: &theme.metadata,
                options: options.scalar,
                scheme,
            }
            .tree()
        };

        profiles.push((
            Arc::clone(name),
            Profile {
                dark: profile(ColorScheme::Dark)?,
                light: profile(ColorScheme::Light)?,
            },
        ));
    }

    Ok(Output {
        default_vars: Some(Arc::clone(options.default_vars)),
        media: alternatives,
        profiles,
        unnamed: options.unnamed,
    })
}

/// Converts the variables of one set and scheme.
struct Converter<'a> {
    /// References under resolution, by address.
    active: Vec<*const Reference>,
    /// Whether the catalog has media-conditioned values the Provider can select.
    media: bool,
    metadata: &'a Metadata,
    options: &'a scalar::Options,
    scheme: ColorScheme,
}

/// A tree under construction, kept in insertion order until it becomes an [`Object`].
enum Node {
    Branch(Map<Node>),
    Leaf(Data),
}

impl Converter<'_> {
    fn tree(&mut self) -> Result<EncodedTree> {
        let metadata = self.metadata;
        let mut tree = Map::default();

        for (path, source) in metadata.values.iter() {
            let parts: Vec<Arc<str>> =
                match metadata.paths.as_ref().and_then(|paths| paths.get(path)) {
                    Some(parts) => parts.to_vec(),
                    None => path.split('.').map(Arc::from).collect(),
                };
            let leaf = match self.leaf(path, &parts, source) {
                Ok(value) => value.to_data(),
                Err(message) => Data::Array(Arc::new(vec![Data::String(
                    format!("Native variable {path}: {message}").into(),
                )])),
            };

            insert(&mut tree, &parts, leaf)?;
        }

        Ok(object(tree))
    }

    fn leaf(
        &mut self,
        path: &str,
        parts: &[Arc<str>],
        source: &TokenValue,
    ) -> std::result::Result<Scalar, String> {
        let first = parts.first().map_or("", |part| &**part);
        let property = parts.last().map_or("", |part| &**part);
        let category = if first == "typography" {
            property
        } else {
            first
        };
        let target = if category == "radius" {
            "borderRadius"
        } else {
            category
        };
        let mapped = match &self.metadata.contract.mappings {
            Some(Mappings::Categories(categories)) => categories.get(first),
            _ => None,
        };
        let targets: Vec<&str> = match mapped {
            Some(properties) if !properties.is_empty() => {
                properties.iter().map(|property| &**property).collect()
            }
            _ if scalar::property(target).is_some() => vec![target],
            _ => Vec::new(),
        };

        if parts.iter().any(|part| conditional(part)) {
            return Err("Media-conditioned variables require a web target.".to_owned());
        }

        let value = self.resolve(source).map_err(|error| error.text())?;

        // Every target converts before any comparison, so conversion errors take precedence.
        let values = targets
            .iter()
            .map(|target| self.convert(target, &value, path, parts))
            .collect::<std::result::Result<Vec<_>, _>>()?;

        if let Some((first, rest)) = values.split_first() {
            if rest.iter().any(|converted| converted != first) {
                return Err(
                    "Mapped native properties require different converted values.".to_owned(),
                );
            }

            return Ok(first.clone());
        }

        match &*variable_sets::domain(source) {
            "spacing" => scalar::length(&value, self.options, true)
                .map(Scalar::Number)
                .map_err(|error| error.text()),
            "color" => {
                scalar::convert(Kind::Color, &value, self.options).map_err(|error| error.text())
            }
            _ => Ok(value),
        }
    }

    fn convert(
        &mut self,
        property: &str,
        value: &Scalar,
        path: &str,
        parts: &[Arc<str>],
    ) -> std::result::Result<Scalar, String> {
        let property = literal::alias(property).unwrap_or(property);
        let Some(kind) = scalar::property(property) else {
            return Err(format!("Unsupported native property: {property}."));
        };

        if property == "lineHeight" {
            return self.line_height(value, path, parts);
        }

        if matches!(
            kind,
            Kind::Flex
                | Kind::FontVariant
                | Kind::Origin
                | Kind::Shadow
                | Kind::TextShadow
                | Kind::Transform
        ) {
            return Err(format!(
                "Native property {property} does not have a scalar variable value."
            ));
        }

        if matches!(kind, Kind::Ratio) && !matches!(value, Scalar::Number(_)) {
            return Err("Native aspect ratios require numeric variable values.".to_owned());
        }

        let converted = match kind {
            Kind::Box | Kind::BoxSigned => {
                scalar::length(value, self.options, matches!(kind, Kind::BoxSigned))
                    .map(Scalar::Number)
            }
            Kind::BoxOffset => scalar::convert(Kind::Offset, value, self.options),
            kind => scalar::convert(kind, value, self.options),
        };

        converted.map_err(|error| error.text())
    }

    /// Converts a line height to logical units: lengths directly, and multipliers against the
    /// sibling `fontSize` of a typography group.
    fn line_height(
        &mut self,
        value: &Scalar,
        path: &str,
        parts: &[Arc<str>],
    ) -> std::result::Result<Scalar, String> {
        if let Scalar::String(text) = value
            && (scalar::is_calc(text) || is_length(text))
        {
            return scalar::length(
                &Scalar::String(js::trim(text).to_lowercase().into()),
                self.options,
                false,
            )
            .map(Scalar::Number)
            .map_err(|error| error.text());
        }

        let multiplier = match value {
            Scalar::Number(number) => *number,
            Scalar::String(text) => js::to_number(text),
        };

        if !multiplier.is_finite()
            || matches!(value, Scalar::String(text) if js::trim(text).is_empty())
        {
            return Err(format!(
                "Unsupported native line height: {}.",
                value.to_js_string()
            ));
        }

        let size = (parts.first().map(|part| &**part) == Some("typography"))
            .then(|| {
                let mut key: Vec<&str> = parts
                    .iter()
                    .take(parts.len().saturating_sub(1))
                    .map(|part| &**part)
                    .collect();

                key.push("fontSize");
                self.metadata.values.get(key.join(".").as_str())
            })
            .flatten();
        let Some(size) = size else {
            return Err(format!("Native line height requires fontSize: {path}."));
        };
        let size = self.resolve(size).map_err(|error| error.text())?;
        let length = scalar::length(&size, self.options, false).map_err(|error| error.text())?;

        scalar::convert(
            Kind::Number,
            &Scalar::Number(multiplier * length),
            self.options,
        )
        .map_err(|error| error.text())
    }

    fn resolve(&mut self, value: &TokenValue) -> Result<Scalar> {
        match value {
            TokenValue::Number(number) => Ok(Scalar::Number(*number)),
            TokenValue::String(text) => Ok(Scalar::String(Arc::clone(text))),
            TokenValue::Reference(reference) => self.reference(reference),
            TokenValue::Composition(expression) if expression.group.is_some() => {
                let mut text = String::new();

                for part in &expression.parts {
                    match part {
                        Part::Text(value) => text.push_str(value),
                        Part::Reference(reference) => match self.reference(reference)? {
                            Scalar::Number(number) => js::write_number(&mut text, number),
                            Scalar::String(value) => text.push_str(&value),
                        },
                        Part::Binding(_) => return Err(self.conditional_error()),
                    }
                }

                if expression.group.as_deref() != Some("spacing") || !scalar::is_calc(&text) {
                    return Ok(Scalar::String(text.into()));
                }

                let length = calculation::length(&text, self.options)?;
                let mut output = String::new();

                js::write_number(&mut output, length / self.options.units.px.unwrap_or(1.0));
                output.push_str("px");

                Ok(Scalar::String(output.into()))
            }
            TokenValue::Record(_) => match (value.field("light"), value.field("dark")) {
                (Some(light), Some(dark)) => self.resolve(match self.scheme {
                    ColorScheme::Dark => dark,
                    ColorScheme::Light => light,
                }),
                _ => Err(self.conditional_error()),
            },
            TokenValue::Composition(_) => Err(self.conditional_error()),
        }
    }

    fn reference(&mut self, reference: &Arc<Reference>) -> Result<Scalar> {
        let identity = Arc::as_ptr(reference);

        if self.active.contains(&identity) {
            return Err(Error::message(
                "Native token aliases must not form a cycle.",
            ));
        }

        let metadata = self.metadata;
        let shared = Arc::ptr_eq(&metadata.contract, &reference.contract)
            || (metadata.contract.identity.is_some()
                && metadata.contract.identity == reference.contract.identity);
        let next = if shared {
            metadata.values.get(&reference.path)
        } else {
            Some(&reference.value)
        };
        let Some(next) = next else {
            return Err(Error::Message(format!(
                "Missing native token: {}.",
                reference.path
            )));
        };

        self.active.push(identity);

        let result = self.resolve(next);

        self.active.pop();
        result
    }

    #[cold]
    fn conditional_error(&self) -> Error {
        Error::message(if self.media {
            "Native media-conditioned variables require the native Provider window dimensions."
        } else {
            "Media-conditioned variables require a web target."
        })
    }
}

/// Whether a path segment is a web condition, `^@(media|container)\s`.
fn conditional(part: &str) -> bool {
    ["@media", "@container"].iter().any(|prefix| {
        part.strip_prefix(prefix)
            .and_then(|rest| rest.chars().next())
            .is_some_and(js::is_whitespace)
    })
}

/// Matches `^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px|rem)\s*$` case-insensitively.
fn is_length(text: &str) -> bool {
    let text = js::trim(text).as_bytes();
    let digits = |from: usize| {
        text.get(from..).map_or(0, |rest| {
            rest.iter().take_while(|byte| byte.is_ascii_digit()).count()
        })
    };
    let mut index = usize::from(matches!(text.first(), Some(b'+' | b'-')));
    let integer = digits(index);

    index += integer;

    if text.get(index) == Some(&b'.') {
        let fraction = digits(index + 1);

        if integer == 0 && fraction == 0 {
            return false;
        }

        index += 1 + fraction;
    } else if integer == 0 {
        return false;
    }

    if matches!(text.get(index), Some(b'e' | b'E')) {
        let sign = usize::from(matches!(text.get(index + 1), Some(b'+' | b'-')));
        let exponent = digits(index + 1 + sign);

        if exponent > 0 {
            index += 1 + sign + exponent;
        }
    }

    let unit = text.get(index..).unwrap_or_default();

    unit.eq_ignore_ascii_case(b"px") || unit.eq_ignore_ascii_case(b"rem")
}

/// Assigns a leaf at a path, creating branches as `parent[key] ??= Object.create(null)` does.
///
/// # Errors
///
/// Returns JavaScript's strict-mode `TypeError` message when a path continues below a string or
/// number leaf.
fn insert(tree: &mut Map<Node>, parts: &[Arc<str>], leaf: Data) -> Result<()> {
    let Some((last, parents)) = parts.split_last() else {
        return Ok(());
    };
    let mut entries = tree;

    for (depth, key) in parents.iter().enumerate() {
        let node = entries
            .entry(Arc::clone(key))
            .or_insert_with(|| Node::Branch(Map::default()));

        entries = match node {
            Node::Branch(children) => children,
            Node::Leaf(value) => {
                let next = parts.get(depth + 1).map_or("", |part| &**part);

                return match value {
                    Data::String(text) => Err(Error::Message(format!(
                        "Cannot create property '{next}' on string '{text}'"
                    ))),
                    Data::Number(number) => Err(Error::Message(format!(
                        "Cannot create property '{next}' on number '{}'",
                        js::number(*number)
                    ))),
                    // Properties written to a diagnostic array never reach its JSON.
                    _ => Ok(()),
                };
            }
        };
    }

    // An existing key keeps its position, as an assignment does.
    entries.insert(Arc::clone(last), Node::Leaf(leaf));

    Ok(())
}

fn object(entries: Map<Node>) -> Object {
    Object::from_entries(entries.into_iter().map(|(key, node)| {
        let value = match node {
            Node::Branch(children) => Data::from(object(children)),
            Node::Leaf(value) => value,
        };

        (key, value)
    }))
}
