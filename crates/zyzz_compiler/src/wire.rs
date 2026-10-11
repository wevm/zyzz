//! Decodes `Css.compile` input from, and encodes its result into, one JSON string.
//!
//! JavaScript callers pass frozen definitions whose contracts, token references, expressions,
//! bindings, and theme metadata compare by object identity. The wire format keeps that identity
//! with one post-order `objects` table: each JavaScript object appears once, earlier entries
//! never refer to later ones, and every use refers to it by index. Decoding shares one
//! [`Arc`] per entry, so `Arc::ptr_eq` matches JavaScript identity exactly.
//!
//! # Input
//!
//! ```text
//! Input        := { "objects"?: [Object], "styles": [Style], "contributions"?: [Contribution],
//!                   "labels"?: [[style, name | null, namespace | null]], "names"?: [[style, id]],
//!                   "vars"?: [[name, index | false | null]], "units"?: Units,
//!                   "composition"?: Mode, "cssOutput"?: Mode, "development"?: bool,
//!                   "schemes"?: bool, "scope"?: string, "shared"?: "all" | "defaults" }
//! Object       := ["c", Contract] | ["b", name, type, dynamic]
//!               | ["t", contract, group, path, Value, web] | ["e", group | null, [Part]]
//!               | ["m", contract, cssName | null, [[path, Value]], paths | null, queries | null]
//! Contract     := { "keys": [name], "complete"?: bool, "identity"?: string,
//!                   "variableSet"?: bool, "mappings"?: false | {category: [property]},
//!                   "composition"?: string, "cssOutput"?: string, "defaultLayer"?: string,
//!                   "shorthands"?: {name: [property]} }
//! Value        := string | number | [index] | {"n": "NaN" | "Infinity" | "-Infinity"}
//!               | {"r": [[key, Value]]}
//! Part         := string | [index]
//! Style        := { "n": name, "d": [[property, Value, 0 | 1]], "r"?: [[condition | null, Style]],
//!                   "o"?: Mode, "c"?: Mode, "t"?: {"native"?, "ios"?, "android"?: JSON,
//!                   "web"?: Style} }
//! Mode         := string | false
//! Units        := { "owner": string, "qualifier": string, "visible": [owner] | null,
//!                   "names": [[key, name, owner]] }
//! ```
//!
//! Objects, records, and option lists keep JavaScript own-property order, which already lists
//! array-index keys first. `Mode` carries an own property's raw value: `false` stands for a
//! present non-string value. `vars` entries name a metadata object, `false` for a value without
//! definition metadata, or `null` for `null` and `undefined`. Contributions keep the TypeScript
//! shapes with a `kind` tag; their styles use `Style`, and their descriptor records become
//! `[[key, scalar]]` lists. `units` snapshots a TypeScript-owned registry: every registered name,
//! the scope's owner and qualifier, and the owners it may borrow from, or `null` for all.
//!
//! # Output
//!
//! ```text
//! Output := { "classes": {name: class}, "css": string, "vars": {name: class},
//!             "contributionCss"?: string, "scopedCss"?: string, "rules": {identity: body},
//!             "units": [[key, borrowed, name]], "shared"?: [Resource] }
//!         | { "error": { "name": string, "message": string, "diagnostics"?: [Diagnostic] } }
//! Resource := { "css": string, "id": string, "rules"?: [Rule] }
//! Rule := { "conditions": [string], "property": string, "selector": string, "value": string }
//! Diagnostic := { "code": string, "message": string, "path": [string] }
//! ```

use std::fmt;
use std::sync::Arc;

use rustc_hash::FxHashSet;
use serde::Deserialize;
use serde::de::{self, Deserializer, MapAccess, SeqAccess, Visitor};

use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::binding::{self, Domain};
use crate::internal::query;
use crate::internal::token::{
    self, Composition, Contract, ContractKey, CssOutput, Expression, Mappings, Metadata, Part,
    Reference,
};
use crate::js;
use crate::style::{self, Declaration, Label, Labels, NamedStyle, Rule, Targets};
use crate::web::css::{self, Names, Output};
use crate::web::internal::block::Entry;
use crate::web::internal::class_name::{Registry, Visibility};
use crate::web::internal::contributions::{self, ImportLayer, Kind, Scalar};
use crate::web::internal::namespace;
use crate::web::internal::themes::{Resource, Scope, Shared};

/// A decoded unit naming scope over a snapshot of its registry.
#[derive(Debug)]
pub struct UnitScope {
    /// Compilation identity recorded on the names it introduces.
    pub owner: Arc<str>,
    /// Fixed prefix distinguishing this compilation's new names.
    pub qualifier: Arc<str>,
    /// Registered names from earlier compilations.
    pub registry: Registry,
    /// Owners whose names this compilation may reuse.
    pub visible: Visibility,
}

/// Decoded `Css.compile` input that owns every definition.
#[derive(Debug, Default)]
pub struct Input {
    /// Composition for styles without their own mode.
    pub composition: Option<Composition>,
    /// Stylesheet contributions.
    pub contributions: Vec<contributions::Definition>,
    /// Default CSS representation.
    pub css_output: Option<CssOutput>,
    /// Development naming.
    pub development: bool,
    /// Readable names per style.
    pub labels: Option<Labels>,
    /// Fixed class identities.
    pub names: Option<Names>,
    /// Emits scheme selection classes.
    pub schemes: bool,
    /// Consumer-owned namespace.
    pub scope: Option<Arc<str>>,
    /// Separated token rules.
    pub shared: Option<Shared>,
    /// Ordered named styles.
    pub styles: Vec<Arc<NamedStyle>>,
    /// Unit naming scope, when the caller supplied one.
    pub units: Option<UnitScope>,
    /// Named theme scopes.
    pub vars: Option<Vec<(Arc<str>, Scope)>>,
}

impl Input {
    /// Borrows the input as compiler options.
    pub fn options(&self) -> css::Options<'_> {
        css::Options {
            composition: self.composition,
            contributions: &self.contributions,
            css_output: self.css_output,
            development: self.development,
            labels: self.labels.as_ref(),
            names: self.names.as_ref(),
            schemes: self.schemes,
            scope: self.scope.as_deref(),
            shared: self.shared,
            styles: &self.styles,
            vars: self.vars.as_deref(),
        }
    }

    /// Compiles the decoded input, naming units in its supplied scope when present.
    ///
    /// # Errors
    ///
    /// Returns the [`css::compile`] errors.
    pub fn compile(&mut self) -> Result<Output> {
        let Self { units, .. } = self;
        let mut scope = units.take();
        let options = self.options();
        let result = match &mut scope {
            Some(scope) => {
                let mut units = scope.registry.scope(
                    &scope.owner,
                    &scope.qualifier,
                    std::mem::take(&mut scope.visible),
                );

                css::compile(&options, Some(&mut units))
            }
            None => css::compile(&options, None),
        };

        self.units = scope;
        result
    }
}

/// Decodes, compiles, and encodes one `Css.compile` call, reporting failures as error JSON.
pub fn compile(input: &str) -> String {
    let result = decode(input).and_then(|mut input| input.compile());

    encode(&result)
}

#[cold]
fn malformed(message: impl fmt::Display) -> Error {
    Error::message(format!("Invalid compiler wire input: {message}"))
}

/// Decodes wire input.
///
/// # Errors
///
/// Returns a plain error for malformed JSON, and `Css.CompileError` for an output mode that is
/// neither atomic nor grouped, matching the first diagnostic `Css.compile` reports.
pub fn decode(input: &str) -> Result<Input> {
    let raw: RawInput = serde_json::from_str(input).map_err(malformed)?;
    let mut decoder = Decoder {
        invalid: None,
        objects: Vec::with_capacity(raw.objects.len()),
    };

    for object in raw.objects {
        let resolved = decoder.object(object)?;

        decoder.objects.push(resolved);
    }

    let mut styles = Vec::with_capacity(raw.styles.len());

    for style in raw.styles {
        styles.push(decoder.style(style, true)?);
    }

    let css_output = match &raw.css_output {
        None => None,
        Some(mode) => Some(
            mode.output()
                .ok_or_else(|| css::invalid_output(vec!["cssOutput".into()]))?,
        ),
    };

    if let Some(path) = decoder.invalid.take() {
        return Err(css::invalid_output(path));
    }

    let mut contributions = Vec::with_capacity(raw.contributions.len());

    for contribution in raw.contributions {
        contributions.push(decoder.contribution(contribution)?);
    }

    let vars = match raw.vars {
        None => None,
        Some(entries) => {
            let mut vars = Vec::with_capacity(entries.len());

            for (name, reference) in entries {
                let scope = match reference {
                    ThemeReference::Index(index) => match decoder.objects.get(index) {
                        Some(Resolved::Theme(metadata)) => Scope::Definition(metadata.clone()),
                        _ => return Err(malformed("vars must refer to theme metadata")),
                    },
                    ThemeReference::Invalid => Scope::Invalid,
                    ThemeReference::Nullish => Scope::Nullish,
                };

                vars.push((name, scope));
            }

            Some(vars)
        }
    };
    let units = raw.units.map(|units| {
        let mut registry = Registry::new();

        for (key, name, owner) in &units.names {
            registry.insert(key, name, owner);
        }

        UnitScope {
            owner: units.owner,
            qualifier: units.qualifier,
            registry,
            visible: match units.visible {
                None => Visibility::All,
                Some(owners) => Visibility::Owners(
                    owners
                        .into_iter()
                        .map(|owner| owner.as_ref().into())
                        .collect::<FxHashSet<Box<str>>>(),
                ),
            },
        }
    });

    Ok(Input {
        composition: raw.composition.as_ref().map(RawMode::composition),
        contributions,
        css_output,
        development: raw.development,
        labels: raw.labels.map(|labels| {
            labels
                .into_iter()
                .filter_map(|(style, name, namespace)| {
                    Some((
                        style,
                        Label {
                            name: name?,
                            namespace,
                        },
                    ))
                })
                .collect()
        }),
        names: raw.names.map(|names| names.into_iter().collect()),
        schemes: raw.schemes,
        scope: raw.scope,
        shared: raw.shared.as_deref().map(|shared| {
            if shared == "all" {
                Shared::All
            } else {
                Shared::Defaults
            }
        }),
        styles,
        units,
        vars,
    })
}

/// A resolved identity table entry.
#[derive(Clone, Debug)]
enum Resolved {
    Binding(Arc<binding::Reference>),
    Contract(Arc<Contract>),
    Expression(Arc<Expression>),
    Theme(Metadata),
    Token(Arc<Reference>),
}

struct Decoder {
    /// Path of the first invalid output mode, in `Css.compile` validation order.
    invalid: Option<Vec<Arc<str>>>,
    objects: Vec<Resolved>,
}

impl Decoder {
    fn contract(&self, index: usize) -> Result<Arc<Contract>> {
        match self.objects.get(index) {
            Some(Resolved::Contract(contract)) => Ok(Arc::clone(contract)),
            _ => Err(malformed(format_args!("object {index} is not a contract"))),
        }
    }

    fn object(&self, object: RawObject) -> Result<Resolved> {
        Ok(match object {
            RawObject::Binding(name, kind, dynamic) => {
                Resolved::Binding(Arc::new(binding::Reference {
                    domain: Domain::parse(&kind)
                        .ok_or_else(|| malformed(format_args!("unknown binding type {kind}")))?,
                    dynamic,
                    name: name.to_string(),
                }))
            }
            RawObject::Contract(raw) => Resolved::Contract(Arc::new(Contract {
                complete: raw.complete,
                composition: raw.composition.as_deref().and_then(Composition::parse),
                css_output: raw.css_output.as_deref().and_then(CssOutput::parse),
                default_layer: raw.default_layer,
                identity: raw.identity,
                keys: Some(
                    raw.keys
                        .iter()
                        .filter_map(|key| ContractKey::parse(key))
                        .collect(),
                ),
                mappings: match raw.mappings {
                    None => None,
                    Some(RawMappings::Disabled) => Some(Mappings::Disabled),
                    Some(RawMappings::Categories(categories)) => {
                        Some(Mappings::Categories(lists(categories)))
                    }
                },
                shorthands: raw.shorthands.map(lists),
                variable_set: raw.variable_set,
            })),
            RawObject::Expression(group, parts) => {
                let mut values = Vec::with_capacity(parts.len());

                for part in parts {
                    values.push(match part {
                        RawPart::Text(text) => Part::Text(text),
                        RawPart::Reference(index) => match self.objects.get(index) {
                            Some(Resolved::Token(reference)) => {
                                Part::Reference(Arc::clone(reference))
                            }
                            Some(Resolved::Binding(binding)) => Part::Binding(Arc::clone(binding)),
                            _ => return Err(malformed("expression parts must be references")),
                        },
                    });
                }

                Resolved::Expression(Arc::new(Expression {
                    group: group.map(|group| token::Group::from(&*group)),
                    parts: values,
                }))
            }
            RawObject::Theme(contract, css_name, values, paths, queries) => {
                let mut map = token::Map::default();

                for (path, value) in values {
                    map.insert(path, self.token_value(value)?);
                }

                Resolved::Theme(Metadata {
                    contract: self.contract(contract)?,
                    css_name,
                    paths: paths.map(lists),
                    queries: queries.map(|queries| {
                        Arc::new(query::Metadata {
                            breakpoint: queries.breakpoint.into_iter().collect(),
                            container: queries.container.into_iter().collect(),
                            container_names: queries.container_names,
                        })
                    }),
                    values: Arc::new(map),
                })
            }
            RawObject::Token(contract, group, path, value, web) => {
                Resolved::Token(Arc::new(Reference {
                    contract: self.contract(contract)?,
                    group: token::Group::from(&*group),
                    path,
                    value: self.token_value(value)?,
                    web,
                }))
            }
        })
    }

    fn token_value(&self, value: RawValue) -> Result<token::Value> {
        Ok(match value {
            RawValue::Number(number) => token::Value::Number(number),
            RawValue::String(text) => token::Value::String(text),
            RawValue::Reference(index) => match self.objects.get(index) {
                Some(Resolved::Token(reference)) => token::Value::Reference(Arc::clone(reference)),
                Some(Resolved::Expression(expression)) => {
                    token::Value::Composition(Arc::clone(expression))
                }
                _ => {
                    return Err(malformed(
                        "token values must refer to tokens or compositions",
                    ));
                }
            },
            RawValue::Record(entries) => {
                let mut record = Vec::with_capacity(entries.len());

                for (key, entry) in entries {
                    record.push((key, self.token_value(entry)?));
                }

                token::Value::Record(record.into())
            }
        })
    }

    fn declaration_value(&self, value: RawValue) -> Result<style::Value> {
        Ok(match value {
            RawValue::Number(number) => style::Value::Number(number),
            RawValue::String(text) => style::Value::String(text),
            RawValue::Reference(index) => match self.objects.get(index) {
                Some(Resolved::Token(reference)) => style::Value::Token(Arc::clone(reference)),
                Some(Resolved::Expression(expression)) => {
                    style::Value::Expression(Arc::clone(expression))
                }
                Some(Resolved::Binding(binding)) => style::Value::Binding(Arc::clone(binding)),
                _ => return Err(malformed("declaration values must refer to values")),
            },
            RawValue::Record(_) => return Err(malformed("declaration values cannot be records")),
        })
    }

    /// Converts a style. Compiled styles validate their own mode before their rules and web
    /// branch, as `Css.compile` does after selecting web targets.
    fn style(&mut self, raw: RawStyle, validate: bool) -> Result<Arc<NamedStyle>> {
        let css_output = match &raw.css_output {
            None => None,
            Some(mode) => {
                let output = mode.output();

                if output.is_none() && validate && self.invalid.is_none() {
                    self.invalid = Some(vec![Arc::clone(&raw.name), "cssOutput".into()]);
                }

                output
            }
        };
        let mut declarations = Vec::with_capacity(raw.declarations.len());

        for (property, value, important) in raw.declarations {
            declarations.push(Declaration {
                important: important != 0,
                property,
                value: self.declaration_value(value)?,
            });
        }

        let rules = match raw.rules {
            None => None,
            Some(rules) => {
                let mut output = Vec::with_capacity(rules.len());

                for (condition, style) in rules {
                    output.push(Rule {
                        condition,
                        style: self.style(style, validate)?,
                    });
                }

                Some(output)
            }
        };
        let targets = match raw.targets {
            None => None,
            Some(targets) => Some(Targets {
                android: targets.android.map(data),
                ios: targets.ios.map(data),
                native: targets.native.map(data),
                web: match targets.web {
                    None => None,
                    Some(web) => Some(self.style(*web, validate)?),
                },
            }),
        };

        Ok(Arc::new(NamedStyle {
            composition: raw.composition.as_ref().map(RawMode::composition),
            css_output,
            declarations,
            name: raw.name,
            rules,
            targets,
        }))
    }

    fn entry(&mut self, raw: RawEntry) -> Result<Entry> {
        Ok(match raw {
            RawEntry::Block { entries, header } => {
                let mut output = Vec::with_capacity(entries.len());

                for entry in entries {
                    output.push(self.entry(entry)?);
                }

                Entry::Block {
                    entries: output,
                    header,
                }
            }
            RawEntry::Descriptor { name, value } => Entry::Descriptor {
                name,
                value: value.into(),
            },
            RawEntry::Style { style } => Entry::Style(self.style(style, false)?),
        })
    }

    fn contribution(&mut self, raw: RawContribution) -> Result<contributions::Definition> {
        let kind = match raw.kind {
            RawKind::Block { entries, header } => {
                let mut output = Vec::with_capacity(entries.len());

                for entry in entries {
                    output.push(self.entry(entry)?);
                }

                Kind::Block {
                    entries: output,
                    header,
                }
            }
            RawKind::CustomMedia { name, query } => Kind::CustomMedia { name, query },
            RawKind::Descriptor {
                declarations,
                name,
                rule,
            } => Kind::Descriptor {
                declarations: scalars(declarations),
                name,
                rule,
            },
            RawKind::FontFace { declarations } => Kind::FontFace {
                declarations: scalars(declarations),
            },
            RawKind::Import {
                layer,
                media,
                supports,
                url,
            } => Kind::Import {
                layer: match layer {
                    Some(RawLayer::Anonymous(true)) => Some(ImportLayer::Anonymous),
                    Some(RawLayer::Named(name)) if !name.is_empty() => {
                        Some(ImportLayer::Named(name))
                    }
                    _ => None,
                },
                media: media.filter(|media| !media.is_empty()),
                supports: supports.filter(|supports| !supports.is_empty()),
                url,
            },
            RawKind::Keyframes { frames, name } => {
                let mut output = Vec::with_capacity(frames.len());

                for (stop, style) in frames {
                    output.push((stop, self.style(style, false)?));
                }

                Kind::Keyframes {
                    frames: output,
                    name,
                }
            }
            RawKind::Layers { names } => Kind::Layers { names },
            RawKind::Namespace { name, prefix, uri } => {
                Kind::Namespace(namespace::Definition { name, prefix, uri })
            }
            RawKind::Property {
                inherits,
                initial_value,
                name,
                syntax,
            } => Kind::Property {
                inherits,
                initial_value: initial_value.map(Into::into),
                name,
                syntax,
            },
            RawKind::Rule { selector, style } => Kind::Rule {
                selector,
                style: self.style(style, false)?,
            },
        };

        Ok(contributions::Definition {
            kind,
            within: raw.within,
        })
    }
}

fn lists(entries: Vec<(Arc<str>, Vec<Arc<str>>)>) -> token::Map<Arc<[Arc<str>]>> {
    entries
        .into_iter()
        .map(|(key, values)| (key, values.into()))
        .collect()
}

fn scalars(entries: Vec<(Arc<str>, RawScalar)>) -> Vec<(Arc<str>, Scalar)> {
    entries
        .into_iter()
        .map(|(key, value)| (key, value.into()))
        .collect()
}

/// Converts static target data into evaluated values.
fn data(value: serde_json::Value) -> Data {
    match value {
        serde_json::Value::Null => Data::Null,
        serde_json::Value::Bool(value) => Data::Bool(value),
        serde_json::Value::Number(number) => Data::Number(number.as_f64().unwrap_or(f64::NAN)),
        serde_json::Value::String(text) => Data::from(text),
        serde_json::Value::Array(items) => {
            Data::Array(Arc::new(items.into_iter().map(data).collect()))
        }
        serde_json::Value::Object(entries) => Data::from(Object::from_entries(
            entries
                .into_iter()
                .map(|(key, value)| (Arc::from(key), data(value))),
        )),
    }
}

#[derive(Deserialize)]
struct RawInput {
    #[serde(default)]
    composition: Option<RawMode>,
    #[serde(default)]
    contributions: Vec<RawContribution>,
    #[serde(default, rename = "cssOutput")]
    css_output: Option<RawMode>,
    #[serde(default)]
    development: bool,
    #[serde(default)]
    labels: Option<Vec<(Arc<str>, Option<Arc<str>>, Option<Arc<str>>)>>,
    #[serde(default)]
    names: Option<Vec<(Arc<str>, Arc<str>)>>,
    #[serde(default)]
    objects: Vec<RawObject>,
    #[serde(default)]
    schemes: bool,
    #[serde(default)]
    scope: Option<Arc<str>>,
    #[serde(default)]
    shared: Option<Box<str>>,
    #[serde(default)]
    styles: Vec<RawStyle>,
    #[serde(default)]
    units: Option<RawUnits>,
    #[serde(default)]
    vars: Option<Vec<(Arc<str>, ThemeReference)>>,
}

#[derive(Deserialize)]
struct RawUnits {
    names: Vec<(Box<str>, Box<str>, Box<str>)>,
    owner: Arc<str>,
    qualifier: Arc<str>,
    visible: Option<Vec<Arc<str>>>,
}

/// A theme entry: a metadata index, `false` for a non-definition, or `null` for nullish values.
enum ThemeReference {
    Index(usize),
    Invalid,
    Nullish,
}

impl<'de> Deserialize<'de> for ThemeReference {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct ReferenceVisitor;

        impl Visitor<'_> for ReferenceVisitor {
            type Value = ThemeReference;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an object index, false, or null")
            }

            fn visit_u64<E: de::Error>(self, value: u64) -> std::result::Result<Self::Value, E> {
                usize::try_from(value)
                    .map(ThemeReference::Index)
                    .map_err(E::custom)
            }

            fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<Self::Value, E> {
                Ok(ThemeReference::Invalid)
            }

            fn visit_unit<E: de::Error>(self) -> std::result::Result<Self::Value, E> {
                Ok(ThemeReference::Nullish)
            }
        }

        deserializer.deserialize_any(ReferenceVisitor)
    }
}

/// An own property's raw mode: a string, or a present non-string value.
enum RawMode {
    Invalid,
    Text(Box<str>),
}

impl RawMode {
    fn output(&self) -> Option<CssOutput> {
        match self {
            Self::Text(text) => CssOutput::parse(text),
            Self::Invalid => None,
        }
    }

    /// Only `independent` isolates; every other present mode orders.
    fn composition(&self) -> Composition {
        match self {
            Self::Text(text) if &**text == "independent" => Composition::Independent,
            _ => Composition::Ordered,
        }
    }
}

impl<'de> Deserialize<'de> for RawMode {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct ModeVisitor;

        impl Visitor<'_> for ModeVisitor {
            type Value = RawMode;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a mode string or false")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<Self::Value, E> {
                Ok(RawMode::Text(value.into()))
            }

            fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<Self::Value, E> {
                Ok(RawMode::Invalid)
            }
        }

        deserializer.deserialize_any(ModeVisitor)
    }
}

struct RawContractFields {
    complete: bool,
    composition: Option<Box<str>>,
    css_output: Option<Box<str>>,
    default_layer: Option<Arc<str>>,
    identity: Option<Arc<str>>,
    keys: Vec<Box<str>>,
    mappings: Option<RawMappings>,
    shorthands: Option<Entries>,
    variable_set: bool,
}

/// String-list records keep JSON document order, which is JavaScript property order.
type Entries = Vec<(Arc<str>, Vec<Arc<str>>)>;

enum RawMappings {
    Categories(Entries),
    Disabled,
}

/// Deserializes a JSON object of string lists into ordered entries.
struct EntriesVisitor;

impl<'de> Visitor<'de> for EntriesVisitor {
    type Value = Entries;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("an object of string lists")
    }

    fn visit_map<A: MapAccess<'de>>(
        self,
        mut map: A,
    ) -> std::result::Result<Self::Value, A::Error> {
        let mut entries = Vec::with_capacity(map.size_hint().unwrap_or_default());

        while let Some((key, values)) = map.next_entry::<Arc<str>, Vec<Arc<str>>>()? {
            entries.push((key, values));
        }

        Ok(entries)
    }
}

impl<'de> Deserialize<'de> for RawMappings {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct MappingsVisitor;

        impl<'de> Visitor<'de> for MappingsVisitor {
            type Value = RawMappings;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("false or an object of property lists")
            }

            fn visit_bool<E: de::Error>(self, _: bool) -> std::result::Result<Self::Value, E> {
                Ok(RawMappings::Disabled)
            }

            fn visit_map<A: MapAccess<'de>>(
                self,
                map: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                EntriesVisitor.visit_map(map).map(RawMappings::Categories)
            }
        }

        deserializer.deserialize_any(MappingsVisitor)
    }
}

#[derive(Default)]
struct RawQueries {
    breakpoint: Vec<(String, String)>,
    container: Vec<(String, String)>,
    container_names: Vec<String>,
}

impl<'de> Deserialize<'de> for RawQueries {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct PairsVisitor;

        impl<'de> Visitor<'de> for PairsVisitor {
            type Value = Vec<(String, String)>;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an object of strings")
            }

            fn visit_map<A: MapAccess<'de>>(
                self,
                mut map: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let mut entries = Vec::new();

                while let Some(entry) = map.next_entry::<String, String>()? {
                    entries.push(entry);
                }

                Ok(entries)
            }
        }

        struct Pairs(Vec<(String, String)>);

        impl<'de> Deserialize<'de> for Pairs {
            fn deserialize<D: Deserializer<'de>>(
                deserializer: D,
            ) -> std::result::Result<Self, D::Error> {
                deserializer.deserialize_map(PairsVisitor).map(Pairs)
            }
        }

        struct QueriesVisitor;

        impl<'de> Visitor<'de> for QueriesVisitor {
            type Value = RawQueries;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("query metadata")
            }

            fn visit_map<A: MapAccess<'de>>(
                self,
                mut map: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let mut queries = RawQueries::default();

                while let Some(key) = map.next_key::<Box<str>>()? {
                    match &*key {
                        "breakpoint" => queries.breakpoint = map.next_value::<Pairs>()?.0,
                        "container" => queries.container = map.next_value::<Pairs>()?.0,
                        "containerNames" => queries.container_names = map.next_value()?,
                        _ => {
                            map.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }

                Ok(queries)
            }
        }

        deserializer.deserialize_map(QueriesVisitor)
    }
}

struct EntriesField(Entries);

impl<'de> Deserialize<'de> for EntriesField {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        deserializer
            .deserialize_map(EntriesVisitor)
            .map(EntriesField)
    }
}

enum RawObject {
    Binding(Arc<str>, Box<str>, bool),
    Contract(Box<RawContractFields>),
    Expression(Option<Arc<str>>, Vec<RawPart>),
    Theme(
        usize,
        Option<Arc<str>>,
        Vec<(Arc<str>, RawValue)>,
        Option<Entries>,
        Option<RawQueries>,
    ),
    Token(usize, Arc<str>, Arc<str>, RawValue, bool),
}

impl<'de> Deserialize<'de> for RawObject {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct ObjectVisitor;

        fn next<'de, T: Deserialize<'de>, A: SeqAccess<'de>>(
            seq: &mut A,
        ) -> std::result::Result<T, A::Error> {
            seq.next_element()?
                .ok_or_else(|| de::Error::custom("truncated object entry"))
        }

        impl<'de> Visitor<'de> for ObjectVisitor {
            type Value = RawObject;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a tagged object entry")
            }

            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let tag: Box<str> = next(&mut seq)?;

                Ok(match &*tag {
                    "b" => RawObject::Binding(next(&mut seq)?, next(&mut seq)?, next(&mut seq)?),
                    "c" => RawObject::Contract(Box::new(next(&mut seq)?)),
                    "e" => RawObject::Expression(next(&mut seq)?, next(&mut seq)?),
                    "m" => {
                        let contract = next(&mut seq)?;
                        let css_name = next(&mut seq)?;
                        let values = next(&mut seq)?;
                        let paths: Option<EntriesField> = next(&mut seq)?;
                        let queries = next(&mut seq)?;

                        RawObject::Theme(
                            contract,
                            css_name,
                            values,
                            paths.map(|paths| paths.0),
                            queries,
                        )
                    }
                    "t" => RawObject::Token(
                        next(&mut seq)?,
                        next(&mut seq)?,
                        next(&mut seq)?,
                        next(&mut seq)?,
                        next(&mut seq)?,
                    ),
                    other => {
                        return Err(de::Error::custom(format_args!(
                            "unknown object tag {other}"
                        )));
                    }
                })
            }
        }

        deserializer.deserialize_seq(ObjectVisitor)
    }
}

impl<'de> Deserialize<'de> for RawContractFields {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct ContractVisitor;

        impl<'de> Visitor<'de> for ContractVisitor {
            type Value = RawContractFields;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("contract fields")
            }

            fn visit_map<A: MapAccess<'de>>(
                self,
                mut map: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let mut fields = RawContractFields {
                    complete: false,
                    composition: None,
                    css_output: None,
                    default_layer: None,
                    identity: None,
                    keys: Vec::new(),
                    mappings: None,
                    shorthands: None,
                    variable_set: false,
                };

                while let Some(key) = map.next_key::<Box<str>>()? {
                    match &*key {
                        "complete" => fields.complete = map.next_value()?,
                        "composition" => fields.composition = map.next_value()?,
                        "cssOutput" => fields.css_output = map.next_value()?,
                        "defaultLayer" => fields.default_layer = map.next_value()?,
                        "identity" => fields.identity = map.next_value()?,
                        "keys" => fields.keys = map.next_value()?,
                        "mappings" => fields.mappings = map.next_value()?,
                        "shorthands" => {
                            fields.shorthands = map
                                .next_value::<Option<EntriesField>>()?
                                .map(|field| field.0);
                        }
                        "variableSet" => fields.variable_set = map.next_value()?,
                        _ => {
                            map.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }

                Ok(fields)
            }
        }

        deserializer.deserialize_map(ContractVisitor)
    }
}

enum RawPart {
    Reference(usize),
    Text(Arc<str>),
}

impl<'de> Deserialize<'de> for RawPart {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct PartVisitor;

        impl<'de> Visitor<'de> for PartVisitor {
            type Value = RawPart;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("text or a reference")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<Self::Value, E> {
                Ok(RawPart::Text(value.into()))
            }

            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let index: usize = seq
                    .next_element()?
                    .ok_or_else(|| de::Error::custom("empty reference"))?;

                Ok(RawPart::Reference(index))
            }
        }

        deserializer.deserialize_any(PartVisitor)
    }
}

enum RawValue {
    Number(f64),
    Record(Vec<(Arc<str>, RawValue)>),
    Reference(usize),
    String(Arc<str>),
}

impl<'de> Deserialize<'de> for RawValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct ValueVisitor;

        impl<'de> Visitor<'de> for ValueVisitor {
            type Value = RawValue;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a declaration or token value")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> std::result::Result<Self::Value, E> {
                Ok(RawValue::String(value.into()))
            }

            #[expect(
                clippy::cast_precision_loss,
                reason = "JavaScript numbers are doubles."
            )]
            fn visit_u64<E: de::Error>(self, value: u64) -> std::result::Result<Self::Value, E> {
                Ok(RawValue::Number(value as f64))
            }

            #[expect(
                clippy::cast_precision_loss,
                reason = "JavaScript numbers are doubles."
            )]
            fn visit_i64<E: de::Error>(self, value: i64) -> std::result::Result<Self::Value, E> {
                Ok(RawValue::Number(value as f64))
            }

            fn visit_f64<E: de::Error>(self, value: f64) -> std::result::Result<Self::Value, E> {
                Ok(RawValue::Number(value))
            }

            fn visit_seq<A: SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let index: usize = seq
                    .next_element()?
                    .ok_or_else(|| de::Error::custom("empty reference"))?;

                Ok(RawValue::Reference(index))
            }

            fn visit_map<A: MapAccess<'de>>(
                self,
                mut map: A,
            ) -> std::result::Result<Self::Value, A::Error> {
                let key: Box<str> = map
                    .next_key()?
                    .ok_or_else(|| de::Error::custom("empty tagged value"))?;

                match &*key {
                    "n" => {
                        let text: Box<str> = map.next_value()?;

                        Ok(RawValue::Number(match &*text {
                            "Infinity" => f64::INFINITY,
                            "-Infinity" => f64::NEG_INFINITY,
                            _ => f64::NAN,
                        }))
                    }
                    "r" => Ok(RawValue::Record(map.next_value()?)),
                    other => Err(de::Error::custom(format_args!("unknown value tag {other}"))),
                }
            }
        }

        deserializer.deserialize_any(ValueVisitor)
    }
}

#[derive(Deserialize)]
struct RawStyle {
    #[serde(default, rename = "c")]
    composition: Option<RawMode>,
    #[serde(default, rename = "o")]
    css_output: Option<RawMode>,
    #[serde(default, rename = "d")]
    declarations: Vec<(Arc<str>, RawValue, u8)>,
    #[serde(rename = "n")]
    name: Arc<str>,
    #[serde(default, rename = "r")]
    rules: Option<Vec<(Option<Arc<str>>, RawStyle)>>,
    #[serde(default, rename = "t")]
    targets: Option<RawTargets>,
}

#[derive(Deserialize)]
struct RawTargets {
    #[serde(default)]
    android: Option<serde_json::Value>,
    #[serde(default)]
    ios: Option<serde_json::Value>,
    #[serde(default)]
    native: Option<serde_json::Value>,
    #[serde(default)]
    web: Option<Box<RawStyle>>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum RawScalar {
    Number(f64),
    String(Arc<str>),
}

impl From<RawScalar> for Scalar {
    fn from(value: RawScalar) -> Self {
        match value {
            RawScalar::Number(number) => Self::Number(number),
            RawScalar::String(text) => Self::String(text),
        }
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum RawLayer {
    Anonymous(bool),
    Named(Arc<str>),
}

#[derive(Deserialize)]
#[serde(tag = "kind")]
enum RawEntry {
    #[serde(rename = "block")]
    Block {
        entries: Vec<RawEntry>,
        header: Arc<str>,
    },
    #[serde(rename = "descriptor")]
    Descriptor { name: Arc<str>, value: RawScalar },
    #[serde(rename = "style")]
    Style { style: RawStyle },
}

#[derive(Deserialize)]
struct RawContribution {
    #[serde(flatten)]
    kind: RawKind,
    #[serde(default)]
    within: Vec<Arc<str>>,
}

#[derive(Deserialize)]
#[serde(tag = "kind")]
enum RawKind {
    #[serde(rename = "block")]
    Block {
        entries: Vec<RawEntry>,
        header: Arc<str>,
    },
    #[serde(rename = "custom-media")]
    CustomMedia { name: Arc<str>, query: Arc<str> },
    #[serde(rename = "descriptor")]
    Descriptor {
        declarations: Vec<(Arc<str>, RawScalar)>,
        name: Arc<str>,
        rule: Arc<str>,
    },
    #[serde(rename = "font-face")]
    FontFace {
        declarations: Vec<(Arc<str>, RawScalar)>,
    },
    #[serde(rename = "import")]
    Import {
        #[serde(default)]
        layer: Option<RawLayer>,
        #[serde(default)]
        media: Option<Arc<str>>,
        #[serde(default)]
        supports: Option<Arc<str>>,
        url: Arc<str>,
    },
    #[serde(rename = "keyframes")]
    Keyframes {
        frames: Vec<(Arc<str>, RawStyle)>,
        name: Arc<str>,
    },
    #[serde(rename = "layers")]
    Layers { names: Vec<Arc<str>> },
    #[serde(rename = "namespace")]
    Namespace {
        name: Arc<str>,
        #[serde(default)]
        prefix: Option<Arc<str>>,
        uri: Arc<str>,
    },
    #[serde(rename = "property")]
    Property {
        inherits: bool,
        #[serde(default, rename = "initialValue")]
        initial_value: Option<RawScalar>,
        name: Arc<str>,
        syntax: Arc<str>,
    },
    #[serde(rename = "rule")]
    Rule { selector: Arc<str>, style: RawStyle },
}

/// Encodes a compilation result or failure.
pub fn encode(result: &Result<Output>) -> String {
    match result {
        Ok(output) => encode_output(output),
        Err(error) => encode_error(error),
    }
}

/// Writes a record in JavaScript property order: array-index keys ascending, then insertion order.
fn write_record<'a>(output: &mut String, entries: impl Iterator<Item = (&'a str, &'a str)>) {
    let mut entries: Vec<(&str, &str)> = entries.collect();

    if entries
        .iter()
        .any(|(key, _)| js::array_index(key).is_some())
    {
        // A stable sort keeps insertion order among non-index keys.
        entries.sort_by_key(|(key, _)| js::array_index(key).map_or(u64::MAX, u64::from));
    }

    output.push('{');

    for (index, (key, value)) in entries.into_iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        js::write_string(output, key);
        output.push(':');
        js::write_string(output, value);
    }

    output.push('}');
}

fn write_strings<'a>(output: &mut String, values: impl Iterator<Item = &'a str>) {
    output.push('[');

    for (index, value) in values.enumerate() {
        if index > 0 {
            output.push(',');
        }

        js::write_string(output, value);
    }

    output.push(']');
}

fn write_resource(output: &mut String, resource: &Resource) {
    output.push_str("{\"css\":");
    js::write_string(output, &resource.css);
    output.push_str(",\"id\":");
    js::write_string(output, &resource.id);

    if let Some(rules) = &resource.rules {
        output.push_str(",\"rules\":[");

        for (index, rule) in rules.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push_str("{\"conditions\":");
            write_strings(output, rule.conditions.iter().map(|condition| &**condition));
            output.push_str(",\"property\":");
            js::write_string(output, &rule.property);
            output.push_str(",\"selector\":");
            js::write_string(output, &rule.selector);
            output.push_str(",\"value\":");
            js::write_string(output, &rule.value);
            output.push('}');
        }

        output.push(']');
    }

    output.push('}');
}

fn encode_output(result: &Output) -> String {
    let mut output = String::with_capacity(
        result.css.len() * 2 + result.classes.len() * 32 + result.rules.len() * 64,
    );

    output.push_str("{\"classes\":");
    write_record(
        &mut output,
        result
            .classes
            .iter()
            .map(|(name, class)| (&**name, class.as_str())),
    );
    output.push_str(",\"css\":");
    js::write_string(&mut output, &result.css);
    output.push_str(",\"vars\":");
    write_record(
        &mut output,
        result
            .vars
            .iter()
            .map(|(name, class)| (&**name, class.as_str())),
    );

    if let Some(css) = &result.contribution_css {
        output.push_str(",\"contributionCss\":");
        js::write_string(&mut output, css);
    }

    if let Some(css) = &result.scoped_css {
        output.push_str(",\"scopedCss\":");
        js::write_string(&mut output, css);
    }

    output.push_str(",\"rules\":");
    write_record(
        &mut output,
        result
            .rules
            .iter()
            .map(|(name, body)| (name.as_str(), body.as_str())),
    );
    output.push_str(",\"units\":[");

    for (index, (key, decision)) in result.units.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');
        js::write_string(&mut output, key);
        output.push_str(if decision.borrowed {
            ",true,"
        } else {
            ",false,"
        });
        js::write_string(&mut output, &decision.name);
        output.push(']');
    }

    output.push(']');

    if let Some(resources) = &result.shared {
        output.push_str(",\"shared\":[");

        for (index, resource) in resources.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            write_resource(&mut output, resource);
        }

        output.push(']');
    }

    output.push('}');
    output
}

fn encode_error(error: &Error) -> String {
    let mut output = String::from("{\"error\":{\"name\":");

    match error {
        Error::Css(diagnostics) => {
            js::write_string(&mut output, "Css.CompileError");
            output.push_str(",\"message\":");
            js::write_string(&mut output, &error.text());
            output.push_str(",\"diagnostics\":[");

            for (index, diagnostic) in diagnostics.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                output.push_str("{\"code\":");
                js::write_string(&mut output, diagnostic.code.as_str());
                output.push_str(",\"message\":");
                js::write_string(&mut output, &diagnostic.message);
                output.push_str(",\"path\":");
                write_strings(&mut output, diagnostic.path.iter().map(|part| &**part));
                output.push('}');
            }

            output.push(']');
        }
        other => {
            js::write_string(&mut output, "Error");
            output.push_str(",\"message\":");
            js::write_string(&mut output, &other.text());
        }
    }

    output.push_str("}}");
    output
}
