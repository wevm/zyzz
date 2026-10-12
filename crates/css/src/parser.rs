//! CSS parser producing css-tree's syntax trees.
//!
//! The parser ports css-tree's recursive descent and error recovery. Every place css-tree
//! catches a parse error with `parseWithFallback` rolls back here too, so malformed input yields
//! the same `Raw` fallbacks. Parse functions return [`SyntaxError`] where css-tree throws.

mod conditions;
mod rules;
mod selectors;
mod values;

use std::borrow::Cow;

use crate::ast::{Ast, ConditionKind, List, Node, NodeId};
use crate::tokenizer::{
    TokenStream, TokenType, byte_at, cmp_char, cmp_str, consume_number, find_white_space_start,
};

/// Nesting depth past which parsing fails, standing in for JavaScript's call stack limit.
///
/// css-tree recurses for nested blocks, functions, and conditions, and a stack overflow there is
/// caught by the nearest error recovery. Sequences, blocks, conditions, and selector lists each
/// count one level, so this allows about 512 levels of CSS nesting in about 512 KiB of native
/// stack. css-tree itself overflows somewhere between 1,000 and 5,000 levels, depending on the
/// JavaScript engine's stack.
const MAX_DEPTH: usize = 512;

/// What to parse, like css-tree's `context` option.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Context<'o> {
    /// One at-rule.
    Atrule,
    /// An at-rule prelude, using the named at-rule's prelude grammar when it has one.
    AtrulePrelude {
        /// The at-rule name without `@`.
        atrule: Option<&'o str>,
    },
    /// A `{}` block of declarations.
    Block,
    /// A media, container, or supports condition.
    Condition {
        /// The condition kind.
        kind: ConditionKind,
    },
    /// One declaration.
    Declaration,
    /// Declarations without braces.
    DeclarationList,
    /// One media query.
    MediaQuery,
    /// A comma-separated media query list.
    MediaQueryList,
    /// One style rule.
    Rule,
    /// One complex selector.
    Selector,
    /// A selector list.
    SelectorList,
    /// A stylesheet, css-tree's default context.
    #[default]
    StyleSheet,
    /// A declaration value.
    Value,
}

/// Parse options, mirroring css-tree's options that affect the tree.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[expect(
    clippy::struct_excessive_bools,
    reason = "The flags mirror css-tree's independent boolean options."
)]
pub struct ParseOptions<'o> {
    /// What to parse.
    pub context: Context<'o>,
    /// Whether at-rule preludes are parsed (default `true`) or kept as `Raw`.
    pub parse_atrule_prelude: bool,
    /// Whether custom property values are parsed (default `false`) or kept as `Raw`.
    pub parse_custom_property: bool,
    /// Whether rule preludes are parsed (default `true`) or kept as `Raw`.
    pub parse_rule_prelude: bool,
    /// Whether declaration values are parsed (default `true`) or kept as `Raw`.
    pub parse_value: bool,
}

impl Default for ParseOptions<'_> {
    fn default() -> Self {
        Self {
            context: Context::StyleSheet,
            parse_atrule_prelude: true,
            parse_custom_property: false,
            parse_rule_prelude: true,
            parse_value: true,
        }
    }
}

impl<'o> ParseOptions<'o> {
    /// Returns default options for a context.
    pub fn context(context: Context<'o>) -> Self {
        Self {
            context,
            ..Self::default()
        }
    }
}

/// A parse error with css-tree's message.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyntaxError {
    /// css-tree's error message, such as `Identifier is expected`.
    pub message: Cow<'static, str>,
    /// UTF-8 byte offset css-tree reports for the error.
    pub offset: usize,
}

impl std::fmt::Display for SyntaxError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for SyntaxError {}

/// Result of a parse step.
pub(crate) type PResult<T> = Result<T, SyntaxError>;

/// The recognizer that reads sequence items, like css-tree's `scope`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Scope {
    /// At-rule preludes without a dedicated grammar.
    AtrulePrelude,
    /// Selectors.
    Selector,
    /// Values, which special-case `var()` and `expression()`.
    Value,
}

/// A function argument reader: a scope or `@import`'s `layer()` and `supports()` readers.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Recognizer {
    /// `@import` argument functions, which have no fallback sequence reader.
    ImportFunctions,
    /// A sequence scope.
    Scope(Scope),
}

/// Stop rule for `Raw` consumption. css-tree passes these as callbacks.
pub(crate) mod stop {
    /// Never stops before a balance edge.
    pub(crate) fn balance_end(_: u8) -> u8 {
        0
    }

    /// Stops before `{`.
    pub(crate) fn left_curly_bracket(code: u8) -> u8 {
        u8::from(code == b'{')
    }

    /// Stops before `{` or `;`.
    pub(crate) fn left_curly_bracket_or_semicolon(code: u8) -> u8 {
        u8::from(code == b'{' || code == b';')
    }

    /// Stops before `!` or `;`.
    pub(crate) fn exclamation_mark_or_semicolon(code: u8) -> u8 {
        u8::from(code == b'!' || code == b';')
    }

    /// Stops after `;`.
    pub(crate) fn semicolon_included(code: u8) -> u8 {
        if code == b';' { 2 } else { 0 }
    }
}

/// Parses CSS source into a syntax tree.
///
/// # Errors
///
/// Returns css-tree's error when the context's grammar fails without recovery or input remains
/// after it, as with `a;b` in the value context.
pub fn parse<'a>(source: &'a str, options: &ParseOptions<'_>) -> Result<Ast<'a>, SyntaxError> {
    let mut parser = Parser::new(source, options);
    let root = parser.parse_context(options.context)?;

    if !parser.stream.eof {
        return Err(parser.error(None, None));
    }

    parser.ast.set_root(root);
    Ok(parser.ast)
}

/// Parser state: the token stream, the tree under construction, and a child stack.
#[expect(
    clippy::struct_excessive_bools,
    reason = "The flags mirror css-tree's independent boolean options."
)]
pub(crate) struct Parser<'a> {
    pub(crate) ast: Ast<'a>,
    depth: usize,
    pub(crate) parse_atrule_prelude: bool,
    pub(crate) parse_custom_property: bool,
    pub(crate) parse_rule_prelude: bool,
    pub(crate) parse_value: bool,
    /// Children of lists under construction. Each list owns the entries above its base.
    scratch: Vec<NodeId>,
    pub(crate) stream: TokenStream<'a>,
}

impl<'a> Parser<'a> {
    fn new(source: &'a str, options: &ParseOptions<'_>) -> Self {
        Self {
            ast: Ast::new(),
            depth: 0,
            parse_atrule_prelude: options.parse_atrule_prelude,
            parse_custom_property: options.parse_custom_property,
            parse_rule_prelude: options.parse_rule_prelude,
            parse_value: options.parse_value,
            scratch: Vec::new(),
            stream: TokenStream::new(source),
        }
    }

    fn parse_context(&mut self, context: Context<'_>) -> PResult<NodeId> {
        match context {
            Context::Atrule => self.atrule(false),
            Context::AtrulePrelude { atrule } => self.atrule_prelude(atrule),
            Context::Block => self.block(true),
            Context::Condition { kind } => self.condition(kind),
            Context::Declaration => self.declaration(),
            Context::DeclarationList => self.declaration_list(),
            Context::MediaQuery => self.media_query(),
            Context::MediaQueryList => self.media_query_list(),
            Context::Rule => self.rule(),
            Context::Selector => self.selector(),
            Context::SelectorList => self.selector_list(),
            Context::StyleSheet => self.style_sheet(),
            Context::Value => self.value(),
        }
    }

    /// Runs a nested parse step under the depth limit.
    pub(crate) fn nested<T>(&mut self, step: impl FnOnce(&mut Self) -> PResult<T>) -> PResult<T> {
        if self.depth >= MAX_DEPTH {
            return Err(self.error(Some("Maximum call stack size exceeded"), None));
        }

        self.depth += 1;
        let result = step(self);
        self.depth -= 1;
        result
    }

    /// Runs `consumer`, and on error rewinds the tokens and tree and runs `fallback`.
    pub(crate) fn parse_with_fallback<T>(
        &mut self,
        consumer: impl FnOnce(&mut Self) -> PResult<T>,
        fallback: impl FnOnce(&mut Self) -> PResult<T>,
    ) -> PResult<T> {
        let start = self.stream.token_index;
        let checkpoint = self.ast.checkpoint();
        let scratch = self.scratch.len();

        if let Ok(value) = consumer(self) {
            return Ok(value);
        }

        self.stream.skip_to(start);
        self.ast.rollback(checkpoint);
        self.scratch.truncate(scratch);
        fallback(self)
    }

    /// Builds an error at an explicit offset, the end of input, or the current token.
    #[cold]
    pub(crate) fn error(
        &self,
        message: Option<&'static str>,
        offset: Option<usize>,
    ) -> SyntaxError {
        self.error_owned(Cow::Borrowed(message.unwrap_or("Unexpected input")), offset)
    }

    /// Builds an error with a computed message.
    #[cold]
    pub(crate) fn error_owned(
        &self,
        message: Cow<'static, str>,
        offset: Option<usize>,
    ) -> SyntaxError {
        let length = self.stream.bytes.len();
        let offset = match offset {
            Some(offset) if offset < length => offset,
            _ if self.stream.eof => {
                find_white_space_start(self.stream.bytes, length.checked_sub(1))
            }
            _ => self.stream.token_start,
        };

        SyntaxError {
            message: if message.is_empty() {
                Cow::Borrowed("Unexpected input")
            } else {
                message
            },
            offset,
        }
    }

    /// Returns the current list base for [`Parser::finish_list`].
    #[inline]
    pub(crate) fn begin_list(&self) -> usize {
        self.scratch.len()
    }

    /// Adds a child to the innermost list under construction.
    #[inline]
    pub(crate) fn push_child(&mut self, child: NodeId) {
        self.scratch.push(child);
    }

    /// Returns the last child of the list that started at `base`.
    pub(crate) fn last_child(&self, base: usize) -> Option<NodeId> {
        if self.scratch.len() > base {
            self.scratch.last().copied()
        } else {
            None
        }
    }

    /// Stores the children above `base` as a list.
    pub(crate) fn finish_list(&mut self, base: usize) -> List {
        let list = self
            .ast
            .push_list(self.scratch.get(base..).unwrap_or_default());

        self.scratch.truncate(base);
        list
    }

    /// Stores a one-node list.
    pub(crate) fn single_list(&mut self, node: NodeId) -> List {
        self.ast.push_list(&[node])
    }

    /// Appends a node.
    #[inline]
    pub(crate) fn push(&mut self, node: Node<'a>) -> NodeId {
        self.ast.push(node)
    }

    /// Reports whether a node satisfies a predicate on its variant.
    pub(crate) fn is(&self, id: NodeId, test: fn(&Node<'a>) -> bool) -> bool {
        self.ast.get(id).is_some_and(test)
    }

    /// Returns the source between two offsets like JavaScript `substring`, which swaps
    /// reversed bounds.
    pub(crate) fn substring(&self, start: usize, end: usize) -> &'a str {
        let (start, end) = if start > end {
            (end, start)
        } else {
            (start, end)
        };
        let source = self.stream.source;

        source.get(start..end.min(source.len())).unwrap_or_default()
    }

    /// Returns the source from `start` to the current token.
    pub(crate) fn substr_to_cursor(&self, start: usize) -> &'a str {
        self.substring(start, self.stream.token_start)
    }

    /// Reads a source byte, zero outside the source.
    #[inline]
    pub(crate) fn char_code_at(&self, offset: usize) -> u8 {
        byte_at(self.stream.bytes, offset)
    }

    /// Compares a source byte with a lowercase ASCII reference.
    pub(crate) fn cmp_char(&self, offset: usize, reference: u8) -> bool {
        cmp_char(self.stream.bytes, offset, reference)
    }

    /// Compares a source range with a lowercase reference.
    pub(crate) fn cmp_str(&self, start: usize, end: usize, reference: &str) -> bool {
        cmp_str(self.stream.bytes, start, end, reference)
    }

    /// Advances one token.
    #[inline]
    pub(crate) fn next(&mut self) {
        self.stream.next();
    }

    /// Skips whitespace and comments.
    #[inline]
    pub(crate) fn skip_sc(&mut self) {
        self.stream.skip_sc();
    }

    /// Reports whether the current token is a delimiter with the given byte.
    #[inline]
    pub(crate) fn is_delim(&self, code: u8) -> bool {
        self.stream.is_delim(code, 0)
    }

    /// Returns the first type at or after a relative offset that is not whitespace or a comment.
    pub(crate) fn lookup_non_ws_type(&self, mut offset: isize) -> TokenType {
        loop {
            let kind = self.stream.lookup_type(offset);

            offset += 1;

            if kind != TokenType::WhiteSpace && kind != TokenType::Comment {
                return kind;
            }
        }
    }

    /// Consumes a token of the expected type or fails with css-tree's message.
    pub(crate) fn eat(&mut self, expected: TokenType) -> PResult<()> {
        if self.stream.token_type != expected {
            return Err(self.eat_error(expected));
        }

        self.next();
        Ok(())
    }

    #[cold]
    fn eat_error(&mut self, expected: TokenType) -> SyntaxError {
        let mut offset = self.stream.token_start;
        let mut message: Cow<'static, str> = Cow::Borrowed(expected_message(expected));

        match expected {
            TokenType::Ident => {
                if matches!(self.stream.token_type, TokenType::Function | TokenType::Url) {
                    offset = self.stream.token_end - 1;
                    message = Cow::Borrowed("Identifier is expected but function found");
                } else {
                    message = Cow::Borrowed("Identifier is expected");
                }
            }
            TokenType::Hash => {
                if self.is_delim(b'#') {
                    self.next();
                    offset += 1;
                    message = Cow::Borrowed("Name is expected");
                }
            }
            TokenType::Percentage if self.stream.token_type == TokenType::Number => {
                offset = self.stream.token_end;
                message = Cow::Borrowed("Percent sign is expected");
            }
            _ => {}
        }

        self.error_owned(message, Some(offset))
    }

    /// Consumes an identifier equal to `name`, ignoring ASCII case.
    pub(crate) fn eat_ident(&mut self, name: &'static str) -> PResult<()> {
        if self.stream.token_type != TokenType::Ident || !self.stream.lookup_value(0, name) {
            return Err(self.error_owned(
                Cow::Owned(format!("Identifier \"{name}\" is expected")),
                None,
            ));
        }

        self.next();
        Ok(())
    }

    /// Consumes a delimiter with the given byte.
    pub(crate) fn eat_delim(&mut self, code: u8) -> PResult<()> {
        if !self.is_delim(code) {
            return Err(self.error_owned(
                Cow::Owned(format!("Delim \"{}\" is expected", char::from(code))),
                None,
            ));
        }

        self.next();
        Ok(())
    }

    /// Consumes a token and returns the source up to the next token.
    pub(crate) fn consume(&mut self, expected: TokenType) -> PResult<&'a str> {
        let start = self.stream.token_start;

        self.eat(expected)?;
        Ok(self.substr_to_cursor(start))
    }

    /// Consumes a function token and returns its name.
    pub(crate) fn consume_function_name(&mut self) -> PResult<&'a str> {
        let name = self.substring(
            self.stream.token_start,
            self.stream.token_end.saturating_sub(1),
        );

        self.eat(TokenType::Function)?;
        Ok(name)
    }

    /// Consumes a numeric token and returns its numeric part.
    pub(crate) fn consume_number_token(&mut self, expected: TokenType) -> PResult<&'a str> {
        let start = self.stream.token_start;
        let number = self.substring(start, consume_number(self.stream.bytes, start));

        self.eat(expected)?;
        Ok(number)
    }

    /// Reads a sequence of nodes with a scope, like css-tree's `readSequence`.
    pub(crate) fn read_sequence(&mut self, scope: Scope) -> PResult<List> {
        self.nested(|parser| {
            let base = parser.begin_list();
            let mut space = false;

            while !parser.stream.eof {
                match parser.stream.token_type {
                    TokenType::Comment => {
                        parser.next();
                        continue;
                    }
                    TokenType::WhiteSpace => {
                        space = true;
                        parser.next();
                        continue;
                    }
                    _ => {}
                }

                let Some(child) = parser.scope_node(scope)? else {
                    break;
                };

                if space {
                    parser.on_white_space(scope, Some(child), base);
                    space = false;
                }

                parser.push_child(child);
            }

            if space {
                parser.on_white_space(scope, None, base);
            }

            Ok(parser.finish_list(base))
        })
    }

    /// Reads one node with a scope's recognizer, or `None` to end the sequence.
    fn scope_node(&mut self, scope: Scope) -> PResult<Option<NodeId>> {
        match scope {
            Scope::AtrulePrelude | Scope::Value => self.default_node(scope),
            Scope::Selector => self.selector_node(),
        }
    }

    /// Applies a scope's whitespace rule between `next` and the previous child.
    fn on_white_space(&mut self, scope: Scope, next: Option<NodeId>, base: usize) {
        match scope {
            Scope::AtrulePrelude => {}
            Scope::Selector => {
                let last = self.last_child(base);

                if let Some(last) = last
                    && !self.is(last, |node| matches!(node, Node::Combinator { .. }))
                    && let Some(next) = next
                    && !self.is(next, |node| matches!(node, Node::Combinator { .. }))
                {
                    let combinator = self.push(Node::Combinator { name: " " });

                    self.push_child(combinator);
                }
            }
            Scope::Value => {
                if let Some(next) = next
                    && let Some(Node::Operator { value }) = self.ast.get_mut(next)
                    && is_plus_minus(value)
                {
                    *value = Cow::Owned(format!(" {value}"));
                }

                if let Some(last) = self.last_child(base)
                    && let Some(Node::Operator { value }) = self.ast.get_mut(last)
                    && is_plus_minus(value)
                {
                    value.to_mut().push(' ');
                }
            }
        }
    }

    /// css-tree's default recognizer, shared by values and at-rule preludes.
    fn default_node(&mut self, scope: Scope) -> PResult<Option<NodeId>> {
        let start = self.stream.token_start;

        Ok(Some(match self.stream.token_type {
            TokenType::Hash => self.hash()?,
            TokenType::Comma => self.operator(),
            TokenType::LeftParenthesis => self.parentheses(scope)?,
            TokenType::LeftSquareBracket => self.brackets(scope)?,
            TokenType::String => self.string()?,
            TokenType::Dimension => self.dimension()?,
            TokenType::Percentage => self.percentage()?,
            TokenType::Number => self.number()?,
            TokenType::Function => {
                if self.cmp_str(start, self.stream.token_end, "url(") {
                    self.url()?
                } else {
                    self.function(Recognizer::Scope(scope))?
                }
            }
            TokenType::Url => self.url()?,
            TokenType::Ident => {
                if self.cmp_char(start, b'u') && self.cmp_char(start + 1, b'+') {
                    self.unicode_range()?
                } else {
                    self.identifier()?
                }
            }
            TokenType::Delim => match self.char_code_at(start) {
                b'/' | b'*' | b'+' | b'-' => self.operator(),
                b'#' => {
                    return Err(self.error(Some("Hex or identifier is expected"), Some(start + 1)));
                }
                _ => return Ok(None),
            },
            _ => return Ok(None),
        }))
    }
}

/// Reports whether an operator ends with `+` or `-`.
fn is_plus_minus(value: &str) -> bool {
    value.ends_with('+') || value.ends_with('-')
}

/// css-tree's `eat` message for a token type: the token name without `-token`, with hyphens as
/// spaces and the first letter capitalized, quoted when it is a bracket.
const fn expected_message(kind: TokenType) -> &'static str {
    match kind {
        TokenType::Eof => "EOF is expected",
        TokenType::Ident => "Ident is expected",
        TokenType::Function => "Function is expected",
        TokenType::AtKeyword => "At keyword is expected",
        TokenType::Hash => "Hash is expected",
        TokenType::String => "String is expected",
        TokenType::BadString => "Bad string is expected",
        TokenType::Url => "Url is expected",
        TokenType::BadUrl => "Bad url is expected",
        TokenType::Delim => "Delim is expected",
        TokenType::Number => "Number is expected",
        TokenType::Percentage => "Percentage is expected",
        TokenType::Dimension => "Dimension is expected",
        TokenType::WhiteSpace => "Whitespace is expected",
        TokenType::Cdo => "CDO is expected",
        TokenType::Cdc => "CDC is expected",
        TokenType::Colon => "Colon is expected",
        TokenType::Semicolon => "Semicolon is expected",
        TokenType::Comma => "Comma is expected",
        TokenType::LeftSquareBracket => "\"[\" is expected",
        TokenType::RightSquareBracket => "\"]\" is expected",
        TokenType::LeftParenthesis => "\"(\" is expected",
        TokenType::RightParenthesis => "\")\" is expected",
        TokenType::LeftCurlyBracket => "\"{\" is expected",
        TokenType::RightCurlyBracket => "\"}\" is expected",
        TokenType::Comment => "Comment is expected",
    }
}
