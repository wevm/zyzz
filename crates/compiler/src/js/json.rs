//! Reproduces the `SyntaxError` messages V8's `JSON.parse` reports.
//!
//! Hosts surface these messages for malformed library contracts and source maps. The scanner
//! follows V8's parser, so it checks tokens in the same order and reports the first failure at
//! the same UTF-16 position. It runs only after a parse has already failed.

/// Token classes of V8's one-character JSON lookup table.
#[derive(Clone, Copy, Eq, PartialEq)]
enum Token {
    Colon,
    Comma,
    End,
    False,
    Illegal,
    LeftBrace,
    LeftBracket,
    Null,
    Number,
    RightBrace,
    RightBracket,
    String,
    True,
    Whitespace,
}

/// A container whose next member the parser expects.
enum Frame {
    Array,
    Object,
}

/// The first failure, as V8 selects its message.
enum Failure {
    /// A fixed message template, reported at a UTF-16 position.
    At(&'static str, usize),
    /// An unexpected token, whose class selects the message.
    Token(Token, usize),
}

const BAD_CONTROL: &str = "Bad control character in string literal in JSON";
const BAD_ESCAPE: &str = "Bad escaped character in JSON";
const BAD_UNICODE: &str = "Bad Unicode escape in JSON";
const EXPECTED_COLON: &str = "Expected ':' after property name in JSON";
const EXPECTED_COMMA_OR_BRACE: &str = "Expected ',' or '}' after property value in JSON";
const EXPECTED_COMMA_OR_BRACKET: &str = "Expected ',' or ']' after array element in JSON";
const EXPECTED_PROPERTY: &str = "Expected double-quoted property name in JSON";
const EXPECTED_PROPERTY_OR_BRACE: &str = "Expected property name or '}' in JSON";
const MISSING_EXPONENT: &str = "Exponent part is missing a number in JSON";
const NO_NUMBER: &str = "No number after minus sign in JSON";
const TRAILING: &str = "Unexpected non-whitespace character after JSON";
const UNTERMINATED_FRACTION: &str = "Unterminated fractional number in JSON";
const UNTERMINATED_STRING: &str = "Unterminated string in JSON";

/// Characters of context V8 quotes on each side of an unexpected token in a long source.
const CONTEXT: usize = 10;

/// Sources V8 names whole, since they are what `JSON.parse` receives for common non-JSON values.
const SPECIAL: [&str; 4] = ["[object Object]", "undefined", "Infinity", "NaN"];

const fn token(unit: Option<u16>) -> Token {
    let Some(unit) = unit else {
        return Token::End;
    };

    match unit {
        0x22 => Token::String,
        0x2c => Token::Comma,
        0x2d | 0x30..=0x39 => Token::Number,
        0x3a => Token::Colon,
        0x5b => Token::LeftBracket,
        0x5d => Token::RightBracket,
        0x66 => Token::False,
        0x6e => Token::Null,
        0x74 => Token::True,
        0x7b => Token::LeftBrace,
        0x7d => Token::RightBrace,
        0x09 | 0x0a | 0x0d | 0x20 => Token::Whitespace,
        _ => Token::Illegal,
    }
}

const fn is_digit(unit: u16) -> bool {
    matches!(unit, 0x30..=0x39)
}

const fn is_hex(unit: u16) -> bool {
    matches!(unit, 0x30..=0x39 | 0x41..=0x46 | 0x61..=0x66)
}

/// Characters V8 treats as continuing a number after a leading zero or integer digits.
const fn is_number_part(unit: u16) -> bool {
    matches!(unit, 0x2b | 0x2d | 0x2e | 0x30..=0x39 | 0x45 | 0x65)
}

struct Scanner<'u> {
    cursor: usize,
    units: &'u [u16],
}

impl Scanner<'_> {
    fn current(&self) -> Option<u16> {
        self.units.get(self.cursor).copied()
    }

    fn peek(&self) -> Token {
        token(self.current())
    }

    fn skip_whitespace(&mut self) {
        while self.peek() == Token::Whitespace {
            self.cursor += 1;
        }
    }

    /// Consumes `expected` after whitespace, as V8's `Check` does.
    fn check(&mut self, expected: Token) -> bool {
        self.skip_whitespace();

        if self.peek() != expected {
            return false;
        }

        self.cursor += 1;
        true
    }

    /// Consumes `expected` after whitespace, reporting `message` at any other token.
    fn expect_next(&mut self, expected: Token, message: &'static str) -> Result<(), Failure> {
        self.skip_whitespace();

        if self.peek() != expected {
            return Err(Failure::At(message, self.cursor));
        }

        self.cursor += 1;
        Ok(())
    }

    fn digits(&mut self) {
        while self.current().is_some_and(is_digit) {
            self.cursor += 1;
        }
    }

    /// Scans a string body after its opening quote.
    fn string(&mut self) -> Result<(), Failure> {
        loop {
            let Some(unit) = self.current() else {
                return Err(Failure::At(UNTERMINATED_STRING, self.cursor));
            };

            match unit {
                0x22 => {
                    self.cursor += 1;
                    return Ok(());
                }
                0x5c => {
                    self.cursor += 1;

                    match self.current() {
                        Some(0x22 | 0x2f | 0x5c | 0x62 | 0x66 | 0x6e | 0x72 | 0x74) => {}
                        Some(0x75) => {
                            for _ in 0..4 {
                                self.cursor += 1;

                                if !self.current().is_some_and(is_hex) {
                                    return Err(Failure::At(BAD_UNICODE, self.cursor));
                                }
                            }
                        }
                        _ => return Err(Failure::At(BAD_ESCAPE, self.cursor)),
                    }

                    self.cursor += 1;
                }
                0x00..0x20 => return Err(Failure::At(BAD_CONTROL, self.cursor)),
                _ => self.cursor += 1,
            }
        }
    }

    fn number(&mut self) -> Result<(), Failure> {
        let negative = self.current() == Some(0x2d);

        if negative {
            self.cursor += 1;
        }

        if self.current() == Some(0x30) {
            self.cursor += 1;

            match self.current() {
                Some(unit) if is_number_part(unit) => {
                    if is_digit(unit) {
                        return Err(Failure::Token(Token::Number, self.cursor));
                    }
                }
                _ if !negative => return Ok(()),
                _ => {}
            }
        } else {
            let start = self.cursor;

            self.digits();

            if self.cursor == start {
                return Err(Failure::At(NO_NUMBER, self.cursor));
            }

            if !self.current().is_some_and(is_number_part) {
                return Ok(());
            }
        }

        if self.current() == Some(0x2e) {
            self.cursor += 1;

            if !self.current().is_some_and(is_digit) {
                return Err(Failure::At(UNTERMINATED_FRACTION, self.cursor));
            }

            self.digits();
        }

        if matches!(self.current(), Some(0x45 | 0x65)) {
            self.cursor += 1;

            if matches!(self.current(), Some(0x2b | 0x2d)) {
                self.cursor += 1;
            }

            if !self.current().is_some_and(is_digit) {
                return Err(Failure::At(MISSING_EXPONENT, self.cursor));
            }

            self.digits();
        }

        Ok(())
    }

    /// Scans a literal whose first character `peek` already matched.
    fn literal(&mut self, word: &str) -> Result<(), Failure> {
        self.cursor += 1;

        for expected in word.bytes().skip(1) {
            match self.current() {
                Some(unit) if unit == u16::from(expected) => self.cursor += 1,
                unit => return Err(Failure::Token(token(unit), self.cursor)),
            }
        }

        Ok(())
    }

    /// Produces one value, opening containers until a complete value or a first member starts.
    fn value(&mut self, stack: &mut Vec<Frame>) -> Result<(), Failure> {
        loop {
            self.skip_whitespace();

            match self.peek() {
                Token::String => {
                    self.cursor += 1;
                    self.string()?;
                }
                Token::Number => self.number()?,
                Token::LeftBrace => {
                    self.cursor += 1;

                    if self.check(Token::RightBrace) {
                        return Ok(());
                    }

                    stack.push(Frame::Object);
                    self.expect_next(Token::String, EXPECTED_PROPERTY_OR_BRACE)?;
                    self.string()?;
                    self.expect_next(Token::Colon, EXPECTED_COLON)?;

                    continue;
                }
                Token::LeftBracket => {
                    self.cursor += 1;

                    if self.check(Token::RightBracket) {
                        return Ok(());
                    }

                    stack.push(Frame::Array);

                    continue;
                }
                Token::True => self.literal("true")?,
                Token::False => self.literal("false")?,
                Token::Null => self.literal("null")?,
                token => return Err(Failure::Token(token, self.cursor)),
            }

            return Ok(());
        }
    }

    /// Parses a complete document with an explicit container stack, so depth is unbounded as in V8.
    fn document(&mut self) -> Result<(), Failure> {
        let mut stack = Vec::new();

        loop {
            self.value(&mut stack)?;

            // Close every container the produced value completes.
            loop {
                match stack.last() {
                    None => {
                        return if self.check(Token::End) {
                            Ok(())
                        } else {
                            Err(Failure::At(TRAILING, self.cursor))
                        };
                    }
                    Some(Frame::Object) => {
                        if self.check(Token::Comma) {
                            self.expect_next(Token::String, EXPECTED_PROPERTY)?;
                            self.string()?;
                            self.expect_next(Token::Colon, EXPECTED_COLON)?;

                            break;
                        }

                        self.expect_next(Token::RightBrace, EXPECTED_COMMA_OR_BRACE)?;
                    }
                    Some(Frame::Array) => {
                        if self.check(Token::Comma) {
                            break;
                        }

                        self.expect_next(Token::RightBracket, EXPECTED_COMMA_OR_BRACKET)?;
                    }
                }

                stack.pop();
            }
        }
    }
}

/// Appends V8's position suffix, counting `\r\n` as one line break.
fn write_position(output: &mut String, units: &[u16], position: usize) {
    let mut line = 1;
    let mut line_start = 0;
    let mut index = 0;

    while index < position {
        if units.get(index) == Some(&0x0d)
            && index + 1 < position
            && units.get(index + 1) == Some(&0x0a)
        {
            index += 1;
        }

        if matches!(units.get(index), Some(0x0a | 0x0d)) {
            line += 1;
            line_start = index + 1;
        }

        index += 1;
    }

    let column = 1 + index - line_start;

    output.push_str(" at position ");
    output.push_str(&position.to_string());
    output.push_str(" (line ");
    output.push_str(&line.to_string());
    output.push_str(" column ");
    output.push_str(&column.to_string());
    output.push(')');
}

fn text(units: &[u16], start: usize, end: usize) -> String {
    String::from_utf16_lossy(units.get(start..end.min(units.len())).unwrap_or_default())
}

/// Formats the message of the `SyntaxError` that `JSON.parse(text)` throws, or returns `None`
/// when `JSON.parse` accepts the text.
#[cold]
pub fn json_error(source: &str) -> Option<String> {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut scanner = Scanner {
        cursor: 0,
        units: &units,
    };
    let failure = scanner.document().err()?;
    let mut output = String::new();

    match failure {
        Failure::At(message, position) => {
            output.push_str(message);
            write_position(&mut output, &units, position);
        }
        Failure::Token(Token::End, _) => output.push_str("Unexpected end of JSON input"),
        Failure::Token(Token::Number, position) => {
            output.push_str("Unexpected number in JSON");
            write_position(&mut output, &units, position);
        }
        Failure::Token(Token::String, position) => {
            output.push_str("Unexpected string in JSON");
            write_position(&mut output, &units, position);
        }
        Failure::Token(_, _) if SPECIAL.contains(&source) => {
            output.push('"');
            output.push_str(source);
            output.push_str("\" is not valid JSON");
        }
        Failure::Token(_, position) => {
            let length = units.len();

            output.push_str("Unexpected token '");
            output.push_str(&text(&units, position, position + 1));
            output.push_str("', ");

            if length <= CONTEXT * 2 {
                output.push('"');
                output.push_str(source);
                output.push('"');
            } else if position < CONTEXT {
                output.push('"');
                output.push_str(&text(&units, 0, position + CONTEXT));
                output.push_str("\"...");
            } else if position < length - CONTEXT {
                output.push_str("...\"");
                output.push_str(&text(&units, position - CONTEXT, position + CONTEXT));
                output.push_str("\"...");
            } else {
                output.push_str("...\"");
                output.push_str(&text(&units, position - CONTEXT, length));
                output.push('"');
            }

            output.push_str(" is not valid JSON");
        }
    }

    Some(output)
}
