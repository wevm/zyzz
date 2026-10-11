//! Serializes syntax trees back to CSS like css-tree's `generate`.
//!
//! Tokens are written without original whitespace. Between two tokens that would otherwise
//! merge, such as two identifiers, the generator inserts one space using css-tree's `safe`
//! token pair table.

use crate::ast::{Ast, Node, NodeId};
use crate::tokenizer::{TokenType, tokenize};

/// A generation failure where css-tree throws.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenerateError {
    /// css-tree's message, `Unknown node type: undefined`.
    pub message: &'static str,
}

impl std::fmt::Display for GenerateError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for GenerateError {}

/// Serializes a node and its descendants to CSS.
///
/// # Errors
///
/// Fails where css-tree throws: on the placeholder css-tree stores for `constructor()` in a
/// condition, and on a ratio without a second term, which parsing never produces.
pub fn generate(ast: &Ast<'_>, node: NodeId) -> Result<String, GenerateError> {
    let mut generator = Generator {
        ast,
        current: None,
        failed: false,
        previous: 0,
        sink: StringSink(String::with_capacity(64)),
    };

    generator.node(node);

    if generator.failed {
        return Err(GenerateError {
            message: UNKNOWN_NODE_TYPE,
        });
    }

    Ok(generator.sink.0)
}

/// css-tree's message for generating a value that is not a node.
const UNKNOWN_NODE_TYPE: &str = "Unknown node type: undefined";

/// One token emitted while generating, used by the lexer to match trees.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GeneratedToken {
    /// Token type.
    pub(crate) kind: TokenType,
    /// The innermost node being generated, absent for inserted whitespace.
    pub(crate) node: Option<NodeId>,
    /// Token text.
    pub(crate) value: String,
}

/// Generates a node as tokens attributed to the nodes that produced them, like css-tree's
/// lexer token decorator.
pub(crate) fn generate_tokens(
    ast: &Ast<'_>,
    node: NodeId,
) -> Result<Vec<GeneratedToken>, GenerateError> {
    let mut generator = Generator {
        ast,
        current: None,
        failed: false,
        previous: 0,
        sink: TokenSink(Vec::new()),
    };

    generator.node(node);

    if generator.failed {
        return Err(GenerateError {
            message: UNKNOWN_NODE_TYPE,
        });
    }

    Ok(generator.sink.0)
}

/// Receives generated text.
trait Sink {
    /// Writes token text made of `parts`.
    fn emit(&mut self, parts: &[&str], kind: TokenType, node: Option<NodeId>);
}

struct StringSink(String);

impl Sink for StringSink {
    fn emit(&mut self, parts: &[&str], _: TokenType, _: Option<NodeId>) {
        for part in parts {
            self.0.push_str(part);
        }
    }
}

struct TokenSink(Vec<GeneratedToken>);

impl Sink for TokenSink {
    fn emit(&mut self, parts: &[&str], kind: TokenType, node: Option<NodeId>) {
        self.0.push(GeneratedToken {
            kind,
            node,
            value: parts.concat(),
        });
    }
}

struct Generator<'t, 'a, S> {
    ast: &'t Ast<'a>,
    current: Option<NodeId>,
    /// Set where css-tree throws, after which nothing more is written.
    failed: bool,
    /// css-tree's `prevCode`: the previous token's pair code, with bit 0 requesting a space.
    previous: u32,
    sink: S,
}

impl<S: Sink> Generator<'_, '_, S> {
    fn node(&mut self, id: NodeId) {
        if self.failed {
            return;
        }

        let Some(node) = self.ast.get(id) else {
            return;
        };
        let saved = self.current.replace(id);

        self.generate_node(node);
        self.current = saved;
    }

    fn token(&mut self, kind: TokenType, parts: &[&str]) {
        self.token_with(kind, parts, false);
    }

    fn token_with(&mut self, kind: TokenType, parts: &[&str], suppress_space: bool) {
        let first = parts.iter().find_map(|part| part.bytes().next());

        self.previous = token_before(self.previous, kind, first);

        if !suppress_space && self.previous & 1 != 0 {
            self.sink.emit(&[" "], TokenType::WhiteSpace, None);
        }

        self.sink.emit(parts, kind, self.current);

        if kind == TokenType::Delim && first == Some(b'\\') {
            self.sink.emit(&["\n"], TokenType::WhiteSpace, None);
        }
    }

    /// Re-tokenizes raw text, suppressing inserted spaces inside it.
    fn tokenize(&mut self, raw: &str) {
        for token in tokenize(raw) {
            let text = raw
                .get(token.start as usize..token.end as usize)
                .unwrap_or_default();

            self.token_with(token.kind, &[text], token.start != 0);
        }
    }

    fn children(&mut self, id: NodeId) {
        for &child in self.ast.children(id) {
            self.node(child);
        }
    }

    fn children_separated(&mut self, id: NodeId, separator: Separator) {
        let mut previous: Option<NodeId> = None;

        for &child in self.ast.children(id) {
            if let Some(previous) = previous {
                match separator {
                    Separator::Comma => self.token(TokenType::Comma, &[","]),
                    Separator::SemicolonAfterDeclaration => {
                        if matches!(self.ast.get(previous), Some(Node::Declaration { .. })) {
                            self.token(TokenType::Semicolon, &[";"]);
                        }
                    }
                }
            }

            self.node(child);
            previous = Some(child);
        }
    }

    fn generate_node(&mut self, node: &Node<'_>) {
        let Some(id) = self.current else {
            return;
        };

        match node {
            Node::AnPlusB { a, b } => self.an_plus_b(a.as_deref(), b.as_deref()),
            Node::Atrule {
                block,
                name,
                prelude,
            } => {
                self.token(TokenType::AtKeyword, &["@", name]);

                if let Some(prelude) = prelude {
                    self.node(*prelude);
                }

                if let Some(block) = block {
                    self.node(*block);
                } else {
                    self.token(TokenType::Semicolon, &[";"]);
                }
            }
            Node::AttributeSelector {
                flags,
                matcher,
                name,
                value,
            } => {
                self.token(TokenType::Delim, &["["]);
                self.node(*name);

                if let Some(matcher) = matcher {
                    self.tokenize(matcher);

                    if let Some(value) = value {
                        self.node(*value);
                    }
                }

                if let Some(flags) = flags {
                    self.token(TokenType::Ident, &[flags]);
                }

                self.token(TokenType::Delim, &["]"]);
            }
            Node::Block { .. } => {
                self.token(TokenType::LeftCurlyBracket, &["{"]);
                self.children_separated(id, Separator::SemicolonAfterDeclaration);
                self.token(TokenType::RightCurlyBracket, &["}"]);
            }
            Node::Brackets { .. } => {
                self.token(TokenType::Delim, &["["]);
                self.children(id);
                self.token(TokenType::Delim, &["]"]);
            }
            Node::Cdc => self.token(TokenType::Cdc, &["-->"]),
            Node::Cdo => self.token(TokenType::Cdo, &["<!--"]),
            Node::ClassSelector { name } => {
                self.token(TokenType::Delim, &["."]);
                self.token(TokenType::Ident, &[name]);
            }
            Node::Combinator { name } | Node::Layer { name } | Node::TypeSelector { name } => {
                self.tokenize(name);
            }
            Node::Comment { value } => self.token(TokenType::Comment, &["/*", value, "*/"]),
            Node::Condition { .. } => {
                for &child in self.ast.children(id) {
                    if matches!(self.ast.get(child), Some(Node::Condition { .. })) {
                        self.token(TokenType::LeftParenthesis, &["("]);
                        self.node(child);
                        self.token(TokenType::RightParenthesis, &[")"]);
                    } else {
                        self.node(child);
                    }
                }
            }
            Node::Declaration {
                important,
                property,
                value,
            } => {
                self.token(TokenType::Ident, &[property]);
                self.token(TokenType::Colon, &[":"]);
                self.node(*value);

                if let Some(important) = important {
                    self.token(TokenType::Delim, &["!"]);
                    self.token(TokenType::Ident, &[important]);
                }
            }
            Node::DeclarationList { .. } => {
                self.children_separated(id, Separator::SemicolonAfterDeclaration);
            }
            Node::Dimension { unit, value } => self.token(TokenType::Dimension, &[value, unit]),
            Node::Feature { name, value, .. } => {
                self.token(TokenType::LeftParenthesis, &["("]);
                self.token(TokenType::Ident, &[name]);

                if let Some(value) = value {
                    self.token(TokenType::Colon, &[":"]);
                    self.node(*value);
                }

                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::FeatureFunction { feature, value, .. } => {
                self.token(TokenType::Function, &[feature, "("]);

                let Some(value) = value else {
                    self.failed = true;
                    return;
                };

                self.node(*value);
                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::FeatureRange {
                left,
                left_comparison,
                middle,
                right,
                right_comparison,
                ..
            } => {
                self.token(TokenType::LeftParenthesis, &["("]);
                self.node(*left);
                self.tokenize(left_comparison);
                self.node(*middle);

                if let Some(right) = right {
                    if let Some(comparison) = right_comparison {
                        self.tokenize(comparison);
                    }

                    self.node(*right);
                }

                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::Function { name, .. } => {
                self.token(TokenType::Function, &[name, "("]);
                self.children(id);
                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::GeneralEnclosed { function, .. } => {
                if let Some(function) = function {
                    self.token(TokenType::Function, &[function, "("]);
                } else {
                    self.token(TokenType::LeftParenthesis, &["("]);
                }

                self.children(id);
                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::Hash { value } => self.token(TokenType::Hash, &["#", value]),
            Node::IdSelector { name } => self.token(TokenType::Delim, &["#", name]),
            Node::Identifier { name } => self.token(TokenType::Ident, &[name]),
            Node::LayerList { .. } | Node::MediaQueryList { .. } | Node::SelectorList { .. } => {
                self.children_separated(id, Separator::Comma);
            }
            Node::MediaQuery {
                condition,
                media_type,
                modifier,
            } => {
                if let Some(media_type) = media_type.filter(|value| !value.is_empty()) {
                    if let Some(modifier) = modifier.filter(|value| !value.is_empty()) {
                        self.token(TokenType::Ident, &[modifier]);
                    }

                    self.token(TokenType::Ident, &[media_type]);

                    if let Some(condition) = condition {
                        self.token(TokenType::Ident, &["and"]);
                        self.node(*condition);
                    }
                } else if let Some(condition) = condition {
                    self.node(*condition);
                }
            }
            Node::NestingSelector => self.token(TokenType::Delim, &["&"]),
            Node::Nth { nth, selector } => {
                self.node(*nth);

                if let Some(selector) = selector {
                    self.token(TokenType::Ident, &["of"]);
                    self.node(*selector);
                }
            }
            Node::Number { value } => self.token(TokenType::Number, &[value]),
            Node::Operator { value } => self.tokenize(value),
            Node::Parentheses { .. } => {
                self.token(TokenType::LeftParenthesis, &["("]);
                self.children(id);
                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::Percentage { value } => self.token(TokenType::Percentage, &[value, "%"]),
            Node::PseudoClassSelector { children, name } => {
                self.token(TokenType::Colon, &[":"]);
                self.pseudo(id, name, children.is_some());
            }
            Node::PseudoElementSelector { children, name } => {
                self.token(TokenType::Colon, &[":"]);
                self.token(TokenType::Colon, &[":"]);
                self.pseudo(id, name, children.is_some());
            }
            Node::Ratio { left, right } => {
                self.node(*left);
                self.token(TokenType::Delim, &["/"]);

                match right {
                    Some(right) => self.node(*right),
                    None => self.failed = true,
                }
            }
            Node::Raw { value } | Node::UnicodeRange { value } => self.tokenize(value),
            Node::Rule { block, prelude } => {
                self.node(*prelude);
                self.node(*block);
            }
            Node::Scope { limit, root } => {
                if let Some(root) = root {
                    self.token(TokenType::LeftParenthesis, &["("]);
                    self.node(*root);
                    self.token(TokenType::RightParenthesis, &[")"]);
                }

                if let Some(limit) = limit {
                    self.token(TokenType::Ident, &["to"]);
                    self.token(TokenType::LeftParenthesis, &["("]);
                    self.node(*limit);
                    self.token(TokenType::RightParenthesis, &[")"]);
                }
            }
            Node::AtrulePrelude { .. }
            | Node::Selector { .. }
            | Node::StyleSheet { .. }
            | Node::Value { .. } => self.children(id),
            Node::String { value } => {
                let encoded = crate::string::encode(value, false);

                self.token(TokenType::String, &[&encoded]);
            }
            Node::SupportsDeclaration { declaration } => {
                self.token(TokenType::LeftParenthesis, &["("]);
                self.node(*declaration);
                self.token(TokenType::RightParenthesis, &[")"]);
            }
            Node::Url { value } => {
                let encoded = crate::url::encode(value);

                self.token(TokenType::Url, &[&encoded]);
            }
            Node::WhiteSpace { value } => self.token(TokenType::WhiteSpace, &[value]),
        }
    }

    fn pseudo(&mut self, id: NodeId, name: &str, functional: bool) {
        if functional {
            self.token(TokenType::Function, &[name, "("]);
            self.children(id);
            self.token(TokenType::RightParenthesis, &[")"]);
        } else {
            self.token(TokenType::Ident, &[name]);
        }
    }

    fn an_plus_b(&mut self, a: Option<&str>, b: Option<&str>) {
        let Some(a) = a.filter(|value| !value.is_empty()) else {
            if let Some(b) = b {
                self.tokenize(b);
            }

            return;
        };
        let mut text = String::with_capacity(a.len() + 8);

        match a {
            "+1" | "1" => text.push('n'),
            "-1" => text.push_str("-n"),
            _ => {
                text.push_str(a);
                text.push('n');
            }
        }

        if let Some(b) = b.filter(|value| !value.is_empty()) {
            if !b.starts_with(['-', '+']) {
                text.push('+');
            }

            text.push_str(b);
        }

        self.tokenize(&text);
    }
}

/// How children are separated.
#[derive(Clone, Copy)]
enum Separator {
    Comma,
    SemicolonAfterDeclaration,
}

/// css-tree's pair code for a token: a delimiter's first code point (non-ASCII as 0x80)
/// shifted by 7, or the token type shifted by 1.
const fn pair_code(kind: TokenType, first: Option<u8>) -> u32 {
    if let TokenType::Delim = kind {
        let code = match first {
            Some(code) if code < 0x80 => code as u32,
            Some(_) => 0x80,
            None => 0,
        };

        return code << 7;
    }

    (kind as u32) << 1
}

/// A side of a token pair in css-tree's tables: a token type or a delimiter character.
#[derive(Clone, Copy)]
enum Side {
    Char(u8),
    Type(TokenType),
}

impl Side {
    const fn code(self) -> u32 {
        match self {
            Self::Char(code) => (code as u32) << 7,
            Self::Type(kind) => (kind as u32) << 1,
        }
    }
}

/// Builds the sorted set of pair keys that need a space between them.
const fn safe_pair_keys() -> [u32; SAFE_PAIRS.len()] {
    let mut keys = [0u32; SAFE_PAIRS.len()];
    let mut index = 0;

    while index < SAFE_PAIRS.len() {
        let (previous, next) = SAFE_PAIRS[index];

        keys[index] = (previous.code() << 16) | next.code();
        index += 1;
    }

    // Insertion sort, which is fine at compile time for a table this small.
    let mut outer = 1;

    while outer < keys.len() {
        let mut inner = outer;

        while inner > 0 && keys[inner - 1] > keys[inner] {
            let swap = keys[inner - 1];

            keys[inner - 1] = keys[inner];
            keys[inner] = swap;
            inner -= 1;
        }

        outer += 1;
    }

    keys
}

static SAFE_KEYS: [u32; SAFE_PAIRS.len()] = safe_pair_keys();

/// css-tree's `safe` token pairs: the specification pairs plus extra pairs that keep output
/// readable in legacy browsers. Order matches css-tree and does not affect lookups.
const SAFE_PAIRS: [(Side, Side); 93] = {
    use Side::{Char, Type};
    use TokenType::{
        AtKeyword, BadUrl, Cdc, Colon, Dimension, Function, Hash, Ident, LeftParenthesis, Number,
        Percentage, RightParenthesis, String, Url,
    };

    [
        (Type(Ident), Type(Ident)),
        (Type(Ident), Type(Function)),
        (Type(Ident), Type(Url)),
        (Type(Ident), Type(BadUrl)),
        (Type(Ident), Char(b'-')),
        (Type(Ident), Type(Number)),
        (Type(Ident), Type(Percentage)),
        (Type(Ident), Type(Dimension)),
        (Type(Ident), Type(Cdc)),
        (Type(Ident), Type(LeftParenthesis)),
        (Type(AtKeyword), Type(Ident)),
        (Type(AtKeyword), Type(Function)),
        (Type(AtKeyword), Type(Url)),
        (Type(AtKeyword), Type(BadUrl)),
        (Type(AtKeyword), Char(b'-')),
        (Type(AtKeyword), Type(Number)),
        (Type(AtKeyword), Type(Percentage)),
        (Type(AtKeyword), Type(Dimension)),
        (Type(AtKeyword), Type(Cdc)),
        (Type(Hash), Type(Ident)),
        (Type(Hash), Type(Function)),
        (Type(Hash), Type(Url)),
        (Type(Hash), Type(BadUrl)),
        (Type(Hash), Char(b'-')),
        (Type(Hash), Type(Number)),
        (Type(Hash), Type(Percentage)),
        (Type(Hash), Type(Dimension)),
        (Type(Hash), Type(Cdc)),
        (Type(Dimension), Type(Ident)),
        (Type(Dimension), Type(Function)),
        (Type(Dimension), Type(Url)),
        (Type(Dimension), Type(BadUrl)),
        (Type(Dimension), Char(b'-')),
        (Type(Dimension), Type(Number)),
        (Type(Dimension), Type(Percentage)),
        (Type(Dimension), Type(Dimension)),
        (Type(Dimension), Type(Cdc)),
        (Char(b'#'), Type(Ident)),
        (Char(b'#'), Type(Function)),
        (Char(b'#'), Type(Url)),
        (Char(b'#'), Type(BadUrl)),
        (Char(b'#'), Char(b'-')),
        (Char(b'#'), Type(Number)),
        (Char(b'#'), Type(Percentage)),
        (Char(b'#'), Type(Dimension)),
        (Char(b'#'), Type(Cdc)),
        (Char(b'-'), Type(Ident)),
        (Char(b'-'), Type(Function)),
        (Char(b'-'), Type(Url)),
        (Char(b'-'), Type(BadUrl)),
        (Char(b'-'), Char(b'-')),
        (Char(b'-'), Type(Number)),
        (Char(b'-'), Type(Percentage)),
        (Char(b'-'), Type(Dimension)),
        (Char(b'-'), Type(Cdc)),
        (Type(Number), Type(Ident)),
        (Type(Number), Type(Function)),
        (Type(Number), Type(Url)),
        (Type(Number), Type(BadUrl)),
        (Type(Number), Type(Number)),
        (Type(Number), Type(Percentage)),
        (Type(Number), Type(Dimension)),
        (Type(Number), Char(b'%')),
        (Type(Number), Type(Cdc)),
        (Char(b'@'), Type(Ident)),
        (Char(b'@'), Type(Function)),
        (Char(b'@'), Type(Url)),
        (Char(b'@'), Type(BadUrl)),
        (Char(b'@'), Char(b'-')),
        (Char(b'@'), Type(Cdc)),
        (Char(b'.'), Type(Number)),
        (Char(b'.'), Type(Percentage)),
        (Char(b'.'), Type(Dimension)),
        (Char(b'+'), Type(Number)),
        (Char(b'+'), Type(Percentage)),
        (Char(b'+'), Type(Dimension)),
        (Char(b'/'), Char(b'*')),
        (Type(Ident), Type(Hash)),
        (Type(Dimension), Type(Hash)),
        (Type(Hash), Type(Hash)),
        (Type(AtKeyword), Type(LeftParenthesis)),
        (Type(AtKeyword), Type(String)),
        (Type(AtKeyword), Type(Colon)),
        (Type(Percentage), Type(Percentage)),
        (Type(Percentage), Type(Dimension)),
        (Type(Percentage), Type(Function)),
        (Type(Percentage), Char(b'-')),
        (Type(RightParenthesis), Type(Ident)),
        (Type(RightParenthesis), Type(Function)),
        (Type(RightParenthesis), Type(Percentage)),
        (Type(RightParenthesis), Type(Dimension)),
        (Type(RightParenthesis), Type(Hash)),
        (Type(RightParenthesis), Char(b'-')),
    ]
};

/// css-tree's `tokenBefore.safe`: returns the next token's pair code with bit 0 set when a
/// space must separate it from the previous token.
fn token_before(previous: u32, kind: TokenType, first: Option<u8>) -> u32 {
    let next = pair_code(kind, first);
    let previous = (previous & 0xFFFE) << 16;
    let sign = match first {
        Some(b'-') => !matches!(
            kind,
            TokenType::Ident | TokenType::Function | TokenType::Cdc
        ),
        Some(b'+') => true,
        _ => false,
    };
    let key = if sign {
        previous | (u32::from(first.unwrap_or(0)) << 7)
    } else {
        previous | next
    };

    next | u32::from(SAFE_KEYS.binary_search(&key).is_ok())
}
