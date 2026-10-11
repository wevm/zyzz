//! Resolves identifiers to their declarations through oxc semantic analysis.
//!
//! Declarations report the same start offsets the TypeScript compiler keys its side tables by:
//! the specifier of an import, the function of a function declaration, and the binding
//! identifier otherwise.

use oxc_ast::AstKind;
use oxc_ast::ast::{
    Function, IdentifierReference, ImportDeclaration, VariableDeclaration, VariableDeclarator,
};
use oxc_semantic::{Semantic, SymbolFlags};
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::ScopeId;
use oxc_syntax::symbol::SymbolId;

/// The kind of declaration that introduces a binding.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Kind {
    /// A `catch` clause parameter.
    CatchParam,
    /// A function declaration or named function expression.
    Function,
    /// A function or arrow parameter.
    FunctionParam,
    /// A class, enum, type, interface, or namespace name.
    Identifier,
    /// An import specifier.
    Import,
    /// A `var`, `let`, or `const` binding.
    Variable,
}

/// Which namespace a lookup searches.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mode {
    /// Type declarations.
    Type,
    /// Value declarations.
    Value,
}

/// A resolved declaration.
#[derive(Clone, Copy, Debug)]
pub struct Declaration<'a> {
    /// The variable's declarator, for variables.
    pub declarator: Option<&'a VariableDeclarator<'a>>,
    /// The function, for function declarations.
    pub function: Option<&'a Function<'a>>,
    /// The import declaration, for imports.
    pub import: Option<&'a ImportDeclaration<'a>>,
    /// What introduced the binding.
    pub kind: Kind,
    /// Span of the declaring node: the specifier, the function, or the binding identifier.
    pub span: Span,
    /// The symbol.
    pub symbol: SymbolId,
    /// The variable declaration, for variables.
    pub variable: Option<&'a VariableDeclaration<'a>>,
}

impl Declaration<'_> {
    /// Start offset of the declaring node, the key side tables use.
    pub fn start(&self) -> u32 {
        self.span.start
    }

    /// Whether the binding is an import from a module specifier, value or type.
    pub fn imported_from(&self, source: &str) -> bool {
        self.import
            .is_some_and(|import| import.source.value == source)
    }
}

/// Resolves an identifier reference.
pub fn resolve<'a>(
    semantic: &Semantic<'a>,
    reference: &IdentifierReference<'a>,
) -> Option<Declaration<'a>> {
    let reference_id = reference.reference_id.get()?;
    let symbol = semantic.scoping().get_reference(reference_id).symbol_id()?;

    declaration(semantic, symbol)
}

/// Looks up a name from a scope outward.
pub fn lookup<'a>(
    semantic: &Semantic<'a>,
    name: &str,
    scope: ScopeId,
    mode: Mode,
) -> Option<Declaration<'a>> {
    let scoping = semantic.scoping();
    let mut current = Some(scope);

    while let Some(scope) = current {
        if let Some(symbol) = scoping.get_binding(scope, name.into()) {
            let flags = scoping.symbol_flags(symbol);
            let matches = match mode {
                Mode::Type => flags.intersects(SymbolFlags::Type),
                Mode::Value => {
                    flags.intersects(SymbolFlags::Value) || flags.contains(SymbolFlags::Import)
                }
            };

            if matches {
                return declaration(semantic, symbol);
            }
        }

        current = scoping.scope_parent_id(scope);
    }

    None
}

/// Describes the declaration of a symbol.
pub fn declaration<'a>(semantic: &Semantic<'a>, symbol: SymbolId) -> Option<Declaration<'a>> {
    let scoping = semantic.scoping();
    let nodes = semantic.nodes();
    let node = scoping.symbol_declaration(symbol);
    let identifier = scoping.symbol_span(symbol);
    let base = Declaration {
        declarator: None,
        function: None,
        import: None,
        kind: Kind::Identifier,
        span: identifier,
        symbol,
        variable: None,
    };

    Some(match nodes.kind(node) {
        AstKind::ImportSpecifier(_)
        | AstKind::ImportDefaultSpecifier(_)
        | AstKind::ImportNamespaceSpecifier(_) => {
            let span = nodes.kind(node).span();
            let import = nodes
                .ancestors(node)
                .find_map(|ancestor| match ancestor.kind() {
                    AstKind::ImportDeclaration(import) => Some(import),
                    _ => None,
                });

            Declaration {
                import,
                kind: Kind::Import,
                span,
                ..base
            }
        }
        AstKind::VariableDeclarator(declarator) => {
            let variable = match nodes.parent_kind(node) {
                AstKind::VariableDeclaration(variable) => Some(variable),
                _ => None,
            };

            Declaration {
                declarator: Some(declarator),
                kind: Kind::Variable,
                variable,
                ..base
            }
        }
        AstKind::Function(function) => Declaration {
            function: Some(function),
            kind: Kind::Function,
            span: function.span,
            ..base
        },
        AstKind::FormalParameter(_) | AstKind::FormalParameterRest(_) => Declaration {
            kind: Kind::FunctionParam,
            ..base
        },
        AstKind::CatchParameter(_) => Declaration {
            kind: Kind::CatchParam,
            ..base
        },
        _ => base,
    })
}

/// The scope that contains a node, by its id.
pub fn scope_of(semantic: &Semantic<'_>, node: oxc_syntax::node::NodeId) -> ScopeId {
    semantic.nodes().get_node(node).scope_id()
}
