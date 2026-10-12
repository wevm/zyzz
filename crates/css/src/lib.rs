//! CSS tokenization, parsing, generation, and value-definition grammar matching compatible with
//! css-tree 3.2.1.
//!
//! The crate ports the parts of css-tree the Zyzz compiler uses, keeping css-tree's observable
//! behavior: the same token boundaries, syntax trees, serialized output, lexer match results,
//! iteration counts, traces, and error messages. Modules mirror css-tree's layout:
//!
//! - [`tokenizer`]: CSS Syntax Level 3 tokens.
//! - [`parser`] and [`ast`]: syntax trees with css-tree's error recovery.
//! - [`generator`]: serialization back to CSS.
//! - [`walker`]: depth-first traversal.
//! - [`definition_syntax`]: the CSS value definition syntax used by grammars.
//! - [`lexer`]: grammar matching against css-tree's bundled property, type, and at-rule data,
//!   generated from css-tree's runtime lexer by `scripts/build-css-syntax-tables.ts`.
//! - [`ident`], [`string`], [`url`], and [`names`]: escaping and name helpers.
//!
//! Offsets are UTF-8 byte offsets into Rust strings. css-tree reports UTF-16 offsets into
//! JavaScript strings, and both identify the same token boundaries. Lexer error carets count
//! UTF-16 code units, as css-tree's messages do.
//!
//! Known differences from css-tree:
//!
//! - **Token buffer reuse:** css-tree's parser reuses a typed array across parses and reads one
//!   stale slot when an unbalanced closing bracket follows a balanced top-level block. This
//!   crate reads that slot as a fresh buffer would.
//! - **Nesting depth:** parsing fails at about 512 levels of nesting, where css-tree overflows
//!   the JavaScript stack somewhere between 1,000 and 5,000 levels. Both failures are caught by
//!   the same error recovery.
//! - **`constructor()` features:** css-tree stores a non-node placeholder for `constructor()` in
//!   media, supports, and container conditions. The tree holds no value there, [`walk`] visits
//!   nothing for it, and [`generate`] fails with css-tree's message.
//! - **Definition syntax limits:** multiplier repetitions expand to at most 1,000 nodes and
//!   counts saturate at `u32::MAX`, and an astral character in a grammar is one token instead
//!   of two surrogate tokens. Only grammars passed to [`Lexer::match_syntax`] can reach these.
//! - **Unported APIs:** source positions, `onComment` and `onToken` callbacks, custom or forked
//!   lexers, structure checks, fragment search, `toPlainObject`, `clone`, source maps, and
//!   walker `leave`, `reverse`, and context fields. Parse errors carry a message and offset
//!   without line, column, or source fragment.

pub mod ast;
pub mod definition_syntax;
mod generated;
pub mod generator;
pub mod ident;
mod js;
pub mod lexer;
pub mod names;
pub mod parser;
pub mod string;
pub mod tokenizer;
pub mod url;
pub mod walker;

pub use ast::{Ast, ConditionKind, List, Node, NodeId};
pub use generator::{GenerateError, generate};
pub use lexer::{Lexer, MatchError, MatchResult, MatchValue};
pub use parser::{Context, ParseOptions, SyntaxError, parse};
pub use tokenizer::{Token, TokenType, tokenize};
pub use walker::{Walk, walk, walk_visit};
