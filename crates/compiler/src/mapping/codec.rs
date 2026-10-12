//! Encodes and decodes Source Map v3 `mappings`, mirroring `@jridgewell/sourcemap-codec` 1.6.
//!
//! Values follow the JavaScript arithmetic of the original: decoded integers are 32-bit, sums
//! accumulate as doubles (here `i64`), and encoding truncates each delta to 32 bits before the
//! sign bit is applied. Decoding reads UTF-16 code units, so malformed input decodes as it does in
//! JavaScript.

/// The original position a segment maps to.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Original {
    /// Zero-based source column.
    pub column: i64,
    /// Zero-based source line.
    pub line: i64,
    /// Index into `names`, when the segment names a binding.
    pub name: Option<i64>,
    /// Index into `sources`.
    pub source: i64,
}

/// One mapping segment: a generated column and an optional original position.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Segment {
    /// Zero-based generated column, in UTF-16 code units.
    pub column: i64,
    /// Original position, absent for a sourceless segment.
    pub original: Option<Original>,
}

impl Segment {
    /// Creates a sourceless segment.
    pub const fn generated(column: i64) -> Self {
        Self {
            column,
            original: None,
        }
    }

    /// Creates a segment mapped to a source position.
    pub const fn mapped(column: i64, source: i64, line: i64, original_column: i64) -> Self {
        Self {
            column,
            original: Some(Original {
                column: original_column,
                line,
                name: None,
                source,
            }),
        }
    }
}

/// Decoded mappings: one segment list per generated line.
pub type Mappings = Vec<Vec<Segment>>;

const CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Base64 digit values for code units below 128. Other units decode as zero, as a `Uint8Array`
/// lookup does.
#[expect(
    clippy::cast_possible_truncation,
    reason = "Digit indexes are below 64."
)]
const CHAR_TO_INT: [u8; 128] = {
    let mut table = [0_u8; 128];
    let mut index = 0;

    while index < CHARS.len() {
        table[CHARS[index] as usize] = index as u8;
        index += 1;
    }

    table
};

/// Encodes decoded mappings into a VLQ string.
pub fn encode(mappings: &[Vec<Segment>]) -> String {
    let mut encoder = Encoder::default();

    for (index, line) in mappings.iter().enumerate() {
        if index > 0 {
            encoder.new_line();
        }

        for segment in line {
            encoder.push(*segment);
        }
    }

    encoder.finish()
}

/// Encodes segments as they are produced in generated order, keeping the running deltas
/// [`encode`] keeps, so producers need not buffer every segment.
#[derive(Debug, Default)]
pub struct Encoder {
    column: i64,
    name: i64,
    output: String,
    segments: bool,
    source: i64,
    source_column: i64,
    source_line: i64,
}

impl Encoder {
    /// Starts the next generated line.
    pub fn new_line(&mut self) {
        self.output.push(';');
        self.column = 0;
        self.segments = false;
    }

    /// Appends a segment on the current line.
    pub fn push(&mut self, segment: Segment) {
        if self.segments {
            self.output.push(',');
        }

        self.segments = true;
        write_integer(&mut self.output, segment.column - self.column);
        self.column = segment.column;

        let Some(original) = segment.original else {
            return;
        };

        write_integer(&mut self.output, original.source - self.source);
        write_integer(&mut self.output, original.line - self.source_line);
        write_integer(&mut self.output, original.column - self.source_column);
        self.source = original.source;
        self.source_line = original.line;
        self.source_column = original.column;

        if let Some(index) = original.name {
            write_integer(&mut self.output, index - self.name);
            self.name = index;
        }
    }

    /// Appends `count` segments after a mapped one, each one generated and original column
    /// further along the same lines, as unedited text maps unit by unit.
    pub fn advance(&mut self, count: i64) {
        // Deltas of one column, zero sources, and zero lines encode as `CAAC`, so runs append
        // whole blocks of repeated segments.
        let mut remaining = usize::try_from(count).unwrap_or_default();

        self.output.reserve(remaining * UNIT.len());

        while remaining > 0 {
            let units = remaining.min(RUN.len() / UNIT.len());

            self.output
                .push_str(RUN.get(..units * UNIT.len()).unwrap_or_default());
            remaining -= units;
        }

        self.column += count;
        self.source_column += count;
    }

    /// Returns the encoded mappings.
    pub fn finish(self) -> String {
        self.output
    }
}

/// One segment one column after the previous, on the same source and line.
const UNIT: &str = ",CAAC";

/// Repeated [`UNIT`] segments appended a block at a time.
const RUN: &str = ",CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC";

/// Appends one signed integer as base64 VLQ digits.
fn write_integer(output: &mut String, value: i64) {
    let mut number = encode_sign(value);

    loop {
        let mut digit = number & 31;

        number >>= 5;

        if number > 0 {
            digit |= 32;
        }

        output.push(char::from(
            CHARS.get(digit as usize).copied().unwrap_or(b'A'),
        ));

        if number == 0 {
            break;
        }
    }
}

/// `num < 0 ? -num << 1 | 1 : num << 1` on 32-bit integers, read back as unsigned.
#[expect(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "JavaScript shift operators truncate to 32 bits."
)]
fn encode_sign(value: i64) -> u32 {
    if value < 0 {
        ((value.wrapping_neg() as i32).wrapping_shl(1) | 1) as u32
    } else {
        (value as i32).wrapping_shl(1) as u32
    }
}

/// Decodes a VLQ mappings string. Lines whose columns are out of order are stably sorted.
pub fn decode(mappings: &str) -> Mappings {
    let units: Vec<u16> = mappings.encode_utf16().collect();
    let length = units.len();
    let mut reader = Reader {
        position: 0,
        units: &units,
    };
    let mut decoded = Vec::new();
    let mut source = 0_i64;
    let mut source_line = 0_i64;
    let mut source_column = 0_i64;
    let mut name = 0_i64;

    loop {
        let semicolon = reader.index_of(u16::from(b';'));
        let mut line = Vec::new();
        let mut sorted = true;
        let mut last = 0_i64;
        let mut column = 0_i64;

        while reader.position < semicolon {
            column += i64::from(decode_sign(reader.integer()));

            if column < last {
                sorted = false;
            }

            last = column;

            let segment = if reader.has_more(semicolon) {
                source += i64::from(decode_sign(reader.integer()));
                source_line += i64::from(decode_sign(reader.integer()));
                source_column += i64::from(decode_sign(reader.integer()));

                let named = if reader.has_more(semicolon) {
                    name += i64::from(decode_sign(reader.integer()));
                    Some(name)
                } else {
                    None
                };

                Segment {
                    column,
                    original: Some(Original {
                        column: source_column,
                        line: source_line,
                        name: named,
                        source,
                    }),
                }
            } else {
                Segment::generated(column)
            };

            line.push(segment);
            reader.position += 1;
        }

        if !sorted {
            line.sort_by_key(|segment| segment.column);
        }

        decoded.push(line);
        reader.position = semicolon + 1;

        if reader.position > length {
            break;
        }
    }

    decoded
}

struct Reader<'a> {
    position: usize,
    units: &'a [u16],
}

impl Reader<'_> {
    /// `charCodeAt(pos++)` mapped through the digit table. Past the end, JavaScript reads `NaN`,
    /// which decodes as zero.
    fn next(&mut self) -> u8 {
        let unit = self.units.get(self.position).copied();

        self.position += 1;

        match unit {
            Some(unit) if unit < 128 => CHAR_TO_INT.get(usize::from(unit)).copied().unwrap_or(0),
            _ => 0,
        }
    }

    fn integer(&mut self) -> i32 {
        let mut value = 0_i32;
        let mut shift = 0_u32;

        loop {
            let digit = self.next();

            value |= i32::from(digit & 31).wrapping_shl(shift);
            shift += 5;

            if digit & 32 == 0 {
                return value;
            }
        }
    }

    fn has_more(&self, max: usize) -> bool {
        if self.position >= max {
            return false;
        }

        self.units.get(self.position) != Some(&u16::from(b','))
    }

    fn index_of(&self, unit: u16) -> usize {
        self.units
            .get(self.position..)
            .and_then(|rest| rest.iter().position(|candidate| *candidate == unit))
            .map_or(self.units.len(), |index| self.position + index)
    }
}

/// `num & 1 ? -2147483648 | -(num >>> 1) : num >>> 1`.
#[expect(
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "JavaScript reinterprets 32-bit integers between signed and unsigned."
)]
fn decode_sign(value: i32) -> i32 {
    let shifted = ((value as u32) >> 1) as i32;

    if value & 1 == 0 {
        shifted
    } else {
        i32::MIN | shifted.wrapping_neg()
    }
}
