//! Decodes the identity-preserving capture graphs that the TypeScript replay instrumentation
//! records, shared by the native replay examples.
//!
//! Objects carry ids (`$o`, `$a`, `$token`, `$expr`, `$binding`, `$theme`) and later occurrences
//! refer back with `$ref`, so shared JavaScript objects decode into shared [`Arc`]s. Numbers are
//! `{"$n": String(value)}` with `-0` preserved, and `undefined` is `{"$u": 1}`.

use std::sync::Arc;

use rustc_hash::FxHashMap;
use serde_json::Value as Json;
use zyzz_compiler::data::{Data, Object};
use zyzz_compiler::internal::binding::{self, Domain};
use zyzz_compiler::internal::recipe;
use zyzz_compiler::internal::theme::{self, ClassName};
use zyzz_compiler::internal::token::{
    Contract, Expression, Map, Mappings, Metadata, Part, Reference, Value as TokenValue,
};
use zyzz_compiler::react_native::internal::scalar::{self, Kind, Value as Scalar};
use zyzz_compiler::react_native::style_sheet;
use zyzz_compiler::runtime::internal::native_media::{Operand, Operator, Query};
use zyzz_compiler::runtime::{native_dynamic, native_static, native_vars};
use zyzz_compiler::style::{self, Declaration, NamedStyle, Rule, Targets};

/// A decoded value, or why the capture cannot be replayed.
pub(crate) type Outcome<T> = Result<T, String>;

pub(crate) fn truncate(text: &str, length: usize) -> String {
    if text.len() <= length {
        return text.to_owned();
    }

    let mut end = length;

    while !text.is_char_boundary(end) {
        end -= 1;
    }

    format!("{}…", &text[..end])
}

pub(crate) fn field<'a>(node: &'a Json, key: &str) -> Outcome<&'a Json> {
    property(node, key).ok_or_else(|| format!("missing field {key}"))
}

/// Reads an encoded object property.
pub(crate) fn property<'a>(node: &'a Json, key: &str) -> Option<&'a Json> {
    node.get("props")?
        .as_array()?
        .iter()
        .find(|entry| entry.get(0).and_then(Json::as_str) == Some(key))
        .and_then(|entry| entry.get(1))
}

pub(crate) fn properties(node: &Json) -> Vec<(&str, &Json)> {
    node.get("props")
        .and_then(Json::as_array)
        .map(|props| {
            props
                .iter()
                .filter_map(|entry| Some((entry.get(0)?.as_str()?, entry.get(1)?)))
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn symbol<'a>(node: &'a Json, description: &str) -> Option<&'a Json> {
    node.get("syms")?
        .as_array()?
        .iter()
        .find(|entry| entry.get(0).and_then(Json::as_str) == Some(description))
        .and_then(|entry| entry.get(1))
}

pub(crate) fn is_undefined(node: &Json) -> bool {
    node.get("$u").is_some()
}

pub(crate) fn number(node: &Json) -> Option<f64> {
    let text = node.get("$n")?.as_str()?;

    Some(match text {
        "-0" => -0.0,
        "NaN" => f64::NAN,
        "Infinity" => f64::INFINITY,
        "-Infinity" => f64::NEG_INFINITY,
        text => text.parse().ok()?,
    })
}

pub(crate) fn string(node: &Json) -> Outcome<String> {
    node.as_str()
        .map(str::to_owned)
        .ok_or_else(|| "expected string".to_owned())
}

pub(crate) fn id(node: &Json) -> Option<u64> {
    ["$o", "$a", "$token", "$expr", "$binding", "$theme"]
        .iter()
        .find_map(|key| node.get(*key).and_then(Json::as_u64))
}

/// Decodes one capture graph with identity-preserving caches.
pub(crate) struct Decoder<'a> {
    bindings: FxHashMap<u64, Arc<binding::Reference>>,
    contracts: FxHashMap<u64, Arc<Contract>>,
    data: FxHashMap<u64, Data>,
    expressions: FxHashMap<u64, Arc<Expression>>,
    nodes: FxHashMap<u64, &'a Json>,
    records: FxHashMap<u64, TokenValue>,
    references: FxHashMap<u64, Arc<Reference>>,
    styles: FxHashMap<u64, Arc<NamedStyle>>,
    themes: FxHashMap<u64, Arc<theme::Definition>>,
}

impl<'a> Decoder<'a> {
    pub(crate) fn new(root: &'a Json) -> Self {
        let mut decoder = Self {
            bindings: FxHashMap::default(),
            contracts: FxHashMap::default(),
            data: FxHashMap::default(),
            expressions: FxHashMap::default(),
            nodes: FxHashMap::default(),
            records: FxHashMap::default(),
            references: FxHashMap::default(),
            styles: FxHashMap::default(),
            themes: FxHashMap::default(),
        };

        decoder.index(root);
        decoder
    }

    pub(crate) fn index(&mut self, node: &'a Json) {
        match node {
            Json::Object(object) => {
                if let Some(id) = id(node) {
                    self.nodes.insert(id, node);
                }

                for value in object.values() {
                    self.index(value);
                }
            }
            Json::Array(items) => {
                for item in items {
                    self.index(item);
                }
            }
            _ => {}
        }
    }

    pub(crate) fn node(&self, node: &'a Json) -> &'a Json {
        node.get("$ref")
            .and_then(Json::as_u64)
            .and_then(|id| self.nodes.get(&id).copied())
            .unwrap_or(node)
    }

    pub(crate) fn data(&mut self, node: &'a Json) -> Outcome<Data> {
        let node = self.node(node);

        match node {
            Json::Null => return Ok(Data::Null),
            Json::Bool(value) => return Ok(Data::Bool(*value)),
            Json::String(value) => return Ok(Data::string(value.as_str())),
            _ => {}
        }

        if let Some(value) = number(node) {
            return Ok(Data::Number(value));
        }

        if is_undefined(node) {
            return Ok(Data::Undefined);
        }

        let Some(identity) = id(node) else {
            return Err(format!(
                "unrepresentable value {}",
                truncate(&node.to_string(), 60)
            ));
        };

        if let Some(data) = self.data.get(&identity) {
            return Ok(data.clone());
        }

        let data = if node.get("$token").is_some() {
            Data::Token(self.reference(node)?)
        } else if node.get("$expr").is_some() {
            Data::Expression(self.expression(node)?)
        } else if node.get("$binding").is_some() {
            Data::Binding(self.binding(node)?)
        } else if node.get("$theme").is_some() {
            Data::Theme(self.theme(node)?)
        } else if let Some(items) = node.get("items").and_then(Json::as_array) {
            let mut output = Vec::with_capacity(items.len());

            for item in items {
                if item.get("$hole").is_some() {
                    return Err("sparse array".to_owned());
                }

                if item.get("$getter").is_some() {
                    return Err("array accessor".to_owned());
                }

                output.push(self.data(item)?);
            }

            Data::Array(Arc::new(output))
        } else {
            let mut object = Object::new();

            object.exotic = node.get("proto").and_then(Json::as_str) == Some("other");

            for (key, value) in properties(node) {
                if value.get("$getter").is_some() {
                    object.insert_accessor(key);
                } else {
                    object.insert(key, self.data(value)?);
                }
            }

            if node
                .get("syms")
                .and_then(Json::as_array)
                .is_some_and(|symbols| !symbols.is_empty())
            {
                return Err("symbol-keyed data".to_owned());
            }

            Data::from(object)
        };

        self.data.insert(identity, data.clone());
        Ok(data)
    }

    /// Decodes an output value, where objects are plain data.
    pub(crate) fn output_data(&mut self, node: &'a Json) -> Outcome<Data> {
        self.index(node);
        self.data(node)
    }

    pub(crate) fn contract(&mut self, node: &'a Json) -> Outcome<Arc<Contract>> {
        let node = self.node(node);
        let identity = id(node).ok_or("contract id")?;

        if let Some(contract) = self.contracts.get(&identity) {
            return Ok(Arc::clone(contract));
        }

        let mappings = match property(node, "mappings").map(|mappings| self.node(mappings)) {
            Some(Json::Bool(false)) => Some(Mappings::Disabled),
            Some(mappings) if mappings.get("props").is_some() => {
                let mut categories: Map<Arc<[Arc<str>]>> = Map::default();

                for (category, properties) in properties(mappings) {
                    categories.insert(category.into(), self.strings(properties)?.into());
                }

                Some(Mappings::Categories(categories))
            }
            _ => None,
        };
        let contract = Arc::new(Contract {
            complete: symbol(node, "zyzz.contract.complete").and_then(Json::as_bool) == Some(true),
            identity: symbol(node, "zyzz.contract.identity")
                .and_then(Json::as_str)
                .map(Into::into),
            mappings,
            variable_set: property(node, "variableSet").and_then(Json::as_bool) == Some(true),
            ..Contract::default()
        });

        self.contracts.insert(identity, Arc::clone(&contract));
        Ok(contract)
    }

    pub(crate) fn reference(&mut self, node: &'a Json) -> Outcome<Arc<Reference>> {
        let node = self.node(node);
        let identity = node
            .get("$token")
            .and_then(Json::as_u64)
            .ok_or("token id")?;

        if let Some(reference) = self.references.get(&identity) {
            return Ok(Arc::clone(reference));
        }

        let reference = Arc::new(Reference {
            contract: self.contract(&node["contract"])?,
            group: node["group"].as_str().unwrap_or_default().into(),
            path: node["path"].as_str().unwrap_or_default().into(),
            value: self.token_value(&node["value"])?,
            web: node["web"].as_bool() == Some(true),
        });

        self.references.insert(identity, Arc::clone(&reference));
        Ok(reference)
    }

    pub(crate) fn expression(&mut self, node: &'a Json) -> Outcome<Arc<Expression>> {
        let node = self.node(node);
        let identity = node.get("$expr").and_then(Json::as_u64).ok_or("expr id")?;

        if let Some(expression) = self.expressions.get(&identity) {
            return Ok(Arc::clone(expression));
        }

        let mut parts = Vec::new();

        for part in node["parts"].as_array().ok_or("parts")? {
            let part = self.node(part);

            parts.push(match part {
                Json::String(text) => Part::Text(text.as_str().into()),
                _ if part.get("$token").is_some() => Part::Reference(self.reference(part)?),
                _ if part.get("$binding").is_some() => Part::Binding(self.binding(part)?),
                _ => return Err("expression part".to_owned()),
            });
        }

        let expression = Arc::new(Expression {
            group: node["group"].as_str().map(Into::into),
            parts,
        });

        self.expressions.insert(identity, Arc::clone(&expression));
        Ok(expression)
    }

    pub(crate) fn binding(&mut self, node: &'a Json) -> Outcome<Arc<binding::Reference>> {
        let node = self.node(node);
        let identity = node
            .get("$binding")
            .and_then(Json::as_u64)
            .ok_or("binding id")?;

        if let Some(binding) = self.bindings.get(&identity) {
            return Ok(Arc::clone(binding));
        }

        let binding = Arc::new(binding::Reference {
            domain: node["domain"]
                .as_str()
                .and_then(Domain::parse)
                .ok_or("binding domain")?,
            dynamic: node["dynamic"].as_bool() == Some(true),
            name: node["name"].as_str().unwrap_or_default().to_owned(),
            zero: node["zero"].as_bool() == Some(true),
        });

        self.bindings.insert(identity, Arc::clone(&binding));
        Ok(binding)
    }

    pub(crate) fn token_value(&mut self, node: &'a Json) -> Outcome<TokenValue> {
        let node = self.node(node);

        if let Json::String(text) = node {
            return Ok(TokenValue::String(text.as_str().into()));
        }

        if let Some(value) = number(node) {
            return Ok(TokenValue::Number(value));
        }

        if node.get("$token").is_some() {
            return Ok(TokenValue::Reference(self.reference(node)?));
        }

        if node.get("$expr").is_some() {
            return Ok(TokenValue::Composition(self.expression(node)?));
        }

        let Some(identity) = node.get("$o").and_then(Json::as_u64) else {
            return Err(format!("token value {}", truncate(&node.to_string(), 60)));
        };

        if let Some(record) = self.records.get(&identity) {
            return Ok(record.clone());
        }

        let mut entries = Vec::new();

        for (key, value) in properties(node) {
            entries.push((Arc::from(key), self.token_value(value)?));
        }

        let record = TokenValue::Record(entries.into());

        self.records.insert(identity, record.clone());
        Ok(record)
    }

    pub(crate) fn metadata(&mut self, node: &'a Json) -> Outcome<Metadata> {
        let node = self.node(node);
        let mut values: Map<TokenValue> = Map::default();

        for (path, value) in properties(self.node(field(node, "values")?)) {
            values.insert(path.into(), self.token_value(value)?);
        }

        let paths = match property(node, "paths").map(|paths| self.node(paths)) {
            Some(paths) if !is_undefined(paths) => {
                let mut map: Map<Arc<[Arc<str>]>> = Map::default();

                for (path, parts) in properties(paths) {
                    let parts = self.node(parts)["items"]
                        .as_array()
                        .ok_or("paths items")?
                        .iter()
                        .map(|part| Arc::from(part.as_str().unwrap_or_default()))
                        .collect::<Vec<_>>();

                    map.insert(path.into(), parts.into());
                }

                Some(map)
            }
            _ => None,
        };

        Ok(Metadata {
            contract: self.contract(field(node, "contract")?)?,
            css_name: property(node, "cssName")
                .and_then(Json::as_str)
                .map(Into::into),
            paths,
            queries: None,
            values: Arc::new(values),
        })
    }

    pub(crate) fn theme(&mut self, node: &'a Json) -> Outcome<Arc<theme::Definition>> {
        let node = self.node(node);
        let identity = node
            .get("$theme")
            .and_then(Json::as_u64)
            .ok_or("theme id")?;

        if let Some(theme) = self.themes.get(&identity) {
            return Ok(Arc::clone(theme));
        }

        let theme = Arc::new(theme::Definition {
            class_name: ClassName::Contract,
            metadata: self.metadata(&node["metadata"])?,
            tokens: Data::Undefined,
            vars: Data::Undefined,
        });

        self.themes.insert(identity, Arc::clone(&theme));
        Ok(theme)
    }

    pub(crate) fn style_value(&mut self, node: &'a Json) -> Outcome<style::Value> {
        let node = self.node(node);

        if let Json::String(text) = node {
            return Ok(style::Value::String(text.as_str().into()));
        }

        if let Some(value) = number(node) {
            return Ok(style::Value::Number(value));
        }

        if node.get("$token").is_some() {
            return Ok(style::Value::Token(self.reference(node)?));
        }

        if node.get("$expr").is_some() {
            return Ok(style::Value::Expression(self.expression(node)?));
        }

        if node.get("$binding").is_some() {
            return Ok(style::Value::Binding(self.binding(node)?));
        }

        Err(format!(
            "declaration value {}",
            truncate(&node.to_string(), 60)
        ))
    }

    pub(crate) fn named_style(&mut self, node: &'a Json) -> Outcome<Arc<NamedStyle>> {
        let node = self.node(node);
        let identity = id(node).ok_or("style id")?;

        if let Some(style) = self.styles.get(&identity) {
            return Ok(Arc::clone(style));
        }

        let mut declarations = Vec::new();

        for declaration in self.node(field(node, "declarations")?)["items"]
            .as_array()
            .ok_or("declarations")?
        {
            let declaration = self.node(declaration);

            declarations.push(Declaration {
                important: property(declaration, "important").and_then(Json::as_bool) == Some(true),
                property: string(field(declaration, "property")?)?.into(),
                value: self.style_value(field(declaration, "value")?)?,
            });
        }

        let rules = match property(node, "rules").map(|rules| self.node(rules)) {
            Some(rules) if !is_undefined(rules) => {
                let mut output = Vec::new();

                for rule in rules["items"].as_array().ok_or("rules")? {
                    let rule = self.node(rule);
                    let condition = property(rule, "condition")
                        .and_then(Json::as_str)
                        .map(Into::into);

                    output.push(Rule {
                        condition,
                        style: self.named_style(field(rule, "style")?)?,
                    });
                }

                Some(output)
            }
            _ => None,
        };
        let targets = match property(node, "targets").map(|targets| self.node(targets)) {
            Some(targets) if !is_undefined(targets) => {
                let mut branch = |name: &str| -> Outcome<Option<Data>> {
                    match property(targets, name) {
                        Some(value) => match self.data(value)? {
                            Data::Undefined => Ok(None),
                            data => Ok(Some(data)),
                        },
                        None => Ok(None),
                    }
                };

                Some(Targets {
                    android: branch("android")?,
                    ios: branch("ios")?,
                    native: branch("native")?,
                    order: Vec::new(),
                    web: None,
                })
            }
            _ => None,
        };
        let style = Arc::new(NamedStyle {
            declarations,
            name: string(field(node, "name")?)?.into(),
            rules,
            targets,
            ..NamedStyle::default()
        });

        self.styles.insert(identity, Arc::clone(&style));
        Ok(style)
    }

    pub(crate) fn definition(&mut self, node: &'a Json) -> Outcome<style::Definition> {
        let node = self.node(node);
        let mut styles = Vec::new();

        for style in self.node(field(node, "styles")?)["items"]
            .as_array()
            .ok_or("styles")?
        {
            styles.push(self.named_style(style)?);
        }

        Ok(style::Definition {
            labels: None,
            styles,
        })
    }

    pub(crate) fn native_options(
        &mut self,
        node: &'a Json,
        allowed: &[&str],
    ) -> Outcome<style_sheet::Options> {
        for (key, _) in properties(node) {
            if !allowed.contains(&key) {
                return Err("unknown option".to_owned());
            }
        }

        let mut read = |key: &str| -> Outcome<Data> {
            property(node, key).map_or(Ok(Data::Undefined), |value| self.data(value))
        };

        Ok(style_sheet::Options {
            fonts: read("fonts")?,
            platform: read("platform")?,
            units: read("units")?,
            vars: read("vars")?,
        })
    }

    pub(crate) fn stylesheet_options(
        &mut self,
        node: &'a Json,
    ) -> Outcome<(style::Definition, style_sheet::Options)> {
        let options =
            self.native_options(node, &["fonts", "platform", "styles", "units", "vars"])?;
        let definition = self
            .definition(field(node, "styles")?)
            .map_err(|reason| format!("styles: {reason}"))?;

        Ok((definition, options))
    }

    pub(crate) fn variants_options(
        &mut self,
        node: &'a Json,
    ) -> Outcome<(recipe::Definition, style_sheet::Options)> {
        let options =
            self.native_options(node, &["fonts", "platform", "recipe", "units", "vars"])?;

        Ok((self.recipe(field(node, "recipe")?)?, options))
    }

    /// Decodes ordered recipe alternatives with their axes and defaults.
    pub(crate) fn recipe(&mut self, node: &'a Json) -> Outcome<recipe::Definition> {
        let recipe = self.node(node);
        let mut rules = Vec::new();

        for rule in self.node(field(recipe, "rules")?)["items"]
            .as_array()
            .ok_or("rules")?
        {
            let rule = self.node(rule);

            rules.push(recipe::Rule {
                matches: self.matches(field(rule, "matches")?)?,
                value: self.definition(field(rule, "value")?)?,
            });
        }

        Ok(recipe::Definition {
            axes: self.axes(field(recipe, "axes")?)?,
            defaults: self.defaults(field(recipe, "defaults")?)?,
            rules,
        })
    }

    pub(crate) fn strings(&self, node: &'a Json) -> Outcome<Vec<Arc<str>>> {
        self.node(node)["items"]
            .as_array()
            .ok_or("expected array")?
            .iter()
            .map(|item| {
                item.as_str()
                    .map(Into::into)
                    .ok_or_else(|| "non-string choice".to_owned())
            })
            .collect()
    }

    pub(crate) fn axes(&self, node: &'a Json) -> Outcome<recipe::Axes> {
        properties(self.node(node))
            .into_iter()
            .map(|(axis, choices)| Ok((axis.into(), self.strings(choices)?)))
            .collect()
    }

    pub(crate) fn defaults(&self, node: &'a Json) -> Outcome<recipe::Defaults> {
        properties(self.node(node))
            .into_iter()
            .map(|(axis, choice)| match self.node(choice) {
                Json::Null => Ok((axis.into(), None)),
                Json::String(choice) => Ok((axis.into(), Some(choice.as_str().into()))),
                _ => Err("non-string default".to_owned()),
            })
            .collect()
    }

    pub(crate) fn matches(&self, node: &'a Json) -> Outcome<recipe::Matches> {
        self.node(node)["items"]
            .as_array()
            .ok_or("matches")?
            .iter()
            .map(|entry| {
                let entry = self.node(entry);
                let items = entry["items"].as_array().ok_or("match entry")?;
                let axis = items.first().and_then(Json::as_str).ok_or("match axis")?;

                Ok((axis.into(), self.strings(items.get(1).ok_or("choices")?)?))
            })
            .collect()
    }

    pub(crate) fn table(&mut self, node: &'a Json) -> Outcome<Arc<Object>> {
        match self.data(node)? {
            Data::Object(table) => Ok(table),
            _ => Err("table".to_owned()),
        }
    }

    pub(crate) fn kind(&self, node: &'a Json) -> Outcome<Kind> {
        let node = self.node(node);

        if let Some(name) = node.as_str() {
            return scalar::PROPERTIES
                .iter()
                .map(|(_, kind)| *kind)
                .find(|kind| kind.as_str() == Some(name))
                .ok_or_else(|| format!("kind {name}"));
        }

        let keywords = self.strings(node)?;

        scalar::PROPERTIES
            .iter()
            .map(|(_, kind)| *kind)
            .find(|kind| match kind {
                Kind::Keywords(list) => {
                    list.len() == keywords.len()
                        && list
                            .iter()
                            .zip(&keywords)
                            .all(|(left, right)| *left == &**right)
                }
                _ => false,
            })
            .ok_or_else(|| "keywords".to_owned())
    }

    pub(crate) fn scalar(&self, node: &'a Json) -> Outcome<Scalar> {
        let node = self.node(node);

        if let Json::String(text) = node {
            return Ok(Scalar::String(text.as_str().into()));
        }

        number(node)
            .map(Scalar::Number)
            .ok_or_else(|| format!("scalar {}", truncate(&node.to_string(), 60)))
    }

    pub(crate) fn scalar_options(&mut self, node: &'a Json) -> Outcome<scalar::Options> {
        let node = self.node(node);
        let fonts =
            property(node, "fonts").map_or(Ok(Data::Undefined), |value| self.data(value))?;
        let units =
            property(node, "units").map_or(Ok(Data::Undefined), |value| self.data(value))?;

        Ok(scalar::Options::read(&fonts, &units))
    }

    pub(crate) fn static_options(&mut self, node: &'a Json) -> Outcome<native_static::Options> {
        let mut rules = Vec::new();

        for rule in self.node(field(node, "rules")?)["items"]
            .as_array()
            .ok_or("rules")?
        {
            let rule = self.node(rule);
            let mut steps = Vec::new();

            for step in self.node(field(rule, "steps")?)["items"]
                .as_array()
                .ok_or("steps")?
            {
                let step = self.node(step);

                steps.push(match step {
                    Json::String(name) => native_static::Step::Style(name.as_str().into()),
                    _ => native_static::Step::LineHeight(number(step).ok_or("step")?),
                });
            }

            rules.push(native_static::Rule {
                matches: self.matches(field(rule, "matches")?)?,
                steps,
            });
        }

        Ok(native_static::Options {
            axes: self.axes(field(node, "axes")?)?,
            defaults: self.defaults(field(node, "defaults")?)?,
            rules,
            styles: self.table(field(node, "styles")?)?,
        })
    }

    pub(crate) fn record_strings(&self, node: &'a Json) -> Outcome<Vec<(Arc<str>, Arc<str>)>> {
        properties(self.node(node))
            .into_iter()
            .map(|(key, value)| {
                Ok((
                    key.into(),
                    self.node(value).as_str().ok_or("record string")?.into(),
                ))
            })
            .collect()
    }

    pub(crate) fn dynamic_options(&mut self, node: &'a Json) -> Outcome<native_dynamic::Options> {
        let program = self.node(field(node, "program")?);
        let mut rules = Vec::new();

        for rule in self.node(field(program, "rules")?)["items"]
            .as_array()
            .ok_or("rules")?
        {
            let rule = self.node(rule);
            let mut steps = Vec::new();

            for step in self.node(field(rule, "steps")?)["items"]
                .as_array()
                .ok_or("steps")?
            {
                let step = self.node(step);

                if let Some(style) = property(step, "style") {
                    steps.push(native_dynamic::Step::Style(string(style)?.into()));
                    continue;
                }

                let mut parts = Vec::new();

                for part in self.node(field(step, "parts")?)["items"]
                    .as_array()
                    .ok_or("parts")?
                {
                    let part = self.node(part);

                    parts.push(match part {
                        Json::String(text) => native_dynamic::Part::String(text.as_str().into()),
                        _ if number(part).is_some() => {
                            native_dynamic::Part::Number(number(part).unwrap_or_default())
                        }
                        _ => native_dynamic::Part::Slot {
                            number: property(part, "number").and_then(Json::as_bool) == Some(true),
                            slot: string(field(part, "slot")?)?.into(),
                        },
                    });
                }

                steps.push(native_dynamic::Step::Assign {
                    parts,
                    property: string(field(step, "property")?)?.into(),
                });
            }

            rules.push(native_dynamic::Rule {
                matches: self.matches(field(rule, "matches")?)?,
                steps,
            });
        }

        let payloads = match property(node, "payloads").map(|payloads| self.node(payloads)) {
            Some(payloads) if !is_undefined(payloads) => {
                let mut output = Vec::new();

                for payload in payloads["items"].as_array().ok_or("payloads")? {
                    let payload = self.node(payload);
                    let mut slots = Vec::new();

                    for record in self.node(field(payload, "slots")?)["items"]
                        .as_array()
                        .ok_or("slots")?
                    {
                        slots.push(self.record_strings(record)?);
                    }

                    output.push(native_dynamic::Payload {
                        axis: string(field(payload, "axis")?)?.into(),
                        choice: string(field(payload, "choice")?)?.into(),
                        slots,
                    });
                }

                let defaults = match property(node, "defaultPayloads").map(|value| self.node(value))
                {
                    Some(defaults) if !is_undefined(defaults) => Some(
                        properties(defaults)
                            .into_iter()
                            .map(|(axis, fields)| {
                                Ok((
                                    axis.into(),
                                    properties(self.node(fields))
                                        .into_iter()
                                        .map(|(field, value)| {
                                            Ok((field.into(), self.scalar(value)?))
                                        })
                                        .collect::<Outcome<Vec<_>>>()?,
                                ))
                            })
                            .collect::<Outcome<Vec<_>>>()?,
                    ),
                    _ => None,
                };

                Some(native_dynamic::Payloads {
                    defaults,
                    payloads: output,
                })
            }
            _ => None,
        };
        let mut read = |key: &str| -> Outcome<Data> {
            property(node, key).map_or(Ok(Data::Undefined), |value| self.data(value))
        };
        let fonts = read("fonts")?;
        let units = read("units")?;

        Ok(native_dynamic::Options {
            axes: self.axes(field(node, "axes")?)?,
            defaults: self.defaults(field(node, "defaults")?)?,
            fonts,
            payloads,
            program: native_dynamic::Program {
                rules,
                slots: self.record_strings(field(program, "slots")?)?,
            },
            styles: self.table(field(node, "styles")?)?,
            units,
        })
    }

    pub(crate) fn profiles(&mut self, node: &'a Json) -> Outcome<native_vars::Profiles> {
        let mut output = Vec::new();

        for (name, schemes) in properties(self.node(node)) {
            let schemes = self.node(schemes);

            output.push((
                name.into(),
                native_vars::Profile {
                    dark: (*self.table(field(schemes, "dark")?)?).clone(),
                    light: (*self.table(field(schemes, "light")?)?).clone(),
                },
            ));
        }

        Ok(output)
    }

    pub(crate) fn vars_options(&mut self, node: &'a Json) -> Outcome<native_vars::Options> {
        let media = match property(node, "media").map(|media| self.node(media)) {
            Some(media) if !is_undefined(media) => {
                let mut profiles = Vec::new();

                for (selection, value) in properties(self.node(field(media, "profiles")?)) {
                    profiles.push((selection.into(), self.profiles(value)?));
                }

                Some(native_vars::Media {
                    profiles,
                    queries: self.queries(field(media, "queries")?)?,
                })
            }
            _ => None,
        };

        Ok(native_vars::Options {
            default_vars: property(node, "defaultVars")
                .and_then(Json::as_str)
                .map(Into::into),
            media,
            profiles: self.profiles(field(node, "profiles")?)?,
            unnamed: field(node, "unnamed")?.as_bool().ok_or("unnamed")?,
        })
    }

    pub(crate) fn queries(&self, node: &'a Json) -> Outcome<Vec<Query>> {
        self.node(node)["items"]
            .as_array()
            .ok_or("queries")?
            .iter()
            .map(|query| self.query(query))
            .collect()
    }

    pub(crate) fn query(&self, node: &'a Json) -> Outcome<Query> {
        let node = self.node(node);
        let kind = string(field(node, "kind")?)?;
        let operand = |value: &'a Json| -> Outcome<Operand> {
            let value = self.node(value);

            match value.as_str() {
                Some("height") => Ok(Operand::Height),
                Some("width") => Ok(Operand::Width),
                _ => number(value)
                    .map(Operand::Number)
                    .ok_or_else(|| "operand".to_owned()),
            }
        };

        Ok(match kind.as_str() {
            "and" => Query::And(self.queries(field(node, "queries")?)?),
            "or" => Query::Or(self.queries(field(node, "queries")?)?),
            "not" => Query::Not(Box::new(self.query(field(node, "query")?)?)),
            "compare" => Query::Compare {
                left: operand(field(node, "left")?)?,
                operator: match string(field(node, "operator")?)?.as_str() {
                    "=" => Operator::Equal,
                    ">" => Operator::Greater,
                    ">=" => Operator::GreaterEqual,
                    "<" => Operator::Less,
                    "<=" => Operator::LessEqual,
                    _ => return Err("operator".to_owned()),
                },
                right: operand(field(node, "right")?)?,
            },
            _ => return Err("query kind".to_owned()),
        })
    }
}
