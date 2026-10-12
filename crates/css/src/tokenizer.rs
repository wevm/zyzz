//! Byte-oriented CSS tokenizer following css-tree's `tokenize` and `TokenStream`.
//!
//! The tokenizer implements CSS Syntax Level 3 with css-tree's deviations: comments are tokens,
//! every code point at or above U+0080 starts a name, and a leading byte order mark is skipped.
//! Offsets are UTF-8 byte offsets into the source. css-tree reports UTF-16 offsets into a
//! JavaScript string, and both describe the same token boundaries because every byte or code
//! unit at or above 0x80 is a name code point and every delimiter is ASCII.

use memchr::memmem;

/// A CSS token type. Discriminants match css-tree's `tokenTypes` numbers, so declaration order
/// is observable and follows the specification instead of the alphabet.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
#[repr(u8)]
pub enum TokenType {
    /// `<EOF-token>`, which [`tokenize`] never yields.
    Eof = 0,
    /// `<ident-token>`.
    Ident = 1,
    /// `<function-token>`, including the opening parenthesis.
    Function = 2,
    /// `<at-keyword-token>`.
    AtKeyword = 3,
    /// `<hash-token>`.
    Hash = 4,
    /// `<string-token>`, including its quotes.
    String = 5,
    /// `<bad-string-token>`.
    BadString = 6,
    /// `<url-token>`, an unquoted `url(...)`.
    Url = 7,
    /// `<bad-url-token>`.
    BadUrl = 8,
    /// `<delim-token>`, always one ASCII byte.
    Delim = 9,
    /// `<number-token>`.
    Number = 10,
    /// `<percentage-token>`.
    Percentage = 11,
    /// `<dimension-token>`.
    Dimension = 12,
    /// `<whitespace-token>`.
    WhiteSpace = 13,
    /// `<CDO-token>` (`<!--`).
    Cdo = 14,
    /// `<CDC-token>` (`-->`).
    Cdc = 15,
    /// `<colon-token>`.
    Colon = 16,
    /// `<semicolon-token>`.
    Semicolon = 17,
    /// `<comma-token>`.
    Comma = 18,
    /// `<[-token>`.
    LeftSquareBracket = 19,
    /// `<]-token>`.
    RightSquareBracket = 20,
    /// `<(-token>`.
    LeftParenthesis = 21,
    /// `<)-token>`.
    RightParenthesis = 22,
    /// `<{-token>`.
    LeftCurlyBracket = 23,
    /// `<}-token>`.
    RightCurlyBracket = 24,
    /// A comment, which css-tree keeps as a token.
    Comment = 25,
}

impl TokenType {
    /// Returns css-tree's `tokenNames` entry, such as `ident-token`.
    pub const fn name(self) -> &'static str {
        match self {
            Self::Eof => "EOF-token",
            Self::Ident => "ident-token",
            Self::Function => "function-token",
            Self::AtKeyword => "at-keyword-token",
            Self::Hash => "hash-token",
            Self::String => "string-token",
            Self::BadString => "bad-string-token",
            Self::Url => "url-token",
            Self::BadUrl => "bad-url-token",
            Self::Delim => "delim-token",
            Self::Number => "number-token",
            Self::Percentage => "percentage-token",
            Self::Dimension => "dimension-token",
            Self::WhiteSpace => "whitespace-token",
            Self::Cdo => "CDO-token",
            Self::Cdc => "CDC-token",
            Self::Colon => "colon-token",
            Self::Semicolon => "semicolon-token",
            Self::Comma => "comma-token",
            Self::LeftSquareBracket => "[-token",
            Self::RightSquareBracket => "]-token",
            Self::LeftParenthesis => "(-token",
            Self::RightParenthesis => ")-token",
            Self::LeftCurlyBracket => "{-token",
            Self::RightCurlyBracket => "}-token",
            Self::Comment => "comment-token",
        }
    }

    /// Returns the css-tree token type for a `tokenTypes` number.
    pub const fn from_u8(value: u8) -> Option<Self> {
        Some(match value {
            0 => Self::Eof,
            1 => Self::Ident,
            2 => Self::Function,
            3 => Self::AtKeyword,
            4 => Self::Hash,
            5 => Self::String,
            6 => Self::BadString,
            7 => Self::Url,
            8 => Self::BadUrl,
            9 => Self::Delim,
            10 => Self::Number,
            11 => Self::Percentage,
            12 => Self::Dimension,
            13 => Self::WhiteSpace,
            14 => Self::Cdo,
            15 => Self::Cdc,
            16 => Self::Colon,
            17 => Self::Semicolon,
            18 => Self::Comma,
            19 => Self::LeftSquareBracket,
            20 => Self::RightSquareBracket,
            21 => Self::LeftParenthesis,
            22 => Self::RightParenthesis,
            23 => Self::LeftCurlyBracket,
            24 => Self::RightCurlyBracket,
            25 => Self::Comment,
            _ => return None,
        })
    }

    /// Reports whether the token opens a block that a matching closer balances.
    pub const fn is_block_opener(self) -> bool {
        matches!(
            self,
            Self::Function
                | Self::LeftParenthesis
                | Self::LeftSquareBracket
                | Self::LeftCurlyBracket
        )
    }

    /// Reports whether the token closes a block.
    pub const fn is_block_closer(self) -> bool {
        matches!(
            self,
            Self::RightParenthesis | Self::RightSquareBracket | Self::RightCurlyBracket
        )
    }

    /// Returns the closing token that balances an opener.
    pub(crate) const fn balance_pair(self) -> Option<Self> {
        match self {
            Self::Function | Self::LeftParenthesis => Some(Self::RightParenthesis),
            Self::LeftSquareBracket => Some(Self::RightSquareBracket),
            Self::LeftCurlyBracket => Some(Self::RightCurlyBracket),
            _ => None,
        }
    }
}

/// One token with UTF-8 byte offsets into the tokenized source.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Token {
    /// Exclusive end offset.
    pub end: u32,
    /// Token type.
    pub kind: TokenType,
    /// Inclusive start offset.
    pub start: u32,
}

/// Byte category of a whitespace code point.
const WHITE_SPACE_CATEGORY: u8 = 0x82;
/// Byte category of a digit.
const DIGIT_CATEGORY: u8 = 0x83;
/// Byte category of a name-start code point, including every non-ASCII byte.
const NAME_START_CATEGORY: u8 = 0x84;
/// Byte category of a non-printable code point.
const NON_PRINTABLE_CATEGORY: u8 = 0x85;

/// css-tree's `charCodeCategory` over bytes. Other ASCII bytes map to themselves.
const CATEGORY: [u8; 256] = {
    let mut table = [NAME_START_CATEGORY; 256];
    let mut index = 0;

    while index < 0x80 {
        #[expect(
            clippy::cast_possible_truncation,
            reason = "The loop bound keeps the index below 0x80."
        )]
        let byte = index as u8;

        table[index] = if is_white_space(byte) {
            WHITE_SPACE_CATEGORY
        } else if is_digit(byte) {
            DIGIT_CATEGORY
        } else if is_name_start(byte) {
            NAME_START_CATEGORY
        } else if is_non_printable(byte) {
            NON_PRINTABLE_CATEGORY
        } else {
            byte
        };
        index += 1;
    }

    table
};

/// Reports whether a byte is an ASCII digit.
pub(crate) const fn is_digit(code: u8) -> bool {
    code.is_ascii_digit()
}

/// Reports whether a byte is an ASCII hex digit.
pub(crate) const fn is_hex_digit(code: u8) -> bool {
    code.is_ascii_hexdigit()
}

/// Reports whether a byte is a name-start code point: a letter, `_`, or any non-ASCII byte.
pub(crate) const fn is_name_start(code: u8) -> bool {
    code.is_ascii_alphabetic() || code >= 0x80 || code == b'_'
}

/// Reports whether a byte is a name code point.
pub(crate) const fn is_name(code: u8) -> bool {
    is_name_start(code) || is_digit(code) || code == b'-'
}

/// Reports whether a byte is a non-printable code point.
pub(crate) const fn is_non_printable(code: u8) -> bool {
    code <= 0x08 || code == 0x0B || (code >= 0x0E && code <= 0x1F) || code == 0x7F
}

/// Reports whether a byte is a newline, counting `\r` and `\f` because css-tree does not
/// preprocess the input.
pub(crate) const fn is_newline(code: u8) -> bool {
    code == b'\n' || code == b'\r' || code == 0x0C
}

/// Reports whether a byte is whitespace.
pub(crate) const fn is_white_space(code: u8) -> bool {
    is_newline(code) || code == b' ' || code == b'\t'
}

/// Checks whether two code points are a valid escape. A zero byte stands for EOF.
pub(crate) const fn is_valid_escape(first: u8, second: u8) -> bool {
    first == b'\\' && !is_newline(second) && second != 0
}

/// Checks whether three code points would start an identifier.
pub(crate) const fn is_identifier_start(first: u8, second: u8, third: u8) -> bool {
    if first == b'-' {
        return is_name_start(second) || second == b'-' || is_valid_escape(second, third);
    }

    if is_name_start(first) {
        return true;
    }

    if first == b'\\' {
        return is_valid_escape(first, second);
    }

    false
}

/// Checks whether three code points would start a number. Returns the number of code points
/// css-tree inspected, or zero.
pub(crate) const fn is_number_start(first: u8, second: u8, third: u8) -> u8 {
    if first == b'+' || first == b'-' {
        if is_digit(second) {
            return 2;
        }

        return if second == b'.' && is_digit(third) {
            3
        } else {
            0
        };
    }

    if first == b'.' {
        return if is_digit(second) { 2 } else { 0 };
    }

    if is_digit(first) { 1 } else { 0 }
}

/// Reads a byte, returning zero past the end like css-tree's `getCharCode`.
#[inline]
pub(crate) fn byte_at(bytes: &[u8], offset: usize) -> u8 {
    bytes.get(offset).copied().unwrap_or(0)
}

/// Returns the length of a newline sequence, two for `\r\n`.
pub(crate) fn newline_length(bytes: &[u8], offset: usize, code: u8) -> usize {
    if code == b'\r' && byte_at(bytes, offset + 1) == b'\n' {
        2
    } else {
        1
    }
}

/// Compares a byte with an ASCII-lowercase reference, folding `A-Z`.
pub(crate) fn cmp_char(bytes: &[u8], offset: usize, reference: u8) -> bool {
    byte_at(bytes, offset).to_ascii_lowercase() == reference && offset < bytes.len()
}

/// Compares a source range with a lowercase reference, folding `A-Z` like css-tree's `cmpStr`.
pub(crate) fn cmp_str(bytes: &[u8], start: usize, end: usize, reference: &str) -> bool {
    let Some(slice) = bytes.get(start..end) else {
        return false;
    };

    slice.len() == reference.len()
        && slice
            .iter()
            .zip(reference.as_bytes())
            .all(|(test, reference)| test.to_ascii_lowercase() == *reference)
}

/// Returns the offset after the whitespace run that starts at `offset`.
pub(crate) fn find_white_space_end(bytes: &[u8], mut offset: usize) -> usize {
    while offset < bytes.len() && is_white_space(byte_at(bytes, offset)) {
        offset += 1;
    }

    offset
}

/// Returns the start of the whitespace run that ends at `offset`, scanning backwards.
pub(crate) fn find_white_space_start(bytes: &[u8], offset: Option<usize>) -> usize {
    let Some(mut offset) = offset else {
        return 0;
    };

    loop {
        if !is_white_space(byte_at(bytes, offset)) {
            return offset + 1;
        }

        let Some(previous) = offset.checked_sub(1) else {
            return 0;
        };

        offset = previous;
    }
}

/// Returns the offset after a run of decimal digits.
pub(crate) fn find_decimal_number_end(bytes: &[u8], mut offset: usize) -> usize {
    while offset < bytes.len() && is_digit(byte_at(bytes, offset)) {
        offset += 1;
    }

    offset
}

/// Consumes an escaped code point whose reverse solidus starts at `offset`.
pub(crate) fn consume_escaped(bytes: &[u8], offset: usize) -> usize {
    let mut offset = offset + 2;

    if is_hex_digit(byte_at(bytes, offset - 1)) {
        let max = bytes.len().min(offset + 5);

        while offset < max && is_hex_digit(byte_at(bytes, offset)) {
            offset += 1;
        }

        let code = byte_at(bytes, offset);

        if is_white_space(code) {
            offset += newline_length(bytes, offset, code);
        }
    }

    offset
}

/// Consumes a name, including escapes.
pub(crate) fn consume_name(bytes: &[u8], mut offset: usize) -> usize {
    while offset < bytes.len() {
        let code = byte_at(bytes, offset);

        if is_name(code) {
            offset += 1;
            continue;
        }

        if is_valid_escape(code, byte_at(bytes, offset + 1)) {
            offset = consume_escaped(bytes, offset);
            continue;
        }

        break;
    }

    offset
}

/// Consumes a number, returning the offset after its representation.
pub(crate) fn consume_number(bytes: &[u8], mut offset: usize) -> usize {
    let mut code = byte_at(bytes, offset);

    if code == b'+' || code == b'-' {
        offset += 1;
        code = byte_at(bytes, offset);
    }

    if is_digit(code) {
        offset = find_decimal_number_end(bytes, offset + 1);
        code = byte_at(bytes, offset);
    }

    if code == b'.' && is_digit(byte_at(bytes, offset + 1)) {
        offset = find_decimal_number_end(bytes, offset + 2);
    }

    if cmp_char(bytes, offset, b'e') {
        let mut sign = 0;
        code = byte_at(bytes, offset + 1);

        if code == b'-' || code == b'+' {
            sign = 1;
            code = byte_at(bytes, offset + 2);
        }

        if is_digit(code) {
            offset = find_decimal_number_end(bytes, offset + 1 + sign + 1);
        }
    }

    offset
}

/// Consumes the remnants of a bad url.
///
/// css-tree advances one past an escape that ends the input, reporting an end offset past the
/// source that every JavaScript slice clamps. This scan clamps it directly.
pub(crate) fn consume_bad_url_remnants(bytes: &[u8], mut offset: usize) -> usize {
    while offset < bytes.len() {
        let code = byte_at(bytes, offset);

        if code == b')' {
            return offset + 1;
        }

        if is_valid_escape(code, byte_at(bytes, offset + 1)) {
            offset = consume_escaped(bytes, offset);
        }

        offset += 1;
    }

    offset.min(bytes.len())
}

/// Returns the byte length of a leading U+FEFF or U+FFFE, which css-tree skips.
pub(crate) fn bom_length(bytes: &[u8]) -> usize {
    match bytes {
        [0xEF, 0xBB, 0xBF, ..] | [0xEF, 0xBF, 0xBE, ..] => 3,
        _ => 0,
    }
}

/// Tokenizes CSS source into a lazy token iterator.
///
/// The iterator never yields `Eof`. Offsets are UTF-8 byte offsets that always fall on character
/// boundaries.
pub fn tokenize(source: &str) -> Tokens<'_> {
    let bytes = source.as_bytes();

    Tokens {
        bytes,
        offset: bom_length(bytes),
    }
}

/// Iterator over the tokens of a source string, created by [`tokenize`].
#[derive(Clone, Debug)]
pub struct Tokens<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl Iterator for Tokens<'_> {
    type Item = Token;

    fn next(&mut self) -> Option<Token> {
        if self.offset >= self.bytes.len() {
            return None;
        }

        let start = self.offset;
        let (kind, end) = next_token(self.bytes, start);

        self.offset = end;

        Some(Token {
            end: offset_u32(end),
            kind,
            start: offset_u32(start),
        })
    }
}

/// Converts a byte offset to the `u32` stored in tokens and nodes.
#[inline]
pub(crate) fn offset_u32(offset: usize) -> u32 {
    u32::try_from(offset).unwrap_or(u32::MAX)
}

/// Consumes one token starting at `offset` and returns its type and end offset.
pub(crate) fn next_token(bytes: &[u8], offset: usize) -> (TokenType, usize) {
    let code = byte_at(bytes, offset);
    let next = byte_at(bytes, offset + 1);

    match CATEGORY[usize::from(code)] {
        WHITE_SPACE_CATEGORY => (
            TokenType::WhiteSpace,
            find_white_space_end(bytes, offset + 1),
        ),
        b'"' | b'\'' => consume_string_token(bytes, offset + 1, code),
        b'#' => {
            if is_name(next) || is_valid_escape(next, byte_at(bytes, offset + 2)) {
                (TokenType::Hash, consume_name(bytes, offset + 1))
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b'(' => (TokenType::LeftParenthesis, offset + 1),
        b')' => (TokenType::RightParenthesis, offset + 1),
        b'+' | b'.' => {
            if is_number_start(code, next, byte_at(bytes, offset + 2)) != 0 {
                consume_numeric_token(bytes, offset)
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b',' => (TokenType::Comma, offset + 1),
        b'-' => {
            let third = byte_at(bytes, offset + 2);

            if is_number_start(code, next, third) != 0 {
                consume_numeric_token(bytes, offset)
            } else if next == b'-' && third == b'>' {
                (TokenType::Cdc, offset + 3)
            } else if is_identifier_start(code, next, third) {
                consume_ident_like_token(bytes, offset)
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b'/' => {
            if next == b'*' {
                let end = bytes
                    .get(offset + 2..)
                    .and_then(|rest| memmem::find(rest, b"*/"))
                    .map_or(bytes.len(), |found| offset + 2 + found + 2);

                (TokenType::Comment, end)
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b':' => (TokenType::Colon, offset + 1),
        b';' => (TokenType::Semicolon, offset + 1),
        b'<' => {
            if next == b'!'
                && byte_at(bytes, offset + 2) == b'-'
                && byte_at(bytes, offset + 3) == b'-'
            {
                (TokenType::Cdo, offset + 4)
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b'@' => {
            if is_identifier_start(next, byte_at(bytes, offset + 2), byte_at(bytes, offset + 3)) {
                (TokenType::AtKeyword, consume_name(bytes, offset + 1))
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b'[' => (TokenType::LeftSquareBracket, offset + 1),
        b'\\' => {
            if is_valid_escape(code, next) {
                consume_ident_like_token(bytes, offset)
            } else {
                (TokenType::Delim, offset + 1)
            }
        }
        b']' => (TokenType::RightSquareBracket, offset + 1),
        b'{' => (TokenType::LeftCurlyBracket, offset + 1),
        b'}' => (TokenType::RightCurlyBracket, offset + 1),
        DIGIT_CATEGORY => consume_numeric_token(bytes, offset),
        NAME_START_CATEGORY => consume_ident_like_token(bytes, offset),
        _ => (TokenType::Delim, offset + 1),
    }
}

/// Consumes a numeric token.
fn consume_numeric_token(bytes: &[u8], offset: usize) -> (TokenType, usize) {
    let offset = consume_number(bytes, offset);

    if is_identifier_start(
        byte_at(bytes, offset),
        byte_at(bytes, offset + 1),
        byte_at(bytes, offset + 2),
    ) {
        return (TokenType::Dimension, consume_name(bytes, offset));
    }

    if byte_at(bytes, offset) == b'%' {
        return (TokenType::Percentage, offset + 1);
    }

    (TokenType::Number, offset)
}

/// Consumes an ident-like token: an identifier, function, or url.
fn consume_ident_like_token(bytes: &[u8], start: usize) -> (TokenType, usize) {
    let offset = consume_name(bytes, start);

    if cmp_str(bytes, start, offset, "url") && byte_at(bytes, offset) == b'(' {
        let offset = find_white_space_end(bytes, offset + 1);
        let code = byte_at(bytes, offset);

        if code == b'"' || code == b'\'' {
            return (TokenType::Function, start + 4);
        }

        return consume_url_token(bytes, offset);
    }

    if byte_at(bytes, offset) == b'(' {
        return (TokenType::Function, offset + 1);
    }

    (TokenType::Ident, offset)
}

/// Consumes a string token after its opening quote.
fn consume_string_token(bytes: &[u8], mut offset: usize, ending: u8) -> (TokenType, usize) {
    while offset < bytes.len() {
        let code = byte_at(bytes, offset);

        if code == ending {
            return (TokenType::String, offset + 1);
        }

        if is_newline(code) {
            return (
                TokenType::BadString,
                offset + newline_length(bytes, offset, code),
            );
        }

        if code == b'\\' && offset != bytes.len() - 1 {
            let next = byte_at(bytes, offset + 1);

            if is_newline(next) {
                offset += newline_length(bytes, offset + 1, next);
            } else if is_valid_escape(code, next) {
                offset = consume_escaped(bytes, offset) - 1;
            }
        }

        offset += 1;
    }

    (TokenType::String, offset)
}

/// Consumes an unquoted url token after `url(` and any whitespace.
fn consume_url_token(bytes: &[u8], mut offset: usize) -> (TokenType, usize) {
    offset = find_white_space_end(bytes, offset);

    while offset < bytes.len() {
        let code = byte_at(bytes, offset);

        match CATEGORY[usize::from(code)] {
            b')' => return (TokenType::Url, offset + 1),
            WHITE_SPACE_CATEGORY => {
                offset = find_white_space_end(bytes, offset);

                if byte_at(bytes, offset) == b')' || offset >= bytes.len() {
                    if offset < bytes.len() {
                        offset += 1;
                    }

                    return (TokenType::Url, offset);
                }

                return (TokenType::BadUrl, consume_bad_url_remnants(bytes, offset));
            }
            b'"' | b'\'' | b'(' | NON_PRINTABLE_CATEGORY => {
                return (TokenType::BadUrl, consume_bad_url_remnants(bytes, offset));
            }
            b'\\' => {
                if is_valid_escape(code, byte_at(bytes, offset + 1)) {
                    offset = consume_escaped(bytes, offset) - 1;
                } else {
                    return (TokenType::BadUrl, consume_bad_url_remnants(bytes, offset));
                }
            }
            _ => {}
        }

        offset += 1;
    }

    (TokenType::Url, offset)
}

/// Token storage with css-tree's balance table, used by the parser.
///
/// Index `count` holds a synthetic EOF token whose end is the source length.
pub(crate) struct TokenStream<'a> {
    /// For each token, the index of the token that balances it, following css-tree's
    /// `TokenStream` algorithm.
    balance: Vec<u32>,
    pub(crate) bytes: &'a [u8],
    /// Number of real tokens.
    pub(crate) count: usize,
    /// Token end offsets.
    ends: Vec<u32>,
    pub(crate) eof: bool,
    /// Offset of the first token, after any byte order mark.
    pub(crate) first_char_offset: usize,
    pub(crate) source: &'a str,
    /// Current token end offset.
    pub(crate) token_end: usize,
    /// Current token index, or `count` at the end.
    pub(crate) token_index: usize,
    /// Current token start offset.
    pub(crate) token_start: usize,
    /// Current token type.
    pub(crate) token_type: TokenType,
    types: Vec<TokenType>,
}

impl<'a> TokenStream<'a> {
    /// Tokenizes a source and computes balance pairs.
    pub(crate) fn new(source: &'a str) -> Self {
        let bytes = source.as_bytes();
        let estimate = bytes.len() / 3 + 2;
        let mut types = Vec::with_capacity(estimate);
        let mut ends = Vec::with_capacity(estimate);
        let mut balance: Vec<u32> = Vec::with_capacity(estimate);
        let mut first_char_offset = None;
        // css-tree starts the balance stack at the source length, a sentinel index past every
        // token. Its type buffer is reused across parses, so the type read for that sentinel
        // is stale data. A fresh buffer reads EOF, which closes nothing.
        let sentinel = offset_u32(bytes.len());
        let mut balance_close: Option<TokenType> = None;
        let mut balance_start = sentinel;

        for token in tokenize(source) {
            let index = offset_u32(types.len());

            types.push(token.kind);
            ends.push(token.end);
            first_char_offset.get_or_insert(token.start as usize);
            balance.push(balance_start);

            if Some(token.kind) == balance_close {
                let previous = balance.get(balance_start as usize).copied().unwrap_or(0);

                if let Some(slot) = balance.get_mut(balance_start as usize) {
                    *slot = index;
                }

                balance_start = previous;
                balance_close = types
                    .get(previous as usize)
                    .and_then(|kind| kind.balance_pair());

                if previous == sentinel {
                    balance_close = None;
                }
            } else if token.kind.is_block_opener() {
                balance_start = index;
                balance_close = token.kind.balance_pair();
            }
        }

        let count = types.len();
        let count_u32 = offset_u32(count);

        types.push(TokenType::Eof);
        ends.push(sentinel);
        balance.push(count_u32);

        for index in 0..count {
            let Some(&start) = balance.get(index) else {
                break;
            };

            if start as usize <= index {
                let end = balance.get(start as usize).copied().unwrap_or(count_u32);

                if end as usize != index
                    && let Some(slot) = balance.get_mut(index)
                {
                    *slot = end;
                }
            } else if start > count_u32
                && let Some(slot) = balance.get_mut(index)
            {
                *slot = count_u32;
            }
        }

        let mut stream = Self {
            balance,
            bytes,
            count,
            ends,
            eof: false,
            first_char_offset: first_char_offset.unwrap_or(0),
            source,
            token_end: 0,
            token_index: 0,
            token_start: 0,
            token_type: TokenType::Eof,
            types,
        };

        stream.token_start = stream.first_char_offset;
        stream.token_end = stream.first_char_offset;
        stream.set_index(0);
        stream
    }

    /// Positions the stream on a token index, like css-tree's `reset` followed by `next`.
    fn set_index(&mut self, index: usize) {
        if index < self.count {
            self.token_index = index;
            self.token_start = self.token_end;
            self.token_type = self.type_at(index);
            self.token_end = self.end_at(index);
        } else {
            self.move_to_eof();
        }
    }

    fn move_to_eof(&mut self) {
        self.eof = true;
        self.token_index = self.count;
        self.token_type = TokenType::Eof;
        self.token_start = self.bytes.len();
        self.token_end = self.bytes.len();
    }

    /// Returns the type stored at an index, EOF past the table.
    #[inline]
    pub(crate) fn type_at(&self, index: usize) -> TokenType {
        self.types.get(index).copied().unwrap_or(TokenType::Eof)
    }

    /// Returns the end offset stored at an index.
    #[inline]
    pub(crate) fn end_at(&self, index: usize) -> usize {
        self.ends
            .get(index)
            .map_or(self.bytes.len(), |end| *end as usize)
    }

    /// Returns the start offset of the token at an absolute index. css-tree reads the end of
    /// the previous slot, which is zero for index zero.
    #[inline]
    fn start_at(&self, index: usize) -> usize {
        index
            .checked_sub(1)
            .map_or(0, |previous| self.end_at(previous))
    }

    /// Returns the balance entry of a token.
    #[inline]
    pub(crate) fn balance_at(&self, index: usize) -> usize {
        self.balance
            .get(index)
            .map_or(self.count, |value| *value as usize)
    }

    /// Advances to the next token.
    pub(crate) fn next(&mut self) {
        let next = self.token_index + 1;

        if next < self.count {
            self.token_index = next;
            self.token_start = self.token_end;
            self.token_type = self.type_at(next);
            self.token_end = self.end_at(next);
        } else {
            self.move_to_eof();
        }
    }

    /// Moves by a relative token count, which may be negative.
    ///
    /// Like css-tree, moving back from the end keeps `eof` set, so parsing resumed by a fallback
    /// after reaching the end stops at its next end-of-input check.
    pub(crate) fn skip(&mut self, count: isize) {
        let next = self.token_index.checked_add_signed(count).unwrap_or(0);

        if next < self.count {
            self.token_index = next;
            self.token_start = self.start_at(next);
            self.token_type = self.type_at(next);
            self.token_end = self.end_at(next);
        } else {
            self.token_index = self.count;
            self.next();
        }
    }

    /// Moves to an absolute token index.
    pub(crate) fn skip_to(&mut self, index: usize) {
        let delta = isize::try_from(index).unwrap_or(isize::MAX)
            - isize::try_from(self.token_index).unwrap_or(isize::MAX);

        self.skip(delta);
    }

    /// Skips whitespace and comment tokens.
    pub(crate) fn skip_sc(&mut self) {
        while matches!(self.token_type, TokenType::WhiteSpace | TokenType::Comment) {
            self.next();
        }
    }

    /// Returns the absolute index for a relative offset, or `None` when it falls before zero.
    #[inline]
    fn relative(&self, offset: isize) -> Option<usize> {
        self.token_index.checked_add_signed(offset)
    }

    /// Returns the type of the token at a relative offset.
    pub(crate) fn lookup_type(&self, offset: isize) -> TokenType {
        match self.relative(offset) {
            Some(index) if index < self.count => self.type_at(index),
            _ => TokenType::Eof,
        }
    }

    /// Returns the type of the `index`th following token that is not whitespace or a comment.
    pub(crate) fn lookup_type_non_sc(&self, mut index: usize) -> TokenType {
        for offset in self.token_index..self.count {
            let kind = self.type_at(offset);

            if kind != TokenType::WhiteSpace && kind != TokenType::Comment {
                if index == 0 {
                    return kind;
                }

                index -= 1;
            }
        }

        TokenType::Eof
    }

    /// Returns the relative offset of the `index`th following non-whitespace token, or zero.
    pub(crate) fn lookup_offset_non_sc(&self, mut index: usize) -> isize {
        for offset in self.token_index..self.count {
            let kind = self.type_at(offset);

            if kind != TokenType::WhiteSpace && kind != TokenType::Comment {
                if index == 0 {
                    return isize::try_from(offset - self.token_index).unwrap_or(0);
                }

                index -= 1;
            }
        }

        0
    }

    /// Returns the start offset of the token at a relative offset.
    pub(crate) fn lookup_offset(&self, offset: isize) -> usize {
        match self.relative(offset) {
            Some(index) if index < self.count => self.start_at(index),
            Some(_) => self.bytes.len(),
            None => 0,
        }
    }

    /// Compares the token at a relative offset with a lowercase reference.
    pub(crate) fn lookup_value(&self, offset: isize, reference: &str) -> bool {
        match self.relative(offset) {
            Some(index) if index < self.count => cmp_str(
                self.bytes,
                self.start_at(index),
                self.end_at(index),
                reference,
            ),
            _ => false,
        }
    }

    /// Returns the start offset of a token by absolute index.
    pub(crate) fn get_token_start(&self, index: usize) -> usize {
        if index == self.token_index {
            return self.token_start;
        }

        if index > 0 {
            return if index < self.count {
                self.end_at(index - 1)
            } else {
                self.end_at(self.count)
            };
        }

        self.first_char_offset
    }

    /// Reports whether the current token balances a block opened before `index`.
    pub(crate) fn is_balance_edge(&self, index: usize) -> bool {
        self.balance_at(self.token_index) < index
    }

    /// Reports whether the current or a relative token is a delimiter with the given byte.
    pub(crate) fn is_delim(&self, code: u8, offset: isize) -> bool {
        if offset != 0 {
            return self.lookup_type(offset) == TokenType::Delim
                && byte_at(self.bytes, self.lookup_offset(offset)) == code;
        }

        self.token_type == TokenType::Delim && byte_at(self.bytes, self.token_start) == code
    }

    /// Skips tokens until `stop` requests a stop, jumping over balanced blocks. `stop` returns
    /// 1 to stop before the token and 2 to stop after it.
    pub(crate) fn skip_until_balanced(&mut self, start: usize, stop: fn(u8) -> u8) {
        let mut cursor = start;

        while cursor < self.count {
            let balance_end = self.balance_at(cursor);

            if balance_end < start {
                break;
            }

            let offset = if cursor > 0 {
                self.end_at(cursor - 1)
            } else {
                self.first_char_offset
            };

            match stop(byte_at(self.bytes, offset)) {
                1 => break,
                2 => {
                    cursor += 1;
                    break;
                }
                _ => {
                    if self.type_at(cursor).is_block_opener() {
                        cursor = balance_end;
                    }
                }
            }

            cursor += 1;
        }

        self.skip_to(cursor);
    }
}
