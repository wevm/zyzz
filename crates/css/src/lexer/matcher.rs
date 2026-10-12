//! Matches tokens against match graphs, following css-tree's `match` module.
//!
//! The matcher is css-tree's backtracking state machine. Its match, syntax, `then`, and `else`
//! stacks are persistent linked lists whose snapshots share tails, stored here as append-only
//! vectors linked by index. Identity checks between snapshots compare indices. Like css-tree,
//! matching stops after 15,000 iterations.

use super::generic::{self, Thrown};
use super::match_graph::{DISALLOW_EMPTY, Graph, GraphIndex, GraphNode, MATCH, MISMATCH};
use super::{EntryKind, Lexer, MatchToken, MatchTree, SyntaxInfo, TreeNode};
use crate::definition_syntax::Range;
use crate::tokenizer::TokenType;

/// css-tree's iteration limit.
const ITERATION_LIMIT: u32 = 15_000;

/// Missing link in a persistent list.
const NONE: u32 = u32::MAX;

/// Why matching stopped.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ExitReason {
    /// The iteration limit was reached.
    IterationLimit,
    /// The tokens matched.
    Match,
    /// The tokens did not match.
    Mismatch,
}

impl ExitReason {
    /// css-tree's reason text, used as the match error's raw message.
    pub(crate) const fn message(self) -> &'static str {
        match self {
            Self::IterationLimit => {
                "Maximum iteration number exceeded (please fill an issue on https://github.com/csstree/csstree/issues)"
            }
            Self::Match => "Match",
            Self::Mismatch => "Mismatch",
        }
    }
}

/// The outcome of one match run.
pub(crate) struct Outcome<'s> {
    pub(crate) iterations: u32,
    pub(crate) longest_match: usize,
    pub(crate) reason: ExitReason,
    pub(crate) tree: Option<MatchTree<'s>>,
}

/// A matcher state.
#[derive(Clone, Copy)]
enum State<'g, 's> {
    /// Enters a `MatchOnce` term buffer again with an extended mask.
    AddMatchOnce {
        graph: &'g Graph<'s>,
        mask: i32,
        node: GraphIndex,
    },
    /// A `MatchOnce` buffer, which css-tree mutates in place.
    Buffer(u32),
    DisallowEmpty,
    /// A graph's wrapper, which costs one iteration to enter like css-tree's `MatchGraph`.
    Graph(&'g Graph<'s>),
    Match,
    Mismatch,
    Node(&'g Graph<'s>, GraphIndex),
}

impl<'g, 's> State<'g, 's> {
    fn at(graph: &'g Graph<'s>, index: GraphIndex) -> Self {
        match index {
            MATCH => Self::Match,
            MISMATCH => Self::Mismatch,
            DISALLOW_EMPTY => Self::DisallowEmpty,
            _ => Self::Node(graph, index),
        }
    }
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum ItemKind {
    Close,
    Open,
    Stub,
    Token,
}

#[derive(Clone, Copy)]
struct MatchItem<'s> {
    kind: ItemKind,
    previous: u32,
    syntax: Option<SyntaxInfo<'s>>,
    token: Option<usize>,
}

#[derive(Clone, Copy)]
struct SyntaxItem<'g, 's> {
    opts: Option<&'g Range<'s>>,
    previous: u32,
    syntax: Option<SyntaxInfo<'s>>,
}

#[derive(Clone, Copy)]
struct ThenItem<'g, 's> {
    match_stack: u32,
    next: State<'g, 's>,
    previous: u32,
    syntax_stack: u32,
}

#[derive(Clone, Copy)]
struct ElseItem<'g, 's> {
    match_stack: u32,
    next: State<'g, 's>,
    previous: u32,
    syntax_stack: u32,
    then_stack: u32,
    token_index: usize,
}

struct Buffer<'g, 's> {
    graph: &'g Graph<'s>,
    index: usize,
    mask: i32,
    node: GraphIndex,
}

/// Stashing state for low-priority types: allowed, disabled, or holding a snapshot.
#[derive(Clone, Copy, Eq, PartialEq)]
enum Stash {
    Allowed,
    Disabled,
    Stashed(u32),
}

/// Matches `tokens` against `graph`, resolving type and property references through `lexer`.
pub(crate) fn match_tokens<'g, 's>(
    tokens: &[MatchToken<'_>],
    graph: &'g Graph<'s>,
    lexer: &'g Lexer,
) -> Result<Outcome<'s>, Thrown> {
    let mut matcher = Matcher {
        buffers: Vec::new(),
        else_items: Vec::new(),
        lexer,
        match_items: vec![MatchItem {
            kind: ItemKind::Stub,
            previous: NONE,
            syntax: None,
            token: None,
        }],
        syntax_items: Vec::new(),
        then_items: Vec::new(),
        tokens,
    };

    matcher.run(graph)
}

struct Matcher<'t, 'v, 'g, 's> {
    buffers: Vec<Buffer<'g, 's>>,
    else_items: Vec<ElseItem<'g, 's>>,
    lexer: &'g Lexer,
    match_items: Vec<MatchItem<'s>>,
    syntax_items: Vec<SyntaxItem<'g, 's>>,
    then_items: Vec<ThenItem<'g, 's>>,
    tokens: &'t [MatchToken<'v>],
}

/// The mutable registers of a run.
struct Registers<'g, 's> {
    else_stack: u32,
    longest_match: usize,
    match_stack: u32,
    stash: Stash,
    state: State<'g, 's>,
    syntax_stack: u32,
    then_stack: u32,
    token_index: usize,
}

impl<'g, 's> Matcher<'_, '_, 'g, 's> {
    fn token(&self, index: usize) -> Option<&MatchToken<'_>> {
        self.tokens.get(index)
    }

    /// Returns the next index at or after `index + 1` that is not whitespace or a comment.
    fn next_token_index(&self, mut index: usize) -> usize {
        loop {
            index += 1;

            match self.tokens.get(index) {
                Some(token) if matches!(token.kind, TokenType::WhiteSpace | TokenType::Comment) => {
                }
                _ => return index,
            }
        }
    }

    fn push_match(&mut self, item: MatchItem<'s>) -> u32 {
        let index = u32::try_from(self.match_items.len()).unwrap_or(NONE);

        self.match_items.push(item);
        index
    }

    fn match_item(&self, index: u32) -> Option<&MatchItem<'s>> {
        self.match_items.get(index as usize)
    }

    fn push_else(
        &mut self,
        registers: &Registers<'g, 's>,
        next: State<'g, 's>,
        previous: u32,
    ) -> u32 {
        let index = u32::try_from(self.else_items.len()).unwrap_or(NONE);

        self.else_items.push(ElseItem {
            match_stack: registers.match_stack,
            next,
            previous,
            syntax_stack: registers.syntax_stack,
            then_stack: registers.then_stack,
            token_index: registers.token_index,
        });
        index
    }

    fn push_then(&mut self, registers: &mut Registers<'g, 's>, next: State<'g, 's>) {
        let index = u32::try_from(self.then_items.len()).unwrap_or(NONE);

        self.then_items.push(ThenItem {
            match_stack: registers.match_stack,
            next,
            previous: registers.then_stack,
            syntax_stack: registers.syntax_stack,
        });
        registers.then_stack = index;
    }

    fn add_token_to_match(
        &mut self,
        registers: &mut Registers<'g, 's>,
        syntax: Option<SyntaxInfo<'s>>,
    ) {
        let token = (registers.token_index < self.tokens.len()).then_some(registers.token_index);

        registers.match_stack = self.push_match(MatchItem {
            kind: ItemKind::Token,
            previous: registers.match_stack,
            syntax,
            token,
        });
        registers.token_index = self.next_token_index(registers.token_index);
        registers.stash = Stash::Allowed;

        if registers.token_index > registers.longest_match {
            registers.longest_match = registers.token_index;
        }
    }

    fn open_syntax(
        &mut self,
        registers: &mut Registers<'g, 's>,
        syntax: SyntaxInfo<'s>,
        opts: Option<&'g Range<'s>>,
    ) {
        let inherited = opts.or_else(|| {
            self.syntax_items
                .get(registers.syntax_stack as usize)
                .and_then(|item| item.opts)
        });
        let index = u32::try_from(self.syntax_items.len()).unwrap_or(NONE);

        self.syntax_items.push(SyntaxItem {
            opts: inherited,
            previous: registers.syntax_stack,
            syntax: Some(syntax),
        });
        registers.syntax_stack = index;

        let token = self
            .match_item(registers.match_stack)
            .and_then(|item| item.token);

        registers.match_stack = self.push_match(MatchItem {
            kind: ItemKind::Open,
            previous: registers.match_stack,
            syntax: Some(syntax),
            token,
        });
    }

    fn close_syntax(&mut self, registers: &mut Registers<'g, 's>) {
        let Some(&top) = self.match_item(registers.match_stack) else {
            return;
        };

        if top.kind == ItemKind::Open {
            registers.match_stack = top.previous;
        } else {
            let syntax = self
                .syntax_items
                .get(registers.syntax_stack as usize)
                .and_then(|item| item.syntax);

            registers.match_stack = self.push_match(MatchItem {
                kind: ItemKind::Close,
                previous: registers.match_stack,
                syntax,
                token: top.token,
            });
        }

        registers.syntax_stack = self
            .syntax_items
            .get(registers.syntax_stack as usize)
            .map_or(NONE, |item| item.previous);
    }

    fn is_comma_context_start(&self, token: Option<usize>) -> bool {
        let Some(token) = token.and_then(|index| self.token(index)) else {
            return true;
        };

        matches!(
            token.kind,
            TokenType::Comma
                | TokenType::Function
                | TokenType::LeftParenthesis
                | TokenType::LeftSquareBracket
                | TokenType::LeftCurlyBracket
        ) || (token.kind == TokenType::Delim && token.value != "?")
    }

    fn run(&mut self, graph: &'g Graph<'s>) -> Result<Outcome<'s>, Thrown> {
        let mut registers = Registers {
            else_stack: NONE,
            longest_match: 0,
            match_stack: 0,
            stash: Stash::Allowed,
            state: State::Graph(graph),
            syntax_stack: NONE,
            then_stack: NONE,
            token_index: 0,
        };
        let mut iterations = 0;
        let mut reason = None;

        // css-tree starts before the first token and moves to the first significant one.
        registers.token_index = match self.tokens.first() {
            Some(token) if matches!(token.kind, TokenType::WhiteSpace | TokenType::Comment) => {
                self.next_token_index(0)
            }
            _ => 0,
        };

        while reason.is_none() {
            iterations += 1;

            if iterations >= ITERATION_LIMIT {
                break;
            }

            reason = self.step(&mut registers)?;
        }

        let match_stack = match reason {
            Some(ExitReason::Match) => {
                while registers.syntax_stack != NONE {
                    self.close_syntax(&mut registers);
                }

                Some(registers.match_stack)
            }
            _ => None,
        };

        Ok(Outcome {
            iterations,
            longest_match: registers.longest_match,
            reason: reason.unwrap_or(ExitReason::IterationLimit),
            tree: match_stack.map(|top| self.build_tree(top, graph.reference)),
        })
    }

    /// Runs one iteration, returning the exit reason when matching ends.
    fn step(&mut self, registers: &mut Registers<'g, 's>) -> Result<Option<ExitReason>, Thrown> {
        match registers.state {
            State::Match => {
                let Some(&then) = self.then_items.get(registers.then_stack as usize) else {
                    if let Some(token) = self.token(registers.token_index) {
                        // A single trailing IE hack such as `\9` does not fail a match.
                        let is_last = registers.token_index + 1 == self.tokens.len();

                        if !is_last || (token.value != "\\0" && token.value != "\\9") {
                            registers.state = State::Mismatch;
                            return Ok(None);
                        }
                    }

                    return Ok(Some(ExitReason::Match));
                };

                registers.state = then.next;

                if matches!(then.next, State::DisallowEmpty) {
                    if then.match_stack == registers.match_stack {
                        registers.state = State::Mismatch;
                        return Ok(None);
                    }

                    registers.state = State::Match;
                }

                while then.syntax_stack != registers.syntax_stack {
                    if registers.syntax_stack == NONE {
                        break;
                    }

                    self.close_syntax(registers);
                }

                registers.then_stack = then.previous;
            }
            State::Mismatch => {
                if let Stash::Stashed(stash) = registers.stash {
                    let restore = match self.else_items.get(registers.else_stack as usize) {
                        None => true,
                        Some(item) => registers.token_index > item.token_index,
                    };

                    if restore {
                        registers.else_stack = stash;
                        registers.stash = Stash::Disabled;
                    }
                } else if registers.else_stack == NONE {
                    return Ok(Some(ExitReason::Mismatch));
                }

                let Some(&item) = self.else_items.get(registers.else_stack as usize) else {
                    return Ok(Some(ExitReason::Mismatch));
                };

                registers.state = item.next;
                registers.then_stack = item.then_stack;
                registers.syntax_stack = item.syntax_stack;
                registers.match_stack = item.match_stack;
                registers.token_index = item.token_index;
                registers.else_stack = item.previous;
            }
            State::DisallowEmpty => {
                // css-tree reaches this only as a `then` target, handled under `Match`.
                return Err(Thrown(std::borrow::Cow::Borrowed(
                    "Unknown node type: DisallowEmpty",
                )));
            }
            State::Graph(graph) => registers.state = State::at(graph, graph.root),
            State::Buffer(buffer) => self.match_once_buffer(registers, buffer),
            State::AddMatchOnce { graph, mask, node } => {
                registers.state = State::Buffer(self.new_buffer(graph, node, mask));
            }
            State::Node(graph, index) => self.step_node(registers, graph, index)?,
        }

        Ok(None)
    }

    fn new_buffer(&mut self, graph: &'g Graph<'s>, node: GraphIndex, mask: i32) -> u32 {
        let index = u32::try_from(self.buffers.len()).unwrap_or(NONE);

        self.buffers.push(Buffer {
            graph,
            index: 0,
            mask,
            node,
        });
        index
    }

    fn match_once_buffer(&mut self, registers: &mut Registers<'g, 's>, buffer: u32) {
        let Some(current) = self.buffers.get(buffer as usize) else {
            registers.state = State::Mismatch;
            return;
        };
        let (graph, node, mask, start) = (current.graph, current.node, current.mask, current.index);
        let GraphNode::MatchOnce { all, terms } = graph.node(node) else {
            registers.state = State::Mismatch;
            return;
        };
        let count = terms.len();

        if start == count {
            registers.state = if mask == 0 || *all {
                State::Mismatch
            } else {
                State::Match
            };
            return;
        }

        // JavaScript shifts modulo 32 and subtracts in floating point.
        let full = i64::from(1i32.wrapping_shl(u32::try_from(count).unwrap_or(0))) - 1;

        if i64::from(mask) == full {
            registers.state = State::Match;
            return;
        }

        let mut index = start;

        while index < count {
            let flag = 1i32.wrapping_shl(u32::try_from(index).unwrap_or(0));

            if mask & flag == 0 {
                let previous = registers.else_stack;

                registers.else_stack = self.push_else(registers, State::Buffer(buffer), previous);
                self.push_then(
                    registers,
                    State::AddMatchOnce {
                        graph,
                        mask: mask | flag,
                        node,
                    },
                );

                if let Some(current) = self.buffers.get_mut(buffer as usize) {
                    current.index = index + 1;
                }

                registers.state = State::at(graph, terms.get(index).copied().unwrap_or(MISMATCH));
                return;
            }

            index += 1;
        }

        if let Some(current) = self.buffers.get_mut(buffer as usize) {
            current.index = index;
        }
    }

    fn step_node(
        &mut self,
        registers: &mut Registers<'g, 's>,
        graph: &'g Graph<'s>,
        index: GraphIndex,
    ) -> Result<(), Thrown> {
        let token_index = registers.token_index;

        match graph.node(index) {
            GraphNode::Match => registers.state = State::Match,
            GraphNode::Mismatch => registers.state = State::Mismatch,
            GraphNode::DisallowEmpty => registers.state = State::DisallowEmpty,
            GraphNode::If {
                matches,
                otherwise,
                then,
            } => {
                // The else snapshot must come first, since it records the then stack before
                // this node changes it.
                if *otherwise != MISMATCH {
                    let previous = registers.else_stack;

                    registers.else_stack =
                        self.push_else(registers, State::at(graph, *otherwise), previous);
                }

                if *then != MATCH {
                    self.push_then(registers, State::at(graph, *then));
                }

                registers.state = State::at(graph, *matches);
            }
            GraphNode::MatchOnce { .. } => {
                registers.state = State::Buffer(self.new_buffer(graph, index, 0));
            }
            GraphNode::Enum { map } => {
                registers.state = State::Mismatch;

                if let Some(token) = self.token(token_index) {
                    let name = crate::js::to_lower_case(&token.value);
                    let name = strip_ie_hack(&name);

                    if let Some(&target) = map.get(name) {
                        registers.state = State::at(graph, target);
                    }
                }
            }
            GraphNode::Generic(kind) => {
                let opts = self
                    .syntax_items
                    .get(registers.syntax_stack as usize)
                    .and_then(|item| item.opts);
                let consumed = generic::call(*kind, self.tokens, token_index, opts)?;
                let last = token_index + consumed;

                if last > token_index {
                    while registers.token_index < last {
                        self.add_token_to_match(registers, None);
                    }

                    registers.state = State::Match;
                } else {
                    registers.state = State::Mismatch;
                }
            }
            GraphNode::Type { opts, syntax } => {
                let target = self.lexer.reference(EntryKind::Type, syntax.name)?;

                if registers.stash != Stash::Disabled
                    && let Some(token) = self.token(token_index)
                {
                    // A `<custom-ident>` only claims an identifier no other term claims, and
                    // a `0` parses as a number before a length.
                    let low_priority = (syntax.name == "custom-ident"
                        && token.kind == TokenType::Ident)
                        || (syntax.name == "length" && token.value == "0");

                    if low_priority {
                        if registers.stash == Stash::Allowed {
                            let previous = registers.else_stack;

                            registers.stash = Stash::Stashed(self.push_else(
                                registers,
                                State::Node(graph, index),
                                previous,
                            ));
                        }

                        registers.state = State::Mismatch;
                        return Ok(());
                    }
                }

                self.open_syntax(registers, *syntax, opts.as_ref());
                registers.state = State::Graph(target);
            }
            GraphNode::Property { syntax } => {
                let target = self.lexer.reference(EntryKind::Property, syntax.name)?;

                self.open_syntax(registers, *syntax, None);
                registers.state = State::Graph(target);
            }
            GraphNode::Keyword { name, syntax } => {
                registers.state = State::Mismatch;

                if let Some(token) = self.token(token_index)
                    && equals_case_insensitive(strip_ie_hack(&token.value), name)
                {
                    self.add_token_to_match(registers, Some(*syntax));
                    registers.state = State::Match;
                }
            }
            GraphNode::AtKeyword { name, syntax } | GraphNode::Function { name, syntax } => {
                registers.state = State::Mismatch;

                if let Some(token) = self.token(token_index)
                    && equals_case_insensitive(&token.value, name)
                {
                    self.add_token_to_match(registers, Some(*syntax));
                    registers.state = State::Match;
                }
            }
            GraphNode::Token { syntax, value } => {
                registers.state = State::Mismatch;

                if self
                    .token(token_index)
                    .is_some_and(|token| token.value == *value)
                {
                    self.add_token_to_match(registers, Some(*syntax));
                    registers.state = State::Match;
                }
            }
            GraphNode::Comma => {
                let last = self
                    .match_item(registers.match_stack)
                    .and_then(|item| item.token);
                let token = self.token(token_index);

                if token.is_some_and(|token| token.kind == TokenType::Comma) {
                    if self.is_comma_context_start(last) {
                        registers.state = State::Mismatch;
                    } else {
                        // css-tree records the multiplier as the comma's syntax, which never
                        // reaches a trace.
                        self.add_token_to_match(registers, None);

                        let next = self.token(registers.token_index);

                        registers.state = if is_comma_context_end(next) {
                            State::Mismatch
                        } else {
                            State::Match
                        };
                    }
                } else {
                    registers.state =
                        if self.is_comma_context_start(last) || is_comma_context_end(token) {
                            State::Match
                        } else {
                            State::Mismatch
                        };
                }
            }
            GraphNode::String { syntax, value } => {
                let mut text = String::new();
                let mut last = token_index;

                while last < self.tokens.len() && text.len() < value.len() {
                    if let Some(token) = self.tokens.get(last) {
                        text.push_str(&token.value);
                    }

                    last += 1;
                }

                if equals_case_insensitive(&text, value) {
                    while registers.token_index < last {
                        self.add_token_to_match(registers, Some(*syntax));
                    }

                    registers.state = State::Match;
                } else {
                    registers.state = State::Mismatch;
                }
            }
        }

        Ok(())
    }

    /// Builds css-tree's match tree from the match stack, like `matchAsTree`.
    fn build_tree(&self, top: u32, reference: Option<SyntaxInfo<'s>>) -> MatchTree<'s> {
        let mut items = Vec::new();
        let mut cursor = top;

        while let Some(item) = self.match_item(cursor) {
            items.push(*item);
            cursor = item.previous;
        }

        // The oldest item is the stub.
        items.pop();

        let mut nodes = vec![TreeNode::Host {
            children: Vec::new(),
            syntax: reference,
        }];
        let mut hosts = vec![0usize];

        for item in items.into_iter().rev() {
            let host = hosts.last().copied().unwrap_or(0);

            match item.kind {
                ItemKind::Open => {
                    let index = nodes.len();

                    nodes.push(TreeNode::Host {
                        children: Vec::new(),
                        syntax: item.syntax,
                    });

                    if let Some(TreeNode::Host { children, .. }) = nodes.get_mut(host) {
                        children.push(index);
                    }

                    hosts.push(index);
                }
                ItemKind::Close => {
                    hosts.pop();
                }
                ItemKind::Stub | ItemKind::Token => {
                    let index = nodes.len();
                    let token = item.token.and_then(|token| self.tokens.get(token));

                    nodes.push(TreeNode::Leaf {
                        node: token.and_then(|token| token.node),
                        syntax: item.syntax,
                        token: item.token.unwrap_or(usize::MAX),
                    });

                    if let Some(TreeNode::Host { children, .. }) = nodes.get_mut(host) {
                        children.push(index);
                    }
                }
            }
        }

        MatchTree { nodes }
    }
}

/// css-tree's `isCommaContextEnd`: whether a token closes a comma-separated context.
fn is_comma_context_end(token: Option<&MatchToken<'_>>) -> bool {
    let Some(token) = token else {
        return true;
    };

    matches!(
        token.kind,
        TokenType::RightParenthesis | TokenType::RightSquareBracket | TokenType::RightCurlyBracket
    ) || (token.kind == TokenType::Delim && token.value == "/")
}

/// Removes a `\0` or `\9` hack and everything after it, like css-tree's
/// `replace(/\\[09].*$/, '')`, which only matches when no line terminator follows.
fn strip_ie_hack(value: &str) -> &str {
    if !value.contains('\\') {
        return value;
    }

    let after_terminator = value
        .rfind(['\n', '\r', '\u{2028}', '\u{2029}'])
        .map_or(0, |found| found + 1);
    let bytes = value.as_bytes();
    let mut index = after_terminator;

    while index + 1 < bytes.len() {
        if bytes.get(index) == Some(&b'\\') && matches!(bytes.get(index + 1), Some(b'0' | b'9')) {
            return value.get(..index).unwrap_or(value);
        }

        index += 1;
    }

    value
}

/// css-tree's `areStringsEqualCaseInsensitive`: folds `A-Z` in the tested string only.
fn equals_case_insensitive(test: &str, reference: &str) -> bool {
    test.len() == reference.len()
        && test
            .bytes()
            .zip(reference.bytes())
            .all(|(test, reference)| test.to_ascii_lowercase() == reference)
}
