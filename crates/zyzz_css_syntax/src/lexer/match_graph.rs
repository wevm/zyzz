//! Compiles definition syntax trees into match graphs, following css-tree's `match-graph`.
//!
//! A graph is a vector of nodes linked by index. Indices 0, 1, and 2 are css-tree's shared
//! `MATCH`, `MISMATCH`, and `DISALLOW_EMPTY` sentinels in every graph. Multipliers without an
//! upper bound form cycles, which index links represent without reference counting.

use std::borrow::Cow;

use rustc_hash::FxHashMap;

use super::generic::GenericKind;
use super::{SyntaxInfo, SyntaxKind};
use crate::definition_syntax::{Combinator, Range, SyntaxNode};

/// Index of a node in a [`Graph`].
pub(crate) type GraphIndex = u32;

/// `MATCH`.
pub(crate) const MATCH: GraphIndex = 0;
/// `MISMATCH`.
pub(crate) const MISMATCH: GraphIndex = 1;
/// `DISALLOW_EMPTY`.
pub(crate) const DISALLOW_EMPTY: GraphIndex = 2;

/// Largest multiplier repetition expanded into a node chain. css-tree expands any count, so
/// larger counts take unbounded time and memory there.
const MAX_REPETITIONS: u32 = 1000;

/// A match graph node.
#[derive(Debug)]
pub(crate) enum GraphNode<'s> {
    /// Matches an at-keyword token such as `@media`.
    AtKeyword {
        name: String,
        syntax: SyntaxInfo<'s>,
    },
    /// Matches a comma, honoring css-tree's comma context rules.
    Comma,
    /// `DISALLOW_EMPTY`: fails when the enclosing match consumed nothing.
    DisallowEmpty,
    /// Dispatches on a token's lowercase value.
    Enum {
        map: FxHashMap<Cow<'s, str>, GraphIndex>,
    },
    /// Matches a function token.
    Function {
        name: String,
        syntax: SyntaxInfo<'s>,
    },
    /// A generic type implemented in code.
    Generic(GenericKind),
    /// Tries `matches`, continuing with `then` on success and `otherwise` on failure.
    If {
        matches: GraphIndex,
        otherwise: GraphIndex,
        then: GraphIndex,
    },
    /// Matches a keyword.
    Keyword {
        name: Cow<'s, str>,
        syntax: SyntaxInfo<'s>,
    },
    /// `MATCH`.
    Match,
    /// Matches every term (`all`) or at least one term once each, in any order.
    MatchOnce { all: bool, terms: Vec<GraphIndex> },
    /// `MISMATCH`.
    Mismatch,
    /// References a property grammar.
    Property { syntax: SyntaxInfo<'s> },
    /// Matches a sequence of tokens whose text equals a string.
    String {
        syntax: SyntaxInfo<'s>,
        value: Cow<'s, str>,
    },
    /// Matches one token by exact text.
    Token {
        syntax: SyntaxInfo<'s>,
        value: &'s str,
    },
    /// References a type grammar.
    Type {
        opts: Option<Range<'s>>,
        syntax: SyntaxInfo<'s>,
    },
}

/// A compiled grammar: nodes, the entry node, and the reference that names it.
#[derive(Debug)]
pub(crate) struct Graph<'s> {
    nodes: Vec<GraphNode<'s>>,
    /// css-tree's `syntax` on the graph: what the grammar belongs to.
    pub(crate) reference: Option<SyntaxInfo<'s>>,
    /// Entry node.
    pub(crate) root: GraphIndex,
}

impl<'s> Graph<'s> {
    /// Returns a node. Out-of-range indices read as `MISMATCH`.
    pub(crate) fn node(&self, index: GraphIndex) -> &GraphNode<'s> {
        self.nodes
            .get(index as usize)
            .unwrap_or(&GraphNode::Mismatch)
    }

    /// Compiles a syntax tree.
    pub(crate) fn build(syntax: &SyntaxNode<'s>, reference: Option<SyntaxInfo<'s>>) -> Self {
        let mut builder = Builder::new();
        let root = builder.build(syntax);

        Self {
            nodes: builder.nodes,
            reference,
            root,
        }
    }

    /// Wraps a generic type implementation.
    pub(crate) fn generic(kind: GenericKind, reference: Option<SyntaxInfo<'s>>) -> Self {
        let mut builder = Builder::new();
        let root = builder.push(GraphNode::Generic(kind));

        Self {
            nodes: builder.nodes,
            reference,
            root,
        }
    }
}

struct Builder<'s> {
    nodes: Vec<GraphNode<'s>>,
}

impl<'s> Builder<'s> {
    fn new() -> Self {
        Self {
            nodes: vec![
                GraphNode::Match,
                GraphNode::Mismatch,
                GraphNode::DisallowEmpty,
            ],
        }
    }

    fn push(&mut self, node: GraphNode<'s>) -> GraphIndex {
        let index = GraphIndex::try_from(self.nodes.len()).unwrap_or(MISMATCH);

        self.nodes.push(node);
        index
    }

    /// css-tree's `createCondition`, which folds trivial conditions.
    fn condition(
        &mut self,
        matches: GraphIndex,
        then: GraphIndex,
        otherwise: GraphIndex,
    ) -> GraphIndex {
        if then == MATCH && otherwise == MISMATCH {
            return matches;
        }

        if matches == MATCH && then == MATCH && otherwise == MATCH {
            return matches;
        }

        let (matches, then) = match self.nodes.get(matches as usize) {
            Some(GraphNode::If {
                matches: inner,
                otherwise: MISMATCH,
                then: inner_then,
            }) if then == MATCH => (*inner, *inner_then),
            _ => (matches, then),
        };

        self.push(GraphNode::If {
            matches,
            otherwise,
            then,
        })
    }

    fn set_then(&mut self, index: GraphIndex, value: GraphIndex) {
        if let Some(GraphNode::If { then, .. }) = self.nodes.get_mut(index as usize) {
            *then = value;
        }
    }

    fn set_otherwise(&mut self, index: GraphIndex, value: GraphIndex) {
        if let Some(GraphNode::If { otherwise, .. }) = self.nodes.get_mut(index as usize) {
            *otherwise = value;
        }
    }

    fn build(&mut self, node: &SyntaxNode<'s>) -> GraphIndex {
        match node {
            SyntaxNode::Group {
                combinator,
                disallow_empty,
                terms,
                ..
            } => {
                let terms: Vec<GraphIndex> = terms.iter().map(|term| self.build(term)).collect();
                let result = self.group(*combinator, &terms, false);

                if *disallow_empty {
                    self.condition(result, DISALLOW_EMPTY, MISMATCH)
                } else {
                    result
                }
            }
            SyntaxNode::Multiplier {
                comma,
                max,
                min,
                term,
            } => self.multiplier(*comma, *min, *max, term),
            SyntaxNode::Boolean { term } => self.boolean(term),
            SyntaxNode::Type { name, opts } => self.push(GraphNode::Type {
                opts: *opts,
                syntax: SyntaxInfo {
                    kind: SyntaxKind::Type,
                    name,
                },
            }),
            SyntaxNode::Property { name } => self.push(GraphNode::Property {
                syntax: SyntaxInfo {
                    kind: SyntaxKind::Property,
                    name,
                },
            }),
            SyntaxNode::Keyword { name } => self.push(GraphNode::Keyword {
                name: crate::js::to_lower_case(name),
                syntax: SyntaxInfo {
                    kind: SyntaxKind::Keyword,
                    name,
                },
            }),
            SyntaxNode::AtKeyword { name } => self.push(GraphNode::AtKeyword {
                name: format!("@{}", crate::js::to_lower_case(name)),
                syntax: SyntaxInfo {
                    kind: SyntaxKind::AtKeyword,
                    name,
                },
            }),
            SyntaxNode::Function { name } => self.push(GraphNode::Function {
                name: format!("{}(", crate::js::to_lower_case(name)),
                syntax: SyntaxInfo {
                    kind: SyntaxKind::Function,
                    name,
                },
            }),
            SyntaxNode::String { value } => {
                let syntax = SyntaxInfo {
                    kind: SyntaxKind::String,
                    name: value,
                };

                // A one-character string such as `'['` becomes a token.
                if crate::js::utf16_length(value) == 3 {
                    let inner = value
                        .get(1..value.len().saturating_sub(1))
                        .unwrap_or_default();

                    return self.push(GraphNode::Token {
                        syntax,
                        value: inner,
                    });
                }

                let inner = value
                    .get(1..value.len().saturating_sub(1))
                    .unwrap_or_default();
                let value = if inner.contains("\\'") {
                    Cow::Owned(inner.replace("\\'", "'"))
                } else {
                    Cow::Borrowed(inner)
                };

                self.push(GraphNode::String { syntax, value })
            }
            SyntaxNode::Token { value } => self.push(GraphNode::Token {
                syntax: SyntaxInfo {
                    kind: SyntaxKind::Token,
                    name: value,
                },
                value,
            }),
            SyntaxNode::Comma => self.push(GraphNode::Comma),
        }
    }

    fn group(
        &mut self,
        combinator: Combinator,
        terms: &[GraphIndex],
        at_least_one: bool,
    ) -> GraphIndex {
        match combinator {
            Combinator::Space => {
                let mut result = MATCH;

                for &term in terms.iter().rev() {
                    result = self.condition(term, result, MISMATCH);
                }

                result
            }
            Combinator::One => self.alternatives(terms),
            Combinator::All | Combinator::Any => {
                let all = combinator == Combinator::All;

                // Large groups would expand to factorial trees, so css-tree matches them with a
                // dedicated node.
                if terms.len() > 5 {
                    return self.push(GraphNode::MatchOnce {
                        all,
                        terms: terms.to_vec(),
                    });
                }

                let mut result = if !all && at_least_one {
                    MATCH
                } else {
                    MISMATCH
                };

                for &term in terms.iter().rev() {
                    let then = if terms.len() > 1 {
                        // css-tree filters by identity, which removes every occurrence of a
                        // term shared by reference.
                        let rest: Vec<GraphIndex> = terms
                            .iter()
                            .copied()
                            .filter(|candidate| *candidate != term)
                            .collect();

                        self.group(combinator, &rest, true)
                    } else {
                        MATCH
                    };

                    result = self.condition(term, then, result);
                }

                result
            }
        }
    }

    /// `|` alternatives, folding runs of keywords and functions into one `Enum`.
    fn alternatives(&mut self, terms: &[GraphIndex]) -> GraphIndex {
        let mut result = MISMATCH;
        let mut map: Option<GraphIndex> = None;

        for index in (0..terms.len()).rev() {
            let Some(&term) = terms.get(index) else {
                continue;
            };

            if let Some(key) = self.enum_key(term) {
                if map.is_none()
                    && index > 0
                    && terms
                        .get(index - 1)
                        .is_some_and(|previous| self.enum_key(*previous).is_some())
                {
                    let created = self.push(GraphNode::Enum {
                        map: FxHashMap::default(),
                    });

                    result = self.condition(created, MATCH, result);
                    map = Some(created);
                }

                if let Some(map_index) = map
                    && let Some(GraphNode::Enum { map: entries }) =
                        self.nodes.get_mut(map_index as usize)
                    && !entries.contains_key(&key)
                {
                    entries.insert(key, term);
                    continue;
                }
            }

            map = None;
            result = self.condition(term, MATCH, result);
        }

        result
    }

    /// Returns the lowercase `Enum` key for keyword-like terms.
    fn enum_key(&self, term: GraphIndex) -> Option<Cow<'s, str>> {
        match self.nodes.get(term as usize)? {
            GraphNode::Keyword { name, .. } => Some(name.clone()),
            GraphNode::AtKeyword { name, .. } | GraphNode::Function { name, .. } => {
                Some(Cow::Owned(crate::js::to_lower_case(name).into_owned()))
            }
            GraphNode::Type { syntax, .. } if is_function_type(syntax.name) => {
                let trimmed = syntax.name.get(..syntax.name.len() - 1).unwrap_or_default();

                Some(Cow::Owned(crate::js::to_lower_case(trimmed).into_owned()))
            }
            _ => None,
        }
    }

    fn multiplier(&mut self, comma: bool, min: u32, max: u32, term: &SyntaxNode<'s>) -> GraphIndex {
        let mut result = MATCH;
        let mut matches = self.build(term);

        if max == 0 {
            // Disallow repeating an empty match, which would loop forever.
            matches = self.condition(matches, DISALLOW_EMPTY, MISMATCH);

            // css-tree creates the loop with an unset `then` that no folding rule matches, so it
            // is always a new node.
            let looped = self.push(GraphNode::If {
                matches,
                otherwise: MISMATCH,
                then: MATCH,
            });
            let then = self.push(GraphNode::If {
                matches: MATCH,
                otherwise: looped,
                then: MATCH,
            });

            self.set_then(looped, then);

            if comma {
                let comma_node = self.push(GraphNode::Comma);
                let comma_condition = self.push(GraphNode::If {
                    matches: comma_node,
                    otherwise: MISMATCH,
                    then: looped,
                });

                self.set_otherwise(then, comma_condition);
            }

            result = looped;
        } else {
            let start = min.max(1);
            let end = max.min(start.saturating_add(MAX_REPETITIONS));

            for _ in start..=end {
                if comma && result != MATCH {
                    let comma_node = self.push(GraphNode::Comma);

                    result = self.condition(comma_node, result, MISMATCH);
                }

                let optional = self.condition(MATCH, MATCH, result);

                result = self.condition(matches, optional, MISMATCH);
            }
        }

        if min == 0 {
            result = self.condition(MATCH, MATCH, result);
        } else {
            for _ in 0..min.saturating_sub(1).min(MAX_REPETITIONS) {
                if comma && result != MATCH {
                    let comma_node = self.push(GraphNode::Comma);

                    result = self.condition(comma_node, result, MISMATCH);
                }

                result = self.condition(matches, result, MISMATCH);
            }
        }

        result
    }

    /// `<boolean-expr[ test ]>` from CSS Values 5.
    fn boolean(&mut self, term: &SyntaxNode<'s>) -> GraphIndex {
        let test = self.build(term);
        let group = |terms: Vec<SyntaxNode<'s>>, combinator| SyntaxNode::Group {
            combinator,
            disallow_empty: false,
            explicit: false,
            terms,
        };
        let placeholder = |name: &'static str| SyntaxNode::Type { name, opts: None };
        let repeated = |keyword: &'static str| SyntaxNode::Multiplier {
            comma: false,
            max: 0,
            min: 0,
            term: Box::new(group(
                vec![
                    SyntaxNode::Keyword { name: keyword },
                    placeholder("!boolean-group"),
                ],
                Combinator::Space,
            )),
        };
        let expression = group(
            vec![
                group(
                    vec![
                        SyntaxNode::Keyword { name: "not" },
                        placeholder("!boolean-group"),
                    ],
                    Combinator::Space,
                ),
                group(
                    vec![
                        placeholder("!boolean-group"),
                        group(vec![repeated("and"), repeated("or")], Combinator::One),
                    ],
                    Combinator::Space,
                ),
            ],
            Combinator::One,
        );
        let matches = self.build(&expression);
        let boolean_group = self.build(&group(
            vec![
                placeholder("!term"),
                group(
                    vec![
                        SyntaxNode::Token { value: "(" },
                        placeholder("!self"),
                        SyntaxNode::Token { value: ")" },
                    ],
                    Combinator::Space,
                ),
                SyntaxNode::Type {
                    name: "general-enclosed",
                    opts: None,
                },
            ],
            Combinator::One,
        ));

        self.replace_types(boolean_group, &[("!term", test), ("!self", matches)]);
        self.replace_types(matches, &[("!boolean-group", boolean_group)]);
        matches
    }

    /// css-tree's `replaceTypeInGraph`: rewrites `If` links to placeholder types, visiting each
    /// `If` once.
    fn replace_types(&mut self, start: GraphIndex, replacements: &[(&str, GraphIndex)]) {
        let mut visited = rustc_hash::FxHashSet::default();
        let mut stack = vec![start];

        while let Some(index) = stack.pop() {
            if !visited.insert(index) {
                continue;
            }

            let Some(GraphNode::If {
                matches,
                otherwise,
                then,
            }) = self.nodes.get(index as usize)
            else {
                continue;
            };
            let links = [*matches, *then, *otherwise];
            let replaced = links.map(|link| self.replacement(link, replacements).unwrap_or(link));

            if let Some(GraphNode::If {
                matches,
                otherwise,
                then,
            }) = self.nodes.get_mut(index as usize)
            {
                *matches = replaced[0];
                *then = replaced[1];
                *otherwise = replaced[2];
            }

            // Recurse into the original links, as css-tree does before replacing them.
            for link in links.into_iter().rev() {
                stack.push(link);
            }
        }
    }

    fn replacement(
        &self,
        link: GraphIndex,
        replacements: &[(&str, GraphIndex)],
    ) -> Option<GraphIndex> {
        let GraphNode::Type { syntax, .. } = self.nodes.get(link as usize)? else {
            return None;
        };

        replacements
            .iter()
            .find(|(name, _)| *name == syntax.name)
            .map(|(_, replacement)| *replacement)
    }
}

/// Reports whether a type name ends with `()`.
fn is_function_type(name: &str) -> bool {
    name.len() > 2 && name.ends_with("()")
}
