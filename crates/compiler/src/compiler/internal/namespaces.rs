//! Isolates CSS namespace selectors and composes their generated source maps.
//!
//! The TypeScript compiler rewrites selectors through the lightningcss binding's JSON visitor,
//! which serializes every selector and rebuilds it from the returned components. The rebuild is
//! observable: it reinserts pseudo-element combinators, drops namespace URLs and lowercase local
//! names, and clears attribute match shortcuts. [`rewrite`] reproduces that round trip on the
//! native selector types so the printed CSS matches.

use std::sync::Arc;

use lightningcss::properties::custom::{Token, TokenList, TokenOrValue, UnresolvedColor};
use lightningcss::rules::CssRule;
use lightningcss::selector::{
    Combinator, Component, PseudoClass, PseudoElement, Selector, SelectorList,
};
use lightningcss::values::ident::Ident;
use lightningcss::values::string::CowArcStr;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};
use parcel_selectors::attr::{
    AttrSelectorWithOptionalNamespace, NamespaceConstraint, ParsedAttrSelectorOperation,
};
use parcel_selectors::parser::NthOfSelectorData;
use rustc_hash::FxHashSet;

use crate::compiler::internal::at_rules;
use crate::compiler::internal::identifiers;
use crate::compiler::internal::lightning::Options;
use crate::error::{Error, Result};
use crate::js;
use crate::mapping::gen_mapping::{EncodedSourceMap, GenMapping, Mapping, Position};
use crate::mapping::trace_mapping::TraceMap;
use crate::web::internal::namespace::{self, Definition};

/// Rewrites namespace-sensitive selectors to the module's emitted namespace prefixes.
///
/// Authored prefixes, compared by their decoded identifiers, map to emitted names, and a default
/// namespace prefixes every compound selector that has no namespace. With
/// `include_declarations`, `@namespace` statements for emitted names the stylesheet does not
/// declare precede the output. When `previous` maps the input, the returned map composes the
/// transform onto it. Columns count UTF-16 code units.
///
/// # Errors
///
/// Returns the at-rule transport's validation and parser errors, and source map query errors.
pub fn rewrite(
    css: &str,
    namespaces: &[Definition],
    previous: Option<&EncodedSourceMap>,
    include_declarations: bool,
) -> Result<(String, Option<EncodedSourceMap>)> {
    if namespaces.is_empty() || css.is_empty() {
        return Ok((css.to_owned(), previous.cloned()));
    }

    // Last bindings win across the module, including equivalent escaped spellings.
    let mut names: Vec<(Option<String>, Arc<str>)> = Vec::new();

    for value in namespaces {
        let key = value.prefix.as_deref().and_then(identifiers::read);

        match names.iter_mut().find(|(existing, _)| *existing == key) {
            Some(entry) => entry.1 = Arc::clone(&value.name),
            None => names.push((key, Arc::clone(&value.name))),
        }
    }

    let mut visitor = Rewrite {
        declared: FxHashSet::default(),
        names,
    };
    let rewritten = at_rules::transform_with(
        &Options {
            code: css,
            filename: "zyzz.css",
            source_map: previous.is_some(),
            ..Options::default()
        },
        &mut visitor,
    )?;

    let declarations: Vec<String> = if include_declarations {
        namespaces
            .iter()
            .filter(|value| !visitor.declared.contains(&*value.name))
            .map(namespace::statement)
            .collect()
    } else {
        Vec::new()
    };

    // Decoding the transformed bytes drops a leading byte order mark.
    let code = rewritten
        .code
        .strip_prefix('\u{feff}')
        .unwrap_or(&rewritten.code);
    let mut output = String::with_capacity(code.len() + declarations.len() * 48);

    for declaration in &declarations {
        output.push_str(declaration);
        output.push('\n');
    }

    output.push_str(code.trim_end_matches(js::is_whitespace));

    let (Some(previous), Some(map)) = (previous, rewritten.map) else {
        return Ok((output, previous.cloned()));
    };

    Ok((output, Some(compose(previous, &map, declarations.len())?)))
}

/// Maps the transform's output through the previous map, shifted below prepended declarations.
fn compose(previous: &EncodedSourceMap, map: &str, offset: usize) -> Result<EncodedSourceMap> {
    let input = TraceMap::new(previous);
    let rewritten = TraceMap::from_json(map)?;
    let mut composed = GenMapping::new(Some(previous.file.as_deref().unwrap_or("zyzz.css")));
    let offset = u32::try_from(offset).unwrap_or(u32::MAX);

    for entry in rewritten.mappings() {
        let (Some(line), Some(column)) = (entry.original_line, entry.original_column) else {
            continue;
        };

        let original = input.original_position_for(line, column)?;

        let (Some(line), Some(column), Some(source)) =
            (original.line, original.column, original.source)
        else {
            continue;
        };

        composed.add_mapping(&Mapping {
            generated: Position {
                column: position(entry.generated_column),
                line: position(entry.generated_line).saturating_add(offset),
            },
            name: original.name,
            original: Some(Position {
                column: position(column),
                line: position(line),
            }),
            source: Some(source),
        });
    }

    for (index, source) in previous.sources.iter().enumerate() {
        let Some(source) = source else {
            continue;
        };

        let content = previous
            .sources_content
            .as_ref()
            .and_then(|contents| contents.get(index))
            .and_then(Option::as_deref);

        composed.set_source_content(source, content);
    }

    Ok(composed.into_encoded_map())
}

/// Narrows a decoded map position, which is never negative or past `u32::MAX` for parsed CSS.
fn position(value: i64) -> u32 {
    u32::try_from(value).unwrap_or_default()
}

/// The selector and namespace visitor of `Namespaces.rewrite`.
struct Rewrite {
    declared: FxHashSet<String>,
    names: Vec<(Option<String>, Arc<str>)>,
}

impl<'i> Visitor<'i> for Rewrite {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES | VisitTypes::SELECTORS
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Namespace(rule) = &*rule
            && let Some(prefix) = &rule.prefix
        {
            self.declared.insert(prefix.0.to_string());
        }

        rule.visit_children(self)
    }

    fn visit_selector_list(&mut self, selectors: &mut SelectorList<'i>) -> Result<()> {
        for selector in &mut selectors.0 {
            *selector = self.selector(selector, true);
        }

        Ok(())
    }
}

impl Rewrite {
    fn name(&self, prefix: Option<&str>) -> Option<&Arc<str>> {
        self.names
            .iter()
            .find(|(key, _)| key.as_deref() == prefix)
            .map(|(_, name)| name)
    }

    fn prefix<'i>(&self, prefix: &Ident<'i>, rewrite: bool) -> Ident<'i> {
        match self.name(Some(&prefix.0)).filter(|_| rewrite) {
            Some(name) => Ident(CowArcStr::from(name.to_string())),
            None => prefix.clone(),
        }
    }

    /// Rebuilds a selector from its serialized components, as the binding deserializes the
    /// visitor's result. With `rewrite`, components first pass through the TypeScript selector
    /// callback.
    fn selector<'i>(&self, input: &Selector<'i>, rewrite: bool) -> Selector<'i> {
        let default = self.name(None).filter(|_| rewrite);
        let mut output: Vec<Component<'i>> = Vec::new();
        let mut first = true;

        for component in serialized(input) {
            if component.is_combinator() {
                first = true;
            } else if first {
                if let Some(name) = default
                    && !matches!(
                        component,
                        Component::ExplicitAnyNamespace
                            | Component::ExplicitNoNamespace
                            | Component::DefaultNamespace(_)
                            | Component::Namespace(..)
                            | Component::Nesting
                    )
                {
                    output.push(Component::Namespace(
                        Ident(CowArcStr::from(name.to_string())),
                        CowArcStr::from(""),
                    ));

                    if !matches!(
                        component,
                        Component::LocalName(_) | Component::ExplicitUniversalType
                    ) {
                        output.push(Component::ExplicitUniversalType);
                    }
                }

                first = false;
            }

            let component = self.component(component, rewrite);

            // Deserialization reinserts the combinators that serialization omits.
            match component {
                Component::Slotted(_) => {
                    output.push(Component::Combinator(Combinator::SlotAssignment));
                }
                Component::Part(_) => output.push(Component::Combinator(Combinator::Part)),
                Component::PseudoElement(_) => {
                    output.push(Component::Combinator(Combinator::PseudoElement));
                }
                _ => {}
            }

            output.push(component);
        }

        Selector::from(output)
    }

    fn selectors<'i>(&self, selectors: &[Selector<'i>], rewrite: bool) -> Box<[Selector<'i>]> {
        selectors
            .iter()
            .map(|selector| self.selector(selector, rewrite))
            .collect()
    }

    /// Converts one component as serialization and deserialization do.
    fn component<'i>(&self, component: &Component<'i>, rewrite: bool) -> Component<'i> {
        match component {
            Component::DefaultNamespace(_) => Component::ExplicitAnyNamespace,
            Component::Namespace(prefix, _) => {
                Component::Namespace(self.prefix(prefix, rewrite), CowArcStr::from(""))
            }
            Component::LocalName(local) => {
                let mut local = local.clone();

                local.lower_name = local.name.clone();
                Component::LocalName(local)
            }
            Component::AttributeInNoNamespaceExists { local_name, .. } => {
                attribute(None, local_name, None)
            }
            Component::AttributeInNoNamespace {
                case_sensitivity,
                local_name,
                operator,
                value,
                ..
            } => attribute(
                None,
                local_name,
                Some(ParsedAttrSelectorOperation::WithValue {
                    case_sensitivity: *case_sensitivity,
                    expected_value: value.clone(),
                    operator: *operator,
                }),
            ),
            Component::AttributeOther(other) => {
                let namespace = other.namespace.as_ref().map(|namespace| match namespace {
                    NamespaceConstraint::Any => NamespaceConstraint::Any,
                    NamespaceConstraint::Specific((prefix, url)) => {
                        NamespaceConstraint::Specific((self.prefix(prefix, rewrite), url.clone()))
                    }
                });
                let operation = match &other.operation {
                    ParsedAttrSelectorOperation::Exists => None,
                    operation @ ParsedAttrSelectorOperation::WithValue { .. } => {
                        Some(operation.clone())
                    }
                };

                attribute(namespace, &other.local_name, operation)
            }
            Component::Negation(selectors) => {
                Component::Negation(self.selectors(selectors, rewrite))
            }
            Component::NthOf(nth) => Component::NthOf(NthOfSelectorData::new(
                *nth.nth_data(),
                self.selectors(nth.selectors(), rewrite),
            )),
            Component::Host(selector) => Component::Host(
                selector
                    .as_ref()
                    .map(|selector| self.selector(selector, rewrite)),
            ),
            Component::Where(selectors) => Component::Where(self.selectors(selectors, rewrite)),
            Component::Is(selectors) => Component::Is(self.selectors(selectors, rewrite)),
            Component::Any(prefix, selectors) => {
                Component::Any(*prefix, self.selectors(selectors, rewrite))
            }
            Component::Has(selectors) => Component::Has(self.selectors(selectors, rewrite)),
            // The callback reads `selectors` and `of` only, so other nested selectors round-trip
            // without rewriting.
            Component::Slotted(selector) => Component::Slotted(self.selector(selector, false)),
            Component::NonTSPseudoClass(class) => Component::NonTSPseudoClass(match class {
                PseudoClass::CustomFunction { arguments, name } => PseudoClass::CustomFunction {
                    arguments: detached(arguments),
                    name: name.clone(),
                },
                PseudoClass::Global { selector } => PseudoClass::Global {
                    selector: Box::new(self.selector(selector, false)),
                },
                PseudoClass::Local { selector } => PseudoClass::Local {
                    selector: Box::new(self.selector(selector, false)),
                },
                _ => class.clone(),
            }),
            Component::PseudoElement(element) => Component::PseudoElement(match element {
                PseudoElement::CueFunction { selector } => PseudoElement::CueFunction {
                    selector: Box::new(self.selector(selector, false)),
                },
                PseudoElement::CueRegionFunction { selector } => PseudoElement::CueRegionFunction {
                    selector: Box::new(self.selector(selector, false)),
                },
                PseudoElement::CustomFunction { arguments, name } => {
                    PseudoElement::CustomFunction {
                        arguments: detached(arguments),
                        name: name.clone(),
                    }
                }
                _ => element.clone(),
            }),
            _ => component.clone(),
        }
    }
}

/// Copies a token list as its JSON form deserializes: number, percentage, and dimension tokens
/// lose their sign flags and integer values, so integers print with a fraction.
fn detached<'i>(tokens: &TokenList<'i>) -> TokenList<'i> {
    let mut tokens = tokens.clone();

    detach(&mut tokens);
    tokens
}

fn detach(tokens: &mut TokenList<'_>) {
    for token in &mut tokens.0 {
        match token {
            TokenOrValue::Token(
                Token::Number {
                    has_sign,
                    int_value,
                    ..
                }
                | Token::Percentage {
                    has_sign,
                    int_value,
                    ..
                }
                | Token::Dimension {
                    has_sign,
                    int_value,
                    ..
                },
            ) => {
                *has_sign = false;
                *int_value = None;
            }
            TokenOrValue::Env(variable) => {
                if let Some(fallback) = &mut variable.fallback {
                    detach(fallback);
                }
            }
            TokenOrValue::Function(function) => detach(&mut function.arguments),
            TokenOrValue::UnresolvedColor(
                UnresolvedColor::HSL { alpha, .. } | UnresolvedColor::RGB { alpha, .. },
            ) => detach(alpha),
            TokenOrValue::UnresolvedColor(UnresolvedColor::LightDark { dark, light }) => {
                detach(light);
                detach(dark);
            }
            TokenOrValue::Var(variable) => {
                if let Some(fallback) = &mut variable.fallback {
                    detach(fallback);
                }
            }
            _ => {}
        }
    }
}

/// Lists a selector's components in serialized order, without the pseudo-element, part, and
/// slot combinators the binding omits.
fn serialized<'s, 'i>(selector: &'s Selector<'i>) -> Vec<&'s Component<'i>> {
    let raw = selector.iter_raw_match_order().as_slice();
    let mut combinators = raw
        .iter()
        .rev()
        .filter(|component| Component::is_combinator(component));
    let mut output = Vec::with_capacity(raw.len());

    for compound in raw.split(Component::is_combinator).rev() {
        if compound.is_empty() {
            continue;
        }

        output.extend(compound.iter());

        if let Some(combinator) = combinators.next()
            && !matches!(
                combinator,
                Component::Combinator(
                    Combinator::Part | Combinator::PseudoElement | Combinator::SlotAssignment
                )
            )
        {
            output.push(combinator);
        }
    }

    output
}

/// Builds an attribute selector as deserialization chooses its representation.
fn attribute<'i>(
    namespace: Option<NamespaceConstraint<(Ident<'i>, CowArcStr<'i>)>>,
    name: &Ident<'i>,
    operation: Option<ParsedAttrSelectorOperation<lightningcss::values::string::CSSString<'i>>>,
) -> Component<'i> {
    let first_uppercase = name.0.bytes().position(|byte| byte.is_ascii_uppercase());
    let lower = match first_uppercase {
        Some(first) => {
            let mut lower = name.0.to_string();

            if let Some(rest) = lower.get_mut(first..) {
                rest.make_ascii_lowercase();
            }

            Ident(CowArcStr::from(lower))
        }
        None => name.clone(),
    };

    if namespace.is_some() || (first_uppercase.is_some() && operation.is_some()) {
        return Component::AttributeOther(Box::new(AttrSelectorWithOptionalNamespace {
            local_name: name.clone(),
            local_name_lower: lower,
            namespace,
            never_matches: false,
            operation: operation.unwrap_or(ParsedAttrSelectorOperation::Exists),
        }));
    }

    match operation {
        Some(ParsedAttrSelectorOperation::WithValue {
            case_sensitivity,
            expected_value,
            operator,
        }) => Component::AttributeInNoNamespace {
            case_sensitivity,
            local_name: name.clone(),
            never_matches: false,
            operator,
            value: expected_value,
        },
        _ => Component::AttributeInNoNamespaceExists {
            local_name: name.clone(),
            local_name_lower: lower,
        },
    }
}
