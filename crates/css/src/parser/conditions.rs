//! Media queries, conditions, features, layers, and scopes.

use std::borrow::Cow;

use super::{PResult, Parser, Scope, stop};
use crate::ast::{ConditionKind, Node, NodeId};
use crate::tokenizer::TokenType;

impl<'a> Parser<'a> {
    /// `MediaQueryList`.
    pub(crate) fn media_query_list(&mut self) -> PResult<NodeId> {
        let base = self.begin_list();

        self.skip_sc();

        while !self.stream.eof {
            let query = self.media_query()?;

            self.push_child(query);

            if self.stream.token_type != TokenType::Comma {
                break;
            }

            self.next();
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::MediaQueryList { children }))
    }

    /// `MediaQuery`.
    pub(crate) fn media_query(&mut self) -> PResult<NodeId> {
        let mut modifier = None;
        let mut media_type = None;
        let mut condition = None;

        self.skip_sc();

        if self.stream.token_type == TokenType::Ident
            && self.stream.lookup_type_non_sc(1) != TokenType::LeftParenthesis
        {
            let ident = self.consume(TokenType::Ident)?;

            if ident.eq_ignore_ascii_case("not") || ident.eq_ignore_ascii_case("only") {
                self.skip_sc();
                modifier = Some(if ident.eq_ignore_ascii_case("not") {
                    "not"
                } else {
                    "only"
                });
                media_type = Some(self.consume(TokenType::Ident)?);
            } else {
                media_type = Some(ident);
            }

            match self.stream.lookup_type_non_sc(0) {
                TokenType::Ident => {
                    self.skip_sc();
                    self.eat_ident("and")?;
                    condition = Some(self.condition(ConditionKind::Media)?);
                }
                TokenType::LeftCurlyBracket
                | TokenType::Semicolon
                | TokenType::Comma
                | TokenType::Eof => {}
                _ => return Err(self.error(Some("Identifier or parenthesis is expected"), None)),
            }
        } else {
            match self.stream.token_type {
                TokenType::Ident | TokenType::LeftParenthesis | TokenType::Function => {
                    condition = Some(self.condition(ConditionKind::Media)?);
                }
                TokenType::LeftCurlyBracket | TokenType::Semicolon | TokenType::Eof => {}
                _ => return Err(self.error(Some("Identifier or parenthesis is expected"), None)),
            }
        }

        Ok(self.push(Node::MediaQuery {
            condition,
            media_type,
            modifier,
        }))
    }

    /// `Condition`.
    pub(crate) fn condition(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        self.nested(|parser| parser.condition_inner(kind))
    }

    fn condition_inner(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        let base = self.begin_list();

        while !self.stream.eof {
            let term = match self.stream.token_type {
                TokenType::Comment | TokenType::WhiteSpace => {
                    self.next();
                    continue;
                }
                TokenType::Ident => self.identifier()?,
                TokenType::LeftParenthesis => {
                    let term = self.parse_with_fallback(
                        |parser| parser.condition_parentheses(kind).map(Some),
                        |_| Ok(None),
                    )?;

                    match term {
                        Some(term) => term,
                        None => self.parse_with_fallback(
                            |parser| {
                                parser.eat(TokenType::LeftParenthesis)?;

                                let result = parser.condition(kind)?;

                                parser.eat(TokenType::RightParenthesis)?;
                                Ok(result)
                            },
                            |parser| parser.general_enclosed(kind),
                        )?,
                    }
                }
                TokenType::Function => {
                    let term = self.parse_with_fallback(
                        |parser| parser.feature_function(kind).map(Some),
                        |_| Ok(None),
                    )?;

                    match term {
                        Some(term) => term,
                        None => self.general_enclosed(kind)?,
                    }
                }
                _ => break,
            };

            self.push_child(term);
        }

        if self.begin_list() == base {
            return Err(self.error(Some("Condition is expected"), None));
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::Condition { children, kind }))
    }

    /// The parenthesized term a condition kind expects: a feature or range for media and
    /// container queries, and a declaration for supports conditions.
    fn condition_parentheses(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        match kind {
            ConditionKind::Media | ConditionKind::Container => {
                if self.stream.lookup_type_non_sc(1) == TokenType::Ident
                    && matches!(
                        self.stream.lookup_type_non_sc(2),
                        TokenType::Colon | TokenType::RightParenthesis | TokenType::Eof
                    )
                {
                    self.feature(kind)
                } else {
                    self.feature_range(kind)
                }
            }
            ConditionKind::Supports => self.supports_declaration(),
            // css-tree has no parser for other kinds and fails with a TypeError.
            ConditionKind::Unknown => Err(self.error(None, None)),
        }
    }

    /// `Feature`.
    pub(crate) fn feature(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        let mut value = None;

        self.eat(TokenType::LeftParenthesis)?;
        self.skip_sc();

        let name = self.consume(TokenType::Ident)?;

        self.skip_sc();

        if self.stream.token_type != TokenType::RightParenthesis {
            self.eat(TokenType::Colon)?;
            self.skip_sc();

            value = Some(match self.stream.token_type {
                TokenType::Number => {
                    if self.lookup_non_ws_type(1) == TokenType::Delim {
                        self.ratio()?
                    } else {
                        self.number()?
                    }
                }
                TokenType::Dimension => self.dimension()?,
                TokenType::Ident => self.identifier()?,
                TokenType::Function => self.function_or_ratio()?,
                _ => {
                    return Err(self.error(
                        Some("Number, dimension, ratio or identifier is expected"),
                        None,
                    ));
                }
            });

            self.skip_sc();
        }

        if !self.stream.eof {
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::Feature { kind, name, value }))
    }

    /// A function operand that falls back to a ratio when followed by `/`.
    fn function_or_ratio(&mut self) -> PResult<NodeId> {
        self.parse_with_fallback(
            |parser| {
                let result = parser.function(super::Recognizer::Scope(Scope::Value))?;

                parser.skip_sc();

                if parser.is_delim(b'/') {
                    return Err(parser.error(None, None));
                }

                Ok(result)
            },
            Self::ratio,
        )
    }

    /// `FeatureRange`.
    pub(crate) fn feature_range(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        self.skip_sc();
        self.eat(TokenType::LeftParenthesis)?;

        let left = self.range_term()?;
        let left_comparison =
            self.range_comparison(self.is(left, |node| matches!(node, Node::Identifier { .. })))?;
        let middle = self.range_term()?;
        let mut right_comparison = None;
        let mut right = None;

        if self.lookup_non_ws_type(0) != TokenType::RightParenthesis {
            right_comparison = Some(self.range_comparison(false)?);
            right = Some(self.range_term()?);
        }

        self.skip_sc();
        self.eat(TokenType::RightParenthesis)?;

        Ok(self.push(Node::FeatureRange {
            kind,
            left,
            left_comparison,
            middle,
            right,
            right_comparison,
        }))
    }

    fn range_term(&mut self) -> PResult<NodeId> {
        self.skip_sc();

        match self.stream.token_type {
            TokenType::Number => {
                let offset = self.stream.lookup_offset_non_sc(1);

                if self.stream.is_delim(b'/', offset) {
                    self.ratio()
                } else {
                    self.number()
                }
            }
            TokenType::Dimension => self.dimension(),
            TokenType::Ident => self.identifier(),
            TokenType::Function => self.function_or_ratio(),
            _ => Err(self.error(
                Some("Number, dimension, ratio or identifier is expected"),
                None,
            )),
        }
    }

    /// Reads `<`, `<=`, `>`, `>=`, or `=`. Like css-tree, `=` is returned without being
    /// consumed, so the following term fails and the range falls back.
    fn range_comparison(&mut self, expect_colon: bool) -> PResult<&'a str> {
        self.skip_sc();

        if self.is_delim(b'<') || self.is_delim(b'>') {
            let less = self.is_delim(b'<');

            self.next();

            if self.is_delim(b'=') {
                self.next();
                return Ok(if less { "<=" } else { ">=" });
            }

            return Ok(if less { "<" } else { ">" });
        }

        if self.is_delim(b'=') {
            return Ok("=");
        }

        Err(self.error(
            Some(if expect_colon {
                "Expected \":\", \"<\", \">\", \"=\" or \")\""
            } else {
                "Expected \"<\", \">\", \"=\" or \")\""
            }),
            None,
        ))
    }

    /// `FeatureFunction`.
    pub(crate) fn feature_function(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        let function = self.consume_function_name()?;
        let feature = FeatureParser::find(kind, function)
            .ok_or_else(|| self.unknown_feature(&crate::js::to_lower_case(function)))?;

        self.skip_sc();

        let value = self.parse_with_fallback(
            |parser| {
                let start = parser.stream.token_index;
                let value = match feature {
                    FeatureParser::Declaration => Some(parser.declaration()?),
                    FeatureParser::Selector => Some(parser.selector()?),
                    FeatureParser::ObjectConstructor => None,
                };

                if !parser.stream.eof && !parser.stream.is_balance_edge(start) {
                    return Err(parser.error(None, None));
                }

                Ok(value)
            },
            |parser| parser.raw(stop::balance_end, false).map(Some),
        )?;

        if !self.stream.eof {
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::FeatureFunction {
            feature: function,
            kind,
            value,
        }))
    }

    /// `GeneralEnclosed`.
    pub(crate) fn general_enclosed(&mut self, kind: ConditionKind) -> PResult<NodeId> {
        let function = if self.stream.token_type == TokenType::Function {
            Some(self.consume_function_name()?)
        } else {
            self.eat(TokenType::LeftParenthesis)?;
            None
        };
        let children = self.parse_with_fallback(
            |parser| {
                let start = parser.stream.token_index;
                let children = parser.read_sequence(Scope::Value)?;

                if !parser.stream.eof && !parser.stream.is_balance_edge(start) {
                    return Err(parser.error(None, None));
                }

                Ok(children)
            },
            |parser| {
                let raw = parser.raw(stop::balance_end, false)?;

                Ok(parser.single_list(raw))
            },
        )?;

        if !self.stream.eof {
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::GeneralEnclosed {
            children,
            function,
            kind,
        }))
    }

    /// `SupportsDeclaration`.
    fn supports_declaration(&mut self) -> PResult<NodeId> {
        self.eat(TokenType::LeftParenthesis)?;
        self.skip_sc();

        let declaration = self.declaration()?;

        if !self.stream.eof {
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::SupportsDeclaration { declaration }))
    }

    /// `Ratio`.
    pub(crate) fn ratio(&mut self) -> PResult<NodeId> {
        let left = self.ratio_term()?;
        let mut right = None;

        self.skip_sc();

        if self.is_delim(b'/') {
            self.eat_delim(b'/')?;
            right = Some(self.ratio_term()?);
        }

        Ok(self.push(Node::Ratio { left, right }))
    }

    fn ratio_term(&mut self) -> PResult<NodeId> {
        self.skip_sc();

        match self.stream.token_type {
            TokenType::Number => self.number(),
            TokenType::Function => self.function(super::Recognizer::Scope(Scope::Value)),
            _ => Err(self.error(Some("Number of function is expected"), None)),
        }
    }

    /// `Layer`.
    pub(crate) fn layer(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let mut end;

        self.consume(TokenType::Ident)?;
        end = self.stream.token_start;

        while self.is_delim(b'.') {
            self.eat(TokenType::Delim)?;
            self.consume(TokenType::Ident)?;
            end = self.stream.token_start;
        }

        let name = self.substring(start, end);

        Ok(self.push(Node::Layer { name }))
    }

    /// `LayerList`.
    pub(crate) fn layer_list(&mut self) -> PResult<NodeId> {
        let base = self.begin_list();

        self.skip_sc();

        while !self.stream.eof {
            let layer = self.layer()?;

            self.push_child(layer);

            if self.stream.lookup_type_non_sc(0) != TokenType::Comma {
                break;
            }

            self.skip_sc();
            self.next();
            self.skip_sc();
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::LayerList { children }))
    }

    /// `Scope`, the `@scope` prelude.
    pub(crate) fn scope(&mut self) -> PResult<NodeId> {
        let mut root = None;
        let mut limit = None;

        self.skip_sc();

        if self.stream.token_type == TokenType::LeftParenthesis {
            self.next();
            self.skip_sc();
            root = Some(self.parse_with_fallback(Self::selector_list, |parser| {
                parser.raw(stop::balance_end, true)
            })?);
            self.skip_sc();
            self.eat(TokenType::RightParenthesis)?;
        }

        if self.lookup_non_ws_type(0) == TokenType::Ident {
            self.skip_sc();
            self.eat_ident("to")?;
            self.skip_sc();
            self.eat(TokenType::LeftParenthesis)?;
            self.skip_sc();
            limit = Some(self.parse_with_fallback(Self::selector_list, |parser| {
                parser.raw(stop::balance_end, true)
            })?);
            self.skip_sc();
            self.eat(TokenType::RightParenthesis)?;
        }

        Ok(self.push(Node::Scope { limit, root }))
    }
}

/// Parsers for feature functions such as `selector()` and `style()`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum FeatureParser {
    /// `style()` in container conditions.
    Declaration,
    /// css-tree looks feature names up in plain objects, so `constructor()` finds
    /// `Object.prototype.constructor`. Calling it consumes nothing and yields no node.
    ObjectConstructor,
    /// `selector()` in supports conditions.
    Selector,
}

impl FeatureParser {
    fn find(kind: ConditionKind, function: &str) -> Option<Self> {
        let name = crate::js::to_lower_case(function);

        match (kind, Cow::as_ref(&name)) {
            (_, "constructor") => Some(Self::ObjectConstructor),
            (ConditionKind::Supports, "selector") => Some(Self::Selector),
            (ConditionKind::Container, "style") => Some(Self::Declaration),
            _ => None,
        }
    }
}
