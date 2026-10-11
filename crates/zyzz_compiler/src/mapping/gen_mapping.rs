//! Builds source maps from individual mappings, mirroring the subset of
//! `@jridgewell/gen-mapping` 0.3 the compiler uses.
//!
//! Lines are one-based and columns zero-based, as the library's public positions are. Columns are
//! whatever unit the caller supplies: the compiler passes UTF-16 code units.

use rustc_hash::FxHashMap;

use crate::js;
use crate::mapping::codec::{self, Original, Segment};

/// A one-based line and zero-based column.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Position {
    /// Zero-based column.
    pub column: u32,
    /// One-based line.
    pub line: u32,
}

/// One mapping from a generated position, optionally to an original position.
#[derive(Clone, Copy, Debug)]
pub struct Mapping<'a> {
    /// Generated position.
    pub generated: Position,
    /// Name of the original binding. An empty name records none.
    pub name: Option<&'a str>,
    /// Original position, used when `source` is present.
    pub original: Option<Position>,
    /// Source path. An empty path records a sourceless mapping.
    pub source: Option<&'a str>,
}

/// An encoded Source Map v3 with every field gen-mapping writes.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct EncodedSourceMap {
    /// Generated file name.
    pub file: Option<String>,
    /// Indexes of ignored sources.
    pub ignore_list: Option<Vec<i64>>,
    /// Encoded mappings.
    pub mappings: String,
    /// Original binding names.
    pub names: Vec<String>,
    /// Prefix of every source path.
    pub source_root: Option<String>,
    /// Source paths, `None` for a `null` entry.
    pub sources: Vec<Option<String>>,
    /// Source contents, `None` for a `null` entry.
    pub sources_content: Option<Vec<Option<String>>>,
}

impl EncodedSourceMap {
    /// Serializes like `JSON.stringify(toEncodedMap(map))`, in gen-mapping's key order.
    pub fn to_json(&self) -> String {
        let mut output = String::from("{\"version\":3");

        if let Some(file) = &self.file {
            output.push_str(",\"file\":");
            js::write_string(&mut output, file);
        }

        output.push_str(",\"names\":");
        write_strings(
            &mut output,
            self.names.iter().map(|name| Some(name.as_str())),
        );

        if let Some(root) = &self.source_root {
            output.push_str(",\"sourceRoot\":");
            js::write_string(&mut output, root);
        }

        output.push_str(",\"sources\":");
        write_strings(&mut output, self.sources.iter().map(Option::as_deref));

        if let Some(contents) = &self.sources_content {
            output.push_str(",\"sourcesContent\":");
            write_strings(&mut output, contents.iter().map(Option::as_deref));
        }

        output.push_str(",\"mappings\":");
        js::write_string(&mut output, &self.mappings);

        if let Some(ignored) = &self.ignore_list {
            output.push_str(",\"ignoreList\":[");

            for (index, entry) in ignored.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                // Indexes are integers, which print like JavaScript numbers.
                output.push_str(&entry.to_string());
            }

            output.push(']');
        }

        output.push('}');
        output
    }
}

fn write_strings<'a>(output: &mut String, values: impl Iterator<Item = Option<&'a str>>) {
    output.push('[');

    for (index, value) in values.enumerate() {
        if index > 0 {
            output.push(',');
        }

        match value {
            Some(value) => js::write_string(output, value),
            None => output.push_str("null"),
        }
    }

    output.push(']');
}

/// An ordered set that assigns each key the index of its first insertion.
#[derive(Clone, Debug, Default)]
struct SetArray {
    array: Vec<String>,
    indexes: FxHashMap<String, usize>,
}

impl SetArray {
    fn put(&mut self, key: &str) -> usize {
        if let Some(index) = self.indexes.get(key) {
            return *index;
        }

        let index = self.array.len();

        self.array.push(key.to_owned());
        self.indexes.insert(key.to_owned(), index);
        index
    }
}

/// A source map under construction.
#[derive(Clone, Debug, Default)]
pub struct GenMapping {
    file: Option<String>,
    mappings: Vec<Vec<Segment>>,
    names: SetArray,
    sources: SetArray,
    sources_content: Vec<Option<String>>,
}

impl GenMapping {
    /// Creates an empty map, as `new GenMapping({ file })` does.
    pub fn new(file: Option<&str>) -> Self {
        Self {
            file: file.map(str::to_owned),
            ..Self::default()
        }
    }

    /// Adds a mapping, keeping each line ordered by generated column. A mapping at an existing
    /// column follows the earlier ones.
    pub fn add_mapping(&mut self, mapping: &Mapping<'_>) {
        let line = mapping.generated.line.saturating_sub(1) as usize;
        let column = i64::from(mapping.generated.column);

        if self.mappings.len() <= line {
            self.mappings.resize_with(line + 1, Vec::new);
        }

        let segment = match mapping.source.filter(|source| !source.is_empty()) {
            None => Segment::generated(column),
            Some(source) => {
                let index = self.sources.put(source);
                let name = mapping
                    .name
                    .filter(|name| !name.is_empty())
                    .map(|name| self.names.put(name));
                let original = mapping.original.unwrap_or(Position { column: 0, line: 1 });

                if index == self.sources_content.len() {
                    self.sources_content.push(None);
                }

                Segment {
                    column,
                    original: Some(Original {
                        column: i64::from(original.column),
                        line: i64::from(original.line) - 1,
                        name: name.and_then(|name| i64::try_from(name).ok()),
                        source: i64::try_from(index).unwrap_or(i64::MAX),
                    }),
                }
            }
        };

        if let Some(segments) = self.mappings.get_mut(line) {
            let position = segments.partition_point(|current| current.column <= column);

            segments.insert(position, segment);
        }
    }

    /// Records the content of a source, adding the source when it is new.
    pub fn set_source_content(&mut self, source: &str, content: Option<&str>) {
        let index = self.sources.put(source);

        if self.sources_content.len() <= index {
            self.sources_content.resize(index + 1, None);
        }

        if let Some(entry) = self.sources_content.get_mut(index) {
            *entry = content.map(str::to_owned);
        }
    }

    /// Encodes the map, dropping trailing empty lines, as `toEncodedMap` does.
    pub fn to_encoded_map(&mut self) -> EncodedSourceMap {
        while self.mappings.last().is_some_and(Vec::is_empty) {
            self.mappings.pop();
        }

        EncodedSourceMap {
            file: self.file.clone().filter(|file| !file.is_empty()),
            ignore_list: Some(Vec::new()),
            mappings: codec::encode(&self.mappings),
            names: self.names.array.clone(),
            source_root: None,
            sources: self.sources.array.iter().cloned().map(Some).collect(),
            sources_content: Some(self.sources_content.clone()),
        }
    }
}
