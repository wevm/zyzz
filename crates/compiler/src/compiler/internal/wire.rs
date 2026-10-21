//! Encodes `Source.extract` results into one JSON document, and runs extraction for hosts.
//!
//! Contracts compare by identity, so each appears once in a `contracts` table in order of first
//! use, and references name it by index. Every other value is written in place. Records and
//! objects keep JavaScript own-property order as `[key, value]` pairs, offsets are UTF-16, and
//! fields that TypeScript omits are absent.
//!
//! ```text
//! Output     := { "contracts": [Contract], "result": Result }
//!             | { "error": { "name": string, "message": string, "diagnostics"?: [Diagnostic] } }
//! Contract   := { "complete": bool, "identity": string | null, "keys": [name] | null,
//!                 "variableSet": bool, "mappings"?: false | [[category, [property]]],
//!                 "composition"?: string, "cssOutput"?: string, "defaultLayer"?: string,
//!                 "shorthands"?: [[name, [property]]] }
//! Data       := string | number | bool | null | {"$": "undefined"} | {"n": "NaN" | ...}
//!             | [Data] | {"obj": [[key, Data]]} | {"ref": Reference} | {"expr": Expression}
//!             | {"binding": Binding} | {"theme": Theme}
//! Reference  := { "c": contract, "g": group, "p": path, "v": TokenValue, "w": bool }
//! TokenValue := string | number | {"obj": [[key, TokenValue]]} | {"ref": Reference}
//!             | {"expr": Expression}
//! Expression := { "group": string | null, "parts": [string | {"ref"} | {"binding"}] }
//! Binding    := { "dynamic": bool, "name": string, "type": domain, "zero": bool }
//! Style      := { "name", "declarations": [[property, Value, important]], "rules"?:
//!                 [[condition | null, Style]], "targets"?: Targets, "composition"?, "cssOutput"? }
//! ```

use std::sync::Arc;

use oxc_allocator::Allocator;
use serde_json::{Map, Value, json};

use crate::compiler::internal::contributions;
use crate::compiler::internal::packed_styles;
use crate::compiler::internal::themes::{
    self, Alias, AliasBinding, FunctionSignature, Link, LinkKind, Output, VarsRead,
};
use crate::compiler::internal::vars;
use crate::compiler::source::{
    self, Call, Diagnostic, Extracted, NativeContext, Options, RuntimeInput, Target,
};
use crate::data::Data;
use crate::error::Error;
use crate::internal::binding;
use crate::internal::recipe;
use crate::internal::rule_reference;
use crate::internal::theme::Definition;
use crate::internal::token::{self, Contract, ContractKey, Mappings};
use crate::js::{Record, Utf16Index};
use crate::runtime::composition::Owner;
use crate::runtime::recipe as runtime;
use crate::style::{self, NamedStyle};
use crate::web::internal::block::Entry;
use crate::web::internal::contributions::{Definition as Contribution, ImportLayer, Kind, Scalar};
use crate::web::internal::namespace;

/// Contracts in order of first use, shared by every module of one encoded document.
#[derive(Debug, Default)]
pub struct Contracts {
    seen: Vec<Arc<Contract>>,
    table: Vec<Value>,
}

impl Contracts {
    /// The encoded contracts in order of first use.
    pub fn table(self) -> Vec<Value> {
        self.table
    }
}

/// Writes values with one module's UTF-16 offsets, assigning contract indexes by first use.
pub struct Encoder<'o> {
    contracts: &'o mut Contracts,
    offsets: &'o Utf16Index,
}

/// A JavaScript number: integers print without a fraction, and non-finite values and `-0` use
/// a tagged string.
fn number(value: f64) -> Value {
    if value.is_nan() {
        return json!({ "n": "NaN" });
    }

    if value.is_infinite() {
        return json!({ "n": if value > 0.0 { "Infinity" } else { "-Infinity" } });
    }

    if value == 0.0 && value.is_sign_negative() {
        return json!({ "n": "-0" });
    }

    if value.fract() == 0.0 && value.abs() < 9_007_199_254_740_992.0 {
        #[expect(
            clippy::cast_possible_truncation,
            reason = "The value is integral and within the safe integer range."
        )]
        return json!(value as i64);
    }

    json!(value)
}

fn pairs(entries: impl IntoIterator<Item = (String, Value)>) -> Value {
    Value::Array(
        entries
            .into_iter()
            .map(|(key, value)| Value::Array(vec![Value::String(key), value]))
            .collect(),
    )
}

fn strings<S: AsRef<str>>(values: impl IntoIterator<Item = S>) -> Value {
    Value::Array(
        values
            .into_iter()
            .map(|value| Value::String(value.as_ref().to_owned()))
            .collect(),
    )
}

fn properties(map: &token::Map<Arc<[Arc<str>]>>) -> Value {
    pairs(
        map.iter()
            .map(|(key, targets)| (key.to_string(), strings(targets.iter()))),
    )
}

fn mappings(value: &Mappings) -> Value {
    match value {
        Mappings::Disabled => Value::Bool(false),
        Mappings::Categories(categories) => properties(categories),
    }
}

fn kind(kind: LinkKind) -> &'static str {
    match kind {
        LinkKind::Animation => "animation",
        LinkKind::Config => "config",
        LinkKind::RuleReference => "rule-reference",
        LinkKind::Style => "style",
        LinkKind::StyleReference => "style-reference",
        LinkKind::Theme => "theme",
        LinkKind::Variables => "variables",
    }
}

fn output(value: Option<Output>) -> Value {
    value.map_or(Value::Null, |_| json!("html"))
}

/// Inserts a field only when it is present.
fn optional(object: &mut Map<String, Value>, key: &str, value: Option<Value>) {
    if let Some(value) = value {
        object.insert(key.to_owned(), value);
    }
}

fn scalar(value: &Scalar) -> Value {
    match value {
        Scalar::Number(value) => number(*value),
        Scalar::String(value) => json!(&**value),
    }
}

fn runtime_scalar(value: &runtime::Scalar) -> Value {
    match value {
        runtime::Scalar::Number(value) => number(*value),
        runtime::Scalar::String(value) => json!(&**value),
    }
}

impl<'o> Encoder<'o> {
    /// Creates an encoder for one module's offsets.
    pub fn new(contracts: &'o mut Contracts, offsets: &'o Utf16Index) -> Self {
        Self { contracts, offsets }
    }

    fn offset(&self, offset: u32) -> Value {
        json!(self.offsets.utf16(offset))
    }

    /// The index of a contract, adding it on first use.
    pub fn contract(&mut self, contract: &Arc<Contract>) -> usize {
        if let Some(index) = self
            .contracts
            .seen
            .iter()
            .position(|seen| Arc::ptr_eq(seen, contract))
        {
            return index;
        }

        let mut value = Map::new();

        value.insert("complete".into(), json!(contract.complete));
        value.insert("identity".into(), json!(contract.identity.as_deref()));
        // Recorded keys are the own properties in creation order. Without them, present
        // properties enumerate in the configuration order.
        let keys: Vec<&str> = match &contract.keys {
            Some(keys) => keys.iter().map(|key| key.as_str()).collect(),
            None => ContractKey::ORDER
                .iter()
                .filter(|key| match key {
                    ContractKey::Composition => contract.composition.is_some(),
                    ContractKey::CssOutput => contract.css_output.is_some(),
                    ContractKey::DefaultLayer => contract.default_layer.is_some(),
                    ContractKey::Mappings => contract.mappings.is_some(),
                    ContractKey::Shorthands => contract.shorthands.is_some(),
                    ContractKey::VariableSet => contract.variable_set,
                })
                .map(|key| key.as_str())
                .collect(),
        };

        value.insert("keys".into(), strings(keys));
        value.insert("variableSet".into(), json!(contract.variable_set));
        optional(
            &mut value,
            "mappings",
            contract.mappings.as_ref().map(mappings),
        );
        optional(
            &mut value,
            "composition",
            contract.composition.map(|value| json!(value.as_str())),
        );
        optional(
            &mut value,
            "cssOutput",
            contract.css_output.map(|value| json!(value.as_str())),
        );
        optional(
            &mut value,
            "defaultLayer",
            contract.default_layer.as_deref().map(|value| json!(value)),
        );
        optional(
            &mut value,
            "shorthands",
            contract.shorthands.as_ref().map(properties),
        );
        self.contracts.seen.push(Arc::clone(contract));
        self.contracts.table.push(Value::Object(value));

        self.contracts.seen.len() - 1
    }

    fn token_value(&mut self, value: &token::Value) -> Value {
        match value {
            token::Value::String(text) => json!(&**text),
            token::Value::Number(value) => number(*value),
            token::Value::Record(entries) => json!({
                "obj": pairs(entries.iter().map(|(key, value)| (key.to_string(), self.token_value(value)))),
            }),
            token::Value::Reference(reference) => json!({ "ref": self.reference(reference) }),
            token::Value::Composition(expression) => json!({ "expr": self.expression(expression) }),
        }
    }

    /// Writes a binding reference.
    pub fn binding(reference: &binding::Reference) -> Value {
        json!({
            "dynamic": reference.dynamic,
            "name": reference.name,
            "type": reference.domain.as_str(),
            "zero": reference.zero,
        })
    }

    fn expression(&mut self, expression: &token::Expression) -> Value {
        let parts: Vec<Value> = expression
            .parts
            .iter()
            .map(|part| match part {
                token::Part::Text(text) => json!(&**text),
                token::Part::Binding(binding) => json!({ "binding": Self::binding(binding) }),
                token::Part::Reference(reference) => json!({ "ref": self.reference(reference) }),
            })
            .collect();

        json!({ "group": expression.group.as_deref(), "parts": parts })
    }

    fn reference(&mut self, reference: &token::Reference) -> Value {
        let contract = self.contract(&reference.contract);
        let value = self.token_value(&reference.value);

        json!({
            "c": contract,
            "g": reference.group.as_str(),
            "p": &*reference.path,
            "v": value,
            "w": reference.web,
        })
    }

    /// Writes statically evaluated data.
    pub fn data(&mut self, data: &Data) -> Value {
        match data {
            Data::Array(items) => Value::Array(items.iter().map(|item| self.data(item)).collect()),
            Data::Binding(binding) => json!({ "binding": Self::binding(binding) }),
            Data::Bool(value) => json!(value),
            Data::Expression(expression) => json!({ "expr": self.expression(expression) }),
            Data::Null => Value::Null,
            Data::Number(value) => number(*value),
            Data::Object(object) => json!({
                "obj": pairs(object.iter().map(|(key, value)| (key.to_string(), self.data(value)))),
            }),
            Data::String(text) => json!(&**text),
            Data::Theme(definition) => json!({ "theme": self.definition(definition) }),
            Data::Token(reference) => json!({ "ref": self.reference(reference) }),
            Data::Undefined => json!({ "$": "undefined" }),
        }
    }

    /// Writes a theme or variable set definition.
    pub fn definition(&mut self, definition: &Definition) -> Value {
        let metadata = &definition.metadata;
        let class_name = match definition.class_name() {
            Ok(name) => json!({ "ok": name }),
            Err(error) => json!({ "error": error.text() }),
        };
        let contract = self.contract(&metadata.contract);
        let paths = metadata.paths.as_ref().map_or(Value::Null, properties);
        let queries = metadata.queries.as_ref().map_or(Value::Null, |queries| {
            json!({
                "breakpoint": pairs(queries.breakpoint.iter().map(|(key, value)| (key.clone(), json!(value)))),
                "container": pairs(queries.container.iter().map(|(key, value)| (key.clone(), json!(value)))),
                "containerNames": queries.container_names,
            })
        });
        let tokens = self.data(&definition.tokens);
        let values = pairs(
            metadata
                .values
                .iter()
                .map(|(key, value)| (key.to_string(), self.token_value(value)))
                .collect::<Vec<_>>(),
        );
        let vars = self.data(&definition.vars);

        json!({
            "className": class_name,
            "contract": contract,
            "cssName": metadata.css_name.as_deref(),
            "paths": paths,
            "queries": queries,
            "tokens": tokens,
            "values": values,
            "vars": vars,
        })
    }

    fn value(&mut self, value: &style::Value) -> Value {
        self.data(&value.to_data())
    }

    /// Writes a named style.
    pub fn style(&mut self, style: &NamedStyle) -> Value {
        let mut object = Map::new();
        let declarations: Vec<Value> = style
            .declarations
            .iter()
            .map(|declaration| {
                json!([
                    &*declaration.property,
                    self.value(&declaration.value),
                    declaration.important
                ])
            })
            .collect();

        object.insert("name".into(), json!(&*style.name));
        object.insert("declarations".into(), Value::Array(declarations));

        if let Some(rules) = &style.rules {
            let rules: Vec<Value> = rules
                .iter()
                .map(|rule| json!([rule.condition.as_deref(), self.style(&rule.style)]))
                .collect();

            object.insert("rules".into(), Value::Array(rules));
        }

        if let Some(targets) = &style.targets {
            let mut value = Map::new();

            optional(
                &mut value,
                "native",
                targets.native.as_ref().map(|data| self.data(data)),
            );
            optional(
                &mut value,
                "ios",
                targets.ios.as_ref().map(|data| self.data(data)),
            );
            optional(
                &mut value,
                "android",
                targets.android.as_ref().map(|data| self.data(data)),
            );
            optional(
                &mut value,
                "web",
                targets.web.as_ref().map(|style| self.style(style)),
            );
            object.insert("targets".into(), Value::Object(value));
        }

        optional(
            &mut object,
            "composition",
            style.composition.map(|value| json!(value.as_str())),
        );
        optional(
            &mut object,
            "cssOutput",
            style.css_output.map(|value| json!(value.as_str())),
        );

        Value::Object(object)
    }

    /// Writes a style definition and its readable labels.
    pub fn styles(&mut self, definition: &style::Definition) -> Value {
        let styles: Vec<Value> = definition
            .styles
            .iter()
            .map(|style| self.style(style))
            .collect();
        let labels = definition.labels.as_ref().map(|labels| {
            Value::Array(
                definition
                    .styles
                    .iter()
                    .filter_map(|style| {
                        let label = labels.get(&style.name)?;

                        Some(json!([
                            &*style.name,
                            &*label.name,
                            label.namespace.as_deref()
                        ]))
                    })
                    .collect(),
            )
        });
        let mut object = Map::new();

        object.insert("styles".into(), Value::Array(styles));
        optional(&mut object, "labels", labels);

        Value::Object(object)
    }

    fn static_recipe(&mut self, recipe: &recipe::Definition) -> Value {
        let rules: Vec<Value> = recipe
            .rules
            .iter()
            .map(|rule| {
                json!({
                    "matches": pairs(rule.matches.iter().map(|(axis, choices)| (axis.to_string(), strings(choices.iter())))),
                    "value": self.styles(&rule.value),
                })
            })
            .collect();

        json!({
            "axes": pairs(recipe.axes.iter().map(|(axis, choices)| (axis.to_string(), strings(choices.iter())))),
            "defaults": pairs(recipe.defaults.iter().map(|(axis, choice)| (axis.to_string(), json!(choice.as_deref())))),
            "rules": rules,
        })
    }

    fn recipe(recipe: &runtime::Definition) -> Value {
        let mut object = Map::new();

        object.insert(
            "axes".into(),
            pairs(
                recipe
                    .axes
                    .iter()
                    .map(|(axis, choices)| (axis.to_string(), strings(choices.iter()))),
            ),
        );
        optional(
            &mut object,
            "conditions",
            recipe
                .conditions
                .as_ref()
                .map(|conditions| strings(conditions.iter())),
        );
        optional(
            &mut object,
            "defaultPayloads",
            recipe.default_payloads.as_ref().map(|payloads| {
                pairs(payloads.iter().map(|(axis, fields)| {
                    (
                        axis.to_string(),
                        pairs(
                            fields
                                .iter()
                                .map(|(field, value)| (field.to_string(), runtime_scalar(value))),
                        ),
                    )
                }))
            }),
        );
        object.insert(
            "defaults".into(),
            pairs(
                recipe
                    .defaults
                    .iter()
                    .map(|(axis, choice)| (axis.to_string(), json!(choice.as_deref()))),
            ),
        );
        optional(
            &mut object,
            "payloads",
            recipe.payloads.as_ref().map(|payloads| {
                Value::Array(
                    payloads
                        .iter()
                        .map(|payload| {
                            json!({
                                "axis": &*payload.axis,
                                "choice": &*payload.choice,
                                "slots": payload.slots.iter().map(|slots| pairs(slots.iter().map(|(field, name)| (field.to_string(), json!(&**name))))).collect::<Vec<_>>(),
                            })
                        })
                        .collect(),
                )
            }),
        );
        optional(
            &mut object,
            "prefix",
            recipe.prefix.as_deref().map(|prefix| json!(prefix)),
        );
        optional(
            &mut object,
            "silent",
            recipe.silent.as_ref().map(|silent| {
                pairs(
                    silent
                        .iter()
                        .map(|(axis, choices)| (axis.to_string(), strings(choices.iter()))),
                )
            }),
        );

        Value::Object(object)
    }

    fn slots(slots: &Record<Arc<binding::Reference>>) -> Value {
        pairs(
            slots
                .iter()
                .map(|(field, slot)| (field.to_string(), Self::binding(slot))),
        )
    }

    fn native_context(&mut self, context: &NativeContext) -> Value {
        json!({
            "defaultVars": &*context.default_vars,
            "vars": pairs(context.vars.iter().map(|(name, definition)| (name.to_string(), self.definition(definition))).collect::<Vec<_>>()),
        })
    }

    fn owner(owner: &Owner) -> Value {
        let mut object = Map::new();

        object.insert("attributes".into(), strings(owner.attributes.iter()));
        optional(
            &mut object,
            "prefixes",
            (!owner.prefixes.is_empty()).then(|| strings(owner.prefixes.iter())),
        );
        object.insert("identity".into(), json!(&*owner.identity));
        object.insert("slots".into(), strings(owner.slots.iter()));

        Value::Object(object)
    }

    fn runtime_input(&self, input: &RuntimeInput) -> Value {
        let mut object = Map::new();

        optional(
            &mut object,
            "applicationStart",
            input.application_start.map(|start| self.offset(start)),
        );
        optional(
            &mut object,
            "condition",
            input.condition.map(|condition| json!(condition)),
        );
        object.insert("end".into(), self.offset(input.end));
        object.insert("name".into(), json!(&*input.name));
        object.insert(
            "owners".into(),
            Value::Array(input.owners.iter().map(Self::owner).collect()),
        );
        object.insert("start".into(), self.offset(input.start));

        Value::Object(object)
    }

    fn counts(&self, counts: &rustc_hash::FxHashMap<u32, u32>) -> Value {
        let mut entries: Vec<(u32, u32)> =
            counts.iter().map(|(key, value)| (*key, *value)).collect();

        entries.sort_unstable();

        Value::Array(
            entries
                .into_iter()
                .map(|(start, count)| json!([self.offsets.utf16(start), count]))
                .collect(),
        )
    }

    /// Writes a direct definition call.
    pub fn call(&mut self, call: &Call<'_>) -> Value {
        let mut object = Map::new();

        optional(
            &mut object,
            "nativeContext",
            call.native_context
                .as_ref()
                .map(|context| self.native_context(context)),
        );
        optional(
            &mut object,
            "portable",
            call.portable.as_deref().map(|value| json!(value)),
        );
        optional(
            &mut object,
            "cssName",
            call.css_name.as_deref().map(|value| json!(value)),
        );
        // Definition calls always carry a namespace field, which compositions omit when absent.
        let composed = call.composition.is_some()
            || call.runtime_composition.is_some()
            || call.composition_case;

        if composed {
            optional(
                &mut object,
                "cssNamespace",
                call.css_namespace.as_deref().map(|value| json!(value)),
            );
        } else {
            object.insert("cssNamespace".into(), json!(call.css_namespace.as_deref()));
        }
        optional(
            &mut object,
            "portableInputs",
            call.portable_inputs
                .as_ref()
                .map(|inputs| strings(inputs.iter())),
        );
        optional(
            &mut object,
            "ownership",
            call.ownership.as_ref().map(Self::owner),
        );
        optional(
            &mut object,
            "compositionCase",
            call.composition_case.then(|| json!(true)),
        );
        optional(
            &mut object,
            "compositionCases",
            call.composition_cases
                .as_ref()
                .map(|cases| strings(cases.iter())),
        );
        optional(
            &mut object,
            "runtimeComposition",
            call.runtime_composition.as_ref().map(|inputs| {
                Value::Array(
                    inputs
                        .iter()
                        .map(|input| self.runtime_input(input))
                        .collect(),
                )
            }),
        );
        optional(
            &mut object,
            "composition",
            call.composition.as_ref().map(|names| strings(names.iter())),
        );
        optional(
            &mut object,
            "recipe",
            call.recipe.as_ref().map(Self::recipe),
        );
        optional(
            &mut object,
            "dynamicRecipe",
            call.dynamic_recipe
                .as_ref()
                .map(|recipe| self.static_recipe(recipe)),
        );
        optional(
            &mut object,
            "staticRecipe",
            call.static_recipe
                .as_ref()
                .map(|recipe| self.static_recipe(recipe)),
        );
        optional(
            &mut object,
            "recipeTypes",
            call.recipe_types.as_ref().map(|types| {
                pairs(types.iter().map(|(axis, choices)| {
                    (
                        axis.to_string(),
                        pairs(
                            choices
                                .iter()
                                .map(|(choice, text)| (choice.to_string(), json!(&**text))),
                        ),
                    )
                }))
            }),
        );
        optional(
            &mut object,
            "identity",
            call.identity.as_deref().map(|value| json!(value)),
        );
        optional(
            &mut object,
            "shorthands",
            call.shorthands.as_ref().map(properties),
        );
        optional(
            &mut object,
            "typography",
            call.typography.as_ref().map(|counts| self.counts(counts)),
        );
        optional(
            &mut object,
            "typographyQueries",
            call.typography_queries
                .as_ref()
                .map(|counts| self.counts(counts)),
        );
        optional(&mut object, "output", call.output.map(|_| json!("html")));
        optional(&mut object, "slots", call.slots.as_ref().map(Self::slots));
        optional(
            &mut object,
            "valuesType",
            call.values_type.as_deref().map(|value| json!(value)),
        );
        object.insert("end".into(), self.offset(call.end));
        object.insert("name".into(), json!(&*call.name));
        object.insert("start".into(), self.offset(call.start));

        Value::Object(object)
    }

    fn function(signature: &FunctionSignature) -> Value {
        json!({
            "parameters": signature.parameters.iter().map(|parameter| {
                let mut object = Map::new();

                optional(&mut object, "default", parameter.default.as_ref().map(runtime_scalar));
                object.insert("name".into(), json!(&*parameter.name));
                optional(&mut object, "syntax", parameter.syntax.as_deref().map(|value| json!(value)));

                Value::Object(object)
            }).collect::<Vec<_>>(),
            "returns": &*signature.returns,
        })
    }

    /// Writes a theme, configuration, or variable-set call.
    pub fn theme_call(&mut self, call: &themes::Call) -> Value {
        let options = match &call.options {
            Some(options) => self.data(&Data::from(options.clone())),
            None => Value::Null,
        };

        json!({
            "appearance": call.appearance,
            "catalogOnly": call.catalog_only,
            "directVariables": call.direct_variables,
            "end": self.offset(call.end),
            "function": call.function.as_ref().map(Self::function),
            "initialization": call.initialization,
            "members": call.members.as_ref().map(|members| pairs(members.iter().map(|(key, name)| (key.to_string(), json!(&**name))))),
            "name": &*call.name,
            "nativeProvider": call.native_provider,
            "options": options,
            "output": output(call.output),
            "recipe": call.recipe,
            "reference": call.reference.map(rule_reference::Kind::as_str),
            "root": call.root,
            "script": call.script,
            "selection": call.selection,
            "start": self.offset(call.start),
            "tokenType": &*call.token_type,
            "type": call.type_text.as_deref(),
            "variableConfig": call.variable_config,
            "variableMappings": call.variable_mappings.as_ref().map_or(Value::Null, mappings),
            "variableOwner": call.variable_owner.as_deref(),
            "variableSet": call.variable_set,
            "variables": call.variables.as_ref().map(Self::slots),
        })
    }

    fn alias(&mut self, alias: &Alias) -> Value {
        json!({
            "bindings": alias.bindings.as_ref().map(|bindings| bindings.iter().map(|binding| match binding {
                AliasBinding::Style => "style",
                AliasBinding::Variants => "variants",
            }).collect::<Vec<_>>()),
            "call": self.theme_call(&alias.call),
            "destructured": alias.destructured,
            "retained": alias.retained,
        })
    }

    fn packed(&mut self, packed: &packed_styles::Definition) -> Value {
        let mut object = Map::new();

        object.insert("attributes".into(), strings(packed.attributes.iter()));
        optional(
            &mut object,
            "className",
            packed.class_name.as_deref().map(|value| json!(value)),
        );
        optional(
            &mut object,
            "prefixes",
            (!packed.prefixes.is_empty()).then(|| strings(packed.prefixes.iter())),
        );
        optional(
            &mut object,
            "dynamic",
            packed.dynamic.as_ref().map(|dynamic| {
                let mut value = Map::new();

                optional(
                    &mut value,
                    "defaultPayloads",
                    dynamic.default_payloads.as_ref().map(|payloads| {
                        pairs(payloads.iter().map(|(axis, fields)| {
                            (
                                axis.to_string(),
                                pairs(fields.iter().map(|(field, scalar)| {
                                    (field.to_string(), runtime_scalar(scalar))
                                })),
                            )
                        }))
                    }),
                );
                optional(
                    &mut value,
                    "payloads",
                    dynamic.payloads.as_ref().map(|payloads| {
                        Value::Array(
                            payloads
                                .iter()
                                .map(|payload| {
                                    json!({
                                        "axis": &*payload.axis,
                                        "choice": &*payload.choice,
                                        "slots": payload.slots.iter().map(|slots| pairs(slots.iter().map(|(field, name)| (field.to_string(), json!(&**name))))).collect::<Vec<_>>(),
                                    })
                                })
                                .collect(),
                        )
                    }),
                );
                value.insert("recipe".into(), self.static_recipe(&dynamic.recipe));
                value.insert("slots".into(), Self::slots(&dynamic.slots));

                Value::Object(value)
            }),
        );
        optional(
            &mut object,
            "nativeContext",
            packed
                .native_context
                .as_ref()
                .map(|context| self.native_context(context)),
        );
        optional(&mut object, "output", packed.output.map(|_| json!("html")));
        object.insert("slots".into(), strings(packed.slots.iter()));
        optional(
            &mut object,
            "staticRecipe",
            packed
                .static_recipe
                .as_ref()
                .map(|recipe| self.static_recipe(recipe)),
        );
        object.insert("style".into(), self.style(&packed.style));

        Value::Object(object)
    }

    /// Writes a graph link.
    pub fn link(&mut self, link: &Link) -> Value {
        let call = self.theme_call(&link.call);
        let definition = self.definition(&link.definition);
        let members = link.members.as_ref().map(|members| {
            pairs(
                members
                    .iter()
                    .map(|(key, member)| (key.to_string(), self.link(member)))
                    .collect::<Vec<_>>(),
            )
        });
        let mut object = Map::new();

        object.insert("binding".into(), json!(&*link.binding));
        object.insert("call".into(), call);
        object.insert("definition".into(), definition);
        object.insert("kind".into(), json!(kind(link.kind)));
        object.insert("members".into(), members.unwrap_or(Value::Null));
        optional(
            &mut object,
            "style",
            link.style.as_deref().map(|packed| self.packed(packed)),
        );

        Value::Object(object)
    }

    fn vars_read(&mut self, read: &VarsRead) -> Value {
        json!({
            "defaultVars": &*read.default_vars,
            "end": self.offset(read.end),
            "owner": &*read.owner,
            "start": self.offset(read.start),
            "unnamed": read.unnamed,
            "vars": pairs(read.vars.iter().map(|(name, definition)| (name.to_string(), self.definition(definition))).collect::<Vec<_>>()),
        })
    }

    fn entry(&mut self, entry: &Entry) -> Value {
        match entry {
            Entry::Block { entries, header } => json!({
                "kind": "block",
                "header": &**header,
                "entries": entries.iter().map(|entry| self.entry(entry)).collect::<Vec<_>>(),
            }),
            Entry::Descriptor { name, value } => json!({
                "kind": "descriptor",
                "name": &**name,
                "value": scalar(value),
            }),
            Entry::Style(style) => json!({ "kind": "style", "style": self.style(style) }),
        }
    }

    fn namespace(definition: &namespace::Definition) -> Value {
        let mut object = Map::new();

        object.insert("kind".into(), json!("namespace"));
        object.insert("uri".into(), json!(&*definition.uri));
        optional(
            &mut object,
            "prefix",
            definition.prefix.as_deref().map(|prefix| json!(prefix)),
        );
        object.insert("name".into(), json!(&*definition.name));

        Value::Object(object)
    }

    /// Writes a stylesheet contribution in its TypeScript shape.
    pub fn contribution(&mut self, contribution: &Contribution) -> Value {
        let mut object = match &contribution.kind {
            Kind::Block { entries, header } => json!({
                "kind": "block",
                "header": &**header,
                "entries": entries.iter().map(|entry| self.entry(entry)).collect::<Vec<_>>(),
            }),
            Kind::CustomMedia { name, query } => json!({
                "kind": "custom-media",
                "name": &**name,
                "query": match &**query {
                    "true" => json!(true),
                    "false" => json!(false),
                    query => json!(query),
                },
            }),
            Kind::Descriptor {
                declarations,
                name,
                rule,
            } => json!({
                "kind": "descriptor",
                "rule": &**rule,
                "name": &**name,
                "declarations": pairs(declarations.iter().map(|(key, value)| (key.to_string(), scalar(value)))),
            }),
            Kind::FontFace { declarations } => json!({
                "kind": "font-face",
                "declarations": pairs(declarations.iter().map(|(key, value)| (key.to_string(), scalar(value)))),
            }),
            Kind::Import {
                layer,
                media,
                supports,
                url,
            } => {
                let mut object = Map::new();

                object.insert("kind".into(), json!("import"));
                object.insert("url".into(), json!(&**url));
                optional(
                    &mut object,
                    "layer",
                    layer.as_ref().map(|layer| match layer {
                        ImportLayer::Anonymous => json!(true),
                        ImportLayer::Named(name) => json!(&**name),
                    }),
                );
                optional(
                    &mut object,
                    "supports",
                    supports.as_deref().map(|value| json!(value)),
                );
                optional(
                    &mut object,
                    "media",
                    media.as_deref().map(|value| json!(value)),
                );

                Value::Object(object)
            }
            Kind::Keyframes { frames, name } => json!({
                "kind": "keyframes",
                "name": &**name,
                "frames": frames.iter().map(|(stop, style)| json!({ "stop": &**stop, "style": self.style(style) })).collect::<Vec<_>>(),
            }),
            Kind::Layers { names } => json!({ "kind": "layers", "names": strings(names.iter()) }),
            Kind::Namespace(definition) => Self::namespace(definition),
            Kind::Property {
                inherits,
                initial_value,
                name,
                syntax,
            } => {
                let mut object = Map::new();

                object.insert("kind".into(), json!("property"));
                object.insert("name".into(), json!(&**name));
                object.insert("syntax".into(), json!(&**syntax));
                object.insert("inherits".into(), json!(inherits));
                optional(
                    &mut object,
                    "initialValue",
                    initial_value.as_ref().map(scalar),
                );

                Value::Object(object)
            }
            Kind::Rule { selector, style } => json!({
                "kind": "rule",
                "selector": &**selector,
                "style": self.style(style),
            }),
        };

        if !contribution.within.is_empty()
            && let Some(object) = object.as_object_mut()
        {
            object.insert("within".into(), strings(contribution.within.iter()));
        }

        object
    }

    fn contribution_call(&self, call: &contributions::Call<'_>) -> Value {
        let mut object = Map::new();

        optional(
            &mut object,
            "function",
            call.function.as_ref().map(Self::function),
        );
        object.insert("start".into(), self.offset(call.start));
        object.insert("end".into(), self.offset(call.end));
        object.insert("kind".into(), json!(call.kind.as_str()));

        if call.kind.named() {
            optional(
                &mut object,
                "name",
                call.name.as_deref().map(|name| json!(name)),
            );
            optional(
                &mut object,
                "binding",
                call.binding.map(|start| self.offset(start)),
            );
            object.insert("exported".into(), json!(call.exported));
        }

        Value::Object(object)
    }

    fn variable_call(&self, call: &vars::Call) -> Value {
        json!({
            "end": self.offset(call.end),
            "explicit": call.explicit,
            "slots": Self::slots(&call.slots),
            "start": self.offset(call.start),
        })
    }

    /// Writes an extraction result in the TypeScript field order.
    pub fn extracted(&mut self, extracted: &Extracted<'_>) -> Value {
        let mut object = Map::new();

        if !extracted.native_vars.is_empty() {
            let reads: Vec<Value> = extracted
                .native_vars
                .iter()
                .map(|read| self.vars_read(read))
                .collect();

            object.insert("nativeVars".into(), Value::Array(reads));
        }

        object.insert(
            "namespaces".into(),
            Value::Array(extracted.namespaces.iter().map(Self::namespace).collect()),
        );

        if !extracted.contributions.is_empty() {
            let contributions: Vec<Value> = extracted
                .contributions
                .iter()
                .map(|contribution| self.contribution(contribution))
                .collect();

            object.insert("contributions".into(), Value::Array(contributions));
            object.insert(
                "contributionStarts".into(),
                Value::Array(
                    extracted
                        .contribution_starts
                        .iter()
                        .map(|start| self.offset(*start))
                        .collect(),
                ),
            );
        }

        if !extracted.contribution_calls.is_empty() {
            object.insert(
                "contributionCalls".into(),
                Value::Array(
                    extracted
                        .contribution_calls
                        .iter()
                        .map(|call| self.contribution_call(call))
                        .collect(),
                ),
            );
        }

        if let Some(exports) = &extracted.theme_exports {
            let exports = pairs(
                exports
                    .iter()
                    .map(|(name, link)| (name.to_string(), self.link(link)))
                    .collect::<Vec<_>>(),
            );

            object.insert("themeExports".into(), exports);
        }

        let calls: Vec<Value> = extracted.calls.iter().map(|call| self.call(call)).collect();

        object.insert("calls".into(), Value::Array(calls));
        object.insert("styles".into(), self.styles(&extracted.styles));

        if !extracted.variable_calls.is_empty() {
            object.insert(
                "variableCalls".into(),
                Value::Array(
                    extracted
                        .variable_calls
                        .iter()
                        .map(|call| self.variable_call(call))
                        .collect(),
                ),
            );
        }

        let aliases: Vec<Value> = extracted
            .theme_aliases
            .iter()
            .map(|alias| self.alias(alias))
            .collect();

        object.insert("themeAliases".into(), Value::Array(aliases));

        if !extracted.theme_appearances.is_empty() {
            object.insert(
                "themeAppearances".into(),
                strings(extracted.theme_appearances.iter()),
            );
        }

        if !extracted.theme_scripts.is_empty() {
            object.insert(
                "themeScripts".into(),
                strings(extracted.theme_scripts.iter()),
            );
        }

        if !extracted.theme_selections.is_empty() {
            object.insert(
                "themeSelections".into(),
                strings(extracted.theme_selections.iter()),
            );
        }

        let calls: Vec<Value> = extracted
            .theme_calls
            .iter()
            .map(|call| self.theme_call(call))
            .collect();

        object.insert("themeCalls".into(), Value::Array(calls));

        if !extracted.static_theme_references.is_empty() {
            object.insert(
                "staticThemeReferences".into(),
                Value::Array(
                    extracted
                        .static_theme_references
                        .iter()
                        .map(|reference| {
                            json!({
                                "start": self.offsets.utf16(reference.start),
                                "end": self.offsets.utf16(reference.end),
                                "value": reference.value,
                            })
                        })
                        .collect(),
                ),
            );
        }

        object.insert(
            "themeReferences".into(),
            Value::Array(
                extracted
                    .theme_references
                    .iter()
                    .map(|reference| {
                        json!({
                            "end": self.offsets.utf16(reference.end),
                            "name": &*reference.name,
                            "start": self.offsets.utf16(reference.start),
                        })
                    })
                    .collect(),
            ),
        );

        let vars = pairs(
            extracted
                .vars
                .iter()
                .map(|(name, definition)| (name.to_string(), self.definition(definition)))
                .collect::<Vec<_>>(),
        );

        object.insert("vars".into(), vars);
        // Collected themes are keyed by a null-prototype record, unlike the empty fallback.
        object.insert("collectedThemes".into(), json!(extracted.collected_themes));

        Value::Object(object)
    }
}

/// Writes extraction diagnostics.
pub fn diagnostics(diagnostics: &[Diagnostic]) -> Value {
    Value::Array(
        diagnostics
            .iter()
            .map(|diagnostic| {
                json!({
                    "code": diagnostic.code.as_str(),
                    "end": diagnostic.end,
                    "message": diagnostic.message,
                    "source": &*diagnostic.source,
                    "start": diagnostic.start,
                })
            })
            .collect(),
    )
}

/// Writes an extraction failure as the error the TypeScript wrapper throws.
pub fn error(error: &Error) -> Value {
    match error {
        Error::Extract(error) => json!({
            "error": {
                "name": "Source.ExtractError",
                "message": error.message(),
                "diagnostics": diagnostics(&error.diagnostics),
            }
        }),
        Error::Theme { message, path } | Error::Vars { message, path } => json!({
            "error": {
                "name": error_name(error),
                "message": error.text(),
                "path": path,
                "reason": message,
            }
        }),
        Error::Style(diagnostics) => json!({
            "error": {
                "name": "Style.InvalidError",
                "message": error.text(),
                "diagnostics": diagnostics.iter().map(|diagnostic| {
                    let mut object = Map::new();

                    object.insert("code".into(), json!(diagnostic.code.as_str()));
                    optional(&mut object, "location", diagnostic.location.as_ref().map(|location| json!({
                        "end": location.end,
                        "path": strings(location.path.iter()),
                        "source": &*location.source,
                        "start": location.start,
                    })));
                    object.insert("message".into(), json!(diagnostic.message));
                    object.insert("path".into(), strings(diagnostic.path.iter()));

                    Value::Object(object)
                }).collect::<Vec<_>>(),
            }
        }),
        error => json!({
            "error": {
                "name": error_name(error),
                "message": error.text(),
            }
        }),
    }
}

fn error_name(error: &Error) -> &'static str {
    match error {
        Error::Config(_) => "Config.InvalidError",
        Error::Conflict { .. } => "Stylesheets.ConflictError",
        Error::Css(_) => "Css.CompileError",
        Error::Extract(_) => "Source.ExtractError",
        Error::MissingTransform => "MissingTransformError",
        Error::Native(_) => "Native.CompileError",
        Error::Style(_) => "Style.InvalidError",
        Error::StyleSheet(_) => "StyleSheet.CompileError",
        Error::StyleSheetSelection(_) => "StyleSheet.SelectionError",
        Error::Syntax(_) => "SyntaxError",
        Error::Themes { .. } => "Source.ThemeInvalidError",
        Error::Theme { .. } => "Theme.InvalidError",
        Error::Variants(_) => "Variants.CompileError",
        Error::Vars { .. } => "Vars.InvalidError",
        Error::Message(_) => "Error",
    }
}

/// Runs `Source.extract` on JSON input and returns its JSON result.
///
/// Input: `{ "moduleId": string, "source": string, "target"?: "native" | "web",
/// "compiler"?: bool }`.
pub fn extract(input: &str) -> String {
    let parsed: Value = match serde_json::from_str(input) {
        Ok(value) => value,
        Err(failure) => {
            return error(&Error::message(format!(
                "Invalid source.extract input: {failure}"
            )))
            .to_string();
        }
    };
    let text = |key: &str| parsed.get(key).and_then(Value::as_str).unwrap_or_default();
    let allocator = Allocator::default();
    let source: &str = allocator.alloc_str(text("source"));
    let options = Options {
        compiler: parsed.get("compiler").and_then(Value::as_bool),
        context: None,
        module_id: text("moduleId"),
        parsed: None,
        source,
        target: if text("target") == "native" {
            Target::Native
        } else {
            Target::Web
        },
    };

    match source::extract(&allocator, &options) {
        Ok(extracted) => {
            let offsets = Utf16Index::new(source);
            let mut contracts = Contracts::default();
            let result = Encoder::new(&mut contracts, &offsets).extracted(&extracted);

            json!({ "contracts": contracts.table(), "result": result }).to_string()
        }
        Err(failure) => error(&failure).to_string(),
    }
}
