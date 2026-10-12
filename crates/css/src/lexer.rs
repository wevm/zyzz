//! Grammar matching against css-tree's lexer dictionaries, following css-tree's `Lexer`.
//!
//! [`Lexer::get`] returns one immutable dictionary of css-tree's property, type, and at-rule
//! grammars. Definitions are stored as strings and compiled into match graphs on first use, so
//! short processes only pay for the grammars they match. Results carry css-tree's errors,
//! including the exact `Mismatch` message with its caret line.

mod generic;
mod match_graph;
mod matcher;

use std::borrow::Cow;
use std::sync::{LazyLock, OnceLock};

use rustc_hash::FxHashMap;

use self::generic::{GenericKind, Thrown};
use self::match_graph::Graph;
use self::matcher::{ExitReason, Outcome};
use crate::ast::{Ast, NodeId};
use crate::definition_syntax::{self, SyntaxNode};
use crate::generated::data;
use crate::names;
use crate::tokenizer::{TokenType, tokenize};

/// The kind of syntax a match tree node or trace entry refers to, like css-tree's syntax
/// `type` field.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum SyntaxKind {
    /// An at-keyword term.
    AtKeyword,
    /// An at-rule descriptor grammar.
    AtruleDescriptor,
    /// An at-rule prelude grammar.
    AtrulePrelude,
    /// A function term.
    Function,
    /// A keyword term.
    Keyword,
    /// A property reference or property grammar.
    Property,
    /// A quoted string term.
    String,
    /// A literal token term.
    Token,
    /// A type reference or type grammar.
    Type,
}

impl SyntaxKind {
    /// Returns css-tree's `type` string.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AtKeyword => "AtKeyword",
            Self::AtruleDescriptor => "AtruleDescriptor",
            Self::AtrulePrelude => "AtrulePrelude",
            Self::Function => "Function",
            Self::Keyword => "Keyword",
            Self::Property => "Property",
            Self::String => "String",
            Self::Token => "Token",
            Self::Type => "Type",
        }
    }
}

/// A syntax reference in a match tree: its kind and name as written in the grammar.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct SyntaxInfo<'s> {
    /// Syntax kind.
    pub kind: SyntaxKind,
    /// Name, such as `length` for `<length>`.
    pub name: &'s str,
}

/// A node of a [`MatchTree`].
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TreeNode<'s> {
    /// A grammar that matched a run of tokens.
    Host {
        /// Indices of child nodes in [`MatchTree::nodes`].
        children: Vec<usize>,
        /// The grammar, absent for anonymous roots.
        syntax: Option<SyntaxInfo<'s>>,
    },
    /// One matched token.
    Leaf {
        /// The syntax tree node that produced the token, when matching a tree.
        node: Option<NodeId>,
        /// The term that matched it, absent for generic types and commas.
        syntax: Option<SyntaxInfo<'s>>,
        /// Index of the token in the matched value's token list.
        token: usize,
    },
}

/// css-tree's match tree: which grammars matched which tokens. The root is node zero.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MatchTree<'s> {
    /// Nodes, with the root first.
    pub nodes: Vec<TreeNode<'s>>,
}

/// A value to match: source text, which css-tree tokenizes, or a parsed node, which css-tree
/// generates into tokens attributed to their nodes.
#[derive(Clone, Copy, Debug)]
pub enum MatchValue<'v, 'a> {
    /// A parsed node and its tree.
    Node(&'v Ast<'a>, NodeId),
    /// CSS source text.
    Source(&'v str),
}

impl<'v> From<&'v str> for MatchValue<'v, '_> {
    fn from(source: &'v str) -> Self {
        Self::Source(source)
    }
}

/// A token prepared for matching.
#[derive(Clone, Debug)]
pub(crate) struct MatchToken<'v> {
    pub(crate) kind: TokenType,
    pub(crate) node: Option<NodeId>,
    pub(crate) value: Cow<'v, str>,
}

/// A `Mismatch` error, css-tree's `SyntaxMatchError`.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MismatchError {
    /// The matched value's tokens joined, or the source text.
    pub css: String,
    /// The full message with the syntax, value, and caret lines.
    pub message: String,
    /// Length of the first unmatched token in UTF-16 code units.
    pub mismatch_length: usize,
    /// Offset of the first unmatched token in UTF-16 code units, the caret's column.
    pub mismatch_offset: usize,
    /// `Mismatch`, or css-tree's iteration limit message.
    pub raw_message: &'static str,
    /// The grammar, serialized, or `<generic>`.
    pub syntax: String,
}

/// An error css-tree returns in a match result's `error` field.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MatchError {
    /// A plain `Error`, such as for values containing `var()`.
    Error(&'static str),
    /// A value that does not match the grammar.
    Mismatch(Box<MismatchError>),
    /// A missing property, type, at-rule, or descriptor, css-tree's `SyntaxReferenceError`.
    Reference {
        /// The message, such as ``Unknown property `colour` ``.
        message: String,
        /// The unknown name.
        reference: String,
    },
    /// A built-in `SyntaxError` about prelude presence.
    Syntax(String),
}

impl MatchError {
    /// Returns css-tree's `message`.
    pub fn message(&self) -> &str {
        match self {
            Self::Error(message) => message,
            Self::Mismatch(error) => &error.message,
            Self::Reference { message, .. } | Self::Syntax(message) => message,
        }
    }
}

impl std::fmt::Display for MatchError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message())
    }
}

impl std::error::Error for MatchError {}

/// An exception css-tree throws instead of returning a result, such as a grammar that
/// references an unknown type or fails to parse.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LexerError {
    /// The exception message.
    pub message: String,
}

impl std::fmt::Display for LexerError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for LexerError {}

impl From<Thrown> for LexerError {
    fn from(thrown: Thrown) -> Self {
        Self {
            message: thrown.0.into_owned(),
        }
    }
}

/// A match result, like css-tree's `{ matched, iterations, error }` object.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MatchResult<'s> {
    /// The error, absent when the value matched or no grammar applies.
    pub error: Option<MatchError>,
    /// The matcher's iteration count.
    pub iterations: u32,
    /// The match tree when the value matched.
    pub matched: Option<MatchTree<'s>>,
}

impl<'s> MatchResult<'s> {
    fn new(matched: Option<MatchTree<'s>>, error: Option<MatchError>, iterations: u32) -> Self {
        Self {
            error,
            iterations,
            matched,
        }
    }

    /// Reports whether the value matched.
    pub fn is_match(&self) -> bool {
        self.error.is_none() && self.matched.is_some()
    }

    /// Returns the type, property, and keyword syntaxes that matched a node, outermost first,
    /// like css-tree's `getTrace`. Returns `None` when the node produced no matched token.
    pub fn trace(&self, node: NodeId) -> Option<Vec<SyntaxInfo<'s>>> {
        let tree = self.matched.as_ref()?;
        let mut trace = None;

        trace_node(tree, 0, node, &mut trace);
        trace
    }
}

/// Searches the subtree at `index` for a leaf produced by `node`.
fn trace_node<'s>(
    tree: &MatchTree<'s>,
    index: usize,
    node: NodeId,
    trace: &mut Option<Vec<SyntaxInfo<'s>>>,
) -> bool {
    let traced = |syntax: Option<SyntaxInfo<'s>>| {
        syntax.filter(|syntax| {
            matches!(
                syntax.kind,
                SyntaxKind::Type | SyntaxKind::Property | SyntaxKind::Keyword
            )
        })
    };

    match tree.nodes.get(index) {
        Some(TreeNode::Host { children, syntax }) => {
            for &child in children {
                if trace_node(tree, child, node, trace) {
                    if let (Some(syntax), Some(entries)) = (traced(*syntax), trace.as_mut()) {
                        entries.insert(0, syntax);
                    }

                    return true;
                }
            }

            false
        }
        Some(TreeNode::Leaf {
            node: leaf, syntax, ..
        }) if *leaf == Some(node) => {
            *trace = Some(traced(*syntax).into_iter().collect());
            true
        }
        _ => false,
    }
}

/// What a dictionary entry describes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum EntryKind {
    AtruleDescriptor,
    AtrulePrelude,
    Property,
    Type,
}

impl EntryKind {
    const fn syntax_kind(self) -> SyntaxKind {
        match self {
            Self::AtruleDescriptor => SyntaxKind::AtruleDescriptor,
            Self::AtrulePrelude => SyntaxKind::AtrulePrelude,
            Self::Property => SyntaxKind::Property,
            Self::Type => SyntaxKind::Type,
        }
    }
}

/// A dictionary grammar compiled on first use.
struct Entry {
    compiled: OnceLock<Result<Compiled, LexerError>>,
    kind: EntryKind,
    name: &'static str,
    source: Source,
}

/// Where a grammar comes from.
#[derive(Clone, Copy)]
enum Source {
    Generic(GenericKind),
    Syntax(&'static str),
}

/// A compiled grammar: the definition tree, its graph, and for properties whose grammar is a
/// top-level comma list, the graph of one item used by `<'property'>` references.
struct Compiled {
    graph: Graph<'static>,
    reference_graph: Option<Graph<'static>>,
    syntax: Option<SyntaxNode<'static>>,
}

impl Entry {
    fn new(kind: EntryKind, name: &'static str, source: Source) -> Self {
        Self {
            compiled: OnceLock::new(),
            kind,
            name,
            source,
        }
    }

    fn compiled(&self) -> Result<&Compiled, LexerError> {
        self.compiled
            .get_or_init(|| compile(self.kind, self.name, self.source))
            .as_ref()
            .map_err(Clone::clone)
    }
}

fn compile(kind: EntryKind, name: &'static str, source: Source) -> Result<Compiled, LexerError> {
    let reference = Some(SyntaxInfo {
        kind: kind.syntax_kind(),
        name,
    });

    match source {
        Source::Generic(generic) => Ok(Compiled {
            graph: Graph::generic(generic, reference),
            reference_graph: None,
            syntax: None,
        }),
        Source::Syntax(text) => {
            let syntax = definition_syntax::parse(text).map_err(|error| LexerError {
                message: error.formatted_message(text),
            })?;
            let reference_graph = match &syntax {
                SyntaxNode::Group {
                    combinator,
                    disallow_empty,
                    explicit: false,
                    terms,
                } if kind == EntryKind::Property => match terms.as_slice() {
                    [
                        SyntaxNode::Multiplier {
                            comma: true, term, ..
                        },
                    ] => Some(Graph::build(
                        &SyntaxNode::Group {
                            combinator: *combinator,
                            disallow_empty: *disallow_empty,
                            explicit: false,
                            terms: vec![(**term).clone()],
                        },
                        reference,
                    )),
                    _ => None,
                },
                _ => None,
            };

            Ok(Compiled {
                graph: Graph::build(&syntax, reference),
                reference_graph,
                syntax: Some(syntax),
            })
        }
    }
}

/// An at-rule's grammars.
struct AtruleEntry {
    descriptors: Option<FxHashMap<&'static str, Entry>>,
    prelude: Option<Entry>,
}

/// css-tree's default lexer: immutable dictionaries with lazily compiled grammars.
pub struct Lexer {
    atrules: FxHashMap<&'static str, AtruleEntry>,
    css_wide_keywords: Graph<'static>,
    properties: FxHashMap<&'static str, Entry>,
    types: FxHashMap<&'static str, Entry>,
}

static LEXER: LazyLock<Lexer> = LazyLock::new(Lexer::new);

impl Lexer {
    /// Returns the shared lexer, building its dictionaries on first use.
    pub fn get() -> &'static Self {
        &LEXER
    }

    fn new() -> Self {
        let mut types: FxHashMap<&'static str, Entry> = data::TYPES
            .iter()
            .map(|(name, syntax)| {
                (
                    *name,
                    Entry::new(EntryKind::Type, name, Source::Syntax(syntax)),
                )
            })
            .collect();

        for name in GENERIC_TYPES {
            if let Some(kind) = GenericKind::from_name(name) {
                types.insert(
                    name,
                    Entry::new(EntryKind::Type, name, Source::Generic(kind)),
                );
            }
        }

        let properties = data::PROPERTIES
            .iter()
            .map(|(name, syntax)| {
                (
                    *name,
                    Entry::new(EntryKind::Property, name, Source::Syntax(syntax)),
                )
            })
            .collect();
        let atrules = data::ATRULES
            .iter()
            .map(|atrule| {
                let descriptors = (!atrule.descriptors.is_empty()).then(|| {
                    atrule
                        .descriptors
                        .iter()
                        .map(|(name, syntax)| {
                            (
                                *name,
                                Entry::new(
                                    EntryKind::AtruleDescriptor,
                                    name,
                                    Source::Syntax(syntax),
                                ),
                            )
                        })
                        .collect()
                });
                let prelude = atrule.prelude.map(|syntax| {
                    Entry::new(
                        EntryKind::AtrulePrelude,
                        atrule.name,
                        Source::Syntax(syntax),
                    )
                });

                (
                    atrule.name,
                    AtruleEntry {
                        descriptors,
                        prelude,
                    },
                )
            })
            .collect();
        let css_wide_keywords = Graph::build(
            &SyntaxNode::Group {
                combinator: definition_syntax::Combinator::One,
                disallow_empty: false,
                explicit: false,
                terms: data::CSS_WIDE_KEYWORDS
                    .iter()
                    .map(|name| SyntaxNode::Keyword { name })
                    .collect(),
            },
            None,
        );

        Self {
            atrules,
            css_wide_keywords,
            properties,
            types,
        }
    }

    /// Resolves a `<type>` or `<'property'>` reference to the graph css-tree matches.
    pub(crate) fn reference(&self, kind: EntryKind, name: &str) -> Result<&Graph<'static>, Thrown> {
        let entry = match kind {
            EntryKind::Property => self.properties.get(name),
            _ => self.types.get(name),
        };
        let Some(entry) = entry else {
            return Err(Thrown(Cow::Owned(if kind == EntryKind::Property {
                format!("Bad syntax reference: <'{name}'>")
            } else {
                format!("Bad syntax reference: <{name}>")
            })));
        };
        // css-tree compiles on first access, so a grammar that fails to parse throws its own
        // error here.
        let compiled = entry
            .compiled()
            .map_err(|error| Thrown(Cow::Owned(error.message)))?;

        Ok(compiled.reference_graph.as_ref().unwrap_or(&compiled.graph))
    }

    fn atrule(&self, name: &str) -> Option<&AtruleEntry> {
        let keyword = names::keyword(name);

        if !keyword.vendor.is_empty() {
            return self
                .atrules
                .get(keyword.name.as_ref())
                .or_else(|| self.atrules.get(keyword.basename.as_ref()));
        }

        self.atrules.get(keyword.name.as_ref())
    }

    fn property(&self, name: &str) -> Option<&Entry> {
        let property = names::property(name);

        if !property.vendor.is_empty() {
            return self
                .properties
                .get(property.name.as_ref())
                .or_else(|| self.properties.get(property.basename.as_ref()));
        }

        self.properties.get(property.name.as_ref())
    }

    /// Matches a property value, like `lexer.matchProperty(name, value)`. CSS-wide keywords
    /// match every property.
    ///
    /// # Errors
    ///
    /// Returns an error where css-tree throws, such as a grammar referencing an unknown type.
    pub fn match_property<'v, 'a: 'v>(
        &self,
        name: &str,
        value: impl Into<MatchValue<'v, 'a>>,
    ) -> Result<MatchResult<'static>, LexerError> {
        if names::property(name).custom {
            return Ok(MatchResult::new(
                None,
                Some(MatchError::Error(
                    "Lexer matching doesn't applicable for custom properties",
                )),
                0,
            ));
        }

        let Some(entry) = self.property(name) else {
            return Ok(MatchResult::new(
                None,
                Some(reference_error("Unknown property", name)),
                0,
            ));
        };

        self.match_entry(entry, value.into(), true)
    }

    /// Matches a value against a type, like `lexer.matchType(name, value)`.
    ///
    /// # Errors
    ///
    /// Returns an error where css-tree throws.
    pub fn match_type<'v, 'a: 'v>(
        &self,
        name: &str,
        value: impl Into<MatchValue<'v, 'a>>,
    ) -> Result<MatchResult<'static>, LexerError> {
        let Some(entry) = self.types.get(name) else {
            return Ok(MatchResult::new(
                None,
                Some(reference_error("Unknown type", name)),
                0,
            ));
        };

        self.match_entry(entry, value.into(), false)
    }

    /// Matches a value against a definition syntax string, like `lexer.match(syntax, value)`.
    ///
    /// # Errors
    ///
    /// Returns an error where css-tree throws, such as when the syntax fails to parse.
    pub fn match_syntax<'s, 'v, 'a: 'v>(
        &self,
        syntax: &'s str,
        value: impl Into<MatchValue<'v, 'a>>,
    ) -> Result<MatchResult<'s>, LexerError> {
        let tree = definition_syntax::parse(syntax).map_err(|error| LexerError {
            message: error.formatted_message(syntax),
        })?;
        let graph = Graph::build(
            &tree,
            Some(SyntaxInfo {
                kind: SyntaxKind::Type,
                name: "anonymous",
            }),
        );

        self.match_graph(&graph, Some(&tree), value.into(), false)
    }

    /// Matches an at-rule prelude, like `lexer.matchAtrulePrelude(name, prelude)`. An empty
    /// source counts as no prelude.
    ///
    /// # Errors
    ///
    /// Returns an error where css-tree throws.
    pub fn match_atrule_prelude<'v, 'a: 'v>(
        &self,
        name: &str,
        prelude: impl Into<MatchValue<'v, 'a>>,
    ) -> Result<MatchResult<'static>, LexerError> {
        let prelude = prelude.into();
        let Some(atrule) = self.atrule(name) else {
            return Ok(MatchResult::new(
                None,
                Some(reference_error("Unknown at-rule", &format!("@{name}"))),
                0,
            ));
        };
        let present = !matches!(prelude, MatchValue::Source(""));

        let Some(entry) = &atrule.prelude else {
            let error = present.then(|| {
                MatchError::Syntax(format!("At-rule `@{name}` should not contain a prelude"))
            });

            return Ok(MatchResult::new(None, error, 0));
        };

        if !present
            && self
                .match_entry(entry, MatchValue::Source(""), false)?
                .matched
                .is_none()
        {
            return Ok(MatchResult::new(
                None,
                Some(MatchError::Syntax(format!(
                    "At-rule `@{name}` should contain a prelude"
                ))),
                0,
            ));
        }

        self.match_entry(entry, prelude, false)
    }

    /// Matches an at-rule descriptor value, like
    /// `lexer.matchAtruleDescriptor(atrule, descriptor, value)`.
    ///
    /// # Errors
    ///
    /// Returns an error where css-tree throws.
    pub fn match_atrule_descriptor<'v, 'a: 'v>(
        &self,
        atrule_name: &str,
        descriptor: &str,
        value: impl Into<MatchValue<'v, 'a>>,
    ) -> Result<MatchResult<'static>, LexerError> {
        let Some(atrule) = self.atrule(atrule_name) else {
            return Ok(MatchResult::new(
                None,
                Some(reference_error(
                    "Unknown at-rule",
                    &format!("@{atrule_name}"),
                )),
                0,
            ));
        };
        let Some(descriptors) = &atrule.descriptors else {
            return Ok(MatchResult::new(
                None,
                Some(MatchError::Syntax(format!(
                    "At-rule `@{atrule_name}` has no known descriptors"
                ))),
                0,
            ));
        };
        let keyword = names::keyword(descriptor);
        let entry = descriptors
            .get(keyword.name.as_ref())
            .or_else(|| descriptors.get(keyword.basename.as_ref()));

        let Some(entry) = entry else {
            return Ok(MatchResult::new(
                None,
                Some(reference_error("Unknown at-rule descriptor", descriptor)),
                0,
            ));
        };

        self.match_entry(entry, value.into(), false)
    }

    fn match_entry(
        &self,
        entry: &Entry,
        value: MatchValue<'_, '_>,
        css_wide_keywords: bool,
    ) -> Result<MatchResult<'static>, LexerError> {
        let compiled = entry.compiled()?;

        self.match_graph(
            &compiled.graph,
            compiled.syntax.as_ref(),
            value,
            css_wide_keywords,
        )
    }

    /// css-tree's `matchSyntax`.
    fn match_graph<'s>(
        &self,
        graph: &Graph<'s>,
        syntax: Option<&SyntaxNode<'_>>,
        value: MatchValue<'_, '_>,
        css_wide_keywords: bool,
    ) -> Result<MatchResult<'s>, LexerError> {
        let tokens = prepare_tokens(value).map_err(|error| LexerError {
            message: error.message.to_owned(),
        })?;

        if tokens
            .iter()
            .any(|token| crate::js::to_lower_case(&token.value) == "var(")
        {
            return Ok(MatchResult::new(
                None,
                Some(MatchError::Error(
                    "Matching for a tree with var() is not supported",
                )),
                0,
            ));
        }

        if css_wide_keywords {
            let outcome = matcher::match_tokens(&tokens, &self.css_wide_keywords, self)?;

            if let Some(tree) = outcome.tree {
                return Ok(MatchResult::new(Some(tree), None, outcome.iterations));
            }
        }

        let outcome: Outcome<'s> = matcher::match_tokens(&tokens, graph, self)?;

        if let Some(tree) = outcome.tree {
            return Ok(MatchResult::new(Some(tree), None, outcome.iterations));
        }

        let error = mismatch_error(outcome.reason, syntax, &tokens, outcome.longest_match);

        Ok(MatchResult::new(
            None,
            Some(MatchError::Mismatch(Box::new(error))),
            outcome.iterations,
        ))
    }
}

/// Builds css-tree's `SyntaxReferenceError`.
fn reference_error(kind: &str, reference: &str) -> MatchError {
    MatchError::Reference {
        message: if reference.is_empty() {
            kind.to_owned()
        } else {
            format!("{kind} `{reference}`")
        },
        reference: reference.to_owned(),
    }
}

/// Builds css-tree's `SyntaxMatchError` message from the longest match.
fn mismatch_error(
    reason: ExitReason,
    syntax: Option<&SyntaxNode<'_>>,
    tokens: &[MatchToken<'_>],
    longest_match: usize,
) -> MismatchError {
    let mut css = String::new();
    let mut mismatch_offset = 0;
    let mut mismatch_length = 0;

    for (index, token) in tokens.iter().enumerate() {
        if index == longest_match {
            mismatch_length = crate::js::utf16_length(&token.value);
            mismatch_offset = crate::js::utf16_length(&css);
        }

        css.push_str(&token.value);
    }

    let syntax = syntax.map_or_else(|| "<generic>".to_owned(), definition_syntax::generate);
    let raw_message = reason.message();
    let mut message = String::with_capacity(raw_message.len() + syntax.len() + css.len() + 40);

    message.push_str(raw_message);
    message.push_str("\n  syntax: ");
    message.push_str(&syntax);
    message.push_str("\n   value: ");
    message.push_str(if css.is_empty() {
        "<empty string>"
    } else {
        &css
    });
    message.push_str("\n  --------");

    for _ in 0..mismatch_offset {
        message.push('-');
    }

    message.push('^');

    MismatchError {
        css,
        message,
        mismatch_length,
        mismatch_offset,
        raw_message,
        syntax,
    }
}

/// Prepares tokens like css-tree's `prepare-tokens`: source text is tokenized, and a node is
/// generated into tokens attributed to the nodes that produced them.
fn prepare_tokens<'v>(
    value: MatchValue<'v, '_>,
) -> Result<Vec<MatchToken<'v>>, crate::generator::GenerateError> {
    Ok(match value {
        MatchValue::Source(source) => tokenize(source)
            .map(|token| MatchToken {
                kind: token.kind,
                node: None,
                value: Cow::Borrowed(
                    source
                        .get(token.start as usize..token.end as usize)
                        .unwrap_or_default(),
                ),
            })
            .collect(),
        MatchValue::Node(ast, node) => crate::generator::generate_tokens(ast, node)?
            .into_iter()
            .map(|token| MatchToken {
                kind: token.kind,
                node: token.node,
                value: Cow::Owned(token.value),
            })
            .collect(),
    })
}

/// css-tree's generic type names. Generic types replace dictionary types of the same name.
const GENERIC_TYPES: [&str; 49] = [
    "(-token",
    ")-token",
    "CDC-token",
    "CDO-token",
    "[-token",
    "]-token",
    "an-plus-b",
    "angle",
    "any-value",
    "at-keyword-token",
    "attr-unit",
    "bad-string-token",
    "bad-url-token",
    "colon-token",
    "comma-token",
    "custom-ident",
    "custom-property-name",
    "dashed-ident",
    "decibel",
    "declaration-value",
    "delim-token",
    "dimension",
    "dimension-token",
    "flex",
    "frequency",
    "function-token",
    "hash-token",
    "hex-color",
    "id-selector",
    "ident",
    "ident-token",
    "integer",
    "length",
    "number",
    "number-token",
    "percentage",
    "percentage-token",
    "resolution",
    "semicolon-token",
    "semitones",
    "string",
    "string-token",
    "time",
    "urange",
    "url-token",
    "whitespace-token",
    "zero",
    "{-token",
    "}-token",
];
