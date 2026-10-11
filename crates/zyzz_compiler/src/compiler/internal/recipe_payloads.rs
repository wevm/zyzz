//! Reuses typed callback extraction for isolated recipe payload contexts.
//!
//! Every condition context of a dynamic choice reads its own copy of the callback, so identical
//! source reads bind different slots. Reads are therefore keyed by arena address rather than by
//! span or node id, which copies share.

use std::cell::RefCell;
use std::sync::Arc;

use oxc_allocator::{Address, Allocator, CloneIn, GetAddress};
use oxc_ast::ast::{
    Expression, ObjectExpression, PropertyKey, TSLiteral, TSSignature, TSType, UnaryOperator,
};
use oxc_ast_visit::{Visit, walk};
use rustc_hash::{FxHashMap, FxHashSet};

use crate::compiler::internal::dynamic::{self, Read, Slots};
use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::statics::Static;
use crate::error::{Error, Result};
use crate::internal::binding;
use crate::js;

/// Static resolution hooks shared with dynamic style callbacks.
#[derive(Clone, Copy)]
pub struct Options<'s, 'a> {
    /// Arena for callback copies.
    pub allocator: &'a Allocator,
    /// Calls whose values static resolution may read.
    pub allowed: &'s FxHashSet<u32>,
    /// Starts of expressions normalization keeps as authored.
    pub opaque: &'s FxHashSet<u32>,
    /// The module's static data.
    pub statics: &'s Static<'a>,
}

impl<'a> Options<'_, 'a> {
    /// Expands immutable body data without executing expressions.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` from static resolution.
    pub fn normalize(&self, node: &'a Expression<'a>) -> Result<&'a Expression<'a>> {
        self.statics
            .normalize(node, self.allowed, self.opaque, false)
    }

    /// Resolves finite local or imported callback type aliases.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for cyclic aliases.
    pub fn resolve_type(&self, node: &'a TSType<'a>) -> Result<&'a TSType<'a>> {
        self.statics.type_of(node, &mut Vec::new())
    }
}

/// One payload context of a dynamic choice.
pub struct Model<'a> {
    /// The normalized object body.
    pub body: &'a ObjectExpression<'a>,
    /// The validated callback.
    pub read: Read<'a>,
}

/// Bindings of every payload context in one recipe.
pub struct Payloads<'s, 'a> {
    models: Vec<Model<'a>>,
    options: Options<'s, 'a>,
    /// The model owning each slot, by slot name.
    owners: FxHashMap<String, usize>,
    references: RefCell<FxHashMap<Address, Arc<binding::Reference>>>,
    /// Every context's slots, by slot name.
    pub slots: Slots,
}

/// Creates empty bindings for one recipe.
pub fn create<'s, 'a>(options: Options<'s, 'a>) -> Payloads<'s, 'a> {
    Payloads {
        models: Vec::new(),
        options,
        owners: FxHashMap::default(),
        references: RefCell::new(FxHashMap::default()),
        slots: Slots::new(),
    }
}

struct Recorder<'r, 'a> {
    error: Option<Error>,
    read: &'r Read<'a>,
    references: Option<&'r mut FxHashMap<Address, Arc<binding::Reference>>>,
}

impl<'a> Visit<'a> for Recorder<'_, 'a> {
    fn visit_expression(&mut self, node: &Expression<'a>) {
        if self.error.is_some() {
            return;
        }

        match self.read.resolve(node) {
            Ok(Some(slot)) => {
                if let Some(references) = self.references.as_deref_mut() {
                    references.insert(unwrap(node).address(), slot);
                }
            }
            Ok(None) => {}
            Err(error) => {
                self.error = Some(error);
                return;
            }
        }

        walk::walk_expression(self, node);
    }
}

impl<'a> Payloads<'_, 'a> {
    /// Whether a slot's declared numeric values fit a property's literal rule.
    pub fn accepts(&self, reference: &binding::Reference, property: &str) -> bool {
        self.owners
            .get(reference.name.as_str())
            .and_then(|index| self.models.get(*index))
            .is_some_and(|model| model.read.accepts(reference, property))
    }

    /// The payload context at an index [`Payloads::read`] returned.
    pub fn model(&self, index: usize) -> Option<&Model<'a>> {
        self.models.get(index)
    }

    /// Reads one isolated payload context of a choice value, or `None` when it is not a callback.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for invalid callbacks, undeclared reads, and failed static
    /// resolution.
    pub fn read(&mut self, node: &'a Expression<'a>, identity: &str) -> Result<Option<usize>> {
        // Only callbacks have payloads, so other values skip the copy.
        if !matches!(unwrap(node), Expression::ArrowFunctionExpression(_)) {
            return Ok(None);
        }

        let allocator = self.options.allocator;
        let copy: &'a Expression<'a> = allocator.alloc(node.clone_in_with_semantic_ids(allocator));
        let options = self.options;
        let Some(read) = dynamic::read(copy, identity, &mut |node| options.resolve_type(node))?
        else {
            return Ok(None);
        };
        let body = match self.options.normalize(read.expression)? {
            Expression::ObjectExpression(body) => &**body,
            _ => read.body,
        };

        self.record(&read, body)?;

        let index = self.models.len();

        for slot in read.slots.values() {
            self.owners.insert(slot.name.clone(), index);
            self.slots.insert(slot.name.as_str(), Arc::clone(slot));
        }

        self.models.push(Model { body, read });

        Ok(Some(index))
    }

    fn record(&self, read: &Read<'a>, body: &ObjectExpression<'a>) -> Result<()> {
        let mut references = self.references.borrow_mut();
        let mut recorder = Recorder {
            error: None,
            read,
            references: Some(&mut references),
        };

        recorder.visit_object_expression(body);

        recorder.error.map_or(Ok(()), Err)
    }

    /// Records the reads of a copy of a context's body, which the expanded recipe holds in place
    /// of the original.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for undeclared reads, which [`Payloads::read`] already rejects.
    pub fn record_copy(&self, index: usize, body: &ObjectExpression<'a>) -> Result<()> {
        let Some(model) = self.models.get(index) else {
            return Ok(());
        };

        self.record(&model.read, body)
    }

    /// The slot a payload read binds, by the read's arena address.
    pub fn resolve(&self, node: &Expression<'a>) -> Option<Arc<binding::Reference>> {
        self.references
            .borrow()
            .get(&unwrap(node).address())
            .cloned()
    }

    /// Whether a scalar fits a context's declared field type.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for cyclic type aliases.
    pub fn accepts_value(&self, index: usize, field: &str, value: &Scalar<'_>) -> Result<bool> {
        let Some(model) = self.models.get(index) else {
            return Ok(false);
        };
        let TSType::TSTypeLiteral(literal) =
            self.options.resolve_type(model.read.type_annotation)?
        else {
            return Ok(false);
        };
        let member = literal.members.iter().find_map(|member| match member {
            TSSignature::TSPropertySignature(signature) => {
                let key = match &signature.key {
                    PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
                    PropertyKey::StringLiteral(literal) => Some(literal.value.as_str()),
                    _ => None,
                };

                (key == Some(field)).then_some(signature)
            }
            _ => None,
        });
        let Some(annotation) = member.and_then(|member| member.type_annotation.as_ref()) else {
            return Ok(false);
        };

        Ok(accepts(
            self.options.resolve_type(&annotation.type_annotation)?,
            value,
        ))
    }
}

/// A scalar payload value.
#[derive(Clone, Copy, Debug)]
pub enum Scalar<'v> {
    /// A number.
    Number(f64),
    /// A string.
    String(&'v str),
}

#[expect(
    clippy::float_cmp,
    reason = "Literal types compare with JavaScript strict equality."
)]
fn accepts(node: &TSType<'_>, value: &Scalar<'_>) -> bool {
    match node {
        TSType::TSUnionType(union) => union.types.iter().any(|node| accepts(node, value)),
        TSType::TSIntersectionType(intersection) => {
            intersection.types.iter().all(|node| accepts(node, value))
        }
        TSType::TSStringKeyword(_) => matches!(value, Scalar::String(_)),
        TSType::TSNumberKeyword(_) => matches!(value, Scalar::Number(number) if number.is_finite()),
        TSType::TSLiteralType(literal) => match (&literal.literal, value) {
            (TSLiteral::StringLiteral(literal), Scalar::String(value)) => literal.value == *value,
            (TSLiteral::NumericLiteral(literal), Scalar::Number(value)) => literal.value == *value,
            (TSLiteral::UnaryExpression(unary), Scalar::Number(value))
                if unary.operator == UnaryOperator::UnaryNegation =>
            {
                matches!(&unary.argument, Expression::NumericLiteral(literal) if -literal.value == *value)
            }
            _ => false,
        },
        TSType::TSTemplateLiteralType(template) => {
            let Scalar::String(input) = value else {
                return false;
            };

            matches(template, input, 0, 0)
        }
        _ => false,
    }
}

fn matches(
    template: &oxc_ast::ast::TSTemplateLiteralType<'_>,
    input: &str,
    index: usize,
    offset: usize,
) -> bool {
    let Some(quasi) = template.quasis.get(index) else {
        return false;
    };
    let text = quasi
        .value
        .cooked
        .as_ref()
        .unwrap_or(&quasi.value.raw)
        .as_str();

    if !input
        .get(offset..)
        .is_some_and(|rest| rest.starts_with(text))
    {
        return false;
    }

    let offset = offset + text.len();
    let Some(kind) = template.types.get(index) else {
        return offset == input.len();
    };

    (offset..=input.len())
        .filter(|end| input.is_char_boundary(*end))
        .any(|end| {
            let part = &input[offset..end];
            let number = js::to_number(part);
            let valid = accepts(kind, &Scalar::String(part))
                || (!js::trim(part).is_empty()
                    && number.is_finite()
                    && accepts(kind, &Scalar::Number(number)));

            valid && matches(template, input, index + 1, end)
        })
}
