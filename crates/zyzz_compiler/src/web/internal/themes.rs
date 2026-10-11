//! Collects live theme references and emits graph-local variables and scope rules.
//!
//! A [`Themes`] collector belongs to one compilation. Anonymous contracts receive graph-local
//! variable names in first-reference order, so callers must serialize references in the order
//! the TypeScript compiler does.

use std::fmt::Write as _;
use std::sync::Arc;

use indexmap::{IndexMap, IndexSet};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::internal::identity;
use crate::internal::scheme;
use crate::internal::token::{Contract, Metadata, Part, Reference, Value};
use crate::js;

/// One generated custom-property declaration and its ordered conditional scope.
#[derive(Clone, Debug, PartialEq)]
pub struct Rule {
    /// Outer-to-inner conditional rules.
    pub conditions: Arc<[Arc<str>]>,
    /// Generated custom-property name.
    pub property: Arc<str>,
    /// Theme or universal fallback selector.
    pub selector: Arc<str>,
    /// Serialized custom-property value.
    pub value: String,
}

/// One generated definition whose scope order must remain intact.
#[derive(Clone, Debug, PartialEq)]
pub struct Resource {
    /// Complete fallback or scoped token definition.
    pub css: String,
    /// Stable identity for stylesheet replacement during development.
    pub id: String,
    /// Generated declarations eligible for consolidation.
    pub rules: Option<Vec<Rule>>,
}

/// Selects independently shareable defaults or all token rules.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Shared {
    /// Every generated token rule becomes a separate resource.
    All,
    /// Only universal fallback rules become separate resources.
    Defaults,
}

/// A named scope supplied to [`Themes::emit`].
#[derive(Clone, Debug)]
pub enum Scope {
    /// A theme or variable set definition.
    Definition(Metadata),
    /// A non-null value without definition metadata.
    Invalid,
    /// `null` or `undefined`, which JavaScript cannot inspect.
    Nullish,
}

/// Theme scope classes and rules emitted for one compilation.
#[derive(Clone, Debug, Default)]
pub struct Emitted {
    /// Scope classes keyed by theme name.
    pub classes: IndexMap<Arc<str>, String, FxBuildHasher>,
    /// Stylesheet text for scopes and defaults that stay inline.
    pub css: String,
    /// Separated resources when shared rules were requested.
    pub resources: Vec<Resource>,
    /// Every scope rule in emission order.
    pub rules: Vec<Rule>,
}

#[derive(Debug)]
struct Entry {
    identity: Option<Arc<str>>,
    paths: IndexMap<Arc<str>, Arc<str>, FxBuildHasher>,
}

/// Collects live token references within one in-memory compilation graph.
#[derive(Debug, Default)]
pub struct Themes {
    anonymous: FxHashMap<(usize, Arc<str>), Arc<str>>,
    contracts: FxHashMap<usize, Entry>,
    default_groups: IndexMap<usize, IndexSet<Arc<str>, FxBuildHasher>, FxBuildHasher>,
    defaults: IndexMap<Arc<str>, Vec<Rule>, FxBuildHasher>,
    ids: Vec<Arc<Contract>>,
    next_variable: u64,
}

fn truthy(value: Option<&Arc<str>>) -> Option<&str> {
    value
        .map(|value| &**value)
        .filter(|value| !value.is_empty())
}

fn universal() -> Arc<str> {
    Arc::from(":where(*)")
}

/// Whether a token value carries conditional overrides under a `default`.
fn conditions(value: &Value) -> Option<&[(Arc<str>, Value)]> {
    match value {
        Value::Record(entries) if entries.iter().any(|(key, _)| &**key == "default") => {
            Some(entries)
        }
        _ => None,
    }
}

impl Themes {
    /// Creates an empty collector.
    pub fn new() -> Self {
        Self::default()
    }

    /// Identifies a contract by pointer, as JavaScript maps key frozen contract objects.
    fn id(&mut self, contract: &Arc<Contract>) -> usize {
        if let Some(index) = self
            .ids
            .iter()
            .position(|candidate| Arc::ptr_eq(candidate, contract))
        {
            return index;
        }

        self.ids.push(Arc::clone(contract));
        self.ids.len() - 1
    }

    fn property(&mut self, id: usize, contract: &Contract, path: &Arc<str>) -> Arc<str> {
        if let Some(identity) = truthy(contract.identity.as_ref()) {
            return variable(Some(identity), path).into();
        }

        let key = (id, Arc::clone(path));

        if let Some(name) = self.anonymous.get(&key) {
            return Arc::clone(name);
        }

        let name: Arc<str> = format!("--z{}", js::radix(self.next_variable, 36)).into();

        self.next_variable += 1;
        self.anonymous.insert(key, Arc::clone(&name));
        name
    }

    /// Serializes a token reference as a variable with its defining fallback.
    pub fn serialize(&mut self, token: &Reference) -> String {
        let id = self.id(&token.contract);
        let existing = self
            .contracts
            .entry(id)
            .or_insert_with(|| Entry {
                identity: token.contract.identity.clone(),
                paths: IndexMap::default(),
            })
            .paths
            .get(&token.path)
            .cloned();
        let name = match existing {
            Some(name) => name,
            None => {
                let name = self.property(id, &token.contract, &token.path);

                if let Some(entry) = self.contracts.get_mut(&id) {
                    entry
                        .paths
                        .insert(Arc::clone(&token.path), Arc::clone(&name));
                }

                name
            }
        };
        let fallback = self.literal(&token.value, Some(&token.path), Some(&token.contract));
        let mut output = String::with_capacity(name.len() + fallback.len() + 6);

        output.push_str("var(");
        output.push_str(&name);
        output.push(',');
        output.push_str(&fallback);
        output.push(')');
        output
    }

    fn literal(
        &mut self,
        value: &Value,
        label: Option<&Arc<str>>,
        owner: Option<&Arc<Contract>>,
    ) -> String {
        match value {
            Value::Reference(reference) => self.serialize(reference),
            Value::Composition(expression) => {
                let mut output = String::new();

                for part in &expression.parts {
                    match part {
                        Part::Text(text) => output.push_str(text),
                        Part::Reference(reference) => output.push_str(&self.serialize(reference)),
                        Part::Binding(binding) => {
                            output.push_str("var(");
                            output.push_str(&binding.name);
                            output.push(')');
                        }
                    }
                }

                output
            }
            Value::Number(number) => js::number(*number),
            Value::String(text) => text.to_string(),
            Value::Record(entries) => {
                if conditions(value).is_none() {
                    let light = field(entries, "light").map_or_else(
                        || "undefined".to_owned(),
                        |light| self.literal(light, label, owner),
                    );
                    let dark = field(entries, "dark").map_or_else(
                        || "undefined".to_owned(),
                        |dark| self.literal(dark, label, owner),
                    );

                    return format!("light-dark({light},{dark})");
                }

                // Separate fallback properties preserve extensions and resolve references within
                // each scope.
                let base = field(entries, "default").map_or_else(
                    || "undefined".to_owned(),
                    |base| self.literal(base, label, owner),
                );
                let mut css = format!(":where(*){{--fallback:{base};}}");
                let nested = self.conditional_css(value, "--fallback", ":where(*)", label, owner);

                css.push_str(&nested);

                // Rule consolidation must not change existing variable identities, so the name
                // hashes the fallback's CSS.
                let fallback: Arc<str> = Arc::from("value");
                let path = label.unwrap_or(&fallback);
                let prefix: Arc<str> = match owner {
                    Some(owner) => {
                        let id = self.id(owner);

                        self.property(id, owner, path)
                    }
                    None => variable(None, path).into(),
                };
                let name: Arc<str> = format!("{prefix}-fallback-{}", identity::hash(&css)).into();
                let mut emitted = vec![Rule {
                    conditions: Arc::from([]),
                    property: Arc::clone(&name),
                    selector: universal(),
                    value: base,
                }];

                self.conditional(value, &name, &universal(), &mut emitted, label, &[], owner);
                self.defaults.insert(Arc::clone(&name), emitted);

                if let Some(owner) = owner {
                    let id = self.id(owner);

                    self.default_groups
                        .entry(id)
                        .or_default()
                        .insert(Arc::clone(&name));
                }

                format!("var({name})")
            }
        }
    }

    fn conditional_css(
        &mut self,
        value: &Value,
        property: &str,
        selector: &str,
        label: Option<&Arc<str>>,
        owner: Option<&Arc<Contract>>,
    ) -> String {
        let Some(entries) = conditions(value) else {
            return String::new();
        };
        let mut output = match field(entries, "default") {
            Some(base) => self.conditional_css(base, property, selector, label, owner),
            None => String::new(),
        };

        for (query, entry) in entries {
            if &**query == "default" {
                continue;
            }

            let literal = self.literal(entry, label, owner);
            let nested = self.conditional_css(entry, property, selector, label, owner);
            let _ = write!(
                output,
                "{query}{{{selector}{{{property}:{literal};}}{nested}}}"
            );
        }

        output
    }

    #[expect(
        clippy::too_many_arguments,
        reason = "Mirrors the recursive TypeScript helper."
    )]
    fn conditional(
        &mut self,
        value: &Value,
        name: &Arc<str>,
        selector: &Arc<str>,
        rules: &mut Vec<Rule>,
        label: Option<&Arc<str>>,
        conditions_so_far: &[Arc<str>],
        owner: Option<&Arc<Contract>>,
    ) {
        let Some(entries) = conditions(value) else {
            return;
        };

        if let Some(base) = field(entries, "default") {
            self.conditional(base, name, selector, rules, label, conditions_so_far, owner);
        }

        for (query, entry) in entries {
            if &**query == "default" {
                continue;
            }

            let mut nested = conditions_so_far.to_vec();
            nested.push(Arc::clone(query));
            let nested: Arc<[Arc<str>]> = nested.into();
            let value = self.literal(entry, label, owner);

            rules.push(Rule {
                conditions: Arc::clone(&nested),
                property: Arc::clone(name),
                selector: Arc::clone(selector),
                value,
            });
            self.conditional(entry, name, selector, rules, label, &nested, owner);
        }
    }

    /// Whether any reference has been serialized, as a created collector is in TypeScript.
    pub fn is_empty(&self) -> bool {
        self.ids.is_empty() && self.defaults.is_empty()
    }

    /// Emits scope classes, rules, and resources for named themes.
    ///
    /// # Errors
    ///
    /// Returns the TypeScript message for empty names, non-definitions, and conflicting scopes.
    pub fn emit(
        &mut self,
        themes: &[(Arc<str>, Scope)],
        schemes: bool,
        separate: Option<Shared>,
    ) -> Result<Emitted, String> {
        let varied = varied_paths(themes)?;
        let mut classes: IndexMap<Arc<str>, String, FxBuildHasher> = IndexMap::default();
        let mut next_scope: u64 = 0;
        let mut complete_defaults: FxHashSet<usize> = FxHashSet::default();
        let mut empty: Vec<String> = Vec::new();
        let mut rules: Vec<Rule> = Vec::new();

        for (name, theme) in themes {
            if name.is_empty() {
                return Err("Theme names must be nonempty.".to_owned());
            }

            let Scope::Definition(data) = theme else {
                return Err("Expected a theme definition.".to_owned());
            };
            let contract_identity = truthy(data.contract.identity.as_ref());
            let class_name =
                if contract_identity.is_some() || truthy(data.css_name.as_ref()).is_some() {
                    let value = match &data.css_name {
                        Some(css_name) => css_name.to_string(),
                        None => match data.contract.identity.as_deref() {
                            Some(identity)
                                if !identity.is_empty()
                                    && name.len() > identity.len()
                                    && name.starts_with(identity)
                                    && name.as_bytes().get(identity.len()) == Some(&b'-') =>
                            {
                                name.get(identity.len() + 1..)
                                    .unwrap_or_default()
                                    .to_owned()
                            }
                            _ => name.to_string(),
                        },
                    };

                    scope(&value, data.contract.identity.as_deref())
                } else {
                    let class_name = format!("z{}", js::radix(next_scope, 36));

                    next_scope += 1;
                    class_name
                };

            classes.insert(Arc::clone(name), class_name.clone());

            let id = self.id(&data.contract);

            if data.contract.complete {
                let mut entry = self.contracts.remove(&id).unwrap_or_else(|| Entry {
                    identity: data.contract.identity.clone(),
                    paths: IndexMap::default(),
                });

                // Separately compiled components may reference tokens absent from this graph.
                for path in data.values.keys() {
                    if entry.paths.contains_key(path) {
                        continue;
                    }

                    let property = self.property(id, &data.contract, path);

                    entry.paths.insert(Arc::clone(path), property);
                }

                self.contracts.insert(id, entry);
            }

            let Some(entry) = self.contracts.get(&id) else {
                continue;
            };

            // Independently compiled consumers must import identical fallback contents.
            if separate == Some(Shared::All) && truthy(entry.identity.as_ref()).is_some() {
                complete_defaults.insert(id);

                for (path, value) in data.values.iter() {
                    self.literal(value, Some(path), Some(&data.contract));
                }
            }

            let selector: Arc<str> = format!(".{class_name}").into();
            // Resolving a value can add references to this contract.
            let paths: Vec<(Arc<str>, Arc<str>)> = self
                .contracts
                .get(&id)
                .map(|entry| {
                    entry
                        .paths
                        .iter()
                        .map(|(path, name)| (Arc::clone(path), Arc::clone(name)))
                        .collect()
                })
                .unwrap_or_default();

            if paths.is_empty() {
                empty.push(format!(".{class_name}{{}}"));
            }

            for (path, property) in paths {
                // A set sharing its contract with an extension lacks the extension's added paths.
                let Some(value) = data.values.get(&path) else {
                    continue;
                };

                // An inherited base reference resolves through its fallback, unless a sibling
                // set overrides it.
                if inherited(value, &path, &data.contract)
                    && !varied
                        .get(&Arc::as_ptr(&data.contract).addr())
                        .is_some_and(|paths| paths.contains(&path))
                {
                    continue;
                }

                let value = self.literal(value, Some(&path), Some(&data.contract));

                rules.push(Rule {
                    conditions: Arc::from([]),
                    property,
                    selector: Arc::clone(&selector),
                    value,
                });
            }

            // The path list grows while conditional values resolve, and JavaScript map iteration
            // visits appended entries.
            let mut index = 0;

            while let Some((path, property)) = self
                .contracts
                .get(&id)
                .and_then(|entry| entry.paths.get_index(index))
                .map(|(path, name)| (Arc::clone(path), Arc::clone(name)))
            {
                if let Some(value) = data.values.get(&path) {
                    self.conditional(
                        value,
                        &property,
                        &selector,
                        &mut rules,
                        Some(&path),
                        &[],
                        Some(&data.contract),
                    );
                }

                index += 1;
            }
        }

        let mut bodies: FxHashMap<(&str, &[Arc<str>], &str), &str> = FxHashMap::default();

        for rule in &rules {
            let key = (&*rule.selector, &*rule.conditions, &*rule.property);

            match bodies.get(&key) {
                Some(previous) if *previous != rule.value => {
                    return Err(format!(
                        "Generated scope {} conflicts. Supply distinct config ids.",
                        rule.selector.get(1..).unwrap_or_default()
                    ));
                }
                _ => {
                    bodies.insert(key, &rule.value);
                }
            }
        }

        let mut scopes: IndexMap<&str, Vec<Rule>, FxBuildHasher> = IndexMap::default();

        for rule in &rules {
            scopes
                .entry(&*rule.property)
                .or_default()
                .push(rule.clone());
        }

        let mut grouped: FxHashSet<Arc<str>> = FxHashSet::default();
        let mut resources: Vec<Resource> = Vec::new();

        if separate == Some(Shared::All) {
            for (id, names) in &self.default_groups {
                if !complete_defaults.contains(id) {
                    continue;
                }

                let Some(contract) = self.ids.get(*id) else {
                    continue;
                };
                // Sort independent properties only. Each property retains its authored
                // conditional order.
                let mut sorted: Vec<&Arc<str>> = names.iter().collect();

                sorted.sort_by(|left, right| utf16_order(left, right));

                let group: Vec<Rule> = sorted
                    .iter()
                    .flat_map(|name| self.defaults.get(*name).cloned().unwrap_or_default())
                    .collect();
                let mut owners: Vec<&str> = themes
                    .iter()
                    .filter(|(_, theme)| {
                        matches!(theme, Scope::Definition(data) if Arc::ptr_eq(&data.contract, contract))
                    })
                    .map(|(name, _)| &**name)
                    .collect();

                owners.sort_by(|left, right| utf16_order(left, right));

                let mut id = String::from("[");

                match &contract.identity {
                    Some(identity) => js::write_string(&mut id, identity),
                    None => id.push_str("null"),
                }

                id.push_str(",\"fallbacks\",[");

                for (index, owner) in owners.iter().enumerate() {
                    if index > 0 {
                        id.push(',');
                    }

                    js::write_string(&mut id, owner);
                }

                id.push_str("]]");
                resources.push(Resource {
                    css: render(&group),
                    id,
                    rules: Some(group),
                });

                for name in names {
                    grouped.insert(Arc::clone(name));
                }
            }
        }

        let css = if separate == Some(Shared::All) {
            String::new()
        } else {
            let mut inline: Vec<Rule> = Vec::new();

            if separate.is_none() {
                for group in self.defaults.values() {
                    inline.extend(group.iter().cloned());
                }
            }

            inline.extend(rules.iter().cloned());

            let mut parts = empty;

            parts.push(render(&inline));

            if schemes {
                parts.push(scheme::css());
            }

            join_nonempty(&parts)
        };
        let resources = if separate.is_some() {
            for (id, group) in &self.defaults {
                if grouped.contains(id) {
                    continue;
                }

                resources.push(Resource {
                    css: render(group),
                    id: id.to_string(),
                    rules: Some(group.clone()),
                });
            }

            if separate == Some(Shared::All) {
                for (property, group) in &scopes {
                    let mut id = String::from("[{");

                    for (index, (name, class)) in classes.iter().enumerate() {
                        if index > 0 {
                            id.push(',');
                        }

                        js::write_string(&mut id, name);
                        id.push(':');
                        js::write_string(&mut id, class);
                    }

                    id.push_str("},");
                    js::write_string(&mut id, property);
                    id.push(']');
                    resources.push(Resource {
                        css: render(group),
                        id,
                        rules: Some(group.clone()),
                    });
                }

                if schemes {
                    resources.push(Resource {
                        css: scheme::css(),
                        id: "zyzz-color-scheme".to_owned(),
                        rules: None,
                    });
                }
            }

            resources
        } else {
            Vec::new()
        };

        Ok(Emitted {
            classes,
            css,
            resources,
            rules,
        })
    }
}

fn field<'a>(entries: &'a [(Arc<str>, Value)], key: &str) -> Option<&'a Value> {
    entries
        .iter()
        .find(|(name, _)| &**name == key)
        .map(|(_, value)| value)
}

/// Orders strings like the default `Array.prototype.sort` comparator, by UTF-16 code units.
fn utf16_order(left: &str, right: &str) -> std::cmp::Ordering {
    if left.is_ascii() && right.is_ascii() {
        return left.cmp(right);
    }

    left.encode_utf16().cmp(right.encode_utf16())
}

fn join_nonempty(parts: &[String]) -> String {
    let mut output = String::new();

    for part in parts {
        if part.is_empty() {
            continue;
        }

        if !output.is_empty() {
            output.push('\n');
        }

        output.push_str(part);
    }

    output
}

/// Whether a set's value is its base's own reference at the same path, as named extensions
/// inherit.
fn inherited(value: &Value, path: &str, contract: &Arc<Contract>) -> bool {
    matches!(value, Value::Reference(reference) if &*reference.path == path && !Arc::ptr_eq(&reference.contract, contract))
}

/// Paths whose values differ between sets that share a contract, keyed by contract address.
fn varied_paths(
    themes: &[(Arc<str>, Scope)],
) -> Result<FxHashMap<usize, FxHashSet<Arc<str>>>, String> {
    let mut seen: FxHashMap<usize, FxHashMap<Arc<str>, String>> = FxHashMap::default();
    let mut varied: FxHashMap<usize, FxHashSet<Arc<str>>> = FxHashMap::default();

    for (_, theme) in themes {
        let data = match theme {
            Scope::Definition(data) => data,
            Scope::Invalid => continue,
            Scope::Nullish => {
                return Err("Cannot convert undefined or null to object".to_owned());
            }
        };
        let contract = Arc::as_ptr(&data.contract).addr();
        let values = seen.entry(contract).or_default();

        for (path, value) in data.values.iter() {
            let key = match value {
                Value::Reference(reference) => {
                    let mut key = String::from("[");

                    match &reference.contract.identity {
                        Some(identity) => js::write_string(&mut key, identity),
                        None => key.push_str("null"),
                    }

                    key.push(',');
                    js::write_string(&mut key, &reference.path);
                    key.push(']');
                    key
                }
                other => identity::token_json(other),
            };

            match values.get(path) {
                None => {
                    values.insert(Arc::clone(path), key);
                }
                Some(previous) if *previous != key => {
                    varied.entry(contract).or_default().insert(Arc::clone(path));
                }
                Some(_) => {}
            }
        }
    }

    Ok(varied)
}

/// Combines generated declarations without crossing competing declarations of the same
/// property.
pub fn render(rules: &[Rule]) -> String {
    struct Group<'a> {
        conditions: &'a [Arc<str>],
        declarations: Vec<&'a Rule>,
        /// Latest declaration index per property.
        latest: FxHashMap<&'a str, usize>,
        selector: &'a str,
    }

    let mut groups: Vec<Group<'_>> = Vec::new();

    for rule in rules {
        let mut target = None;

        for (index, group) in groups.iter().enumerate().rev() {
            if group.selector == &*rule.selector && group.conditions == &*rule.conditions {
                target = Some(index);
                break;
            }

            if group.latest.contains_key(&*rule.property) {
                break;
            }
        }

        let index = match target {
            Some(index) => index,
            None => {
                groups.push(Group {
                    conditions: &rule.conditions,
                    declarations: Vec::new(),
                    latest: FxHashMap::default(),
                    selector: &rule.selector,
                });
                groups.len() - 1
            }
        };
        let Some(group) = groups.get_mut(index) else {
            continue;
        };
        let previous = group
            .latest
            .get(&*rule.property)
            .and_then(|position| group.declarations.get(*position));

        if previous.is_none_or(|previous| previous.value != rule.value) {
            group
                .latest
                .insert(&rule.property, group.declarations.len());
            group.declarations.push(rule);
        }
    }

    let mut output = String::new();

    for (index, group) in groups.iter().enumerate() {
        if index > 0 {
            output.push('\n');
        }

        for condition in group.conditions {
            output.push_str(condition);
            output.push('{');
        }

        output.push_str(group.selector);
        output.push('{');

        for declaration in &group.declarations {
            output.push_str(&declaration.property);
            output.push(':');
            output.push_str(&declaration.value);
            output.push(';');
        }

        output.push('}');

        for _ in group.conditions {
            output.push('}');
        }
    }

    output
}

/// Names an authored scope without its private source identity.
pub fn scope(value: &str, identity: Option<&str>) -> String {
    let mut output = String::from("z-theme-");

    if let Some(namespace) = identity.and_then(|identity| identity.strip_prefix("id-")) {
        output.push_str(namespace);
        output.push('-');
    }

    output.push_str(&identity::name(value));
    output
}

fn variable(identity: Option<&str>, path: &str) -> String {
    let mut output = String::from("--z-");

    if let Some(namespace) = identity.and_then(|identity| identity.strip_prefix("id-")) {
        output.push_str(namespace);
        output.push('-');
    }

    for (index, part) in path.split('.').enumerate() {
        if index > 0 {
            output.push('-');
        }

        output.push_str(&identity::name(part));
    }

    output
}
