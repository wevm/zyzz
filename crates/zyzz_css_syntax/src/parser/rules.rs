//! Stylesheet structure: rules, at-rules, blocks, declarations, and `Raw` recovery.

use std::borrow::Cow;

use super::{PResult, Parser, Recognizer, stop};
use crate::ast::{ConditionKind, Node, NodeId};
use crate::names::is_custom_property;
use crate::tokenizer::TokenType;

/// Custom at-rule grammars, like css-tree's `atrule` configuration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum AtruleKind {
    Container,
    FontFace,
    Import,
    Layer,
    Media,
    Nest,
    Page,
    Scope,
    StartingStyle,
    Supports,
}

impl AtruleKind {
    /// Looks up an at-rule name after lowercasing it like css-tree.
    fn from_name(name: &str) -> Option<Self> {
        const NAMES: [(&str, AtruleKind); 10] = [
            ("container", AtruleKind::Container),
            ("font-face", AtruleKind::FontFace),
            ("import", AtruleKind::Import),
            ("layer", AtruleKind::Layer),
            ("media", AtruleKind::Media),
            ("nest", AtruleKind::Nest),
            ("page", AtruleKind::Page),
            ("scope", AtruleKind::Scope),
            ("starting-style", AtruleKind::StartingStyle),
            ("supports", AtruleKind::Supports),
        ];
        let name = crate::js::to_lower_case(name);

        NAMES
            .iter()
            .find(|(candidate, _)| *candidate == name)
            .map(|(_, kind)| *kind)
    }

    /// Reports whether the at-rule has a custom prelude parser.
    const fn has_prelude(self) -> bool {
        !matches!(self, Self::FontFace | Self::StartingStyle)
    }
}

impl<'a> Parser<'a> {
    /// `StyleSheet`.
    pub(crate) fn style_sheet(&mut self) -> PResult<NodeId> {
        let base = self.begin_list();

        while !self.stream.eof {
            let child = match self.stream.token_type {
                TokenType::WhiteSpace => {
                    self.next();
                    continue;
                }
                TokenType::Comment => {
                    // Only `/*!` comments survive at the top level.
                    if self.char_code_at(self.stream.token_start + 2) != b'!' {
                        self.next();
                        continue;
                    }

                    self.comment()?
                }
                TokenType::Cdo => self.cdo()?,
                TokenType::Cdc => self.cdc()?,
                TokenType::AtKeyword => self.parse_with_fallback(
                    |parser| parser.atrule(false),
                    |parser| parser.raw(stop::balance_end, false),
                )?,
                _ => self.parse_with_fallback(Self::rule, |parser| {
                    parser.raw(stop::balance_end, false)
                })?,
            };

            self.push_child(child);
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::StyleSheet { children }))
    }

    /// `Atrule`.
    pub(crate) fn atrule(&mut self, is_declaration: bool) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let mut prelude = None;
        let mut block = None;

        self.eat(TokenType::AtKeyword)?;

        let name = self.substr_to_cursor(start + 1);
        let kind = AtruleKind::from_name(name);

        self.skip_sc();

        if !self.stream.eof
            && self.stream.token_type != TokenType::LeftCurlyBracket
            && self.stream.token_type != TokenType::Semicolon
        {
            prelude = Some(if self.parse_atrule_prelude {
                self.parse_with_fallback(
                    |parser| parser.atrule_prelude(Some(name)),
                    |parser| parser.raw(stop::left_curly_bracket_or_semicolon, true),
                )?
            } else {
                self.raw(stop::left_curly_bracket_or_semicolon, true)?
            });

            self.skip_sc();
        }

        match self.stream.token_type {
            TokenType::Semicolon => self.next(),
            TokenType::LeftCurlyBracket => {
                block = Some(match kind {
                    Some(AtruleKind::FontFace | AtruleKind::Nest | AtruleKind::Page) => {
                        self.block(true)?
                    }
                    Some(AtruleKind::Layer) => self.block(false)?,
                    Some(
                        AtruleKind::Container
                        | AtruleKind::Media
                        | AtruleKind::Scope
                        | AtruleKind::StartingStyle
                        | AtruleKind::Supports,
                    ) => self.block(is_declaration)?,
                    Some(AtruleKind::Import) | None => {
                        let style = self.is_declaration_block_atrule();

                        self.block(style)?
                    }
                });
            }
            _ => {}
        }

        Ok(self.push(Node::Atrule {
            block,
            name,
            prelude,
        }))
    }

    /// Reports whether an unknown at-rule's block contains declarations: a `}` comes before any
    /// `{` or at-keyword.
    fn is_declaration_block_atrule(&self) -> bool {
        let mut offset = 1;

        loop {
            match self.stream.lookup_type(offset) {
                TokenType::RightCurlyBracket => return true,
                TokenType::Eof | TokenType::LeftCurlyBracket | TokenType::AtKeyword => {
                    return false;
                }
                _ => offset += 1,
            }
        }
    }

    /// `AtrulePrelude`.
    pub(crate) fn atrule_prelude(&mut self, name: Option<&str>) -> PResult<NodeId> {
        let kind = name.and_then(AtruleKind::from_name);

        self.skip_sc();

        let children = match kind {
            Some(kind) if kind.has_prelude() => self.custom_prelude(kind)?,
            _ => self.read_sequence(super::Scope::AtrulePrelude)?,
        };

        self.skip_sc();

        if !self.stream.eof
            && self.stream.token_type != TokenType::LeftCurlyBracket
            && self.stream.token_type != TokenType::Semicolon
        {
            return Err(self.error(Some("Semicolon or block is expected"), None));
        }

        Ok(self.push(Node::AtrulePrelude { children }))
    }

    /// Custom prelude grammars from css-tree's `atrule` configuration.
    fn custom_prelude(&mut self, kind: AtruleKind) -> PResult<crate::ast::List> {
        match kind {
            AtruleKind::Container => {
                let base = self.begin_list();

                if self.stream.token_type == TokenType::Ident {
                    let name = self.substring(self.stream.token_start, self.stream.token_end);
                    let keyword = ["none", "and", "not", "or"]
                        .iter()
                        .any(|keyword| crate::js::to_lower_case(name) == *keyword);

                    if !keyword {
                        let identifier = self.identifier()?;

                        self.push_child(identifier);
                    }
                }

                let condition = self.condition(ConditionKind::Container)?;

                self.push_child(condition);
                Ok(self.finish_list(base))
            }
            AtruleKind::Import => self.import_prelude(),
            AtruleKind::Layer => {
                let list = self.layer_list()?;

                Ok(self.single_list(list))
            }
            AtruleKind::Media => {
                let list = self.media_query_list()?;

                Ok(self.single_list(list))
            }
            AtruleKind::Nest | AtruleKind::Page => {
                let list = self.selector_list()?;

                Ok(self.single_list(list))
            }
            AtruleKind::Scope => {
                let scope = self.scope()?;

                Ok(self.single_list(scope))
            }
            AtruleKind::Supports => {
                let condition = self.condition(ConditionKind::Supports)?;

                Ok(self.single_list(condition))
            }
            AtruleKind::FontFace | AtruleKind::StartingStyle => {
                self.read_sequence(super::Scope::AtrulePrelude)
            }
        }
    }

    /// `@import` prelude.
    fn import_prelude(&mut self) -> PResult<crate::ast::List> {
        let base = self.begin_list();

        let first = match self.stream.token_type {
            TokenType::String => self.string()?,
            TokenType::Url | TokenType::Function => self.url()?,
            _ => return Err(self.error(Some("String or url() is expected"), None)),
        };

        self.push_child(first);
        self.skip_sc();

        let start = self.stream.token_start;
        let end = self.stream.token_end;

        if self.stream.token_type == TokenType::Ident && self.cmp_str(start, end, "layer") {
            let identifier = self.identifier()?;

            self.push_child(identifier);
        } else if self.stream.token_type == TokenType::Function
            && self.cmp_str(start, end, "layer(")
        {
            let function = self.function(Recognizer::ImportFunctions)?;

            self.push_child(function);
        }

        self.skip_sc();

        let start = self.stream.token_start;
        let end = self.stream.token_end;

        if self.stream.token_type == TokenType::Function && self.cmp_str(start, end, "supports(") {
            let function = self.function(Recognizer::ImportFunctions)?;

            self.push_child(function);
        }

        if matches!(
            self.lookup_non_ws_type(0),
            TokenType::Ident | TokenType::LeftParenthesis
        ) {
            let list = self.media_query_list()?;

            self.push_child(list);
        }

        Ok(self.finish_list(base))
    }

    /// `@import`'s guarded argument parse: after `parse`, only whitespace may precede `)`.
    pub(crate) fn import_argument(
        &mut self,
        parse: fn(&mut Self) -> PResult<NodeId>,
        fallback: Option<fn(&mut Self) -> PResult<NodeId>>,
    ) -> PResult<NodeId> {
        self.parse_with_fallback(
            |parser| {
                let result = parse(parser);

                // css-tree checks in a `finally` block, so this error replaces any from `parse`.
                parser.skip_sc();

                if parser.lookup_non_ws_type(0) != TokenType::RightParenthesis {
                    return Err(parser.error(None, None));
                }

                result
            },
            |parser| match fallback {
                Some(fallback) => fallback(parser),
                None => parser.raw(stop::balance_end, true),
            },
        )
    }

    /// `Rule`.
    pub(crate) fn rule(&mut self) -> PResult<NodeId> {
        let parser = self;
        let prelude = if parser.parse_rule_prelude {
            parser.parse_with_fallback(
                |parser| {
                    let prelude = parser.selector_list()?;

                    if !parser.is(prelude, |node| matches!(node, Node::Raw { .. }))
                        && !parser.stream.eof
                        && parser.stream.token_type != TokenType::LeftCurlyBracket
                    {
                        return Err(parser.error(None, None));
                    }

                    Ok(prelude)
                },
                |parser| parser.raw(stop::left_curly_bracket, true),
            )?
        } else {
            parser.raw(stop::left_curly_bracket, true)?
        };
        let block = parser.block(true)?;

        Ok(parser.push(Node::Rule { block, prelude }))
    }

    /// `Block`.
    pub(crate) fn block(&mut self, is_style_block: bool) -> PResult<NodeId> {
        self.nested(|parser| parser.block_inner(is_style_block))
    }

    fn block_inner(&mut self, is_style_block: bool) -> PResult<NodeId> {
        let base = self.begin_list();

        self.eat(TokenType::LeftCurlyBracket)?;

        while !self.stream.eof {
            match self.stream.token_type {
                TokenType::RightCurlyBracket => break,
                TokenType::WhiteSpace | TokenType::Comment => self.next(),
                TokenType::AtKeyword => {
                    let child = self.parse_with_fallback(
                        |parser| parser.atrule(is_style_block),
                        |parser| parser.raw(stop::balance_end, true),
                    )?;

                    self.push_child(child);
                }
                _ => {
                    let child = if is_style_block && !self.is_delim(b'&') {
                        self.consume_declaration()?
                    } else {
                        self.parse_with_fallback(Self::rule, |parser| {
                            parser.raw(stop::balance_end, true)
                        })?
                    };

                    self.push_child(child);
                }
            }
        }

        if !self.stream.eof {
            self.eat(TokenType::RightCurlyBracket)?;
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::Block { children }))
    }

    /// Consumes one declaration in a style block, with `Raw` recovery up to `;`.
    fn consume_declaration(&mut self) -> PResult<NodeId> {
        if self.stream.token_type == TokenType::Semicolon {
            return self.raw(stop::semicolon_included, true);
        }

        let node = self.parse_with_fallback(Self::declaration, |parser| {
            parser.raw(stop::semicolon_included, true)
        })?;

        if self.stream.token_type == TokenType::Semicolon {
            self.next();
        }

        Ok(node)
    }

    /// `DeclarationList`.
    pub(crate) fn declaration_list(&mut self) -> PResult<NodeId> {
        let base = self.begin_list();

        while !self.stream.eof {
            match self.stream.token_type {
                TokenType::WhiteSpace | TokenType::Comment | TokenType::Semicolon => self.next(),
                TokenType::AtKeyword => {
                    let child = self.parse_with_fallback(
                        |parser| parser.atrule(true),
                        |parser| parser.raw(stop::semicolon_included, true),
                    )?;

                    self.push_child(child);
                }
                _ => {
                    let child = if self.is_delim(b'&') {
                        self.parse_with_fallback(Self::rule, |parser| {
                            parser.raw(stop::semicolon_included, true)
                        })?
                    } else {
                        self.parse_with_fallback(Self::declaration, |parser| {
                            parser.raw(stop::semicolon_included, true)
                        })?
                    };

                    self.push_child(child);
                }
            }
        }

        let children = self.finish_list(base);

        Ok(self.push(Node::DeclarationList { children }))
    }

    /// `Declaration`.
    pub(crate) fn declaration(&mut self) -> PResult<NodeId> {
        let start_token = self.stream.token_index;
        let property = self.read_property()?;
        let custom = is_custom_property(property, 0);
        let parse_value = if custom {
            self.parse_custom_property
        } else {
            self.parse_value
        };
        let mut important = None;

        self.skip_sc();
        self.eat(TokenType::Colon)?;

        let value_start = self.stream.token_index;

        if !custom {
            self.skip_sc();
        }

        let value = if parse_value {
            self.parse_with_fallback(
                |parser| {
                    let start = parser.stream.token_index;
                    let value = parser.value()?;

                    if !parser.is(value, |node| matches!(node, Node::Raw { .. }))
                        && !parser.stream.eof
                        && parser.stream.token_type != TokenType::Semicolon
                        && !parser.is_delim(b'!')
                        && !parser.stream.is_balance_edge(start)
                    {
                        return Err(parser.error(None, None));
                    }

                    Ok(value)
                },
                |parser| parser.raw(stop::exclamation_mark_or_semicolon, !custom),
            )?
        } else {
            self.raw(stop::exclamation_mark_or_semicolon, !custom)?
        };

        if custom {
            self.append_space_to_empty_value(value, value_start);
        }

        if self.is_delim(b'!') {
            important = Some(self.important()?);
            self.skip_sc();
        }

        if !self.stream.eof
            && self.stream.token_type != TokenType::Semicolon
            && !self.stream.is_balance_edge(start_token)
        {
            return Err(self.error(None, None));
        }

        Ok(self.push(Node::Declaration {
            important,
            property,
            value,
        }))
    }

    /// Keeps a single space in an empty custom property value when whitespace followed the
    /// colon, like css-tree.
    pub(crate) fn append_space_to_empty_value(&mut self, value: NodeId, value_start: usize) {
        let Some(Node::Value { children }) = self.ast.get(value) else {
            return;
        };

        if !children.is_empty() {
            return;
        }

        let mut index = value_start;

        while index <= self.stream.token_index {
            let offset = isize::try_from(index).unwrap_or(isize::MAX)
                - isize::try_from(self.stream.token_index).unwrap_or(isize::MAX);

            if self.stream.lookup_type(offset) == TokenType::WhiteSpace {
                let space = self.push(Node::WhiteSpace { value: " " });
                let list = self.single_list(space);

                if let Some(Node::Value { children }) = self.ast.get_mut(value) {
                    *children = list;
                }

                return;
            }

            index += 1;
        }
    }

    /// Reads a property name, including css-tree's supported hacks.
    fn read_property(&mut self) -> PResult<&'a str> {
        let start = self.stream.token_start;

        if self.stream.token_type == TokenType::Delim {
            match self.char_code_at(start) {
                b'*' | b'$' | b'+' | b'#' | b'&' => self.next(),
                b'/' => {
                    self.next();

                    if self.is_delim(b'/') {
                        self.next();
                    }
                }
                _ => {}
            }
        }

        if self.stream.token_type == TokenType::Hash {
            self.eat(TokenType::Hash)?;
        } else {
            self.eat(TokenType::Ident)?;
        }

        Ok(self.substr_to_cursor(start))
    }

    /// Reads `! important`, returning the identifier.
    fn important(&mut self) -> PResult<&'a str> {
        self.eat(TokenType::Delim)?;
        self.skip_sc();
        self.consume(TokenType::Ident)
    }

    /// `Raw`: consumes tokens up to a stop rule, jumping over balanced blocks.
    #[expect(
        clippy::unnecessary_wraps,
        reason = "Raw serves as a fallback, which shares the signature of throwing parse steps."
    )]
    pub(crate) fn raw(&mut self, stop: fn(u8) -> u8, exclude_white_space: bool) -> PResult<NodeId> {
        let start = self.stream.get_token_start(self.stream.token_index);

        self.stream
            .skip_until_balanced(self.stream.token_index, stop);

        let end = if exclude_white_space && self.stream.token_start > start {
            self.offset_excluding_white_space()
        } else {
            self.stream.token_start
        };
        let value = self.substring(start, end);

        Ok(self.push(Node::Raw { value }))
    }

    fn offset_excluding_white_space(&self) -> usize {
        let index = self.stream.token_index;

        if index > 0 && self.stream.lookup_type(-1) == TokenType::WhiteSpace {
            return if index > 1 {
                self.stream.get_token_start(index - 1)
            } else {
                self.stream.first_char_offset
            };
        }

        self.stream.token_start
    }

    /// `Comment`.
    pub(crate) fn comment(&mut self) -> PResult<NodeId> {
        let start = self.stream.token_start;
        let mut end = self.stream.token_end;

        self.eat(TokenType::Comment)?;

        if end >= 2 && self.char_code_at(end - 2) == b'*' && self.char_code_at(end - 1) == b'/' {
            end -= 2;
        }

        let value = self.substring(start + 2, end);

        Ok(self.push(Node::Comment { value }))
    }

    /// `CDO`.
    fn cdo(&mut self) -> PResult<NodeId> {
        self.eat(TokenType::Cdo)?;
        Ok(self.push(Node::Cdo))
    }

    /// `CDC`.
    fn cdc(&mut self) -> PResult<NodeId> {
        self.eat(TokenType::Cdc)?;
        Ok(self.push(Node::Cdc))
    }

    /// Builds an error whose message names an unknown feature function.
    pub(crate) fn unknown_feature(&self, name: &str) -> super::SyntaxError {
        self.error_owned(Cow::Owned(format!("Unknown feature {name}()")), None)
    }
}
