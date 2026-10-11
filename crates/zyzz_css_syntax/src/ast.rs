//! Index-addressed syntax trees matching css-tree's node types.
//!
//! Nodes live in one vector and refer to each other by [`NodeId`]. Child lists are ranges into a
//! shared vector, addressed by [`List`]. Node field names follow css-tree in snake case, and only
//! `loc`, which css-tree omits without `positions`, is absent. Strings borrow the parsed source
//! unless css-tree derives them, as with decoded strings or operators padded with spaces.

use std::borrow::Cow;

/// Identifies a node in an [`Ast`].
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct NodeId(u32);

impl NodeId {
    /// Returns the node's position in [`Ast::nodes`].
    pub const fn index(self) -> usize {
        self.0 as usize
    }
}

/// A child list stored in an [`Ast`]. An empty list is the default.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct List {
    len: u32,
    start: u32,
}

impl List {
    /// Returns the number of children.
    pub const fn len(self) -> usize {
        self.len as usize
    }

    /// Reports whether the list has no children.
    pub const fn is_empty(self) -> bool {
        self.len == 0
    }
}

/// The kind of a [`Node::Condition`] and the nodes it contains.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ConditionKind {
    /// A `@container` condition.
    Container,
    /// A `@media` condition.
    Media,
    /// A `@supports` condition.
    Supports,
    /// css-tree's default kind for features parsed without a condition.
    Unknown,
}

impl ConditionKind {
    /// Returns css-tree's `kind` string.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Container => "container",
            Self::Media => "media",
            Self::Supports => "supports",
            Self::Unknown => "unknown",
        }
    }
}

/// A css-tree syntax node.
#[derive(Clone, Debug, PartialEq)]
pub enum Node<'a> {
    /// The `An+B` microsyntax inside `:nth-*()`.
    AnPlusB {
        /// The `A` coefficient without a leading `+`.
        a: Option<Cow<'a, str>>,
        /// The `B` offset without a leading `+`.
        b: Option<Cow<'a, str>>,
    },
    /// An at-rule.
    Atrule {
        /// A `Block`, absent for statement at-rules.
        block: Option<NodeId>,
        /// Name without `@`, as authored.
        name: &'a str,
        /// An `AtrulePrelude` or a `Raw` fallback.
        prelude: Option<NodeId>,
    },
    /// The prelude of an at-rule.
    AtrulePrelude {
        /// Prelude components.
        children: List,
    },
    /// An attribute selector.
    AttributeSelector {
        /// Attribute flags such as `i`.
        flags: Option<&'a str>,
        /// The matcher such as `^=`.
        matcher: Option<&'a str>,
        /// The attribute name as an `Identifier`.
        name: NodeId,
        /// A `String` or `Identifier` value.
        value: Option<NodeId>,
    },
    /// A `{}` block.
    Block {
        /// Declarations, rules, and at-rules.
        children: List,
    },
    /// A `[]` block in a value.
    Brackets {
        /// Contained components.
        children: List,
    },
    /// `-->`.
    Cdc,
    /// `<!--`.
    Cdo,
    /// A class selector.
    ClassSelector {
        /// Class name without `.`.
        name: &'a str,
    },
    /// A selector combinator.
    Combinator {
        /// `>`, `+`, `~`, `/deep/`, or a space.
        name: &'a str,
    },
    /// A comment.
    Comment {
        /// Text between `/*` and `*/`.
        value: &'a str,
    },
    /// A media, container, or supports condition.
    Condition {
        /// Identifiers, features, and nested conditions.
        children: List,
        /// The condition kind.
        kind: ConditionKind,
    },
    /// A declaration.
    Declaration {
        /// The identifier after `!`, such as `important`, when present.
        important: Option<&'a str>,
        /// Property name as authored, including hacks.
        property: &'a str,
        /// A `Value` or `Raw` node.
        value: NodeId,
    },
    /// A declaration list without braces.
    DeclarationList {
        /// Declarations, rules, and at-rules.
        children: List,
    },
    /// A dimension such as `10px`.
    Dimension {
        /// Unit as authored.
        unit: &'a str,
        /// Numeric part as authored.
        value: &'a str,
    },
    /// A media feature such as `(min-width: 10px)`.
    Feature {
        /// The condition kind.
        kind: ConditionKind,
        /// Feature name.
        name: &'a str,
        /// An `Identifier`, `Number`, `Dimension`, `Ratio`, or `Function`.
        value: Option<NodeId>,
    },
    /// A feature function such as `selector()` in `@supports`.
    FeatureFunction {
        /// Function name without the parenthesis.
        feature: &'a str,
        /// The condition kind.
        kind: ConditionKind,
        /// A `Declaration`, `Selector`, or `Raw` node. css-tree resolves `constructor()` to
        /// `Object.prototype.constructor`, which consumes nothing and stores no node, so the
        /// value is absent there.
        value: Option<NodeId>,
    },
    /// A range feature such as `(10px < width <= 20px)`.
    FeatureRange {
        /// The condition kind.
        kind: ConditionKind,
        /// Left operand.
        left: NodeId,
        /// Comparison after the left operand.
        left_comparison: &'a str,
        /// Middle operand.
        middle: NodeId,
        /// Right operand.
        right: Option<NodeId>,
        /// Comparison before the right operand.
        right_comparison: Option<&'a str>,
    },
    /// A function in a value.
    Function {
        /// Arguments.
        children: List,
        /// Name without the parenthesis, as authored.
        name: &'a str,
    },
    /// A general-enclosed condition component.
    GeneralEnclosed {
        /// Contained components.
        children: List,
        /// Function name, absent for a parenthesized block.
        function: Option<&'a str>,
        /// The condition kind.
        kind: ConditionKind,
    },
    /// A hash such as a hex color.
    Hash {
        /// Text after `#`.
        value: &'a str,
    },
    /// An ID selector.
    IdSelector {
        /// Name without `#`.
        name: &'a str,
    },
    /// An identifier.
    Identifier {
        /// Name as authored, without decoding escapes.
        name: &'a str,
    },
    /// A cascade layer name.
    Layer {
        /// Dot-separated name.
        name: &'a str,
    },
    /// A list of layer names.
    LayerList {
        /// `Layer` nodes.
        children: List,
    },
    /// One media query.
    MediaQuery {
        /// A media condition.
        condition: Option<NodeId>,
        /// Media type as authored.
        media_type: Option<&'a str>,
        /// Lowercase `not` or `only`.
        modifier: Option<&'a str>,
    },
    /// A comma-separated list of media queries.
    MediaQueryList {
        /// `MediaQuery` nodes.
        children: List,
    },
    /// The `&` nesting selector.
    NestingSelector,
    /// The argument of `:nth-*()`.
    Nth {
        /// An `AnPlusB` or `Identifier`.
        nth: NodeId,
        /// The `of` selector list.
        selector: Option<NodeId>,
    },
    /// A number.
    Number {
        /// Number as authored.
        value: &'a str,
    },
    /// An operator such as `,` or `/`, padded with spaces around `+` and `-` in values.
    Operator {
        /// Operator text.
        value: Cow<'a, str>,
    },
    /// A `()` block in a value.
    Parentheses {
        /// Contained components.
        children: List,
    },
    /// A percentage.
    Percentage {
        /// Numeric part as authored.
        value: &'a str,
    },
    /// A pseudo-class selector.
    PseudoClassSelector {
        /// Arguments of a functional pseudo-class.
        children: Option<List>,
        /// Name as authored.
        name: &'a str,
    },
    /// A pseudo-element selector.
    PseudoElementSelector {
        /// Arguments of a functional pseudo-element.
        children: Option<List>,
        /// Name as authored.
        name: &'a str,
    },
    /// A ratio such as `16 / 9`.
    Ratio {
        /// Left term.
        left: NodeId,
        /// Right term.
        right: Option<NodeId>,
    },
    /// Unparsed source kept by error recovery or unknown syntax.
    Raw {
        /// Source text.
        value: &'a str,
    },
    /// A style rule.
    Rule {
        /// The declaration `Block`.
        block: NodeId,
        /// A `SelectorList` or `Raw` prelude.
        prelude: NodeId,
    },
    /// The prelude of `@scope`.
    Scope {
        /// Scope limit selectors.
        limit: Option<NodeId>,
        /// Scope root selectors.
        root: Option<NodeId>,
    },
    /// A complex selector.
    Selector {
        /// Compound selector parts and combinators.
        children: List,
    },
    /// A comma-separated selector list.
    SelectorList {
        /// `Selector` or `Raw` nodes.
        children: List,
    },
    /// A quoted string.
    String {
        /// Decoded value without quotes.
        value: Cow<'a, str>,
    },
    /// A stylesheet.
    StyleSheet {
        /// Rules, at-rules, and preserved comments.
        children: List,
    },
    /// A declaration in a supports condition.
    SupportsDeclaration {
        /// The `Declaration`.
        declaration: NodeId,
    },
    /// A type selector.
    TypeSelector {
        /// Name, including any namespace prefix.
        name: &'a str,
    },
    /// A unicode range such as `U+0-7F`.
    UnicodeRange {
        /// Range as authored.
        value: &'a str,
    },
    /// A url.
    Url {
        /// Decoded url.
        value: Cow<'a, str>,
    },
    /// A declaration value.
    Value {
        /// Value components.
        children: List,
    },
    /// Whitespace that css-tree keeps, always one space.
    WhiteSpace {
        /// Whitespace text.
        value: &'a str,
    },
}

impl Node<'_> {
    /// Returns css-tree's `type` name, such as `Atrule`.
    pub const fn type_name(&self) -> &'static str {
        match self {
            Self::AnPlusB { .. } => "AnPlusB",
            Self::Atrule { .. } => "Atrule",
            Self::AtrulePrelude { .. } => "AtrulePrelude",
            Self::AttributeSelector { .. } => "AttributeSelector",
            Self::Block { .. } => "Block",
            Self::Brackets { .. } => "Brackets",
            Self::Cdc => "CDC",
            Self::Cdo => "CDO",
            Self::ClassSelector { .. } => "ClassSelector",
            Self::Combinator { .. } => "Combinator",
            Self::Comment { .. } => "Comment",
            Self::Condition { .. } => "Condition",
            Self::Declaration { .. } => "Declaration",
            Self::DeclarationList { .. } => "DeclarationList",
            Self::Dimension { .. } => "Dimension",
            Self::Feature { .. } => "Feature",
            Self::FeatureFunction { .. } => "FeatureFunction",
            Self::FeatureRange { .. } => "FeatureRange",
            Self::Function { .. } => "Function",
            Self::GeneralEnclosed { .. } => "GeneralEnclosed",
            Self::Hash { .. } => "Hash",
            Self::IdSelector { .. } => "IdSelector",
            Self::Identifier { .. } => "Identifier",
            Self::Layer { .. } => "Layer",
            Self::LayerList { .. } => "LayerList",
            Self::MediaQuery { .. } => "MediaQuery",
            Self::MediaQueryList { .. } => "MediaQueryList",
            Self::NestingSelector => "NestingSelector",
            Self::Nth { .. } => "Nth",
            Self::Number { .. } => "Number",
            Self::Operator { .. } => "Operator",
            Self::Parentheses { .. } => "Parentheses",
            Self::Percentage { .. } => "Percentage",
            Self::PseudoClassSelector { .. } => "PseudoClassSelector",
            Self::PseudoElementSelector { .. } => "PseudoElementSelector",
            Self::Ratio { .. } => "Ratio",
            Self::Raw { .. } => "Raw",
            Self::Rule { .. } => "Rule",
            Self::Scope { .. } => "Scope",
            Self::Selector { .. } => "Selector",
            Self::SelectorList { .. } => "SelectorList",
            Self::String { .. } => "String",
            Self::StyleSheet { .. } => "StyleSheet",
            Self::SupportsDeclaration { .. } => "SupportsDeclaration",
            Self::TypeSelector { .. } => "TypeSelector",
            Self::UnicodeRange { .. } => "UnicodeRange",
            Self::Url { .. } => "Url",
            Self::Value { .. } => "Value",
            Self::WhiteSpace { .. } => "WhiteSpace",
        }
    }

    /// Returns the child list of nodes that have one, like css-tree's `children` field.
    pub const fn children(&self) -> Option<List> {
        match self {
            Self::AtrulePrelude { children }
            | Self::Block { children }
            | Self::Brackets { children }
            | Self::Condition { children, .. }
            | Self::DeclarationList { children }
            | Self::Function { children, .. }
            | Self::GeneralEnclosed { children, .. }
            | Self::LayerList { children }
            | Self::MediaQueryList { children }
            | Self::Parentheses { children }
            | Self::Selector { children }
            | Self::SelectorList { children }
            | Self::StyleSheet { children }
            | Self::Value { children } => Some(*children),
            Self::PseudoClassSelector { children, .. }
            | Self::PseudoElementSelector { children, .. } => *children,
            _ => None,
        }
    }
}

/// A parsed syntax tree: nodes, child lists, and the root.
#[derive(Clone, Debug, Default)]
pub struct Ast<'a> {
    lists: Vec<NodeId>,
    nodes: Vec<Node<'a>>,
    root: Option<NodeId>,
}

impl<'a> Ast<'a> {
    /// Creates an empty tree.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the root node. Trees from [`crate::parse`] always have one. An empty tree from
    /// [`Ast::new`] returns an id that [`Ast::get`] rejects.
    pub fn root(&self) -> NodeId {
        self.root.unwrap_or(NodeId(0))
    }

    /// Sets the root node.
    pub fn set_root(&mut self, root: NodeId) {
        self.root = Some(root);
    }

    /// Returns a node, or `None` for an id from another tree.
    pub fn get(&self, id: NodeId) -> Option<&Node<'a>> {
        self.nodes.get(id.index())
    }

    /// Returns a mutable node, or `None` for an id from another tree.
    pub fn get_mut(&mut self, id: NodeId) -> Option<&mut Node<'a>> {
        self.nodes.get_mut(id.index())
    }

    /// Returns every node in creation order.
    pub fn nodes(&self) -> &[Node<'a>] {
        &self.nodes
    }

    /// Returns the children in a list.
    pub fn list(&self, list: List) -> &[NodeId] {
        let start = list.start as usize;

        self.lists
            .get(start..start + list.len())
            .unwrap_or_default()
    }

    /// Returns the children of a node, or an empty slice for nodes without children.
    pub fn children(&self, id: NodeId) -> &[NodeId] {
        self.get(id)
            .and_then(Node::children)
            .map_or(&[], |list| self.list(list))
    }

    /// Appends a node and returns its id.
    pub fn push(&mut self, node: Node<'a>) -> NodeId {
        let id = NodeId(u32::try_from(self.nodes.len()).unwrap_or(u32::MAX));

        self.nodes.push(node);
        id
    }

    /// Stores a child list and returns its handle.
    pub fn push_list(&mut self, children: &[NodeId]) -> List {
        let start = u32::try_from(self.lists.len()).unwrap_or(u32::MAX);

        self.lists.extend_from_slice(children);

        List {
            len: u32::try_from(children.len()).unwrap_or(u32::MAX),
            start,
        }
    }

    /// Returns the node and list counts, used to roll back failed parse attempts.
    pub(crate) fn checkpoint(&self) -> (usize, usize) {
        (self.nodes.len(), self.lists.len())
    }

    /// Discards nodes and lists created after a checkpoint.
    pub(crate) fn rollback(&mut self, checkpoint: (usize, usize)) {
        self.nodes.truncate(checkpoint.0);
        self.lists.truncate(checkpoint.1);
    }
}
