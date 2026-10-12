//! Edits a source string by original offsets and generates high-resolution source maps, mirroring
//! the subset of `magic-string` 1.2 the compiler uses.
//!
//! Callers pass UTF-8 byte offsets on character boundaries. Source map columns and the offsets in
//! error messages count UTF-16 code units, as `magic-string` computes them from JavaScript strings.
//! Chunks never move, so they stay ordered by their original start.

use std::collections::BTreeMap;
use std::fmt;

use crate::error::{Error, Result};
use crate::js;
use crate::mapping::codec::{self, Segment};

/// One original range and its replacement and insertions.
#[derive(Clone, Debug)]
struct Chunk {
    /// Replacement content. `None` keeps the original text, which also keeps per-character
    /// mappings.
    content: Option<String>,
    /// Exclusive original end.
    end: u32,
    /// Content inserted before the chunk.
    intro: String,
    /// Content inserted after the chunk.
    outro: String,
}

impl Chunk {
    fn edited(&self) -> bool {
        self.content.is_some()
    }

    /// Replaces the content. Unless `content_only` is set, insertions are dropped too.
    fn edit(&mut self, content: String, content_only: bool) {
        self.content = Some(content);

        if !content_only {
            self.intro.clear();
            self.outro.clear();
        }
    }
}

/// Options for [`MagicString::generate_map`] and [`Bundle::generate_map`].
#[derive(Clone, Copy, Debug, Default)]
pub struct MapOptions<'a> {
    /// Maps every original character instead of only the first of each line and edit.
    pub hires: bool,
    /// Includes the original text as `sourcesContent`.
    pub include_content: bool,
    /// Source path for a [`MagicString`] map. Backslashes become forward slashes.
    pub source: Option<&'a str>,
}

/// A generated Source Map v3, as `magic-string` returns it.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SourceMap {
    /// Encoded mappings with UTF-16 columns.
    pub mappings: String,
    /// Stored names, always empty for the edits this module supports.
    pub names: Vec<String>,
    /// Source paths.
    pub sources: Vec<String>,
    /// Original contents, present when requested. Bundle entries without content are `None`.
    pub sources_content: Option<Vec<Option<String>>>,
}

impl SourceMap {
    /// Serializes like `map.toString()`, which is `JSON.stringify(map)`.
    pub fn to_json(&self) -> String {
        let mut output = String::from("{\"version\":3,\"sources\":[");

        for (index, source) in self.sources.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            js::write_string(&mut output, source);
        }

        output.push(']');

        if let Some(contents) = &self.sources_content {
            output.push_str(",\"sourcesContent\":[");

            for (index, content) in contents.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                match content {
                    Some(content) => js::write_string(&mut output, content),
                    None => output.push_str("null"),
                }
            }

            output.push(']');
        }

        output.push_str(",\"names\":[");

        for (index, name) in self.names.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            js::write_string(&mut output, name);
        }

        output.push_str("],\"mappings\":");
        js::write_string(&mut output, &self.mappings);
        output.push('}');
        output
    }
}

/// A string under edit, addressed by offsets into the original text.
#[derive(Clone, Debug)]
pub struct MagicString<'a> {
    /// Chunks keyed by original start. They cover the original text without gaps.
    chunks: BTreeMap<u32, Chunk>,
    /// Name of the source within a [`Bundle`].
    filename: Option<String>,
    /// Content before every chunk.
    intro: String,
    /// The text being edited.
    original: &'a str,
    /// Content after every chunk.
    outro: String,
}

impl<'a> MagicString<'a> {
    /// Starts editing a string.
    pub fn new(original: &'a str) -> Self {
        let mut chunks = BTreeMap::new();

        chunks.insert(
            0,
            Chunk {
                content: None,
                end: length(original),
                intro: String::new(),
                outro: String::new(),
            },
        );

        Self {
            chunks,
            filename: None,
            intro: String::new(),
            original,
            outro: String::new(),
        }
    }

    /// Starts editing a string with a filename, as `new MagicString(text, { filename })` does.
    pub fn with_filename(original: &'a str, filename: &str) -> Self {
        Self {
            filename: Some(filename.to_owned()),
            ..Self::new(original)
        }
    }

    /// The text being edited.
    pub fn original(&self) -> &'a str {
        self.original
    }

    /// Inserts content at an index, after previous appends to the same index. The content stays
    /// with the range ending at the index.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when the index falls inside edited content.
    pub fn append_left(&mut self, index: u32, content: &str) -> Result<&mut Self> {
        self.split(index)?;

        match self
            .by_end(index)
            .and_then(|start| self.chunks.get_mut(&start))
        {
            Some(chunk) => chunk.outro.push_str(content),
            None => self.intro.push_str(content),
        }

        Ok(self)
    }

    /// Inserts content at an index, before previous prepends to the same index. The content stays
    /// with the range starting at the index.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when the index falls inside edited content.
    pub fn prepend_right(&mut self, index: u32, content: &str) -> Result<&mut Self> {
        self.split(index)?;

        match self.chunks.get_mut(&index) {
            Some(chunk) => chunk.intro.insert_str(0, content),
            None => self.outro.insert_str(0, content),
        }

        Ok(self)
    }

    /// Replaces a range and everything inserted inside it.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message for empty, reversed, or out-of-bounds ranges, and for a
    /// boundary inside edited content.
    pub fn overwrite(&mut self, start: u32, end: u32, content: &str) -> Result<&mut Self> {
        self.replace(start, end, content, true)
    }

    /// Replaces a range, keeping content inserted at its first chunk.
    ///
    /// # Errors
    ///
    /// Returns the same errors as [`MagicString::overwrite`].
    pub fn update(&mut self, start: u32, end: u32, content: &str) -> Result<&mut Self> {
        self.replace(start, end, content, false)
    }

    fn replace(
        &mut self,
        start: u32,
        end: u32,
        content: &str,
        overwrite: bool,
    ) -> Result<&mut Self> {
        let length = length(self.original);

        if end > length {
            return Err(fail(&format!(
                "end {} is out of bounds",
                self.position(end)
            )));
        }

        if start == end {
            return Err(fail(&format!(
                "cannot overwrite a zero-length range at {}, use appendLeft() or prependRight()",
                self.position(start)
            )));
        }

        if start > end {
            return Err(fail(&format!(
                "end must be greater than start (start: {}, end: {})",
                self.position(start),
                self.position(end)
            )));
        }

        self.split(start)?;
        self.split(end)?;

        let mut chunks = self.chunks.range_mut(start..end);

        match chunks.next() {
            Some((&first_start, first)) if first_start == start => {
                first.edit(content.to_owned(), !overwrite);
            }
            _ => return Ok(self),
        }

        // Every later chunk of the range loses its content and insertions.
        for (_, chunk) in chunks {
            chunk.edit(String::new(), false);
        }

        Ok(self)
    }

    /// Removes a range and everything inserted inside it. An empty range does nothing.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message for reversed or out-of-bounds ranges, and for a boundary
    /// inside edited content.
    pub fn remove(&mut self, start: u32, end: u32) -> Result<&mut Self> {
        if start == end {
            return Ok(self);
        }

        if end > length(self.original) {
            return Err(fail(&format!(
                "range {}\u{2013}{} is out of bounds",
                self.position(start),
                self.position(end)
            )));
        }

        if start > end {
            return Err(fail(&format!(
                "end must be greater than start (start: {}, end: {})",
                self.position(start),
                self.position(end)
            )));
        }

        self.split(start)?;
        self.split(end)?;

        // Chunks cover the text without gaps, so the range holds the contiguous run from start.
        let mut expected = start;

        for (&position, chunk) in self.chunks.range_mut(start..) {
            if position != expected {
                break;
            }

            chunk.edit(String::new(), false);

            if end <= chunk.end {
                break;
            }

            expected = chunk.end;
        }

        Ok(self)
    }

    /// Returns a copy that keeps only the original range from `start` to `end`.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when a boundary falls inside edited content.
    pub fn snip(&self, start: u32, end: u32) -> Result<Self> {
        let mut clone = self.clone();

        clone.remove(0, start)?;
        clone.remove(end, length(self.original))?;

        Ok(clone)
    }

    /// Returns the generated text for an original range, including insertions inside it.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when a boundary falls inside edited content.
    pub fn slice(&self, start: u32, end: u32) -> Result<String> {
        let mut result = String::new();
        let mut chunks = self.chunks.iter().peekable();

        // Skip to the chunk containing the start.
        while let Some(&(&chunk_start, chunk)) = chunks.peek() {
            if !(chunk_start > start || chunk.end <= start) {
                break;
            }

            if chunk_start < end && chunk.end >= end {
                return Ok(result);
            }

            chunks.next();
        }

        let mut first = true;

        for (&chunk_start, chunk) in chunks {
            if first && chunk.edited() && chunk_start != start {
                return Err(fail(&format!(
                    "cannot use edited character {} as slice start anchor",
                    self.position(start)
                )));
            }

            if !chunk.intro.is_empty() && (!first || chunk_start == start) {
                result.push_str(&chunk.intro);
            }

            let contains_end = chunk_start < end && chunk.end >= end;

            if contains_end && chunk.edited() && chunk.end != end {
                return Err(fail(&format!(
                    "cannot use edited character {} as slice end anchor",
                    self.position(end)
                )));
            }

            let content = self.content(chunk_start, chunk);
            let content_length = length(content);
            let slice_start = if first {
                start.saturating_sub(chunk_start)
            } else {
                0
            };
            let slice_end = if contains_end {
                (content_length + end).saturating_sub(chunk.end)
            } else {
                content_length
            };

            if slice_start < slice_end {
                result.push_str(
                    content
                        .get(slice_start as usize..slice_end as usize)
                        .unwrap_or_default(),
                );
            }

            if !chunk.outro.is_empty() && (!contains_end || chunk.end == end) {
                result.push_str(&chunk.outro);
            }

            if contains_end {
                break;
            }

            first = false;
        }

        Ok(result)
    }

    /// Generates a version 3 source map with UTF-16 columns.
    pub fn generate_map(&self, options: &MapOptions<'_>) -> SourceMap {
        let mut mappings = Mappings::new(options.hires);

        self.write_mappings(&mut mappings, Some(0));

        SourceMap {
            mappings: mappings.encoder.finish(),
            names: Vec::new(),
            // `getRelativePath("", source)` splits on both separators and joins with `/`.
            sources: vec![options.source.map_or_else(String::new, |source| {
                source.split(['/', '\\']).collect::<Vec<_>>().join("/")
            })],
            sources_content: options
                .include_content
                .then(|| vec![Some(self.original.to_owned())]),
        }
    }

    /// Appends the mappings of every chunk. Without a source index, chunks only advance columns.
    fn write_mappings(&self, mappings: &mut Mappings, source: Option<i64>) {
        let locator = Locator::new(self.original);

        mappings.advance(&self.intro);

        for (&start, chunk) in &self.chunks {
            let (line, column) = locator.locate(start);

            mappings.advance(&chunk.intro);

            match (source, &chunk.content) {
                (Some(source), Some(content)) => mappings.add_edit(source, content, line, column),
                (Some(source), None) => mappings.add_unedited(
                    source,
                    self.original
                        .get(start as usize..chunk.end as usize)
                        .unwrap_or_default(),
                    line,
                    column,
                ),
                (None, content) => {
                    mappings.advance(content.as_deref().unwrap_or_else(|| {
                        self.original
                            .get(start as usize..chunk.end as usize)
                            .unwrap_or_default()
                    }));
                }
            }

            mappings.advance(&chunk.outro);
        }

        mappings.advance(&self.outro);
    }

    fn content<'s>(&'s self, start: u32, chunk: &'s Chunk) -> &'s str {
        match &chunk.content {
            Some(content) => content,
            None => self
                .original
                .get(start as usize..chunk.end as usize)
                .unwrap_or_default(),
        }
    }

    /// The start of the chunk ending at an index.
    fn by_end(&self, index: u32) -> Option<u32> {
        if let Some((&start, chunk)) = self.chunks.range(..index).next_back()
            && chunk.end == index
        {
            return Some(start);
        }

        // Only an empty original has a chunk that ends where it starts.
        self.chunks
            .get(&index)
            .filter(|chunk| chunk.end == index)
            .map(|_| index)
    }

    /// Splits the chunk containing an index so that the index becomes a chunk boundary.
    fn split(&mut self, index: u32) -> Result<()> {
        // The chunk starting at or before the index decides: a start or an end at the index is
        // already a boundary.
        let Some((&start, chunk)) = self.chunks.range_mut(..=index).next_back() else {
            return Ok(());
        };

        if start == index || chunk.end <= index {
            return Ok(());
        }

        if chunk
            .content
            .as_ref()
            .is_some_and(|content| !content.is_empty())
        {
            let (line, column) = Locator::new(self.original).locate(index);
            let original = self
                .original
                .get(start as usize..chunk.end as usize)
                .unwrap_or_default();

            return Err(fail(&format!(
                "cannot split a chunk that has already been edited ({line}:{column} \u{2013} \"{original}\")"
            )));
        }

        let edited = chunk.edited();
        let mut next = Chunk {
            content: None,
            end: chunk.end,
            intro: String::new(),
            outro: std::mem::take(&mut chunk.outro),
        };

        chunk.end = index;

        if edited {
            // Splitting removed content also drops the insertions after it, as `magic-string`'s
            // `edit("")` does.
            next.edit(String::new(), false);
            chunk.content = Some(String::new());
        }

        self.chunks.insert(index, next);

        Ok(())
    }

    /// Converts a byte offset to the UTF-16 offset `magic-string` reports.
    fn position(&self, offset: u32) -> u32 {
        let length = length(self.original);
        let index = js::Utf16Index::new(self.original);

        if offset <= length {
            index.utf16(offset)
        } else {
            index.utf16(length) + (offset - length)
        }
    }
}

/// Creates a `MagicStringError`, whose messages carry the `[MagicString]` prefix.
#[cold]
fn fail(message: &str) -> Error {
    Error::Message(format!("[MagicString] {message}"))
}

impl fmt::Display for MagicString<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.intro)?;

        for (&start, chunk) in &self.chunks {
            formatter.write_str(&chunk.intro)?;
            formatter.write_str(self.content(start, chunk))?;
            formatter.write_str(&chunk.outro)?;
        }

        formatter.write_str(&self.outro)
    }
}

/// Concatenates edited strings and maps them back to their sources.
#[derive(Clone, Debug, Default)]
pub struct Bundle<'a> {
    /// Content between sources.
    separator: String,
    /// Sources in order.
    sources: Vec<MagicString<'a>>,
    /// Unique filenames and their original text, in first-seen order.
    unique: Vec<(String, &'a str)>,
}

impl<'a> Bundle<'a> {
    /// Creates a bundle, as `new Bundle({ separator })` does.
    pub fn new(separator: &str) -> Self {
        Self {
            separator: separator.to_owned(),
            ..Self::default()
        }
    }

    /// Adds a source, optionally naming it for the source map.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when a filename was already added with different content.
    pub fn add_source(
        &mut self,
        mut content: MagicString<'a>,
        filename: Option<&str>,
    ) -> Result<&mut Self> {
        if let Some(filename) = filename {
            content.filename = Some(filename.to_owned());
        }

        if let Some(filename) = content
            .filename
            .as_deref()
            .filter(|filename| !filename.is_empty())
        {
            match self.unique.iter().find(|(name, _)| name == filename) {
                Some((_, original)) if *original != content.original => {
                    return Err(Error::Message(format!(
                        "[MagicString] duplicate filename \"{filename}\" with different content, use unique filenames"
                    )));
                }
                Some(_) => {}
                None => self.unique.push((filename.to_owned(), content.original)),
            }
        }

        self.sources.push(content);

        Ok(self)
    }

    /// Generates a version 3 source map with UTF-16 columns over every named source.
    pub fn generate_map(&self, options: &MapOptions<'_>) -> SourceMap {
        let mut mappings = Mappings::new(options.hires);

        for (index, source) in self.sources.iter().enumerate() {
            if index > 0 {
                mappings.advance(&self.separator);
            }

            let source_index = source
                .filename
                .as_deref()
                .filter(|filename| !filename.is_empty())
                .and_then(|filename| self.unique.iter().position(|(name, _)| name == filename))
                .and_then(|index| i64::try_from(index).ok());

            source.write_mappings(&mut mappings, source_index);
        }

        SourceMap {
            mappings: mappings.encoder.finish(),
            names: Vec::new(),
            sources: self.unique.iter().map(|(name, _)| name.clone()).collect(),
            sources_content: Some(
                self.unique
                    .iter()
                    .map(|(_, original)| options.include_content.then(|| (*original).to_owned()))
                    .collect(),
            ),
        }
    }
}

impl fmt::Display for Bundle<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        for (index, source) in self.sources.iter().enumerate() {
            if index > 0 {
                formatter.write_str(&self.separator)?;
            }

            write!(formatter, "{source}")?;
        }

        Ok(())
    }
}

/// Line starts of a text, locating byte offsets as zero-based lines and UTF-16 columns.
struct Locator {
    index: js::Utf16Index,
    lines: Vec<u32>,
}

impl Locator {
    fn new(text: &str) -> Self {
        let mut lines = vec![0];

        lines.extend(
            memchr::memchr_iter(b'\n', text.as_bytes())
                .map(|offset| u32::try_from(offset + 1).unwrap_or(u32::MAX)),
        );

        Self {
            index: js::Utf16Index::new(text),
            lines,
        }
    }

    fn locate(&self, offset: u32) -> (i64, i64) {
        let line = self
            .lines
            .partition_point(|start| *start <= offset)
            .saturating_sub(1);
        let start = self.lines.get(line).copied().unwrap_or(0);

        (
            i64::try_from(line).unwrap_or(i64::MAX),
            i64::from(self.index.utf16(offset)) - i64::from(self.index.utf16(start)),
        )
    }
}

/// Mappings encoded in generated order, as `magic-string`'s `Mappings` class builds them.
struct Mappings {
    column: i64,
    encoder: codec::Encoder,
    hires: bool,
}

impl Mappings {
    fn new(hires: bool) -> Self {
        Self {
            column: 0,
            encoder: codec::Encoder::default(),
            hires,
        }
    }

    fn new_line(&mut self) {
        self.encoder.new_line();
        self.column = 0;
    }

    /// Maps replaced content to the start of its original range, once per generated line.
    fn add_edit(&mut self, source: i64, content: &str, line: i64, column: i64) {
        if content.is_empty() {
            return;
        }

        let last = content.len() - 1;
        let mut previous = None;

        for newline in memchr::memchr_iter(b'\n', content.as_bytes()) {
            if newline >= last {
                break;
            }

            self.encoder
                .push(Segment::mapped(self.column, source, line, column));
            self.new_line();
            previous = Some(newline);
        }

        self.encoder
            .push(Segment::mapped(self.column, source, line, column));
        self.advance(
            content
                .get(previous.map_or(0, |index| index + 1)..)
                .unwrap_or_default(),
        );
    }

    /// Maps original text unit by unit, or only at line starts without `hires`.
    fn add_unedited(&mut self, source: i64, text: &str, mut line: i64, mut column: i64) {
        for (index, text) in text.split('\n').enumerate() {
            if index > 0 {
                line += 1;
                column = 0;
                self.new_line();
            }

            // An astral character is two code units, each with its own segment.
            let units = i64::try_from(js::utf16_len(text)).unwrap_or(i64::MAX);

            if units == 0 {
                continue;
            }

            self.encoder
                .push(Segment::mapped(self.column, source, line, column));

            if self.hires {
                self.encoder.advance(units - 1);
            }

            column += units;
            self.column += units;
        }
    }

    /// Moves the generated position past inserted text.
    fn advance(&mut self, text: &str) {
        if text.is_empty() {
            return;
        }

        let mut lines = text.split('\n');
        let mut last = lines.next().unwrap_or_default();
        let mut multiline = false;

        for line in lines {
            self.encoder.new_line();
            last = line;
            multiline = true;
        }

        if multiline {
            self.column = 0;
        }

        self.column += i64::try_from(js::utf16_len(last)).unwrap_or(i64::MAX);
    }
}

/// A text length as a `u32` byte offset.
fn length(text: &str) -> u32 {
    u32::try_from(text.len()).unwrap_or(u32::MAX)
}
