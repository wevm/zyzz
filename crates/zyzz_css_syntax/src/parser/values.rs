//! Value components: identifiers, numbers, strings, urls, functions, and blocks.

use std::borrow::Cow;

use super::{PResult, Parser, Recognizer, Scope, stop};
use crate::ast::{ConditionKind, List, Node, NodeId};
use crate::tokenizer::{TokenType, is_hex_digit};

impl Parser<'_> {
    /// `Value`.
    pub(crate) fn value(&mut self) -> PResult<NodeId> {
        let children = self.read_sequence(Scope::Value)?;

        Ok(self.push(Node::Value { children }))
    }

    /// `Identifier`.
    pub(crate) fn identifier(&mut self) -> PResult<NodeId> {
        let name = self.consume(TokenType::Ident)?;

        Ok(self.push(Node::Identifier { name }))
    }

    /// `Number`.
    pub(crate) fn number(&mut self) -> PResult<NodeId> {
        let value = self.consume(TokenType::Number)?;

        Ok(self.push(Node::Number { value }))
    }

    /// `Dimension`.
    pub(crate) fn dimension(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let value = self.consume_number_token(TokenType::Dimension)?;
        let unit = self.substring(start + value.len(), self.stream.token_start);

        Ok(self.push(Node::Dimension { unit, value }))
    }

    /// `Percentage`.
    pub(crate) fn percentage(&mut self) -> PResult<NodeId> {
        let value = self.consume_number_token(TokenType::Percentage)?;

        Ok(self.push(Node::Percentage { value }))
    }

    /// `String`.
    pub(crate) fn string(&mut self) -> PResult<NodeId> {
        let token = self.consume(TokenType::String)?;
        let value = Cow::Owned(crate::string::decode(token));

        Ok(self.push(Node::String { value }))
    }

    /// `Url`: an unquoted url token or `url(` with a string.
    pub(crate) fn url(&mut self) -> PResult<NodeId> {
        let value = match self.stream.token_type {
            TokenType::Url => {
                let token = self.consume(TokenType::Url)?;

                crate::url::decode(token)
            }
            TokenType::Function => {
                if !self.cmp_str(self.stream.token_start, self.stream.token_end, "url(") {
                    return Err(self.error(Some("Function name must be `url`"), None));
                }

                self.eat(TokenType::Function)?;
                self.skip_sc();

                let token = self.consume(TokenType::String)?;
                let value = crate::string::decode(token);

                self.skip_sc();

                if !self.stream.eof {
                    self.eat(TokenType::RightParenthesis)?;
                }

                value
            }
            _ => return Err(self.error(Some("Url or Function is expected"), None)),
        };

        Ok(self.push(Node::Url {
            value: Cow::Owned(value),
        }))
    }

    /// `Hash`.
    pub(crate) fn hash(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;

        self.eat(TokenType::Hash)?;

        let value = self.substr_to_cursor(start + 1);

        Ok(self.push(Node::Hash { value }))
    }

    /// `Operator`.
    pub(crate) fn operator(&mut self) -> NodeId {
        let start = self.stream.token_start;

        self.next();

        let value = Cow::Borrowed(self.substr_to_cursor(start));

        self.push(Node::Operator { value })
    }

    /// `Parentheses`.
    pub(crate) fn parentheses(&mut self, scope: Scope) -> PResult<NodeId> {
        self.eat(TokenType::LeftParenthesis)?;

        let children = self.read_sequence(scope)?;

        if !self.stream.eof {
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::Parentheses { children }))
    }

    /// `Brackets`.
    pub(crate) fn brackets(&mut self, scope: Scope) -> PResult<NodeId> {
        self.eat(TokenType::LeftSquareBracket)?;

        let children = self.read_sequence(scope)?;

        if !self.stream.eof {
            self.eat(TokenType::RightSquareBracket)?;
        }

        Ok(self.push(Node::Brackets { children }))
    }

    /// `Function`, reading arguments with the recognizer's special functions when it has one.
    pub(crate) fn function(&mut self, recognizer: Recognizer) -> PResult<NodeId> {
        let parser = self;
        let name = parser.consume_function_name()?;
        let children = match recognizer {
            Recognizer::Scope(Scope::Value) if name.eq_ignore_ascii_case("var") => {
                parser.var_arguments()?
            }
            Recognizer::Scope(Scope::Value) if name.eq_ignore_ascii_case("expression") => {
                let raw = parser.raw(stop::balance_end, false)?;

                parser.single_list(raw)
            }
            Recognizer::Scope(scope) => parser.read_sequence(scope)?,
            Recognizer::ImportFunctions => {
                if name.eq_ignore_ascii_case("layer") {
                    parser.import_layer()?
                } else if name.eq_ignore_ascii_case("supports") {
                    parser.import_supports()?
                } else {
                    // css-tree has no sequence reader here and fails with a TypeError.
                    return Err(parser.error(Some("readSequence is not a function"), None));
                }
            }
        };

        if !parser.stream.eof {
            parser.eat(TokenType::RightParenthesis)?;
        }

        Ok(parser.push(Node::Function { children, name }))
    }

    /// `var( <ident> , <value>? )` arguments.
    fn var_arguments(&mut self) -> PResult<List> {
        let base = self.begin_list();

        self.skip_sc();

        let identifier = self.identifier()?;

        self.push_child(identifier);
        self.skip_sc();

        if self.stream.token_type == TokenType::Comma {
            let operator = self.operator();

            self.push_child(operator);

            let start = self.stream.token_index;
            let value = if self.parse_custom_property {
                self.value()?
            } else {
                self.raw(stop::exclamation_mark_or_semicolon, false)?
            };

            self.append_space_to_empty_value(value, start);
            self.push_child(value);
        }

        Ok(self.finish_list(base))
    }

    /// `@import`'s `layer()` argument.
    fn import_layer(&mut self) -> PResult<List> {
        self.skip_sc();

        let node = self.import_argument(Self::layer, None)?;

        Ok(self.non_empty_raw_list(node))
    }

    /// `@import`'s `supports()` argument.
    fn import_supports(&mut self) -> PResult<List> {
        self.skip_sc();

        let node = self.import_argument(
            Self::declaration,
            Some(|parser: &mut Self| {
                parser.import_argument(|parser| parser.condition(ConditionKind::Supports), None)
            }),
        )?;

        Ok(self.non_empty_raw_list(node))
    }

    /// Returns a list with the node unless it is an empty `Raw`.
    fn non_empty_raw_list(&mut self, node: NodeId) -> List {
        if matches!(self.ast.get(node), Some(Node::Raw { value }) if value.is_empty()) {
            return List::default();
        }

        self.single_list(node)
    }

    /// `UnicodeRange`.
    pub(crate) fn unicode_range(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;

        self.eat_ident("u")?;
        self.scan_unicode_range()?;

        let value = self.substr_to_cursor(start);

        Ok(self.push(Node::UnicodeRange { value }))
    }

    fn scan_unicode_range(&mut self) -> PResult<()> {
        match self.stream.token_type {
            TokenType::Number => {
                let length = self.eat_hex_sequence(1, true)?;

                if self.is_delim(b'?') {
                    return self.eat_question_mark_sequence(6 - length);
                }

                if matches!(
                    self.stream.token_type,
                    TokenType::Dimension | TokenType::Number
                ) {
                    self.unicode_starts_with(b'-')?;
                    self.eat_hex_sequence(1, false)?;
                }

                Ok(())
            }
            TokenType::Dimension => {
                let length = self.eat_hex_sequence(1, true)?;

                if length > 0 {
                    self.eat_question_mark_sequence(6 - length)?;
                }

                Ok(())
            }
            _ => {
                self.eat_delim(b'+')?;

                if self.stream.token_type == TokenType::Ident {
                    let length = self.eat_hex_sequence(0, true)?;

                    if length > 0 {
                        self.eat_question_mark_sequence(6 - length)?;
                    }

                    return Ok(());
                }

                if self.is_delim(b'?') {
                    self.next();
                    return self.eat_question_mark_sequence(5);
                }

                Err(self.error(Some("Hex digit or question mark is expected"), None))
            }
        }
    }

    /// Validates hex digits in the current token from `offset`, optionally allowing one `-`
    /// range separator. Returns the digit count, or -1 after a range.
    fn eat_hex_sequence(&mut self, offset: usize, allow_dash: bool) -> PResult<i32> {
        let mut length = 0;
        let mut position = self.stream.token_start + offset;

        while position < self.stream.token_end {
            let code = self.char_code_at(position);

            if code == b'-' && allow_dash && length != 0 {
                self.eat_hex_sequence(offset + usize::try_from(length).unwrap_or(0) + 1, false)?;
                return Ok(-1);
            }

            if !is_hex_digit(code) {
                let message = if allow_dash && length != 0 {
                    if length < 6 {
                        "Hyphen minus or hex digit is expected"
                    } else {
                        "Hyphen minus is expected"
                    }
                } else if length < 6 {
                    "Hex digit is expected"
                } else {
                    "Unexpected input"
                };

                return Err(self.error(Some(message), Some(position)));
            }

            length += 1;

            if length > 6 {
                return Err(self.error(Some("Too many hex digits"), Some(position)));
            }

            position += 1;
        }

        self.next();
        Ok(length)
    }

    fn eat_question_mark_sequence(&mut self, max: i32) -> PResult<()> {
        let mut count = 0;

        while self.is_delim(b'?') {
            count += 1;

            if count > max {
                return Err(self.error(Some("Too many question marks"), None));
            }

            self.next();
        }

        Ok(())
    }

    fn unicode_starts_with(&self, code: u8) -> PResult<()> {
        if self.char_code_at(self.stream.token_start) != code {
            let message = if code == b'+' {
                "Plus sign is expected"
            } else {
                "Hyphen minus is expected"
            };

            return Err(self.error(Some(message), None));
        }

        Ok(())
    }
}
