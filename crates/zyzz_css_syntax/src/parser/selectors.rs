//! Selectors, pseudo-class arguments, and the `An+B` microsyntax.

use std::borrow::Cow;

use super::{PResult, Parser, Scope, stop};
use crate::ast::{List, Node, NodeId};
use crate::tokenizer::{TokenType, is_digit};

/// Pseudo-class and pseudo-element argument grammars, like css-tree's `pseudo` configuration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PseudoKind {
    IdentList,
    LangList,
    Nth,
    Selector,
    SelectorList,
}

impl PseudoKind {
    /// Looks up a pseudo name after lowercasing it like css-tree.
    fn from_name(name: &str) -> Option<Self> {
        const NAMES: [(&str, PseudoKind); 16] = [
            ("-moz-any", PseudoKind::SelectorList),
            ("-webkit-any", PseudoKind::SelectorList),
            ("dir", PseudoKind::IdentList),
            ("has", PseudoKind::SelectorList),
            ("host", PseudoKind::Selector),
            ("host-context", PseudoKind::Selector),
            ("is", PseudoKind::SelectorList),
            ("lang", PseudoKind::LangList),
            ("matches", PseudoKind::SelectorList),
            ("not", PseudoKind::SelectorList),
            ("nth-child", PseudoKind::Nth),
            ("nth-last-child", PseudoKind::Nth),
            ("nth-last-of-type", PseudoKind::Nth),
            ("nth-of-type", PseudoKind::Nth),
            ("slotted", PseudoKind::Selector),
            ("where", PseudoKind::SelectorList),
        ];
        let name = crate::js::to_lower_case(name);

        NAMES
            .iter()
            .find(|(candidate, _)| *candidate == name)
            .map(|(_, kind)| *kind)
    }
}

impl<'a> Parser<'a> {
    /// `SelectorList`.
    pub(crate) fn selector_list(&mut self) -> PResult<NodeId> {
        self.nested(|parser| {
            let base = parser.begin_list();

            while !parser.stream.eof {
                let selector = parser.selector()?;

                parser.push_child(selector);

                if parser.stream.token_type == TokenType::Comma {
                    parser.next();
                    continue;
                }

                break;
            }

            let children = parser.finish_list(base);

            Ok(parser.push(Node::SelectorList { children }))
        })
    }

    /// `Selector`.
    pub(crate) fn selector(&mut self) -> PResult<NodeId> {
        let children = self.read_sequence(Scope::Selector)?;

        if children.is_empty() {
            return Err(self.error(Some("Selector is expected"), None));
        }

        Ok(self.push(Node::Selector { children }))
    }

    /// The selector scope's recognizer.
    pub(crate) fn selector_node(&mut self) -> PResult<Option<NodeId>> {
        let start = self.stream.token_start;

        Ok(Some(match self.stream.token_type {
            TokenType::LeftSquareBracket => self.attribute_selector()?,
            TokenType::Hash => self.id_selector()?,
            TokenType::Colon => {
                if self.stream.lookup_type(1) == TokenType::Colon {
                    self.pseudo_element_selector()?
                } else {
                    self.pseudo_class_selector()?
                }
            }
            TokenType::Ident => self.type_selector()?,
            TokenType::Number | TokenType::Percentage => self.percentage()?,
            TokenType::Dimension => {
                if self.char_code_at(start) == b'.' {
                    return Err(self.error(Some("Identifier is expected"), Some(start + 1)));
                }

                return Ok(None);
            }
            TokenType::Delim => match self.char_code_at(start) {
                b'+' | b'>' | b'~' | b'/' => self.combinator()?,
                b'.' => self.class_selector()?,
                b'*' | b'|' => self.type_selector()?,
                b'#' => self.id_selector()?,
                b'&' => self.nesting_selector()?,
                _ => return Ok(None),
            },
            _ => return Ok(None),
        }))
    }

    /// `TypeSelector`.
    fn type_selector(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;

        if self.is_delim(b'|') {
            self.next();
            self.eat_identifier_or_asterisk()?;
        } else {
            self.eat_identifier_or_asterisk()?;

            if self.is_delim(b'|') {
                self.next();
                self.eat_identifier_or_asterisk()?;
            }
        }

        let name = self.substr_to_cursor(start);

        Ok(self.push(Node::TypeSelector { name }))
    }

    fn eat_identifier_or_asterisk(&mut self) -> PResult<()> {
        if self.stream.token_type != TokenType::Ident && !self.is_delim(b'*') {
            return Err(self.error(Some("Identifier or asterisk is expected"), None));
        }

        self.next();
        Ok(())
    }

    /// `Combinator`.
    fn combinator(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let name = match self.stream.token_type {
            TokenType::WhiteSpace => " ",
            TokenType::Delim => {
                match self.char_code_at(start) {
                    b'>' | b'+' | b'~' => self.next(),
                    b'/' => {
                        self.next();
                        self.eat_ident("deep")?;
                        self.eat_delim(b'/')?;
                    }
                    _ => return Err(self.error(Some("Combinator is expected"), None)),
                }

                self.substr_to_cursor(start)
            }
            _ => "",
        };

        Ok(self.push(Node::Combinator { name }))
    }

    /// `AttributeSelector`.
    fn attribute_selector(&mut self) -> PResult<NodeId> {
        let mut matcher = None;
        let mut value = None;
        let mut flags = None;

        self.eat(TokenType::LeftSquareBracket)?;
        self.skip_sc();

        let name = self.attribute_name()?;

        self.skip_sc();

        if self.stream.token_type != TokenType::RightSquareBracket {
            // `[name i]` has flags without a matcher.
            if self.stream.token_type != TokenType::Ident {
                matcher = Some(self.attribute_operator()?);
                self.skip_sc();
                value = Some(if self.stream.token_type == TokenType::String {
                    self.string()?
                } else {
                    self.identifier()?
                });
                self.skip_sc();
            }

            if self.stream.token_type == TokenType::Ident {
                flags = Some(self.consume(TokenType::Ident)?);
                self.skip_sc();
            }
        }

        self.eat(TokenType::RightSquareBracket)?;

        Ok(self.push(Node::AttributeSelector {
            flags,
            matcher,
            name,
            value,
        }))
    }

    fn attribute_name(&mut self) -> PResult<NodeId> {
        if self.stream.eof {
            return Err(self.error(Some("Unexpected end of input"), None));
        }

        let start = self.stream.token_start;
        let mut expect_ident = false;

        if self.is_delim(b'*') {
            expect_ident = true;
            self.next();
        } else if !self.is_delim(b'|') {
            self.eat(TokenType::Ident)?;
        }

        if self.is_delim(b'|') {
            if self.char_code_at(self.stream.token_start + 1) != b'=' {
                self.next();
                self.eat(TokenType::Ident)?;
            } else if expect_ident {
                return Err(self.error(Some("Identifier is expected"), Some(self.stream.token_end)));
            }
        } else if expect_ident {
            return Err(self.error(Some("Vertical line is expected"), None));
        }

        let name = self.substr_to_cursor(start);

        Ok(self.push(Node::Identifier { name }))
    }

    fn attribute_operator(&mut self) -> PResult<&'a str> {
        let start = self.stream.token_start;
        let code = self.char_code_at(start);

        if !matches!(code, b'=' | b'~' | b'^' | b'$' | b'*' | b'|') {
            return Err(self.error(
                Some("Attribute selector (=, ~=, ^=, $=, *=, |=) is expected"),
                None,
            ));
        }

        self.next();

        if code != b'=' {
            if !self.is_delim(b'=') {
                return Err(self.error(Some("Equal sign is expected"), None));
            }

            self.next();
        }

        Ok(self.substr_to_cursor(start))
    }

    /// `ClassSelector`.
    fn class_selector(&mut self) -> PResult<NodeId> {
        self.eat_delim(b'.')?;

        let name = self.consume(TokenType::Ident)?;

        Ok(self.push(Node::ClassSelector { name }))
    }

    /// `IdSelector`.
    fn id_selector(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;

        self.eat(TokenType::Hash)?;

        let name = self.substr_to_cursor(start + 1);

        Ok(self.push(Node::IdSelector { name }))
    }

    /// `NestingSelector`.
    fn nesting_selector(&mut self) -> PResult<NodeId> {
        self.eat_delim(b'&')?;
        Ok(self.push(Node::NestingSelector))
    }

    /// `PseudoClassSelector`.
    fn pseudo_class_selector(&mut self) -> PResult<NodeId> {
        self.eat(TokenType::Colon)?;

        let (name, children) = self.pseudo_name_and_children()?;

        Ok(self.push(Node::PseudoClassSelector { children, name }))
    }

    /// `PseudoElementSelector`.
    fn pseudo_element_selector(&mut self) -> PResult<NodeId> {
        self.eat(TokenType::Colon)?;
        self.eat(TokenType::Colon)?;

        let (name, children) = self.pseudo_name_and_children()?;

        Ok(self.push(Node::PseudoElementSelector { children, name }))
    }

    fn pseudo_name_and_children(&mut self) -> PResult<(&'a str, Option<List>)> {
        if self.stream.token_type != TokenType::Function {
            return Ok((self.consume(TokenType::Ident)?, None));
        }

        let name = self.consume_function_name()?;
        let children = if self.lookup_non_ws_type(0) == TokenType::RightParenthesis {
            List::default()
        } else if let Some(kind) = PseudoKind::from_name(name) {
            self.skip_sc();

            let children = self.pseudo_arguments(kind)?;

            self.skip_sc();
            children
        } else {
            let raw = self.raw(stop::balance_end, false)?;

            self.single_list(raw)
        };

        self.eat(TokenType::RightParenthesis)?;
        Ok((name, Some(children)))
    }

    fn pseudo_arguments(&mut self, kind: PseudoKind) -> PResult<List> {
        let node = match kind {
            PseudoKind::IdentList => self.identifier()?,
            PseudoKind::LangList => return self.language_range_list(),
            PseudoKind::Nth => self.nth()?,
            PseudoKind::Selector => self.selector()?,
            PseudoKind::SelectorList => self.selector_list()?,
        };

        Ok(self.single_list(node))
    }

    fn language_range_list(&mut self) -> PResult<List> {
        let base = self.begin_list();

        self.skip_sc();

        while !self.stream.eof {
            let child = match self.stream.token_type {
                TokenType::Ident => self.identifier()?,
                TokenType::String => self.string()?,
                TokenType::Comma => self.operator(),
                TokenType::RightParenthesis => break,
                _ => return Err(self.error(Some("Identifier, string or comma is expected"), None)),
            };

            self.push_child(child);
            self.skip_sc();
        }

        Ok(self.finish_list(base))
    }

    /// `Nth`.
    fn nth(&mut self) -> PResult<NodeId> {
        self.skip_sc();

        let mut selector = None;
        let nth = if self.stream.lookup_value(0, "odd") || self.stream.lookup_value(0, "even") {
            self.identifier()?
        } else {
            self.an_plus_b()?
        };

        self.skip_sc();

        if self.stream.lookup_value(0, "of") {
            self.next();
            selector = Some(self.selector_list()?);
        }

        Ok(self.push(Node::Nth { nth, selector }))
    }

    /// `AnPlusB`.
    fn an_plus_b(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let a: Option<Cow<'a, str>>;
        let b: Option<Cow<'a, str>>;

        if self.stream.token_type == TokenType::Number {
            self.check_integer(0, false)?;
            a = None;
            b = Some(Cow::Borrowed(self.consume(TokenType::Number)?));
        } else if self.stream.token_type == TokenType::Ident && self.cmp_char(start, b'-') {
            a = Some(Cow::Borrowed("-1"));
            self.expect_char_code(1, b'n')?;

            match self.stream.token_end - self.stream.token_start {
                2 => {
                    self.next();
                    b = self.consume_b()?;
                }
                3 => {
                    self.expect_char_code(2, b'-')?;
                    self.next();
                    self.skip_sc();
                    self.check_integer(0, true)?;
                    b = Some(Cow::Owned(format!("-{}", self.consume(TokenType::Number)?)));
                }
                _ => {
                    self.expect_char_code(2, b'-')?;
                    self.check_integer(3, true)?;
                    self.next();
                    b = Some(Cow::Borrowed(self.substr_to_cursor(start + 2)));
                }
            }
        } else if self.stream.token_type == TokenType::Ident
            || (self.is_delim(b'+') && self.stream.lookup_type(1) == TokenType::Ident)
        {
            let mut sign = 0;

            a = Some(Cow::Borrowed("1"));

            if self.is_delim(b'+') {
                sign = 1;
                self.next();
            }

            self.expect_char_code(0, b'n')?;

            match self.stream.token_end - self.stream.token_start {
                1 => {
                    self.next();
                    b = self.consume_b()?;
                }
                2 => {
                    self.expect_char_code(1, b'-')?;
                    self.next();
                    self.skip_sc();
                    self.check_integer(0, true)?;
                    b = Some(Cow::Owned(format!("-{}", self.consume(TokenType::Number)?)));
                }
                _ => {
                    self.expect_char_code(1, b'-')?;
                    self.check_integer(2, true)?;
                    self.next();
                    b = Some(Cow::Borrowed(self.substr_to_cursor(start + sign + 1)));
                }
            }
        } else if self.stream.token_type == TokenType::Dimension {
            let code = self.char_code_at(self.stream.token_start);
            let sign = usize::from(code == b'+' || code == b'-');
            let mut index = self.stream.token_start + sign;

            while index < self.stream.token_end && is_digit(self.char_code_at(index)) {
                index += 1;
            }

            if index == self.stream.token_start + sign {
                return Err(self.error(Some("Integer is expected"), Some(index)));
            }

            self.expect_char_code(index - self.stream.token_start, b'n')?;
            a = Some(Cow::Borrowed(self.substring(start, index)));

            if index + 1 == self.stream.token_end {
                self.next();
                b = self.consume_b()?;
            } else {
                self.expect_char_code(index - self.stream.token_start + 1, b'-')?;

                if index + 2 == self.stream.token_end {
                    self.next();
                    self.skip_sc();
                    self.check_integer(0, true)?;
                    b = Some(Cow::Owned(format!("-{}", self.consume(TokenType::Number)?)));
                } else {
                    self.check_integer(index - self.stream.token_start + 2, true)?;
                    self.next();
                    b = Some(Cow::Borrowed(self.substr_to_cursor(index + 1)));
                }
            }
        } else {
            return Err(self.error(None, None));
        }

        Ok(self.push(Node::AnPlusB {
            a: a.map(strip_plus),
            b: b.map(strip_plus),
        }))
    }

    fn check_integer(&self, offset: usize, disallow_sign: bool) -> PResult<()> {
        let mut position = self.stream.token_start + offset;
        let code = self.char_code_at(position);

        if code == b'+' || code == b'-' {
            if disallow_sign {
                return Err(self.error(Some("Number sign is not allowed"), None));
            }

            position += 1;
        }

        while position < self.stream.token_end {
            if !is_digit(self.char_code_at(position)) {
                return Err(self.error(Some("Integer is expected"), Some(position)));
            }

            position += 1;
        }

        Ok(())
    }

    fn expect_char_code(&self, offset: usize, code: u8) -> PResult<()> {
        if !self.cmp_char(self.stream.token_start + offset, code) {
            let message = match code {
                b'n' => "N is expected",
                b'-' => "HyphenMinus is expected",
                _ => "",
            };

            return Err(self.error(Some(message), Some(self.stream.token_start + offset)));
        }

        Ok(())
    }

    /// Reads the `B` part: a signed integer or a sign followed by a signless integer.
    fn consume_b(&mut self) -> PResult<Option<Cow<'a, str>>> {
        let mut offset = 0;
        let mut sign = 0;
        let mut kind = self.stream.token_type;

        while kind == TokenType::WhiteSpace || kind == TokenType::Comment {
            offset += 1;
            kind = self.stream.lookup_type(offset);
        }

        if kind != TokenType::Number {
            if self.stream.is_delim(b'+', offset) || self.stream.is_delim(b'-', offset) {
                sign = if self.stream.is_delim(b'+', offset) {
                    b'+'
                } else {
                    b'-'
                };

                loop {
                    offset += 1;
                    kind = self.stream.lookup_type(offset);

                    if kind != TokenType::WhiteSpace && kind != TokenType::Comment {
                        break;
                    }
                }

                if kind != TokenType::Number {
                    self.stream.skip(offset);
                    self.check_integer(0, true)?;
                }
            } else {
                return Ok(None);
            }
        }

        if offset > 0 {
            self.stream.skip(offset);
        }

        if sign == 0 {
            let code = self.char_code_at(self.stream.token_start);

            if code != b'+' && code != b'-' {
                return Err(self.error(Some("Number sign is expected"), None));
            }
        }

        self.check_integer(0, sign != 0)?;

        let number = self.consume(TokenType::Number)?;

        Ok(Some(if sign == b'-' {
            Cow::Owned(format!("-{number}"))
        } else {
            Cow::Borrowed(number)
        }))
    }
}

/// Removes one leading `+`.
fn strip_plus(value: Cow<'_, str>) -> Cow<'_, str> {
    match value {
        Cow::Borrowed(text) => Cow::Borrowed(text.strip_prefix('+').unwrap_or(text)),
        Cow::Owned(text) => match text.strip_prefix('+') {
            Some(rest) => Cow::Owned(rest.to_owned()),
            None => Cow::Owned(text),
        },
    }
}
