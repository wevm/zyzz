//! Lowers target-neutral callback declarations to ordered native binding data, mirroring
//! `NativeBindings`.
//!
//! [`prepare`] splits each recipe rule into static fragments and scalar assignments in authored
//! order and compiles the fragments for every set and scheme. [`compile`] resolves the token parts
//! of the assignments for one set and scheme and selects its fragment table. [`finite`] lowers a
//! program without runtime bindings to static steps.

use std::sync::Arc;

use rustc_hash::FxHashSet;

use crate::compiler::source::Call;
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::binding::Domain;
use crate::internal::recipe::{self, Axes, Defaults, Matches};
use crate::internal::theme::Definition;
use crate::internal::token::{Part, Reference};
use crate::js::{self, Record};
use crate::react_native::internal::scalar::{self, Kind, Value as Scalar};
use crate::react_native::internal::tokens::{self, Resolution};
use crate::react_native::style_sheet::{self, ColorScheme, Tables};
use crate::runtime::native_dynamic::{self, Payload, PayloadDefaults, Payloads, Program};
use crate::runtime::native_static;
use crate::runtime::recipe::Scalar as PayloadScalar;
use crate::style::{self, NamedStyle};

/// Native target options shared by preparation and selection.
#[derive(Clone, Debug)]
pub struct Options<'a> {
    /// Selected scheme, `light` or `dark`. Other values fail table selection.
    pub color_scheme: Option<&'a str>,
    /// Authored `fonts` option, `Data::Undefined` when omitted.
    pub fonts: Data,
    /// Authored `platform` option, `Data::Undefined` when omitted.
    pub platform: Data,
    /// Selected set, `default` when omitted.
    pub set: Option<&'a str>,
    /// Authored `units` option, `Data::Undefined` when omitted.
    pub units: Data,
    /// Compatible sets by name. Omission compiles the token-fallback `default` table.
    pub vars: Option<&'a Record<Arc<Definition>>>,
}

impl Default for Options<'_> {
    fn default() -> Self {
        Self {
            color_scheme: None,
            fonts: Data::Undefined,
            platform: Data::Undefined,
            set: None,
            units: Data::Undefined,
            vars: None,
        }
    }
}

/// One part of a prepared assignment, before token resolution.
#[derive(Clone, Debug, PartialEq)]
pub enum PreparedPart {
    /// A number.
    Number(f64),
    /// A token reference resolved for the selected set and scheme.
    Reference(Arc<Reference>),
    /// A runtime slot, optionally requiring a number.
    Slot {
        /// Whether the slot only accepts numbers.
        number: bool,
        /// Internal slot name.
        slot: Arc<str>,
    },
    /// CSS text.
    String(Arc<str>),
}

/// One prepared step: a static fragment, or a scalar assignment from parts.
#[derive(Clone, Debug, PartialEq)]
pub enum PreparedStep {
    /// Assigns one portable property from joined parts.
    Assign {
        /// Parts joined in order.
        parts: Vec<PreparedPart>,
        /// Portable property name.
        property: Arc<str>,
    },
    /// Applies the fragment of this name.
    Style(Arc<str>),
}

/// A prepared rule whose steps apply when every match selects a listed choice.
#[derive(Clone, Debug, PartialEq)]
pub struct PreparedRule {
    /// Axis names and allowed choices.
    pub matches: Matches,
    /// Steps in application order.
    pub steps: Vec<PreparedStep>,
}

/// Immutable programs and fragment tables for every set and scheme.
#[derive(Clone, Debug)]
pub struct Prepared {
    /// Ordered finite choice names.
    pub axes: Axes,
    /// Default selections.
    pub defaults: Defaults,
    /// Authored `fonts` option.
    pub fonts: Data,
    /// Dynamic choices, present when the call declares payloads.
    pub payloads: Option<Payloads>,
    /// Base, variant, and compound rules in authored order.
    pub rules: Vec<PreparedRule>,
    /// Required top-level input fields mapped to internal slot names.
    pub slots: Vec<(Arc<str>, Arc<str>)>,
    /// Fragment tables for every set and scheme.
    pub styles: Tables,
    /// Authored `units` option.
    pub units: Data,
}

/// Properties whose values never bind a scalar slot.
fn compound(kind: Kind) -> bool {
    matches!(
        kind,
        Kind::Flex
            | Kind::FontVariant
            | Kind::Origin
            | Kind::Shadow
            | Kind::TextShadow
            | Kind::Transform
    )
}

/// Splits callback declarations into static fragments and scalar assignments, and compiles the
/// fragments for every set and scheme.
///
/// # Errors
///
/// Returns the `NativeBindings` message for importance or fallbacks, unsupported dynamic
/// properties, undeclared bindings, unsupported expressions, and nested conditions. Fragment
/// compilation fails with [`Error::StyleSheet`].
pub fn prepare(
    recipe: &recipe::Definition,
    call: &Call<'_>,
    options: &Options<'_>,
) -> Result<Prepared> {
    let slots: Vec<(Arc<str>, Arc<str>)> = call
        .slots
        .iter()
        .flat_map(Record::iter)
        .map(|(name, slot)| (Arc::clone(name), Arc::from(slot.name.as_str())))
        .collect();
    let payloads = call
        .recipe
        .as_ref()
        .and_then(|recipe| recipe.payloads.as_ref());
    let available: FxHashSet<&str> = slots
        .iter()
        .map(|(_, slot)| &**slot)
        .chain(
            payloads
                .into_iter()
                .flatten()
                .filter_map(|payload| payload.slots.first())
                .flat_map(|slots| slots.values().map(|slot| &**slot)),
        )
        .collect();
    let mut preparer = Preparer {
        available: &available,
        fragments: Vec::new(),
        steps: Vec::new(),
    };
    let mut rules = Vec::with_capacity(recipe.rules.len());

    for rule in &recipe.rules {
        for style in &rule.value.styles {
            preparer.visit(style)?;
        }

        rules.push(PreparedRule {
            matches: rule.matches.clone(),
            steps: std::mem::take(&mut preparer.steps),
        });
    }

    let styles = style_sheet::compile(
        &style::Definition {
            labels: None,
            styles: preparer.fragments,
        },
        &style_sheet::Options {
            fonts: options.fonts.clone(),
            platform: options.platform.clone(),
            units: options.units.clone(),
            vars: vars_data(options.vars),
        },
    )?;

    Ok(Prepared {
        axes: recipe.axes.clone(),
        defaults: recipe.defaults.clone(),
        fonts: options.fonts.clone(),
        payloads: call
            .recipe
            .as_ref()
            .and_then(|recipe| {
                recipe
                    .payloads
                    .as_ref()
                    .map(|payloads| (payloads, recipe.default_payloads.as_ref()))
            })
            .map(|(payloads, defaults)| Payloads {
                defaults: defaults.map(payload_defaults),
                payloads: payloads
                    .iter()
                    .map(|payload| Payload {
                        axis: Arc::clone(&payload.axis),
                        choice: Arc::clone(&payload.choice),
                        slots: payload
                            .slots
                            .iter()
                            .map(|slots| {
                                slots
                                    .iter()
                                    .map(|(field, slot)| (Arc::clone(field), Arc::clone(slot)))
                                    .collect()
                            })
                            .collect(),
                    })
                    .collect(),
            }),
        rules,
        slots,
        styles,
        units: options.units.clone(),
    })
}

/// Resolves the token parts of a prepared program for the selected set and scheme, and selects
/// its fragment table. Without `prepared`, the program is prepared from the same inputs.
///
/// # Errors
///
/// Returns the errors of [`prepare`], token resolution messages, and
/// [`Error::StyleSheetSelection`] for an unknown set or scheme. Token errors take precedence.
pub fn compile(
    recipe: &recipe::Definition,
    call: &Call<'_>,
    options: &Options<'_>,
    prepared: Option<&Prepared>,
) -> Result<native_dynamic::Options> {
    let owned;
    let prepared = if let Some(prepared) = prepared {
        prepared
    } else {
        owned = prepare(recipe, call, options)?;
        &owned
    };
    let set = options.set.unwrap_or("default");
    let metadata = options
        .vars
        .and_then(|vars| vars.get(set))
        .map(|theme| &theme.metadata);
    let scalar = scalar::Options::read(&options.fonts, &options.units);
    let resolve = |reference: &Arc<Reference>| -> Result<native_dynamic::Part> {
        let mut resolution = Resolution::default();
        let value = tokens::resolve(
            &style::Value::Token(Arc::clone(reference)),
            &tokens::Options {
                color_scheme: options.color_scheme.and_then(ColorScheme::parse),
                metadata,
                scalar: &scalar,
            },
            &mut resolution,
        )
        .map_err(|error| Error::Message(error.message().to_owned()))?;

        Ok(match value {
            Scalar::Number(number) => native_dynamic::Part::Number(number),
            Scalar::String(text) => native_dynamic::Part::String(text),
        })
    };
    let mut rules = Vec::with_capacity(prepared.rules.len());

    for rule in &prepared.rules {
        let mut steps = Vec::with_capacity(rule.steps.len());

        for step in &rule.steps {
            steps.push(match step {
                PreparedStep::Style(name) => native_dynamic::Step::Style(Arc::clone(name)),
                PreparedStep::Assign { parts, property } => native_dynamic::Step::Assign {
                    parts: parts
                        .iter()
                        .map(|part| match part {
                            PreparedPart::Number(number) => {
                                Ok(native_dynamic::Part::Number(*number))
                            }
                            PreparedPart::Reference(reference) => resolve(reference),
                            PreparedPart::Slot { number, slot } => Ok(native_dynamic::Part::Slot {
                                number: *number,
                                slot: Arc::clone(slot),
                            }),
                            PreparedPart::String(text) => {
                                Ok(native_dynamic::Part::String(Arc::clone(text)))
                            }
                        })
                        .collect::<Result<_>>()?,
                    property: Arc::clone(property),
                },
            });
        }

        rules.push(native_dynamic::Rule {
            matches: rule.matches.clone(),
            steps,
        });
    }

    let styles = style_sheet::select(&prepared.styles, set, options.color_scheme)?;

    Ok(native_dynamic::Options {
        axes: prepared.axes.clone(),
        defaults: prepared.defaults.clone(),
        fonts: prepared.fonts.clone(),
        payloads: prepared.payloads.clone(),
        program: Program {
            rules,
            slots: prepared.slots.clone(),
        },
        styles,
        units: prepared.units.clone(),
    })
}

/// Lowers a program without runtime slots to static steps. Numeric line heights stay
/// multipliers, and absolute line heights become added fragments.
///
/// # Errors
///
/// Returns `Static native recipes cannot contain runtime bindings.` for any assignment other than
/// a slot-free line height, and the length conversion message for an invalid absolute line height.
pub fn finite(options: &native_dynamic::Options) -> Result<native_static::Options> {
    let scalar = scalar::Options::read(&options.fonts, &options.units);
    let mut styles: Object = (*options.styles).clone();
    let mut rules = Vec::with_capacity(options.program.rules.len());

    for rule in &options.program.rules {
        let mut steps = Vec::with_capacity(rule.steps.len());

        for step in &rule.steps {
            let (parts, property) = match step {
                native_dynamic::Step::Style(name) => {
                    steps.push(native_static::Step::Style(Arc::clone(name)));
                    continue;
                }
                native_dynamic::Step::Assign { parts, property } => (parts, property),
            };

            if &**property != "lineHeight"
                || parts.is_empty()
                || parts
                    .iter()
                    .any(|part| matches!(part, native_dynamic::Part::Slot { .. }))
            {
                return Err(Error::message(
                    "Static native recipes cannot contain runtime bindings.",
                ));
            }

            let value = match parts.as_slice() {
                [native_dynamic::Part::Number(number)] => {
                    steps.push(native_static::Step::LineHeight(*number));
                    continue;
                }
                [native_dynamic::Part::String(text)] => Arc::clone(text),
                parts => {
                    let mut text = String::new();

                    for part in parts {
                        match part {
                            native_dynamic::Part::Number(number) => {
                                js::write_number(&mut text, *number);
                            }
                            native_dynamic::Part::String(value) => text.push_str(value),
                            native_dynamic::Part::Slot { .. } => {}
                        }
                    }

                    text.into()
                }
            };
            let name: Arc<str> = js::number(index_number(styles.len())).into();
            let height = scalar::length(&Scalar::String(value), &scalar, false)?;

            styles.insert(
                Arc::clone(&name),
                Data::from(Object::from_entries([(
                    Arc::from("lineHeight"),
                    Data::Number(height),
                )])),
            );
            steps.push(native_static::Step::Style(name));
        }

        rules.push(native_static::Rule {
            matches: rule.matches.clone(),
            steps,
        });
    }

    Ok(native_static::Options {
        axes: options.axes.clone(),
        defaults: options.defaults.clone(),
        rules,
        styles: Arc::new(styles),
    })
}

/// A count as the number `String(count)` formats.
#[expect(
    clippy::cast_precision_loss,
    reason = "Fragment counts are far below 2^53."
)]
fn index_number(count: usize) -> f64 {
    count as f64
}

/// The catalog as the `vars` option value of `StyleSheet.compile`.
fn vars_data(vars: Option<&Record<Arc<Definition>>>) -> Data {
    vars.map_or(Data::Undefined, |vars| {
        Data::from(Object::from_entries(vars.iter().map(|(name, theme)| {
            (Arc::clone(name), Data::Theme(Arc::clone(theme)))
        })))
    })
}

fn payload_defaults(defaults: &Record<Record<PayloadScalar>>) -> PayloadDefaults {
    defaults
        .iter()
        .map(|(axis, fields)| {
            (
                Arc::clone(axis),
                fields
                    .iter()
                    .map(|(field, value)| {
                        (
                            Arc::clone(field),
                            match value {
                                PayloadScalar::Number(number) => Scalar::Number(*number),
                                PayloadScalar::String(text) => Scalar::String(Arc::clone(text)),
                            },
                        )
                    })
                    .collect(),
            )
        })
        .collect()
}

struct Preparer<'a> {
    available: &'a FxHashSet<&'a str>,
    fragments: Vec<Arc<NamedStyle>>,
    steps: Vec<PreparedStep>,
}

impl Preparer<'_> {
    /// Adds a fragment named by its index and applies it.
    fn fragment(&mut self, style: NamedStyle) {
        let name: Arc<str> = js::number(index_number(self.fragments.len())).into();

        self.fragments.push(Arc::new(NamedStyle {
            name: Arc::clone(&name),
            ..style
        }));
        self.steps.push(PreparedStep::Style(name));
    }

    fn flush(&mut self, name: &Arc<str>, declarations: &mut Vec<style::Declaration>) {
        if declarations.is_empty() {
            return;
        }

        self.fragment(NamedStyle {
            declarations: std::mem::take(declarations),
            name: Arc::clone(name),
            ..NamedStyle::default()
        });
    }

    fn visit(&mut self, style: &NamedStyle) -> Result<()> {
        let mut declared: FxHashSet<&str> = FxHashSet::default();
        let mut declarations = Vec::new();

        for declaration in &style.declarations {
            if declaration.important || !declared.insert(&declaration.property) {
                return Err(Error::message(
                    "Importance and fallback declarations are not supported on native.",
                ));
            }

            let dynamic = match &declaration.value {
                style::Value::Binding(_) => true,
                style::Value::Expression(expression) => expression
                    .parts
                    .iter()
                    .any(|part| matches!(part, Part::Binding(_))),
                _ => false,
            };

            if !dynamic && &*declaration.property != "lineHeight" {
                declarations.push(declaration.clone());
                continue;
            }

            self.flush(&style.name, &mut declarations);

            if scalar::property(&declaration.property).is_none_or(compound) {
                return Err(Error::Message(format!(
                    "Dynamic native property is unsupported: {}.",
                    declaration.property
                )));
            }

            let parts = self.parts(&declaration.value)?;
            let calculation = parts
                .iter()
                .any(|part| matches!(part, PreparedPart::String(text) if calc(text)));
            let suffixed = matches!(
                parts.as_slice(),
                [
                    PreparedPart::Reference(_) | PreparedPart::Slot { .. },
                    PreparedPart::String(suffix),
                ] if matches!(&**suffix, "px" | "rem" | "%")
            );

            if parts.len() > 1 && !calculation && !suffixed {
                return Err(Error::message(
                    "Native dynamic expressions support a scalar with a px, rem, or percent suffix.",
                ));
            }

            self.steps.push(PreparedStep::Assign {
                parts,
                property: Arc::clone(&declaration.property),
            });
        }

        self.flush(&style.name, &mut declarations);

        if let Some(targets) = &style.targets {
            self.fragment(NamedStyle {
                name: Arc::clone(&style.name),
                targets: Some(targets.clone()),
                ..NamedStyle::default()
            });
        }

        for rule in style.rules.iter().flatten() {
            if rule.condition.is_some() {
                return Err(Error::message(
                    "Selectors, queries, and nested rules are not supported on native.",
                ));
            }

            self.visit(&rule.style)?;
        }

        Ok(())
    }

    fn parts(&self, value: &style::Value) -> Result<Vec<PreparedPart>> {
        match value {
            style::Value::Expression(expression) => expression
                .parts
                .iter()
                .map(|part| match part {
                    Part::Binding(binding) => self.slot(binding),
                    Part::Reference(reference) => {
                        Ok(PreparedPart::Reference(Arc::clone(reference)))
                    }
                    Part::Text(text) => Ok(PreparedPart::String(Arc::clone(text))),
                })
                .collect(),
            style::Value::Binding(binding) => Ok(vec![self.slot(binding)?]),
            style::Value::Number(number) => Ok(vec![PreparedPart::Number(*number)]),
            style::Value::String(text) => Ok(vec![PreparedPart::String(Arc::clone(text))]),
            style::Value::Token(reference) => {
                Ok(vec![PreparedPart::Reference(Arc::clone(reference))])
            }
        }
    }

    fn slot(&self, binding: &crate::internal::binding::Reference) -> Result<PreparedPart> {
        if !self.available.contains(binding.name.as_str()) {
            return Err(Error::message(
                "Native bindings require declared runtime scalar fields.",
            ));
        }

        Ok(PreparedPart::Slot {
            number: binding.domain == Domain::Number,
            slot: binding.name.as_str().into(),
        })
    }
}

/// Whether text contains `calc(` at its start or after whitespace, case-insensitively, as
/// `/(?:^|\s)calc\(/i` tests.
fn calc(text: &str) -> bool {
    let at = |from: usize| {
        text.as_bytes()
            .get(from..from + 5)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"calc("))
    };

    at(0)
        || text.char_indices().any(|(index, character)| {
            js::is_whitespace(character) && at(index + character.len_utf8())
        })
}
