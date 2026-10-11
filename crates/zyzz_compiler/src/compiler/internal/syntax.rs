//! Parses authoring modules as TypeScript with JSX and resolves their bindings.

use std::cell::OnceCell;

use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_diagnostics::OxcDiagnostic;
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{Semantic, SemanticBuilder};
use oxc_span::SourceType;
use rustc_hash::FxHashMap;

use crate::compiler::internal::names;
use crate::js::Utf16Index;

/// A syntax or semantic error with UTF-16 offsets.
#[derive(Clone, Debug, PartialEq)]
pub struct SyntaxError {
    /// Exclusive UTF-16 end offset of the first label, or 0.
    pub end: u32,
    /// The parser's message.
    pub message: String,
    /// Inclusive UTF-16 start offset of the first label, or 0.
    pub start: u32,
}

/// A parsed module with resolved scopes. AST nodes live in the caller's allocator.
pub struct Parsed<'a> {
    /// Syntax and semantic errors, in parser order.
    pub errors: Vec<SyntaxError>,
    /// Readable declaration paths of calls, collected once for every pass that names them.
    names: OnceCell<FxHashMap<u32, String>>,
    /// UTF-8 to UTF-16 offset conversion for the source.
    pub offsets: Utf16Index,
    /// The program.
    pub program: &'a Program<'a>,
    /// Scopes, symbols, references, and parent links.
    pub semantic: Semantic<'a>,
    /// The source text.
    pub source: &'a str,
}

impl Parsed<'_> {
    /// Readable declaration paths keyed by call start, as [`names::collect`] reports them.
    pub fn names(&self) -> &FxHashMap<u32, String> {
        self.names.get_or_init(|| names::collect(self.program))
    }

    /// Converts a UTF-8 offset into the UTF-16 offset the TypeScript compiler reports.
    pub fn utf16(&self, offset: u32) -> u32 {
        self.offsets.utf16(offset)
    }
}

/// Parses as TSX, retrying TypeScript files with assertion-aware grammar when TSX fails.
///
/// Semantic errors count as failures, as `showSemanticErrors` does in `oxc-parser`.
pub fn parse<'a>(allocator: &'a Allocator, source: &'a str, module_id: &str) -> Parsed<'a> {
    let parsed = parse_as(allocator, source, SourceType::tsx());

    if !parsed.errors.is_empty() && typescript(module_id) {
        return parse_as(allocator, source, SourceType::ts());
    }

    parsed
}

/// Matches `/\.[cm]?ts$/`.
#[expect(
    clippy::case_sensitive_file_extension_comparisons,
    reason = "Module ids match case-sensitively, as the TypeScript host does."
)]
fn typescript(module_id: &str) -> bool {
    module_id.ends_with(".ts") || module_id.ends_with(".mts") || module_id.ends_with(".cts")
}

fn parse_as<'a>(allocator: &'a Allocator, source: &'a str, source_type: SourceType) -> Parsed<'a> {
    let options = ParseOptions {
        preserve_parens: false,
        ..ParseOptions::default()
    };
    let parsed = Parser::new(allocator, source, source_type.with_module(true))
        .with_options(options)
        .parse();
    let program = allocator.alloc(parsed.program);
    // Scope resolution reads declaring nodes and node scopes from the node store.
    let semantic = SemanticBuilder::new()
        .with_build_nodes(true)
        .with_check_syntax_error(true)
        .build(program);
    let offsets = Utf16Index::new(source);
    let errors = parsed
        .diagnostics
        .iter()
        .chain(&semantic.diagnostics)
        .map(|diagnostic| error(diagnostic, &offsets))
        .collect();

    Parsed {
        errors,
        names: OnceCell::new(),
        offsets,
        program,
        semantic: semantic.semantic,
        source,
    }
}

fn error(diagnostic: &OxcDiagnostic, offsets: &Utf16Index) -> SyntaxError {
    let span = diagnostic.labels.first();
    let (start, end) = span.map_or((0, 0), |label| {
        let start = label.offset();
        let end = start + label.len();

        (offsets.utf16(start), offsets.utf16(end))
    });

    SyntaxError {
        end,
        message: diagnostic.message.to_string(),
        start,
    }
}
