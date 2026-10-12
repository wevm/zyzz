//! Extracts module-level stylesheet effects without evaluating application code.
//!
//! Stylesheet factories imported from `zyzz/web` are compile-time macros: each call becomes
//! ordered contribution data, and named definitions such as `keyframes` become references that
//! declarations and other contributions read by name.

use std::sync::Arc;

use indexmap::IndexMap;
use oxc_allocator::GetAddress;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    Argument, BindingPattern, CallExpression, Expression, ImportDeclarationSpecifier,
    ObjectPropertyKind, PropertyKey, PropertyKind, Statement, TemplateLiteral, UnaryOperator,
    VariableDeclarationKind, VariableDeclarator,
};
use oxc_ast_visit::Visit;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::compiler::internal::descriptors::{self, Descriptor};
use crate::compiler::internal::expression::{self, Template, unwrap};
use crate::compiler::internal::identifiers::{self, Separator};
use crate::compiler::internal::lightning::{self, Options};
use crate::compiler::internal::scope::{self, Declaration, Mode};
use crate::compiler::internal::syntax::Parsed;
use crate::compiler::internal::themes::{
    self, FunctionParameter, FunctionSignature, Link, LinkKind, TokenRead,
};
use crate::compiler::internal::{functions, keyframes, properties, statics};
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::generated::literal::LENGTH_UNITS;
use crate::internal::token::Part;
use crate::internal::{condition, function_syntax, identity, lexical, rule_reference, theme};
use crate::js::{self, Record, Utf16Index};
use crate::runtime::recipe as runtime;
use crate::style::{self, NamedStyle, Rule};
use crate::web::internal::block::Entry;
use crate::web::internal::contributions::{Definition, ImportLayer, Kind, Scalar};
use crate::web::internal::namespace;

/// A stylesheet factory exported by `zyzz/web`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Factory {
    /// `colorProfile`
    ColorProfile,
    /// `counterStyle`
    CounterStyle,
    /// `cssFunction`
    CssFunction,
    /// `customMedia`
    CustomMedia,
    /// `fontFace`
    FontFace,
    /// `fontFeatureValues`
    FontFeatureValues,
    /// `fontPaletteValues`
    FontPaletteValues,
    /// `global`
    Global,
    /// `importCss`
    ImportCss,
    /// `keyframes`
    Keyframes,
    /// `layers`
    Layers,
    /// `namespace`
    Namespace,
    /// `page`
    Page,
    /// `positionTry`
    PositionTry,
    /// `property`
    Property,
    /// `viewTransition`
    ViewTransition,
}

/// Factory export names in the order `Contributions.factories` lists them.
pub const FACTORIES: [&str; 16] = [
    "importCss",
    "namespace",
    "fontFace",
    "fontFeatureValues",
    "global",
    "layers",
    "page",
    "property",
    "viewTransition",
    "cssFunction",
    "customMedia",
    "colorProfile",
    "counterStyle",
    "fontPaletteValues",
    "keyframes",
    "positionTry",
];

impl Factory {
    /// Reads a factory export name.
    pub fn parse(name: &str) -> Option<Self> {
        Some(match name {
            "colorProfile" => Self::ColorProfile,
            "counterStyle" => Self::CounterStyle,
            "cssFunction" => Self::CssFunction,
            "customMedia" => Self::CustomMedia,
            "fontFace" => Self::FontFace,
            "fontFeatureValues" => Self::FontFeatureValues,
            "fontPaletteValues" => Self::FontPaletteValues,
            "global" => Self::Global,
            "importCss" => Self::ImportCss,
            "keyframes" => Self::Keyframes,
            "layers" => Self::Layers,
            "namespace" => Self::Namespace,
            "page" => Self::Page,
            "positionTry" => Self::PositionTry,
            "property" => Self::Property,
            "viewTransition" => Self::ViewTransition,
            _ => return None,
        })
    }

    /// The export name.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ColorProfile => "colorProfile",
            Self::CounterStyle => "counterStyle",
            Self::CssFunction => "cssFunction",
            Self::CustomMedia => "customMedia",
            Self::FontFace => "fontFace",
            Self::FontFeatureValues => "fontFeatureValues",
            Self::FontPaletteValues => "fontPaletteValues",
            Self::Global => "global",
            Self::ImportCss => "importCss",
            Self::Keyframes => "keyframes",
            Self::Layers => "layers",
            Self::Namespace => "namespace",
            Self::Page => "page",
            Self::PositionTry => "positionTry",
            Self::Property => "property",
            Self::ViewTransition => "viewTransition",
        }
    }

    /// Whether the factory defines a named rule that a module-level constant must bind.
    pub const fn named(self) -> bool {
        matches!(
            self,
            Self::ColorProfile
                | Self::CounterStyle
                | Self::CssFunction
                | Self::CustomMedia
                | Self::FontPaletteValues
                | Self::Keyframes
                | Self::PositionTry
        )
    }

    /// The rule kind declarations reference, for named factories other than `keyframes`.
    pub const fn reference(self) -> Option<rule_reference::Kind> {
        Some(match self {
            Self::ColorProfile => rule_reference::Kind::ColorProfile,
            Self::CounterStyle => rule_reference::Kind::CounterStyle,
            Self::CssFunction => rule_reference::Kind::CssFunction,
            Self::CustomMedia => rule_reference::Kind::CustomMedia,
            Self::FontPaletteValues => rule_reference::Kind::FontPaletteValues,
            Self::PositionTry => rule_reference::Kind::PositionTry,
            _ => return None,
        })
    }
}

/// A factory call that a rewriter replaces, with its rule name when it defines one.
///
/// Offsets are UTF-8 byte offsets into the module source.
#[derive(Clone, Debug)]
pub struct Call<'a> {
    /// The definition argument.
    pub argument: &'a Argument<'a>,
    /// Start of the constant that binds a named definition.
    pub binding: Option<u32>,
    /// The optional context argument.
    pub context: Option<&'a Argument<'a>>,
    /// Exclusive offset of the call.
    pub end: u32,
    /// Whether a named definition is exported.
    pub exported: bool,
    /// `@function` signature of a `cssFunction` definition, filled by literal extraction.
    pub function: Option<FunctionSignature>,
    /// The factory.
    pub kind: Factory,
    /// Compiler-owned rule name of a named definition.
    pub name: Option<Arc<str>>,
    /// Inclusive offset of the call.
    pub start: u32,
}

/// A `cssFunction` signature: the defining local call, whose signature literal extraction
/// fills, or the signature of a linked definition.
#[derive(Clone, Debug)]
enum Signature {
    Linked(Option<FunctionSignature>),
    Local(usize),
}

/// A `cssFunction` reference called with arguments.
struct FunctionInput<'a> {
    name: Arc<str>,
    node: &'a CallExpression<'a>,
    signature: Signature,
    values: Vec<Option<String>>,
}

/// A named rule a module-level name refers to, with the local call that defines it.
#[derive(Clone, Debug)]
struct Linked {
    call: Option<usize>,
    link: Link,
}

/// Stylesheet factory calls and the named-rule reads the extraction walk records.
pub struct Contributions<'a> {
    bindings: FxHashMap<u32, usize>,
    /// Factory calls in walk order.
    pub calls: Vec<Call<'a>>,
    exported: Record<Linked>,
    function_inputs: Vec<FunctionInput<'a>>,
    imported: FxHashMap<u32, Arc<str>>,
    /// Rule kinds of named references, by rule name.
    pub kinds: FxHashMap<Arc<str>, rule_reference::Kind>,
    linked: IndexMap<Arc<str>, Linked, FxBuildHasher>,
    namespace: Arc<str>,
    /// `@media` keys of custom media reads used as computed property keys, by key start.
    pub query_keys: FxHashMap<u32, Arc<str>>,
    /// Rule names and static `@function` invocations, by the start of the read.
    pub references: FxHashMap<u32, Arc<str>>,
    undefined_values: FxHashSet<u32>,
    used: FxHashSet<Arc<str>>,
}

#[cold]
fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

/// An empty theme definition, as `Theme.define({})` creates for each rule reference.
fn empty_definition() -> Result<Arc<theme::Definition>> {
    theme::define(&Data::from(Object::new()), None).map(Arc::new)
}

/// Spells a static `@function` invocation, bracing arguments that contain commas.
fn invocation(name: &str, values: &[String]) -> String {
    let mut output = String::with_capacity(name.len() + 2);

    output.push_str(name);
    output.push('(');

    for (index, value) in values.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        if value.contains(',') && !value.trim_start_matches(js::is_whitespace).starts_with('{') {
            output.push('{');
            output.push_str(value);
            output.push('}');
        } else {
            output.push_str(value);
        }
    }

    output.push(')');
    output
}

/// Reads a literal argument like `String(value)`, or `None` for other expressions.
fn scalar_argument(argument: &Argument<'_>) -> Option<String> {
    let input = unwrap(argument.as_expression()?);

    match input {
        Expression::StringLiteral(literal) => Some(literal.value.to_string()),
        Expression::NumericLiteral(literal) => Some(js::number(literal.value)),
        Expression::UnaryExpression(unary)
            if matches!(
                unary.operator,
                UnaryOperator::UnaryNegation | UnaryOperator::UnaryPlus
            ) =>
        {
            let Expression::NumericLiteral(literal) = &unary.argument else {
                return None;
            };

            Some(js::number(
                if unary.operator == UnaryOperator::UnaryNegation {
                    -literal.value
                } else {
                    literal.value
                },
            ))
        }
        _ => None,
    }
}

struct Scanner<'s, 'a> {
    ancestors: Vec<AstKind<'a>>,
    error: Option<Error>,
    imports: FxHashMap<u32, Factory>,
    parsed: &'s Parsed<'a>,
    result: Contributions<'a>,
}

impl<'a> Visit<'a> for Scanner<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        self.ancestors.push(kind);

        if self.error.is_some() {
            return;
        }

        if let Err(error) = self.enter(kind) {
            self.error = Some(error);
        }
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        self.ancestors.pop();
    }
}

impl<'a> Scanner<'_, 'a> {
    fn lookup(&self, name: &str, node: oxc_syntax::node::NodeId) -> Option<Declaration<'a>> {
        let semantic = &self.parsed.semantic;

        scope::lookup(semantic, name, scope::scope_of(semantic, node), Mode::Value)
    }

    /// The ancestor `back` levels above the current node, which is `back == 1`.
    fn at(&self, back: usize) -> Option<AstKind<'a>> {
        self.ancestors
            .len()
            .checked_sub(back)
            .and_then(|index| self.ancestors.get(index))
            .copied()
    }

    fn exported(&self) -> bool {
        self.ancestors
            .iter()
            .any(|ancestor| matches!(ancestor, AstKind::ExportDeclaration(_)))
    }

    fn enter(&mut self, kind: AstKind<'a>) -> Result<()> {
        match kind {
            AstKind::IdentifierReference(identifier)
                if identifier.name == "undefined"
                    && self.lookup("undefined", identifier.node_id()).is_none() =>
            {
                self.result.undefined_values.insert(identifier.span.start);
            }
            AstKind::VariableDeclarator(declarator) => self.alias(declarator)?,
            AstKind::CallExpression(call) => self.call(call)?,
            _ => {}
        }

        Ok(())
    }

    /// Records `const alias = rule` for a linked or local named rule.
    fn alias(&mut self, declarator: &'a VariableDeclarator<'a>) -> Result<()> {
        let (BindingPattern::BindingIdentifier(id), Some(init)) =
            (&declarator.id, &declarator.init)
        else {
            return Ok(());
        };
        let Expression::Identifier(init) = unwrap(init) else {
            return Ok(());
        };
        let Some(identity) = self
            .lookup(&init.name, init.node_id())
            .and_then(|declaration| self.result.imported.get(&declaration.start()))
            .cloned()
        else {
            return Ok(());
        };
        let Some(linked) = self
            .result
            .linked
            .values()
            .find(|linked| linked.link.call.name == identity)
            .cloned()
        else {
            return Ok(());
        };

        if !matches!(
            self.at(2),
            Some(AstKind::VariableDeclaration(variable))
                if variable.kind == VariableDeclarationKind::Const
        ) {
            return Err(invalid(
                "Animation aliases require const bindings.",
                declarator.span,
            ));
        }

        self.result
            .imported
            .insert(declarator.span.start, Arc::clone(&linked.link.call.name));

        if matches!(
            self.at(3),
            Some(AstKind::Program(_) | AstKind::ExportDeclaration(_))
        ) {
            self.result
                .linked
                .insert(Arc::from(id.name.as_str()), linked.clone());
        }

        if self.exported() {
            self.result
                .exported
                .insert(Arc::from(id.name.as_str()), linked);
        }

        Ok(())
    }

    fn call(&mut self, node: &'a CallExpression<'a>) -> Result<()> {
        let Expression::Identifier(callee) = &node.callee else {
            return Ok(());
        };
        let Some(factory) = self
            .lookup(&callee.name, callee.node_id())
            .filter(|declaration| declaration.kind == scope::Kind::Import)
            .and_then(|declaration| self.imports.get(&declaration.start()).copied())
        else {
            return Ok(());
        };
        let parent = self.at(2);
        let variable = match parent {
            Some(AstKind::VariableDeclarator(declarator))
                if declarator
                    .init
                    .as_ref()
                    .is_some_and(|init| matches!(init, Expression::CallExpression(call) if std::ptr::eq(call.as_ref(), node))) =>
            {
                Some(declarator)
            }
            _ => None,
        };
        let statement = if variable.is_some() {
            self.at(3)
        } else {
            parent
        };
        let arguments = node.arguments.len();
        let pair = factory.named()
            || matches!(
                factory,
                Factory::FontFace
                    | Factory::FontFeatureValues
                    | Factory::Page
                    | Factory::Property
                    | Factory::ViewTransition
            );
        let nested = self
            .ancestors
            .get(..self.ancestors.len().saturating_sub(1))
            .unwrap_or_default()
            .iter()
            .any(|ancestor| {
                !matches!(
                    ancestor,
                    AstKind::Program(_)
                        | AstKind::ExportDeclaration(_)
                        | AstKind::VariableDeclaration(_)
                        | AstKind::VariableDeclarator(_)
                        | AstKind::ExpressionStatement(_)
                )
            });
        let unbound = variable.is_some_and(|variable| {
            !matches!(
                statement,
                Some(AstKind::VariableDeclaration(declaration))
                    if declaration.kind == VariableDeclarationKind::Const
            ) || !matches!(variable.id, BindingPattern::BindingIdentifier(_))
        });

        if node.optional
            || (arguments != 1 && (!pair || arguments != 2))
            || (variable.is_none() && !matches!(parent, Some(AstKind::ExpressionStatement(_))))
            || nested
            || unbound
        {
            return Err(invalid(
                "Stylesheet contributions require direct module-level calls and constant named stylesheet bindings.",
                node.span,
            ));
        }

        if factory.named() && variable.is_none() {
            return Err(invalid(
                "Named stylesheet definitions require a module-level named constant.",
                node.span,
            ));
        }

        let context = node.arguments.get(1);
        let id = match context.and_then(Argument::as_expression) {
            Some(Expression::ObjectExpression(object)) => {
                object
                    .properties
                    .iter()
                    .find_map(|property| match property {
                        ObjectPropertyKind::ObjectProperty(property)
                            if !property.computed
                                && matches!(
                                    &property.key,
                                    PropertyKey::StaticIdentifier(key) if key.name == "id"
                                ) | matches!(
                                    &property.key,
                                    PropertyKey::StringLiteral(key) if key.value == "id"
                                ) =>
                        {
                            Some(property)
                        }
                        _ => None,
                    })
            }
            _ => None,
        };
        let explicit = match id {
            Some(property) => match &property.value {
                Expression::StringLiteral(literal) if !literal.value.is_empty() => {
                    Some(literal.value.as_str())
                }
                _ => {
                    return Err(invalid(
                        "Stylesheet ids must be nonempty string literals.",
                        node.span,
                    ));
                }
            },
            None => None,
        };
        let binding = variable.and_then(|variable| match &variable.id {
            BindingPattern::BindingIdentifier(id) => Some((variable, id)),
            _ => None,
        });
        let name = match (explicit, binding) {
            (Some(explicit), _) => Some(identity::contribution(factory.as_str(), Some(explicit))?),
            (None, Some((_, id))) => Some(match factory {
                Factory::Keyframes => format!("z-k-{}", identity::name(&id.name)),
                Factory::CounterStyle => format!(
                    "z-{}-{}",
                    factory.as_str().to_ascii_lowercase(),
                    identity::name(&id.name)
                ),
                _ => format!(
                    "--z-{}-{}",
                    factory.as_str().to_ascii_lowercase(),
                    identity::name(&id.name)
                ),
            }),
            (None, None) => None,
        }
        .map(Arc::<str>::from);
        let Some(argument) = node.arguments.first() else {
            return Ok(());
        };
        let named = factory.named().then_some(()).and(binding);
        let index = self.result.calls.len();

        self.result.calls.push(Call {
            argument,
            binding: named.map(|(variable, _)| variable.span.start),
            context,
            end: node.span.end,
            exported: named.is_some() && self.exported(),
            function: (factory == Factory::CssFunction).then(|| FunctionSignature {
                parameters: Vec::new(),
                returns: Arc::from("*"),
            }),
            kind: factory,
            name: named.and(name.clone()),
            start: node.span.start,
        });

        let Some(((variable, id), name)) = named.zip(name) else {
            return Ok(());
        };
        let call = self.result.calls.get(index);
        let link = Link {
            binding: Arc::clone(&name),
            call: themes::Call {
                end: node.span.end,
                function: call.and_then(|call| call.function.clone()),
                name: Arc::clone(&name),
                reference: factory.reference(),
                start: node.span.start,
                token_type: Arc::from("{}"),
                ..themes::Call::default()
            },
            definition: empty_definition()?,
            kind: if factory == Factory::Keyframes {
                LinkKind::Animation
            } else {
                LinkKind::RuleReference
            },
            members: None,
            style: None,
        };
        let linked = Linked {
            call: Some(index),
            link,
        };
        let exported = call.is_some_and(|call| call.exported);

        self.result
            .imported
            .insert(variable.span.start, Arc::clone(&name));
        self.result
            .linked
            .insert(Arc::from(id.name.as_str()), linked.clone());

        if exported {
            self.result
                .exported
                .insert(Arc::from(id.name.as_str()), linked);
        }

        self.result.bindings.insert(variable.span.start, index);

        Ok(())
    }
}

/// Collects stylesheet factory calls and named-rule aliases.
///
/// `factories` maps local names of factories imported through source barrels to their export
/// names.
///
/// # Errors
///
/// Returns `Themes.InvalidError` for factory calls outside module-level statements and constant
/// bindings, named definitions without a constant, invalid ids, and non-constant aliases.
pub fn scan<'a>(
    parsed: &Parsed<'a>,
    namespace: &str,
    links: &Record<Link>,
    factories: Option<&Record<Arc<str>>>,
) -> Result<Contributions<'a>> {
    let program = parsed.program;
    let mut imports: FxHashMap<u32, Factory> = FxHashMap::default();
    let mut result = Contributions {
        bindings: FxHashMap::default(),
        calls: Vec::new(),
        exported: Record::new(),
        function_inputs: Vec::new(),
        imported: FxHashMap::default(),
        kinds: FxHashMap::default(),
        linked: IndexMap::default(),
        namespace: Arc::from(namespace),
        query_keys: FxHashMap::default(),
        references: FxHashMap::default(),
        undefined_values: FxHashSet::default(),
        used: FxHashSet::default(),
    };

    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };

        for specifier in import.specifiers.iter().flatten() {
            if let ImportDeclarationSpecifier::ImportSpecifier(named) = specifier
                && !import.import_kind.is_type()
                && !named.import_kind.is_type()
            {
                let name = if import.source.value == "zyzz/web" {
                    Some(named.imported.name().as_str())
                } else {
                    factories
                        .and_then(|factories| factories.get(named.local.name.as_str()))
                        .map(|name| &**name)
                };

                if let Some(factory) = name.and_then(Factory::parse) {
                    imports.insert(named.span.start, factory);
                }
            }

            let local = specifier.local().name.as_str();

            if let Some(link) = links.get(local)
                && matches!(link.kind, LinkKind::Animation | LinkKind::RuleReference)
            {
                result
                    .imported
                    .insert(specifier.span().start, Arc::clone(&link.call.name));
                result.linked.insert(
                    Arc::from(local),
                    Linked {
                        call: None,
                        link: link.clone(),
                    },
                );
            }
        }
    }

    if !imports.is_empty() || !result.imported.is_empty() {
        let mut scanner = Scanner {
            ancestors: Vec::new(),
            error: None,
            imports,
            parsed,
            result,
        };

        scanner.visit_program(program);

        if let Some(error) = scanner.error {
            return Err(error);
        }

        result = scanner.result;
    }

    for statement in &program.body {
        match statement {
            Statement::ExportDefaultDeclaration(export) => {
                let linked = match export.declaration.as_expression().map(unwrap) {
                    Some(Expression::Identifier(identifier)) => {
                        result.linked.get(identifier.name.as_str()).cloned()
                    }
                    _ => None,
                };

                if let Some(linked) = linked {
                    result.used.insert(Arc::clone(&linked.link.call.name));
                    result.exported.insert("default", linked);
                }
            }
            Statement::ExportNamedDeclaration(export) if !export.export_kind.is_type() => {
                for specifier in &export.specifiers {
                    if specifier.export_kind.is_type() {
                        continue;
                    }

                    let Some(linked) = result.linked.get(specifier.local.name().as_str()).cloned()
                    else {
                        continue;
                    };

                    result.used.insert(Arc::clone(&linked.link.call.name));
                    result
                        .exported
                        .insert(specifier.exported.name().as_str(), linked);
                }
            }
            _ => {}
        }
    }

    for linked in result.linked.values() {
        if let Some(kind) = linked.link.call.reference {
            result
                .kinds
                .insert(Arc::clone(&linked.link.call.name), kind);
        }
    }

    Ok(result)
}

impl<'a> Contributions<'a> {
    /// Exported named rules, by exported name, with `@function` signatures as extraction filled
    /// them.
    pub fn exports(&self) -> Record<Link> {
        self.exported
            .iter()
            .map(|(name, linked)| (Arc::clone(name), self.link(linked)))
            .collect()
    }

    fn link(&self, linked: &Linked) -> Link {
        let mut link = linked.link.clone();

        if let Some(call) = linked.call.and_then(|index| self.calls.get(index)) {
            link.call.function.clone_from(&call.function);
        }

        link
    }

    fn signature(&self, signature: &Signature) -> Option<FunctionSignature> {
        match signature {
            Signature::Linked(signature) => signature.clone(),
            Signature::Local(index) => self
                .calls
                .get(*index)
                .and_then(|call| call.function.clone()),
        }
    }

    /// Records a read of a named rule during the extraction walk.
    ///
    /// `node` is a reference identifier, `parent` its parent node, and `binding` its declaration.
    pub fn read(
        &mut self,
        node: AstKind<'a>,
        parent: Option<AstKind<'a>>,
        binding: Option<&Declaration<'a>>,
    ) {
        let start = node.span().start;

        if let Some(binding) = binding
            && matches!(binding.kind, scope::Kind::Import | scope::Kind::Variable)
            && let Some(name) = self.imported.get(&binding.start()).cloned()
        {
            let linked = self
                .linked
                .values()
                .find(|linked| linked.link.call.name == name)
                .cloned();
            let reference = linked
                .as_ref()
                .and_then(|linked| linked.link.call.reference);

            self.references.insert(start, Arc::clone(&name));

            if reference == Some(rule_reference::Kind::CustomMedia) {
                self.query_keys
                    .insert(start, Arc::from(format!("@media ({name})")));
            }

            if reference == Some(rule_reference::Kind::CssFunction)
                && let Some(AstKind::CallExpression(call)) = parent
                && call.callee.address() == node.address()
            {
                // A call and its callee share their start offset. Never keep the bare name
                // when an argument cannot be serialized as a static CSS expression.
                self.references.remove(&start);

                let values: Vec<Option<String>> =
                    call.arguments.iter().map(scalar_argument).collect();

                if let Some(linked) = &linked
                    && linked.link.call.function.is_some()
                {
                    self.function_inputs.push(FunctionInput {
                        name: Arc::clone(&name),
                        node: call,
                        signature: match linked.call {
                            Some(index) => Signature::Local(index),
                            None => Signature::Linked(linked.link.call.function.clone()),
                        },
                        values: values.clone(),
                    });
                }

                if let Some(values) = values.into_iter().collect::<Option<Vec<_>>>() {
                    self.references
                        .insert(call.span.start, Arc::from(invocation(&name, &values)));
                }
            }

            self.used.insert(name);

            return;
        }

        let Some(binding) = binding.filter(|binding| binding.kind == scope::Kind::Variable) else {
            return;
        };
        let Some(name) = self
            .bindings
            .get(&binding.start())
            .and_then(|index| self.calls.get(*index))
            .and_then(|call| call.name.clone())
        else {
            return;
        };

        if let Some(AstKind::VariableDeclarator(declarator)) = parent
            && declarator.id.address() == node.address()
        {
            return;
        }

        self.references.insert(start, Arc::clone(&name));
        self.used.insert(name);
    }

    /// Resolves nested static `@function` invocations after the extraction walk.
    pub fn resolve(&mut self) {
        for index in (0..self.function_inputs.len()).rev() {
            let Some(input) = self.function_inputs.get(index) else {
                continue;
            };
            let values: Vec<Option<String>> = input
                .values
                .iter()
                .enumerate()
                .map(|(position, value)| {
                    value.clone().or_else(|| {
                        match input
                            .node
                            .arguments
                            .get(position)
                            .and_then(Argument::as_expression)
                            .map(unwrap)
                        {
                            Some(Expression::CallExpression(call)) => self
                                .references
                                .get(&call.span.start)
                                .map(ToString::to_string),
                            _ => None,
                        }
                    })
                })
                .collect();
            let complete = values.iter().cloned().collect::<Option<Vec<_>>>();
            let start = input.node.span.start;
            let name = Arc::clone(&input.name);

            if let Some(input) = self.function_inputs.get_mut(index) {
                input.values = values;
            }

            if let Some(values) = complete {
                self.references
                    .insert(start, Arc::from(invocation(&name, &values)));
            }
        }
    }
}

/// Token reads of the module, by the start of the read.
pub type Tokens = IndexMap<u32, TokenRead, FxBuildHasher>;

const MARGINS: [&str; 16] = [
    "@top-left-corner",
    "@top-left",
    "@top-center",
    "@top-right",
    "@top-right-corner",
    "@bottom-left-corner",
    "@bottom-left",
    "@bottom-center",
    "@bottom-right",
    "@bottom-right-corner",
    "@left-top",
    "@left-middle",
    "@left-bottom",
    "@right-top",
    "@right-middle",
    "@right-bottom",
];

const PAGE_PROPERTIES: [&str; 20] = [
    "color",
    "counterIncrement",
    "counterReset",
    "direction",
    "height",
    "letterSpacing",
    "lineHeight",
    "maxHeight",
    "maxWidth",
    "minHeight",
    "minWidth",
    "quotes",
    "textAlign",
    "textDecoration",
    "textIndent",
    "textTransform",
    "visibility",
    "whiteSpace",
    "width",
    "wordSpacing",
];

const POSITION_TRY: [&str; 39] = [
    "alignSelf",
    "blockSize",
    "bottom",
    "height",
    "inlineSize",
    "inset",
    "insetBlock",
    "insetBlockEnd",
    "insetBlockStart",
    "insetInline",
    "insetInlineEnd",
    "insetInlineStart",
    "justifySelf",
    "left",
    "margin",
    "marginBlock",
    "marginBlockEnd",
    "marginBlockStart",
    "marginBottom",
    "marginInline",
    "marginInlineEnd",
    "marginInlineStart",
    "marginLeft",
    "marginRight",
    "marginTop",
    "maxBlockSize",
    "maxHeight",
    "maxInlineSize",
    "maxWidth",
    "minBlockSize",
    "minHeight",
    "minInlineSize",
    "minWidth",
    "placeSelf",
    "positionAnchor",
    "positionArea",
    "right",
    "top",
    "width",
];

const FONT_FACE: [&str; 13] = [
    "fontFeatureSettings",
    "fontVariationSettings",
    "fontFamily",
    "src",
    "fontDisplay",
    "fontStyle",
    "fontWeight",
    "fontStretch",
    "unicodeRange",
    "sizeAdjust",
    "ascentOverride",
    "descentOverride",
    "lineGapOverride",
];

const RESERVED: [&str; 6] = [
    "default",
    "inherit",
    "initial",
    "revert",
    "revert-layer",
    "unset",
];

/// Evaluates contribution literals through static bindings without executing code.
struct Evaluator<'s, 'a> {
    resolve: &'s dyn Fn(&'a Expression<'a>) -> Result<&'a Expression<'a>>,
    scanned: &'s Contributions<'a>,
    tokens: &'s Tokens,
}

impl<'a> Evaluator<'_, 'a> {
    fn argument(&self, argument: &'a Argument<'a>) -> Result<Data> {
        match argument.as_expression() {
            Some(expression) => self.value(expression, None),
            None => Err(invalid(
                "Stylesheet contributions require literal data.",
                argument.span(),
            )),
        }
    }

    fn value(&self, node: &'a Expression<'a>, property: Option<&str>) -> Result<Data> {
        let span = node.span();

        if let Some(token) = self.tokens.get(&span.start)
            && token.end == span.end
        {
            return Ok(Data::Token(Arc::clone(&token.reference)));
        }

        let node = unwrap((self.resolve)(node)?);
        let start = node.span().start;

        if let Some(name) = self.scanned.references.get(&start) {
            return Ok(Data::String(Arc::clone(name)));
        }

        if self.scanned.undefined_values.contains(&start) {
            return Ok(Data::Undefined);
        }

        match node {
            Expression::UnaryExpression(unary)
                if unary.operator == UnaryOperator::Void
                    && statics::is_literal(unwrap(&unary.argument)) =>
            {
                return Ok(Data::Undefined);
            }
            Expression::StringLiteral(literal) => return Ok(Data::string(literal.value.as_str())),
            Expression::NumericLiteral(literal) => return Ok(Data::Number(literal.value)),
            Expression::BooleanLiteral(literal) => return Ok(Data::Bool(literal.value)),
            Expression::UnaryExpression(unary)
                if matches!(
                    unary.operator,
                    UnaryOperator::UnaryNegation | UnaryOperator::UnaryPlus
                ) =>
            {
                if let Expression::NumericLiteral(literal) = &unary.argument {
                    return Ok(Data::Number(
                        if unary.operator == UnaryOperator::UnaryNegation {
                            -literal.value
                        } else {
                            literal.value
                        },
                    ));
                }
            }
            Expression::TemplateLiteral(template) => {
                if let Some(value) = self.template(template, property)? {
                    return Ok(value);
                }
            }
            _ => {}
        }

        if let Expression::ArrayExpression(array) = node {
            let mut values = Vec::with_capacity(array.elements.len());

            for element in &array.elements {
                let Some(element) = element.as_expression() else {
                    return Err(invalid(
                        "Contribution arrays require dense literal entries.",
                        array.span,
                    ));
                };

                values.push(self.value(element, property)?);
            }

            return Ok(Data::Array(Arc::new(values)));
        }

        let Expression::ObjectExpression(object) = node else {
            return Err(invalid(
                "Stylesheet contributions require literal data.",
                node.span(),
            ));
        };
        let mut output = Object::new();

        for property in &object.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                return Err(invalid(
                    "Contribution objects require explicit literal properties.",
                    property.span(),
                ));
            };
            let start = property.key.span().start;

            if (property.computed && !self.scanned.query_keys.contains_key(&start))
                || property.shorthand
                || property.method
                || property.kind != PropertyKind::Init
            {
                return Err(invalid(
                    "Contribution objects require explicit literal properties.",
                    property.span,
                ));
            }

            let key = self
                .scanned
                .query_keys
                .get(&start)
                .map(ToString::to_string)
                .or_else(|| match &property.key {
                    PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.to_string()),
                    PropertyKey::StringLiteral(literal) => Some(literal.value.to_string()),
                    _ => None,
                });
            let Some(key) = key.filter(|key| !output.has(key)) else {
                return Err(invalid(
                    "Contribution keys must be unique literal strings.",
                    property.span,
                ));
            };
            let item = unwrap(&property.value);

            if let Some(kind) = self
                .scanned
                .references
                .get(&item.span().start)
                .and_then(|name| self.scanned.kinds.get(name))
                && !rule_reference::accepts(*kind, &key)
            {
                return Err(invalid(
                    "Named stylesheet reference is incompatible with this descriptor.",
                    item.span(),
                ));
            }

            let value = self.value(&property.value, Some(&key))?;

            output.insert(key, value);
        }

        Ok(Data::from(output))
    }

    fn template(
        &self,
        node: &'a TemplateLiteral<'a>,
        property: Option<&str>,
    ) -> Result<Option<Data>> {
        let mut error: Option<Error> = None;
        let template = expression::template(
            node,
            0,
            &mut |expression, prefix| {
                if error.is_some() {
                    return None;
                }

                let node = match (self.resolve)(expression) {
                    Ok(node) => unwrap(node),
                    Err(failure) => {
                        error = Some(failure);
                        return None;
                    }
                };

                if let Expression::StringLiteral(literal) = node {
                    // An empty string is falsy, so it never stands as a reference.
                    return (!literal.value.is_empty())
                        .then(|| Part::Text(Arc::from(literal.value.as_str())));
                }

                let start = node.span().start;
                let name = self.scanned.references.get(&start);

                if let (Some(kind), Some(property)) =
                    (name.and_then(|name| self.scanned.kinds.get(name)), property)
                    && !rule_reference::accepts_expression(*kind, property, prefix)
                {
                    error = Some(invalid(
                        "Named stylesheet reference is incompatible with this descriptor.",
                        node.span(),
                    ));
                    return None;
                }

                match name {
                    Some(name) => Some(Part::Text(Arc::clone(name))),
                    None => self
                        .tokens
                        .get(&start)
                        .map(|token| Part::Reference(Arc::clone(&token.reference))),
                }
            },
            "",
        );

        if let Some(error) = error {
            return Err(error);
        }

        Ok(template.map(|template| match template {
            Template::Text(text) => Data::String(text.into()),
            Template::Expression(expression) => Data::Expression(expression),
        }))
    }
}

fn record(value: &Data) -> std::result::Result<&Object, String> {
    value
        .as_object()
        .ok_or_else(|| "Expected a contribution object.".to_owned())
}

/// Validates one declaration block as `Style.define({ contribution })` does.
fn style(value: &Data) -> std::result::Result<Arc<NamedStyle>, String> {
    record(value)?;

    let mut wrapper = Object::new();

    wrapper.insert("contribution", value.clone());

    let definition = style::define(&Data::from(wrapper), &style::Options::default())
        .map_err(|error| error.text())?;

    definition
        .styles
        .into_iter()
        .next()
        .ok_or_else(|| "Expected a contribution object.".to_owned())
}

/// Whether a key opens `@media`, `@supports`, `@container`, or `@layer` followed by a
/// separator, as `/^@(media|supports|container|layer)(?=[\t\n\r\f (/])/` matches.
fn group(key: &str, names: &[&str]) -> bool {
    names.iter().any(|name| {
        key.strip_prefix('@')
            .and_then(|rest| rest.strip_prefix(name))
            .and_then(|rest| rest.bytes().next())
            .is_some_and(|byte| matches!(byte, b'\t' | b'\n' | b'\r' | 0x0c | b' ' | b'(' | b'/'))
    })
}

/// Whether a global selector key opens a grouping rule, validating its condition.
fn grouping(selector: &str) -> std::result::Result<bool, String> {
    if !selector.starts_with('@') {
        return Ok(false);
    }

    if !condition::is(selector) {
        return Err("Expected a selector or supported grouping rule.".to_owned());
    }

    if group(selector, &["container"]) && !selector.contains('(') {
        return Err("Container rules require a query after the optional name.".to_owned());
    }

    condition::normalize(selector).map_err(|error| error.text())?;

    Ok(true)
}

fn global(input: &Data) -> std::result::Result<Arc<NamedStyle>, String> {
    let mut rules = Vec::new();

    for (selector, child) in record(input)?.iter() {
        let style = if grouping(selector)? {
            global(child)?
        } else {
            style(child)?
        };

        rules.push(Rule {
            condition: Some(Arc::clone(selector)),
            style,
        });
    }

    Ok(Arc::new(NamedStyle {
        declarations: Vec::new(),
        name: Arc::from("global"),
        rules: Some(rules),
        ..NamedStyle::default()
    }))
}

/// Splits nested `@media`, `@supports`, `@container`, and `@layer` groups from descriptors.
///
/// A complete descriptor block occupies its first descriptor's authored position.
/// A descriptor block and its enclosing group headers, outermost first.
type Grouped = (Data, Vec<Arc<str>>);

fn definitions(input: &Data, headers: &[Arc<str>]) -> std::result::Result<Vec<Grouped>, String> {
    let entries = record(input)?;
    let groups =
        |key: &str| key == "@layer" || group(key, &["media", "supports", "container", "layer"]);
    let mut body = Object::new();

    for (key, value) in entries.iter() {
        if !groups(key) {
            body.insert(Arc::clone(key), value.clone());
        }
    }

    let body = Data::from(body);

    if entries.is_empty() {
        return Ok(vec![(body, headers.to_vec())]);
    }

    let first = entries.iter().map(|(key, _)| key).find(|key| !groups(key));
    let mut result = Vec::new();

    for (header, child) in entries.iter() {
        if groups(header) {
            let mut nested = headers.to_vec();

            nested.push(Arc::from(
                condition::normalize(header).map_err(|error| error.text())?,
            ));
            result.extend(definitions(child, &nested)?);
        } else if first == Some(header) {
            result.push((body.clone(), headers.to_vec()));
        }
    }

    Ok(result)
}

/// Converts camelCase to kebab-case, as `.replace(/[A-Z]/g, (letter) => `-${letter}`)` does.
fn kebab(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 4);

    for character in value.chars() {
        if character.is_ascii_uppercase() {
            output.push('-');
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
    }

    output
}

fn scalar(value: &Data) -> Option<Scalar> {
    match value {
        Data::Number(number) => Some(Scalar::Number(*number)),
        Data::String(text) => Some(Scalar::String(Arc::clone(text))),
        _ => None,
    }
}

/// Whether a value is a nonnegative safe integer.
fn index(value: &Data) -> bool {
    value.as_number().is_some_and(|value| {
        value >= 0.0 && value.fract() == 0.0 && value <= 9_007_199_254_740_991.0
    })
}

/// Whether a string is a dashed identifier with a name.
fn dashed(value: &str) -> bool {
    identifiers::read(value).is_some_and(|name| name.starts_with("--") && js::utf16_len(&name) > 2)
}

/// Whether a value is one CSS identifier other than a CSS-wide keyword, allowing non-ASCII code
/// points and escapes.
fn identifier(value: &str) -> bool {
    let mut characters = value.chars().peekable();
    let mut decoded = String::with_capacity(value.len());
    let mut first = true;

    if value.starts_with("--") {
        characters.next();
        characters.next();
        decoded.push_str("--");
        first = false;
    } else if value.starts_with('-') {
        characters.next();
        decoded.push('-');
    }

    if first && characters.peek().is_none() {
        return false;
    }

    while let Some(character) = characters.next() {
        let start = first;

        first = false;

        if character == '\\' {
            let Some(&next) = characters.peek() else {
                return false;
            };

            if matches!(next, '\n' | '\r' | '\u{c}') {
                return false;
            }

            if next.is_ascii_hexdigit() {
                let mut hex = String::new();

                while hex.len() < 6
                    && let Some(&digit) = characters.peek()
                    && digit.is_ascii_hexdigit()
                {
                    hex.push(digit);
                    characters.next();
                }

                if characters.peek() == Some(&'\r') {
                    characters.next();

                    if characters.peek() == Some(&'\n') {
                        characters.next();
                    }
                } else if matches!(characters.peek(), Some(' ' | '\t' | '\n' | '\u{c}')) {
                    characters.next();
                }

                let code = u32::from_str_radix(&hex, 16).unwrap_or(0).min(0x10_ffff);

                decoded.push(char::from_u32(code).unwrap_or('\u{fffd}'));
            } else {
                characters.next();
                decoded.push(next);
            }

            continue;
        }

        let valid = character == '_'
            || character.is_ascii_alphabetic()
            || u32::from(character) >= 0x80
            || (!start && (character.is_ascii_digit() || character == '-'));

        if !valid {
            return false;
        }

        decoded.push(character);
    }

    !RESERVED.contains(&decoded.to_ascii_lowercase().as_str())
}

/// Checks one descriptor grammar, as `Descriptors.check` does.
fn check_descriptor(rule: &str, name: &str, value: &str) -> std::result::Result<(), String> {
    descriptors::check(&Descriptor { name, rule, value }).map_err(|error| error.text())
}

/// The text after the numeric prefix that
/// `/^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?(.+)$/` captures, trying alternatives in the
/// regular expression's backtracking order.
fn numeric_suffix(text: &str) -> Option<&str> {
    let bytes = text.as_bytes();
    let sign = usize::from(matches!(bytes.first(), Some(b'+' | b'-')));
    let digits = |from: usize| {
        bytes
            .get(from..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count()
    };
    // The capture cannot cross a line terminator, and no numeric prefix contains one.
    let rest = |at: usize| {
        text.get(at..).filter(|rest| {
            !rest.is_empty()
                && !rest
                    .chars()
                    .any(|character| matches!(character, '\n' | '\r' | '\u{2028}' | '\u{2029}'))
        })
    };
    // Exponent alternatives at a position, longest first, then no exponent.
    let exponents = |at: usize| -> Option<&str> {
        if matches!(bytes.get(at), Some(b'e' | b'E')) {
            let sign = usize::from(matches!(bytes.get(at + 1), Some(b'+' | b'-')));
            let count = digits(at + 1 + sign);

            for length in (1..=count).rev() {
                if let Some(rest) = rest(at + 1 + sign + length) {
                    return Some(rest);
                }
            }
        }

        rest(at)
    };
    let whole = digits(sign);

    if bytes.get(sign + whole) == Some(&b'.') {
        let fraction = digits(sign + whole + 1);

        for length in (1..=fraction).rev() {
            let end = sign + whole + 1 + length;
            let found = if length == fraction {
                exponents(end)
            } else {
                rest(end)
            };

            if found.is_some() {
                return found;
            }
        }
    }

    for length in (1..=whole).rev() {
        let end = sign + length;
        let found = if length == whole {
            exponents(end)
        } else {
            rest(end)
        };

        if found.is_some() {
            return found;
        }
    }

    None
}

/// Whether a numeric argument of an integer-only parameter is not an integer token.
fn non_integer(syntax: &str, value: &str) -> bool {
    let text = js::trim(value);

    if (syntax.contains('+') && text.chars().any(js::is_whitespace))
        || (syntax.contains('#') && text.contains(','))
    {
        return false;
    }

    let unsigned = text.strip_prefix(['+', '-']).unwrap_or(text);
    let numeric = unsigned.as_bytes().first().is_some_and(u8::is_ascii_digit)
        || (unsigned.starts_with('.')
            && unsigned.as_bytes().get(1).is_some_and(u8::is_ascii_digit));

    if !numeric || (!unsigned.is_empty() && unsigned.bytes().all(|byte| byte.is_ascii_digit())) {
        return false;
    }

    let unit = numeric_suffix(text).and_then(|suffix| {
        if suffix == "%" {
            Some("%".to_owned())
        } else {
            identifiers::read(suffix).map(|unit| unit.to_ascii_lowercase())
        }
    });
    let Some(unit) = unit.filter(|unit| !unit.is_empty()) else {
        return true;
    };
    let normalized = js::trim(syntax);
    let body = if normalized.starts_with("type(") {
        js::slice(normalized, 5, js::utf16_len(normalized).saturating_sub(1))
    } else {
        normalized
    };

    !body
        .split('|')
        .map(js::trim)
        .any(|alternative| match alternative {
            "<percentage>" => unit == "%",
            "<length-percentage>" if unit == "%" => true,
            "<length>" | "<length-percentage>" => LENGTH_UNITS.contains(&unit.as_str()),
            "<angle>" => matches!(unit.as_str(), "deg" | "grad" | "rad" | "turn"),
            "<time>" => matches!(unit.as_str(), "s" | "ms"),
            "<resolution>" => matches!(unit.as_str(), "dpi" | "dpcm" | "dppx" | "x"),
            _ => false,
        })
}

/// Quotes a font family as a CSS string, escaping control characters, quotes, and backslashes.
fn family(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 2);

    output.push('"');

    for character in value.chars() {
        let code = u32::from(character);

        if code < 32 || code == 127 || character == '"' || character == '\\' {
            output.push('\\');
            output.push_str(&js::radix(u64::from(code), 16));
            output.push(' ');
        } else {
            output.push(character);
        }
    }

    output.push('"');
    output
}

/// Reads the scalar entries of a descriptor record.
fn descriptors(declarations: &Object) -> Vec<(Arc<str>, Scalar)> {
    declarations
        .iter()
        .filter_map(|(key, value)| scalar(value).map(|value| (Arc::clone(key), value)))
        .collect()
}

/// The JSON key of a `cssFunction` signature, as `JSON.stringify` spells it.
fn signature_key(
    parameters: &[Data],
    returns: Option<&Data>,
) -> std::result::Result<String, String> {
    let value = |data: Option<&Data>| match data {
        Some(Data::String(text)) => js::Value::String(text.to_string()),
        Some(Data::Number(number)) if number.is_finite() => js::Value::Number(*number),
        Some(Data::Bool(value)) => js::Value::Bool(*value),
        _ => js::Value::Null,
    };
    let mut list = Vec::with_capacity(parameters.len());

    for parameter in parameters {
        let parameter = record(parameter)?;
        let syntax = match parameter.get("syntax") {
            None | Some(Data::Undefined) => js::Value::from("*"),
            syntax => value(syntax),
        };

        list.push(js::Value::Array(vec![
            value(parameter.get("name")),
            syntax,
            value(parameter.get("default")),
        ]));
    }

    let mut object = js::Object::new();

    object.insert("parameters", js::Value::Array(list));
    object.insert(
        "returns",
        match returns {
            None | Some(Data::Undefined) => js::Value::from("*"),
            returns => value(returns),
        },
    );

    Ok(js::stringify(&js::Value::Object(object)))
}

/// Whether a record has only the listed keys.
fn only(object: &Object, keys: &[&str]) -> bool {
    object.keys().all(|key| keys.contains(&&**key))
}

/// A present property: one that is neither absent nor `undefined`.
fn present<'d>(object: &'d Object, key: &str) -> Option<&'d Data> {
    object.get(key).filter(|value| !value.is_undefined())
}

struct Extraction<'s, 'a> {
    call: usize,
    evaluator: Evaluator<'s, 'a>,
    function: Option<FunctionSignature>,
    namespace: &'s str,
    offsets: &'s Utf16Index,
    signature: Option<String>,
}

impl Extraction<'_, '_> {
    fn input(
        &mut self,
        call: &Call<'_>,
        input: &Data,
        result: &mut Vec<Kind>,
    ) -> std::result::Result<(), String> {
        let name = || call.name.clone().unwrap_or_else(|| Arc::from(""));

        match call.kind {
            Factory::ImportCss => {
                let options = record(input)?;
                let invalid = !only(options, &["layer", "media", "supports", "url"])
                    || !matches!(options.get("url"), Some(Data::String(_)))
                    || options.iter().any(|(key, value)| {
                        let allowed = value.is_undefined()
                            || matches!(value, Data::String(_))
                            || (&**key == "layer" && matches!(value, Data::Bool(true)));

                        &**key != "url" && !allowed
                    });

                if invalid {
                    return Err(
                        "Expected a stylesheet URL and static import conditions.".to_owned()
                    );
                }

                let text = |key: &str| present(options, key).and_then(Data::as_str).map(Arc::from);

                result.push(Kind::Import {
                    layer: present(options, "layer").map(|layer| match layer {
                        Data::String(name) => ImportLayer::Named(Arc::clone(name)),
                        _ => ImportLayer::Anonymous,
                    }),
                    media: text("media"),
                    supports: text("supports"),
                    url: text("url").unwrap_or_else(|| Arc::from("")),
                });
            }
            Factory::Namespace => {
                let options = record(input)?;
                let prefix = present(options, "prefix");
                let invalid = !only(options, &["prefix", "uri"])
                    || !matches!(options.get("uri"), Some(Data::String(_)))
                    || prefix.is_some_and(|prefix| {
                        prefix
                            .as_str()
                            .is_none_or(|prefix| identifiers::read(prefix).is_none())
                    });

                if invalid {
                    return Err(
                        "Expected a namespace URI and optional identifier prefix.".to_owned()
                    );
                }

                result.push(Kind::Namespace(namespace::Definition {
                    name: Arc::from(format!(
                        "z-n{}-{}",
                        self.namespace,
                        js::radix(u64::from(self.offsets.utf16(call.start)), 36)
                    )),
                    prefix: prefix.and_then(Data::as_str).map(Arc::from),
                    uri: options
                        .get("uri")
                        .and_then(Data::as_str)
                        .map_or_else(|| Arc::from(""), Arc::from),
                }));
            }
            Factory::CustomMedia => {
                let query: Arc<str> = match input {
                    Data::String(query) => {
                        descriptors::media(query).map_err(|error| error.text())?;
                        Arc::clone(query)
                    }
                    Data::Bool(value) => Arc::from(if *value { "true" } else { "false" }),
                    _ => return Err("Expected a media query or boolean.".to_owned()),
                };

                result.push(Kind::CustomMedia {
                    name: name(),
                    query,
                });
            }
            Factory::CssFunction => self.function(call, input, result)?,
            Factory::Layers => {
                let names = match input {
                    Data::Array(values) => values
                        .iter()
                        .map(|value| value.as_str().map(Arc::from))
                        .collect::<Option<Vec<_>>>(),
                    _ => None,
                };
                let Some(names) = names else {
                    return Err("Layers require a literal string list.".to_owned());
                };

                result.push(Kind::Layers { names });
            }
            Factory::Global => {
                for (selector, child) in record(input)?.iter() {
                    let style = if grouping(selector)? {
                        global(child)?
                    } else {
                        style(child)?
                    };

                    result.push(Kind::Rule {
                        selector: Arc::clone(selector),
                        style,
                    });
                }
            }
            Factory::FontFace => {
                let mut declarations = record(input)?.clone();
                let removed: Vec<Arc<str>> = declarations
                    .iter()
                    .filter(|(key, value)| {
                        value.is_undefined() && &***key != "fontFamily" && &***key != "src"
                    })
                    .map(|(key, _)| Arc::clone(key))
                    .collect();

                for key in &removed {
                    declarations.remove(key);
                }

                let invalid = !matches!(declarations.get("fontFamily"), Some(Data::String(_)))
                    || !matches!(declarations.get("src"), Some(Data::String(_)))
                    || declarations.iter().any(|(key, value)| {
                        !FONT_FACE.contains(&&**key) || scalar(value).is_none()
                    });

                if invalid {
                    return Err(
                        "Font faces require family/source and scalar supported descriptors."
                            .to_owned(),
                    );
                }

                for (key, value) in declarations.iter() {
                    check_descriptor("font-face", key, &value.to_js_string())?;
                }

                result.push(Kind::FontFace {
                    declarations: descriptors(&declarations),
                });
            }
            Factory::Property => {
                let options = record(input)?;
                let names = options
                    .get("name")
                    .and_then(Data::as_str)
                    .and_then(|name| identifiers::list(name, Separator::Space));
                let initial = present(options, "initialValue");
                let valid = only(options, &["name", "syntax", "inherits", "initialValue"])
                    && names.as_ref().is_some_and(|names| {
                        names.len() == 1
                            && names.first().is_some_and(|name| {
                                name.starts_with("--") && js::utf16_len(name) > 2
                            })
                    })
                    && matches!(options.get("syntax"), Some(Data::String(_)))
                    && matches!(options.get("inherits"), Some(Data::Bool(_)))
                    && initial.is_none_or(|value| scalar(value).is_some());

                if !valid {
                    return Err(
                        "Expected a native property registration with scalar descriptors."
                            .to_owned(),
                    );
                }

                if let Some(initial) = initial {
                    properties::initial(&initial.to_js_string()).map_err(|error| error.text())?;
                }

                result.push(Kind::Property {
                    inherits: matches!(options.get("inherits"), Some(Data::Bool(true))),
                    initial_value: initial.and_then(scalar),
                    name: options
                        .get("name")
                        .and_then(Data::as_str)
                        .map_or_else(|| Arc::from(""), Arc::from),
                    syntax: options
                        .get("syntax")
                        .and_then(Data::as_str)
                        .map_or_else(|| Arc::from(""), Arc::from),
                });
            }
            Factory::Page => {
                let options = record(input)?;
                let selector = present(options, "selector");

                if !only(options, &["descriptors", "selector"])
                    || selector.is_some_and(|selector| selector.as_str().is_none())
                {
                    return Err("Expected page descriptors and an optional selector.".to_owned());
                }

                let selector = selector
                    .and_then(Data::as_str)
                    .filter(|value| !value.is_empty());
                let header = match selector {
                    Some(selector) => format!("@page {selector}"),
                    None => "@page".to_owned(),
                };

                result.push(Kind::Block {
                    entries: page(
                        options.get("descriptors").unwrap_or(&Data::Undefined),
                        false,
                    )?,
                    header: Arc::from(condition::normalize(&header).map_err(|error| error.text())?),
                });
            }
            Factory::FontFeatureValues => feature_values(input, result)?,
            Factory::ViewTransition => {
                let mut entries = Vec::new();

                for (key, value) in record(input)?.iter() {
                    if value.is_undefined() {
                        continue;
                    }

                    let text = value.as_str();
                    let invalid = (&**key != "navigation" && &**key != "types")
                        || text.is_none()
                        || (&**key == "navigation"
                            && !matches!(
                                text.and_then(|text| identifiers::list(text, Separator::Space))
                                    .map(|names| names.join(" ").to_ascii_lowercase())
                                    .as_deref(),
                                Some("auto" | "none")
                            ));

                    if invalid {
                        return Err(
                            "Expected navigation or types view-transition descriptors.".to_owned()
                        );
                    }

                    let text = text.unwrap_or_default();

                    if &**key == "types" {
                        let names = identifiers::list(text, Separator::Space);
                        let invalid = names.as_ref().is_none_or(|names| {
                            names.iter().any(|name| {
                                let lower = name.to_ascii_lowercase();

                                RESERVED.contains(&lower.as_str())
                                    || (lower == "none" && names.len() != 1)
                            })
                        });

                        if invalid {
                            return Err(
                                "Expected none or a list of view-transition custom identifiers."
                                    .to_owned(),
                            );
                        }
                    }

                    functions::value("*", text).map_err(|error| error.text())?;
                    entries.push(Entry::Descriptor {
                        name: Arc::clone(key),
                        value: Scalar::String(Arc::from(text)),
                    });
                }

                result.push(Kind::Block {
                    entries,
                    header: Arc::from("@view-transition"),
                });
            }
            Factory::PositionTry => {
                let declarations = record(input)?;

                if declarations
                    .keys()
                    .any(|key| !POSITION_TRY.contains(&&**key))
                {
                    return Err("Unsupported position-try declaration.".to_owned());
                }

                let block = style(input)?;

                if block.rules.is_some()
                    || block
                        .declarations
                        .iter()
                        .any(|declaration| declaration.important)
                {
                    return Err(
                        "Position-try forbids nested rules and important declarations.".to_owned(),
                    );
                }

                result.push(Kind::Rule {
                    selector: Arc::from(format!("@position-try {}", name())),
                    style: block,
                });
            }
            Factory::ColorProfile | Factory::CounterStyle | Factory::FontPaletteValues => {
                Self::descriptor(call, input, result)?;
            }
            Factory::Keyframes => {
                let mut frames = Vec::new();

                for (stop, input) in record(input)?.iter() {
                    if !keyframes::accepts(stop) {
                        return Err("Keyframe stops require from, to, 0–100% offsets, or named timeline percentages.".to_owned());
                    }

                    let frame = style(input)?;

                    if frame.rules.is_some()
                        || frame
                            .declarations
                            .iter()
                            .any(|declaration| declaration.important)
                    {
                        return Err(
                            "Keyframes forbid nested rules and important declarations.".to_owned()
                        );
                    }

                    frames.push((Arc::clone(stop), frame));
                }

                if call.exported
                    || call
                        .name
                        .as_ref()
                        .is_some_and(|name| self.evaluator.scanned.used.contains(name))
                {
                    result.push(Kind::Keyframes {
                        frames,
                        name: name(),
                    });
                }
            }
        }

        Ok(())
    }

    fn function(
        &mut self,
        call: &Call<'_>,
        input: &Data,
        result: &mut Vec<Kind>,
    ) -> std::result::Result<(), String> {
        let options = record(input)?;
        let returns = present(options, "returns");
        let parameters = match options.get("parameters") {
            Some(Data::Array(parameters)) => Some(parameters),
            _ => None,
        };
        let valid_returns =
            returns.is_none_or(|returns| returns.as_str().is_some_and(function_syntax::accepts));
        let (true, Some(parameters), true) = (
            only(options, &["body", "parameters", "returns"]),
            parameters,
            valid_returns,
        ) else {
            return Err(
                "Expected CSS function parameters, body, and optional return syntax.".to_owned(),
            );
        };
        let mut names: FxHashSet<String> = FxHashSet::default();
        let mut texts = Vec::with_capacity(parameters.len());
        let mut signature = Vec::with_capacity(parameters.len());

        for parameter in parameters.iter() {
            let parameter = record(parameter)?;
            let name = parameter.get("name").and_then(Data::as_str);
            let syntax = present(parameter, "syntax");
            let default = present(parameter, "default");
            let read = name.and_then(identifiers::read);
            let valid = only(parameter, &["default", "name", "syntax"])
                && name.is_some_and(dashed)
                && read.as_ref().is_some_and(|read| !names.contains(read))
                && syntax
                    .is_none_or(|syntax| syntax.as_str().is_some_and(function_syntax::accepts))
                && default.is_none_or(|default| scalar(default).is_some());

            let (true, Some(name), Some(read)) = (valid, name, read) else {
                return Err(
                    "Expected unique CSS parameters with supported syntaxes and scalar defaults."
                        .to_owned(),
                );
            };

            names.insert(read);

            let syntax = syntax.and_then(Data::as_str);

            if let Some(default) = default {
                functions::value(syntax.unwrap_or("*"), &default.to_js_string())
                    .map_err(|error| error.text())?;
            }

            let mut text = name.to_owned();

            if let Some(syntax) = syntax.filter(|syntax| !syntax.is_empty()) {
                text.push(' ');
                text.push_str(if syntax == "*" { "type(*)" } else { syntax });
            }

            if let Some(default) = default {
                text.push_str(": ");
                text.push_str(&default.to_js_string());
            }

            texts.push(text);
            signature.push(FunctionParameter {
                default: default.and_then(|default| match default {
                    Data::Number(number) => Some(runtime::Scalar::Number(*number)),
                    Data::String(text) => Some(runtime::Scalar::String(Arc::clone(text))),
                    _ => None,
                }),
                keys: themes::parameter_keys(parameter),
                name: Arc::from(name),
                syntax: syntax.map(Arc::from),
            });
        }

        let key = signature_key(parameters, returns)?;

        if self
            .signature
            .as_ref()
            .is_some_and(|previous| *previous != key)
        {
            return Err(
                "Grouped CSS function definitions must use the same parameters and return syntax."
                    .to_owned(),
            );
        }

        self.signature = Some(key);

        let returns = returns.and_then(Data::as_str);

        self.function = Some(FunctionSignature {
            parameters: signature,
            returns: Arc::from(returns.unwrap_or("*")),
        });

        let mut header = format!(
            "@function {}({})",
            call.name.as_deref().unwrap_or_default(),
            texts.join(",")
        );

        if let Some(returns) = returns.filter(|returns| !returns.is_empty()) {
            header.push_str(" returns ");
            header.push_str(if returns == "*" { "type(*)" } else { returns });
        }

        result.push(Kind::Block {
            entries: function_body(options.get("body").unwrap_or(&Data::Undefined))?,
            header: Arc::from(header),
        });

        Ok(())
    }

    fn descriptor(
        call: &Call<'_>,
        input: &Data,
        result: &mut Vec<Kind>,
    ) -> std::result::Result<(), String> {
        let (rule, keys, required): (&str, &[&str], &[&str]) = match call.kind {
            Factory::ColorProfile => (
                "color-profile",
                &["components", "renderingIntent", "src"],
                &["src"],
            ),
            Factory::CounterStyle => (
                "counter-style",
                &[
                    "additiveSymbols",
                    "fallback",
                    "negative",
                    "pad",
                    "prefix",
                    "range",
                    "speakAs",
                    "suffix",
                    "symbols",
                    "system",
                ],
                &[],
            ),
            _ => (
                "font-palette-values",
                &["basePalette", "fontFamily", "overrideColors"],
                &["fontFamily"],
            ),
        };
        let mut declarations = record(input)?.clone();
        let removed: Vec<Arc<str>> = declarations
            .iter()
            .filter(|(_, value)| value.is_undefined())
            .map(|(key, _)| Arc::clone(key))
            .collect();

        for key in &removed {
            declarations.remove(key);
        }

        let invalid = required
            .iter()
            .any(|key| !matches!(declarations.get(key), Some(Data::String(_))))
            || declarations.iter().any(|(key, value)| {
                !keys.contains(&&**key)
                    || !(matches!(value, Data::String(_))
                        || (&**key == "basePalette" && index(value)))
            });

        if invalid {
            return Err("Expected supported scalar descriptors and required fields.".to_owned());
        }

        let text = |key: &str| declarations.get(key).and_then(Data::as_str);

        if call.kind == Factory::ColorProfile {
            if !text("src").is_some_and(identifiers::url) {
                return Err("Color-profile src requires one URL.".to_owned());
            }

            if let Some(components) = text("components") {
                let names = identifiers::list(components, Separator::Comma);

                if names
                    .is_none_or(|names| names.iter().any(|name| name.eq_ignore_ascii_case("none")))
                {
                    return Err("Color-profile components require comma-separated identifiers other than none.".to_owned());
                }
            }

            if let Some(intent) = text("renderingIntent") {
                let names = identifiers::list(intent, Separator::Space);
                let valid = names.as_ref().is_some_and(|names| {
                    names.len() == 1
                        && names.first().is_some_and(|name| {
                            matches!(
                                name.to_ascii_lowercase().as_str(),
                                "absolute-colorimetric"
                                    | "relative-colorimetric"
                                    | "perceptual"
                                    | "saturation"
                            )
                        })
                });

                if !valid {
                    return Err("Invalid color-profile rendering intent.".to_owned());
                }
            }
        }

        if call.kind == Factory::CounterStyle {
            let authored = text("system");
            let system = authored.map_or_else(
                || "symbolic".to_owned(),
                |system| js::trim(&lexical::normalize(system)).to_ascii_lowercase(),
            );

            if check_descriptor("counter-style", "system", authored.unwrap_or("symbolic")).is_err()
            {
                return Err(
                    "Expected a supported counter system, with an integer after fixed.".to_owned(),
                );
            }

            let required = if system == "additive" {
                Some("additiveSymbols")
            } else if system.starts_with("extends ") {
                None
            } else {
                Some("symbols")
            };

            if let Some(required) = required
                && text(required).is_none_or(|symbols| js::trim(symbols).is_empty())
            {
                return Err("The counter system requires symbols or additiveSymbols.".to_owned());
            }
        }

        if call.kind != Factory::ColorProfile {
            for (name, value) in declarations.iter() {
                check_descriptor(rule, name, &value.to_js_string())?;
            }
        }

        result.push(Kind::Descriptor {
            declarations: descriptors(&declarations),
            name: call.name.clone().unwrap_or_else(|| Arc::from("")),
            rule: Arc::from(rule),
        });

        Ok(())
    }
}

fn function_body(input: &Data) -> std::result::Result<Vec<Entry>, String> {
    let mut entries = Vec::new();

    for (key, value) in record(input)?.iter() {
        if value.is_undefined() {
            continue;
        }

        if ["@media ", "@supports ", "@container "]
            .iter()
            .any(|prefix| key.starts_with(prefix))
        {
            entries.push(Entry::Block {
                entries: function_body(value)?,
                header: Arc::from(condition::normalize(key).map_err(|error| error.text())?),
            });
            continue;
        }

        let Some(scalar) = scalar(value).filter(|_| &**key == "result" || dashed(key)) else {
            return Err(
                "CSS function bodies accept result, local variables, and conditional groups."
                    .to_owned(),
            );
        };

        functions::value("*", &value.to_js_string()).map_err(|error| error.text())?;
        entries.push(Entry::Descriptor {
            name: Arc::clone(key),
            value: scalar,
        });
    }

    Ok(entries)
}

/// Whether a page key names a margin-box, background, border, font, margin, padding, or
/// outline property, other than `borderCollapse` and `borderSpacing`.
fn page_property(key: &str) -> bool {
    key != "borderCollapse"
        && key != "borderSpacing"
        && [
            "background",
            "border",
            "font",
            "margin",
            "padding",
            "outline",
        ]
        .iter()
        .any(|prefix| key.starts_with(prefix))
}

fn page(input: &Data, margin: bool) -> std::result::Result<Vec<Entry>, String> {
    let mut entries = Vec::new();

    for (key, value) in record(input)?.iter() {
        if value.is_undefined() {
            continue;
        }

        if !margin && MARGINS.contains(&&**key) {
            entries.push(Entry::Block {
                entries: page(value, true)?,
                header: Arc::clone(key),
            });
            continue;
        }

        if !margin
            && matches!(
                &**key,
                "bleed" | "marks" | "pageMarginSafety" | "pageOrientation" | "size"
            )
        {
            let Some(scalar) = scalar(value) else {
                return Err("Expected a scalar page descriptor.".to_owned());
            };

            check_descriptor("page", key, &value.to_js_string())?;
            entries.push(Entry::Descriptor {
                name: Arc::from(kebab(key)),
                value: scalar,
            });
            continue;
        }

        let margin_property = margin
            && matches!(
                &**key,
                "content" | "overflow" | "unicodeBidi" | "verticalAlign" | "zIndex"
            );

        if !(page_property(key) || PAGE_PROPERTIES.contains(&&**key) || margin_property) {
            return Err("Unsupported page or page-margin declaration.".to_owned());
        }

        let mut declaration = Object::new();

        declaration.insert(Arc::clone(key), value.clone());
        entries.push(Entry::Style(style(&Data::from(declaration))?));
    }

    Ok(entries)
}

fn feature_values(input: &Data, result: &mut Vec<Kind>) -> std::result::Result<(), String> {
    let options = record(input)?;

    if !only(options, &["families", "features", "fontDisplay"]) {
        return Err("Unknown font-feature-values option.".to_owned());
    }

    let list = match options.get("families") {
        Some(Data::String(families)) => families.to_string(),
        Some(Data::Array(families))
            if !families.is_empty() && families.iter().all(|value| value.as_str().is_some()) =>
        {
            families
                .iter()
                .filter_map(Data::as_str)
                .map(family)
                .collect::<Vec<_>>()
                .join(",")
        }
        _ => return Err("Expected a font family list.".to_owned()),
    };

    // Validate the native prelude before shielding newer body descriptors.
    lightning::transform(&Options {
        code: &format!("@font-feature-values {list} {{}}"),
        filename: "font-feature-values.css",
        ..Options::default()
    })
    .map_err(|error| error.text())?;

    let mut entries = Vec::new();

    for (key, value) in options.iter() {
        if &**key == "fontDisplay" && !value.is_undefined() {
            let display = value
                .as_str()
                .and_then(|text| identifiers::list(text, Separator::Space))
                .map(|names| names.join(" ").to_ascii_lowercase());

            if !matches!(
                display.as_deref(),
                Some("auto" | "block" | "fallback" | "optional" | "swap")
            ) {
                return Err("Invalid font display descriptor.".to_owned());
            }

            entries.push(Entry::Descriptor {
                name: Arc::from("font-display"),
                value: Scalar::String(Arc::from(value.as_str().unwrap_or_default())),
            });
        }

        if &**key != "features" {
            continue;
        }

        for (header, input) in record(value)?.iter() {
            if input.is_undefined() {
                continue;
            }

            if !matches!(
                &**header,
                "@annotation"
                    | "@character-variant"
                    | "@ornaments"
                    | "@styleset"
                    | "@stylistic"
                    | "@swash"
            ) {
                return Err("Unknown font feature block.".to_owned());
            }

            let maximum = match &**header {
                "@styleset" => usize::MAX,
                "@character-variant" => 2,
                _ => 1,
            };
            let mut declarations = Vec::new();

            for (name, value) in record(input)?.iter() {
                let values: Vec<&Data> = match value {
                    Data::Array(values) => values.iter().collect(),
                    value => vec![value],
                };

                if !identifier(name)
                    || values.is_empty()
                    || values.len() > maximum
                    || values.iter().any(|value| !index(value))
                {
                    return Err(
                        "Expected feature aliases with nonnegative integer indices.".to_owned()
                    );
                }

                declarations.push(Entry::Descriptor {
                    name: Arc::clone(name),
                    value: Scalar::String(Arc::from(
                        values
                            .iter()
                            .map(|value| value.to_js_string())
                            .collect::<Vec<_>>()
                            .join(" "),
                    )),
                });
            }

            entries.push(Entry::Block {
                entries: declarations,
                header: Arc::clone(header),
            });
        }
    }

    result.push(Kind::Block {
        entries,
        header: Arc::from(format!("@font-feature-values {list}")),
    });

    Ok(())
}

/// Builds ordered stylesheet data after lexical theme references are resolved.
///
/// `tokens` are the module's token reads, `starts` receives the call start of each
/// contribution, and `resolve` resolves static bindings. `offsets` spells namespace names with
/// UTF-16 call offsets.
///
/// # Errors
///
/// Returns `Themes.InvalidError` at the call for invalid contribution data, and at a `@function`
/// invocation for arguments that do not fit the declared parameters.
pub fn extract<'a>(
    scanned: &mut Contributions<'a>,
    tokens: &Tokens,
    starts: &mut Vec<u32>,
    resolve: &dyn Fn(&'a Expression<'a>) -> Result<&'a Expression<'a>>,
    offsets: &Utf16Index,
) -> Result<Vec<Definition>> {
    let mut result: Vec<Definition> = Vec::new();
    let mut functions: Vec<(usize, FunctionSignature)> = Vec::new();

    for (position, call) in scanned.calls.iter().enumerate() {
        let mut extraction = Extraction {
            call: position,
            evaluator: Evaluator {
                resolve,
                scanned,
                tokens,
            },
            function: None,
            namespace: &scanned.namespace,
            offsets,
            signature: None,
        };
        let outcome = (|| -> std::result::Result<bool, String> {
            let argument = extraction
                .evaluator
                .argument(call.argument)
                .map_err(|error| error.text())?;

            if let Some(name) = &call.name
                && !call.exported
                && !scanned.used.contains(name)
            {
                return Ok(false);
            }

            if let Some(context) = call.context {
                let value = extraction
                    .evaluator
                    .argument(context)
                    .map_err(|error| error.text())?;

                if !value.is_undefined() && record(&value)?.keys().any(|key| &**key != "id") {
                    return Err("Unknown contribution context option. Use nested at-rule keys for enclosing groups.".to_owned());
                }
            }

            let inputs = if matches!(
                call.kind,
                Factory::ImportCss
                    | Factory::Namespace
                    | Factory::CustomMedia
                    | Factory::Layers
                    | Factory::Global
            ) {
                vec![(argument, Vec::new())]
            } else {
                definitions(&argument, &[])?
            };

            for (input, headers) in inputs {
                let mut kinds = Vec::new();

                extraction.input(call, &input, &mut kinds)?;

                for kind in kinds {
                    result.push(Definition {
                        kind,
                        within: headers.clone(),
                    });
                    starts.push(call.start);
                }
            }

            Ok(true)
        })();

        match outcome {
            Ok(_) => {}
            Err(message) => {
                return Err(invalid(&message, Span::new(call.start, call.end)));
            }
        }

        if let Some(function) = extraction.function {
            functions.push((extraction.call, function));
        }
    }

    for (position, function) in functions {
        if let Some(call) = scanned.calls.get_mut(position) {
            call.function = Some(function);
        }
    }

    for input in &scanned.function_inputs {
        let signature = scanned.signature(&input.signature);
        let parameters = signature
            .as_ref()
            .map_or(&[][..], |signature| signature.parameters.as_slice());
        let syntax = |index: usize| {
            parameters
                .get(index)
                .and_then(|parameter| parameter.syntax.as_deref())
                .unwrap_or("*")
        };

        if input.values.iter().enumerate().any(|(index, value)| {
            value.as_deref().is_some_and(|value| {
                function_syntax::integer_only(syntax(index)) && non_integer(syntax(index), value)
            })
        }) {
            return Err(invalid(
                "CSS integer parameters require integer tokens.",
                input.node.span,
            ));
        }
    }

    for input in &scanned.function_inputs {
        let signature = scanned.signature(&input.signature);
        let parameters = signature
            .as_ref()
            .map_or(&[][..], |signature| signature.parameters.as_slice());
        let required = parameters
            .iter()
            .rposition(|parameter| parameter.default.is_none())
            .map_or(0, |index| index + 1);

        if input.values.len() < required || input.values.len() > parameters.len() {
            return Err(invalid(
                "CSS function arguments must match the declared parameter count.",
                input.node.span,
            ));
        }

        for (index, value) in input.values.iter().enumerate() {
            let Some(value) = value else {
                continue;
            };
            let syntax = parameters
                .get(index)
                .and_then(|parameter| parameter.syntax.as_deref())
                .unwrap_or("*");

            functions::value(syntax, value)
                .map_err(|error| invalid(&error.text(), input.node.span))?;
        }
    }

    Ok(result)
}
