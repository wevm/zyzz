//! Records edits to a module by original offsets and applies them in one source-order pass,
//! writing the generated text and its high-resolution mappings together.
//!
//! Edits share [`MagicString`]'s semantics. Disjoint replacements and insertions outside them
//! resolve directly. An edit that nests, overlaps, or needs intermediate text replays the record
//! into a [`MagicString`], which then receives every later edit.

use crate::error::Result;
use crate::js;
use crate::mapping::magic_string::{MagicString, MapOptions, Mappings, SourceMap};

/// Text inserted at one original index.
#[derive(Debug)]
struct Insertion {
    /// Inserted text.
    content: String,
    /// Original byte offset.
    index: u32,
    /// Position among all recorded edits.
    order: u32,
    /// Whether the text stays with the range starting at the index, as `prependRight` keeps it.
    right: bool,
}

/// One replaced or removed original range.
#[derive(Debug)]
struct Range {
    /// Replacement text, empty for a removal.
    content: String,
    /// Exclusive original end.
    end: u32,
    /// Position among all recorded edits.
    order: u32,
    /// Whether the range was removed rather than overwritten.
    removed: bool,
    /// Original start.
    start: u32,
}

/// A module under edit.
#[derive(Debug)]
pub struct Edits<'a> {
    /// Insertions in call order.
    insertions: Vec<Insertion>,
    /// The chunk-based editor, once an edit needs it.
    module: Option<MagicString<'a>>,
    /// The text being edited.
    original: &'a str,
    /// Disjoint replaced ranges, sorted by start.
    ranges: Vec<Range>,
}

impl<'a> Edits<'a> {
    /// Starts editing a string.
    pub fn new(original: &'a str) -> Self {
        Self {
            insertions: Vec::new(),
            module: None,
            original,
            ranges: Vec::new(),
        }
    }

    /// Inserts content at an index, after previous appends to the same index. The content stays
    /// with the range ending at the index.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when the index falls inside edited content.
    pub fn append_left(&mut self, index: u32, content: impl Into<String>) -> Result<()> {
        self.insert(index, content.into(), false)
    }

    /// Inserts content at an index, before previous prepends to the same index. The content stays
    /// with the range starting at the index.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when the index falls inside edited content.
    pub fn prepend_right(&mut self, index: u32, content: impl Into<String>) -> Result<()> {
        self.insert(index, content.into(), true)
    }

    /// Replaces a range and everything inserted inside it.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message for empty, reversed, or out-of-bounds ranges, and for a
    /// boundary inside edited content.
    pub fn overwrite(&mut self, start: u32, end: u32, content: impl Into<String>) -> Result<()> {
        let content = content.into();

        if start < end && end <= length(self.original) {
            self.replace(start, end, content, false)
        } else {
            // Invalid ranges fail with the chunk editor's messages.
            self.chunks().overwrite(start, end, &content).map(|_| ())
        }
    }

    /// Removes a range and everything inserted inside it. An empty range does nothing.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message for reversed or out-of-bounds ranges, and for a boundary
    /// inside edited content.
    pub fn remove(&mut self, start: u32, end: u32) -> Result<()> {
        if start == end {
            return Ok(());
        }

        if start < end && end <= length(self.original) {
            self.replace(start, end, String::new(), true)
        } else {
            self.chunks().remove(start, end).map(|_| ())
        }
    }

    /// Returns the generated text for an original range, including insertions inside it.
    ///
    /// # Errors
    ///
    /// Returns `magic-string`'s message when a boundary falls inside edited content.
    pub fn slice(&mut self, start: u32, end: u32) -> Result<String> {
        self.chunks().slice(start, end)
    }

    /// Returns the generated text and its version 3 source map with UTF-16 columns.
    pub fn finish(&self, options: &MapOptions<'_>) -> (String, SourceMap) {
        if let Some(module) = &self.module {
            (module.to_string(), module.generate_map(options))
        } else {
            let (code, mappings) = self.resolve(options.hires);

            (code, SourceMap::new(self.original, mappings, options))
        }
    }

    fn insert(&mut self, index: u32, content: String, right: bool) -> Result<()> {
        if self.module.is_none() && !self.original.is_empty() && index <= length(self.original) {
            // The last range starting before the index is the only one that can contain it.
            let position = self.ranges.partition_point(|range| range.start < index);
            let inside = position
                .checked_sub(1)
                .and_then(|position| self.ranges.get(position))
                .is_some_and(|range| index < range.end);

            if !inside {
                self.insertions.push(Insertion {
                    content,
                    index,
                    order: self.order(),
                    right,
                });

                return Ok(());
            }
        }

        let module = self.chunks();

        if right {
            module.prepend_right(index, &content)?;
        } else {
            module.append_left(index, &content)?;
        }

        Ok(())
    }

    fn replace(&mut self, start: u32, end: u32, content: String, removed: bool) -> Result<()> {
        if self.module.is_none() && !self.original.is_empty() {
            let position = self.ranges.partition_point(|range| range.start < start);
            let before = position
                .checked_sub(1)
                .and_then(|position| self.ranges.get(position))
                .is_some_and(|range| start < range.end);
            let after = self
                .ranges
                .get(position)
                .is_some_and(|range| range.start < end);

            if !before && !after {
                let order = self.order();

                self.ranges.insert(
                    position,
                    Range {
                        content,
                        end,
                        order,
                        removed,
                        start,
                    },
                );

                return Ok(());
            }
        }

        let module = self.chunks();

        if removed {
            module.remove(start, end)?;
        } else {
            module.overwrite(start, end, &content)?;
        }

        Ok(())
    }

    fn order(&self) -> u32 {
        u32::try_from(self.insertions.len() + self.ranges.len()).unwrap_or(u32::MAX)
    }

    /// The chunk editor, created by replaying every recorded edit in call order.
    fn chunks(&mut self) -> &mut MagicString<'a> {
        let original = self.original;
        let insertions = std::mem::take(&mut self.insertions);
        let ranges = std::mem::take(&mut self.ranges);

        self.module.get_or_insert_with(|| {
            let mut module = MagicString::new(original);
            let mut insertions = insertions.into_iter().peekable();
            let mut ranges: Vec<Range> = ranges;

            ranges.sort_by_key(|range| range.order);

            let mut ranges = ranges.into_iter().peekable();

            // Recorded edits are disjoint, so their replay cannot fail.
            loop {
                let insertion = insertions.peek().map(|insertion| insertion.order);
                let range = ranges.peek().map(|range| range.order);

                match (insertion, range) {
                    (Some(insertion), Some(range)) if insertion < range => {
                        replay_insertion(&mut module, insertions.next());
                    }
                    (Some(_), None) => replay_insertion(&mut module, insertions.next()),
                    (_, Some(_)) => {
                        if let Some(range) = ranges.next() {
                            let _ = if range.removed {
                                module.remove(range.start, range.end)
                            } else {
                                module.overwrite(range.start, range.end, &range.content)
                            };
                        }
                    }
                    (None, None) => break,
                }
            }

            module
        })
    }

    /// Writes the generated text and mappings in one pass over the original.
    fn resolve(&self, hires: bool) -> (String, String) {
        let original = self.original;
        let mut insertions: Vec<&Insertion> = self
            .insertions
            .iter()
            .filter(|insertion| !self.wiped(insertion))
            .collect();

        // At one index, appends follow the range ending there in call order, and prepends lead
        // the range starting there, latest first.
        insertions.sort_by_key(|insertion| {
            (
                insertion.index,
                insertion.right,
                if insertion.right {
                    u32::MAX - insertion.order
                } else {
                    insertion.order
                },
            )
        });

        let mut code = String::with_capacity(
            original.len()
                + self
                    .ranges
                    .iter()
                    .map(|range| range.content.len())
                    .sum::<usize>()
                + insertions
                    .iter()
                    .map(|insertion| insertion.content.len())
                    .sum::<usize>(),
        );
        let mut mappings = Mappings::new(hires);
        let mut locator = Locator::new(original);
        let mut cursor = 0;
        let mut insertions = insertions.into_iter().peekable();
        let mut ranges = self.ranges.iter().peekable();

        loop {
            let next_insertion = insertions.peek().map(|insertion| insertion.index);
            let next_range = ranges.peek().map(|range| range.start);

            // Insertions at a range's start precede its content.
            let insertion = match (next_insertion, next_range) {
                (Some(index), Some(start)) => index <= start,
                (Some(_), None) => true,
                (None, Some(_)) => false,
                (None, None) => break,
            };

            if insertion {
                if let Some(insertion) = insertions.next() {
                    locator.unedited(&mut code, &mut mappings, cursor, insertion.index);
                    cursor = cursor.max(insertion.index);
                    code.push_str(&insertion.content);
                    mappings.advance(&insertion.content);
                }
            } else if let Some(range) = ranges.next() {
                locator.unedited(&mut code, &mut mappings, cursor, range.start);

                let (line, column) = locator.locate(range.start);

                code.push_str(&range.content);
                mappings.add_edit(0, &range.content, line, column);
                cursor = range.end;
            }
        }

        locator.unedited(&mut code, &mut mappings, cursor, length(original));

        (code, mappings.finish())
    }

    /// Whether a later replacement cleared an insertion: one inside it, a prepend at its start,
    /// or an append at its end.
    fn wiped(&self, insertion: &Insertion) -> bool {
        let index = insertion.index;
        let position = self.ranges.partition_point(|range| range.start <= index);
        let covering = |range: &Range| {
            range.order > insertion.order
                && ((range.start < index && index < range.end)
                    || (insertion.right && range.start == index)
                    || (!insertion.right && range.end == index))
        };

        // Ranges are disjoint, so only the ranges starting at or just before the index matter.
        position
            .checked_sub(1)
            .and_then(|position| self.ranges.get(position))
            .is_some_and(covering)
            || position
                .checked_sub(2)
                .and_then(|position| self.ranges.get(position))
                .is_some_and(covering)
    }
}

fn replay_insertion(module: &mut MagicString<'_>, insertion: Option<Insertion>) {
    if let Some(insertion) = insertion {
        let _ = if insertion.right {
            module.prepend_right(insertion.index, &insertion.content)
        } else {
            module.append_left(insertion.index, &insertion.content)
        };
    }
}

/// Zero-based lines and UTF-16 columns of offsets visited in increasing order.
struct Locator<'a> {
    index: js::Utf16Index,
    line: usize,
    original: &'a str,
    starts: Vec<u32>,
}

impl<'a> Locator<'a> {
    fn new(original: &'a str) -> Self {
        let mut starts = vec![0];

        starts.extend(
            memchr::memchr_iter(b'\n', original.as_bytes())
                .map(|offset| u32::try_from(offset + 1).unwrap_or(u32::MAX)),
        );

        Self {
            index: js::Utf16Index::new(original),
            line: 0,
            original,
            starts,
        }
    }

    /// Copies an unedited original range and maps it.
    fn unedited(&mut self, code: &mut String, mappings: &mut Mappings, start: u32, end: u32) {
        if start >= end {
            return;
        }

        let text = self
            .original
            .get(start as usize..end as usize)
            .unwrap_or_default();
        let (line, column) = self.locate(start);

        code.push_str(text);
        mappings.add_unedited(0, text, line, column);
    }

    fn locate(&mut self, offset: u32) -> (i64, i64) {
        while self
            .starts
            .get(self.line + 1)
            .is_some_and(|start| *start <= offset)
        {
            self.line += 1;
        }

        let start = self.starts.get(self.line).copied().unwrap_or(0);

        (
            i64::try_from(self.line).unwrap_or(i64::MAX),
            i64::from(self.index.utf16(offset)) - i64::from(self.index.utf16(start)),
        )
    }
}

/// A text length as a `u32` byte offset.
fn length(text: &str) -> u32 {
    u32::try_from(text.len()).unwrap_or(u32::MAX)
}
