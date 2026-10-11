//! The CSS value definition syntax, following css-tree's `definition-syntax` module.
//!
//! Grammars such as `<length> | auto` parse into [`SyntaxNode`] trees, which the lexer compiles
//! into match graphs. [`generate`] serializes a tree back to text the way css-tree's lexer
//! errors print a syntax.

use std::fmt::Write as _;

use crate::js;

/// How a group's terms combine. Precedence is observable, so variants follow css-tree's
/// binding order from tightest to loosest instead of the alphabet.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Combinator {
    /// Juxtaposition: all terms in order.
    Space,
    /// `&&`: all terms in any order.
    All,
    /// `||`: one or more terms in any order.
    Any,
    /// `|`: exactly one term.
    One,
}

impl Combinator {
    /// Returns the combinator's text.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Space => " ",
            Self::All => "&&",
            Self::Any => "||",
            Self::One => "|",
        }
    }

    const fn precedence(self) -> u8 {
        match self {
            Self::Space => 1,
            Self::All => 2,
            Self::Any => 3,
            Self::One => 4,
        }
    }
}

/// A numeric range bound in `<type [min,max]>`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Bound<'s> {
    /// A number with a unit, which css-tree keeps as a string and never range-checks.
    Dimension {
        /// Signed numeric part.
        number: f64,
        /// Unit text.
        unit: &'s str,
    },
    /// A plain number.
    Number(f64),
}

/// A `[min,max]` range on a type. An absent bound is infinite.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Range<'s> {
    /// Upper bound.
    pub max: Option<Bound<'s>>,
    /// Lower bound.
    pub min: Option<Bound<'s>>,
}

/// A definition syntax tree node, borrowing names from the definition source.
#[derive(Clone, Debug, PartialEq)]
pub enum SyntaxNode<'s> {
    /// `@name`.
    AtKeyword {
        /// Name without `@`.
        name: &'s str,
    },
    /// `<boolean-expr[ ... ]>`.
    Boolean {
        /// The test term.
        term: Box<SyntaxNode<'s>>,
    },
    /// `,`.
    Comma,
    /// `name(`, which css-tree keeps separate from its arguments.
    Function {
        /// Name without the parenthesis.
        name: &'s str,
    },
    /// A group of terms.
    Group {
        /// How terms combine.
        combinator: Combinator,
        /// Whether `!` requires the group to match something.
        disallow_empty: bool,
        /// Whether the group was written with brackets.
        explicit: bool,
        /// Terms.
        terms: Vec<SyntaxNode<'s>>,
    },
    /// A keyword.
    Keyword {
        /// Keyword as written.
        name: &'s str,
    },
    /// A repeated term.
    Multiplier {
        /// Whether repetitions are comma separated.
        comma: bool,
        /// Maximum count, or zero for unbounded.
        max: u32,
        /// Minimum count.
        min: u32,
        /// The repeated term.
        term: Box<SyntaxNode<'s>>,
    },
    /// `<'property'>`.
    Property {
        /// Property name.
        name: &'s str,
    },
    /// A quoted string such as `'['`, including the quotes.
    String {
        /// Quoted text.
        value: &'s str,
    },
    /// A literal character.
    Token {
        /// The character.
        value: &'s str,
    },
    /// `<name>`.
    Type {
        /// Type name, with `()` for functional types.
        name: &'s str,
        /// Range restriction.
        opts: Option<Range<'s>>,
    },
}

/// A definition syntax parse error with css-tree's raw message.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SyntaxError {
    /// Message such as `Expect a keyword`.
    pub message: &'static str,
    /// Byte offset of the error.
    pub offset: usize,
}

impl SyntaxError {
    /// Returns css-tree's full message: the raw message, the input, and a caret line. A zero
    /// offset points past the input, as in css-tree.
    pub fn formatted_message(&self, input: &str) -> String {
        let column = match self.offset {
            0 => js::utf16_length(input),
            offset => js::utf16_length(input.get(..offset).unwrap_or(input)),
        };
        let mut message = String::with_capacity(self.message.len() + input.len() * 2 + 8);

        message.push_str(self.message);
        message.push_str("\n  ");
        message.push_str(input);
        message.push_str("\n--");

        for _ in 0..column {
            message.push('-');
        }

        message.push('^');
        message
    }
}

impl std::fmt::Display for SyntaxError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for SyntaxError {}

type SResult<T> = Result<T, SyntaxError>;

/// Parses a value definition.
///
/// # Errors
///
/// Returns css-tree's error for malformed definitions, such as a dangling combinator.
pub fn parse(source: &str) -> Result<SyntaxNode<'_>, SyntaxError> {
    let mut scanner = Scanner { pos: 0, source };
    let result = read_implicit_group(&mut scanner, None, 0)?;

    if scanner.pos != source.len() {
        return Err(scanner.error("Unexpected input"));
    }

    if let SyntaxNode::Group { terms, .. } = &result
        && let [single @ SyntaxNode::Group { .. }] = terms.as_slice()
    {
        return Ok(single.clone());
    }

    Ok(result)
}

/// Nesting depth past which definition parsing fails.
const MAX_DEPTH: usize = 128;

/// Reports whether a byte is a definition name character: an ASCII letter, digit, or `-`.
const fn is_name_char(code: u8) -> bool {
    code.is_ascii_alphanumeric() || code == b'-'
}

/// The `∞` sign in range notation.
const INFINITY: &str = "\u{221E}";

struct Scanner<'s> {
    pos: usize,
    source: &'s str,
}

impl<'s> Scanner<'s> {
    fn char_code_at(&self, pos: usize) -> u8 {
        self.source.as_bytes().get(pos).copied().unwrap_or(0)
    }

    fn char_code(&self) -> u8 {
        self.char_code_at(self.pos)
    }

    fn next_char_code(&self) -> u8 {
        self.char_code_at(self.pos + 1)
    }

    fn is_infinity(&self) -> bool {
        self.source
            .get(self.pos..)
            .is_some_and(|rest| rest.starts_with(INFINITY))
    }

    fn find_ws_end(&self, mut pos: usize) -> usize {
        while matches!(self.char_code_at(pos), b'\r' | b'\n' | 0x0C | b' ' | b'\t') {
            pos += 1;
        }

        pos
    }

    fn skip_ws(&mut self) {
        self.pos = self.find_ws_end(self.pos);
    }

    fn substring_to_pos(&mut self, end: usize) -> &'s str {
        let text = self.source.get(self.pos..end).unwrap_or_default();

        self.pos = end;
        text
    }

    fn eat(&mut self, code: u8) -> SResult<()> {
        if self.char_code() != code {
            return Err(self.error(match code {
                b'<' => "Expect `<`",
                b'>' => "Expect `>`",
                b'\'' => "Expect `'`",
                b'[' => "Expect `[`",
                b']' => "Expect `]`",
                b'{' => "Expect `{`",
                b'}' => "Expect `}`",
                b',' => "Expect `,`",
                b'&' => "Expect `&`",
                _ => "Expect a character",
            }));
        }

        self.pos += 1;
        Ok(())
    }

    /// Consumes one character, like css-tree's `peek`.
    fn peek(&mut self) -> &'s str {
        let Some(code) = self
            .source
            .get(self.pos..)
            .and_then(|rest| rest.chars().next())
        else {
            return "";
        };
        let start = self.pos;

        self.pos += code.len_utf8();
        self.source.get(start..self.pos).unwrap_or_default()
    }

    #[cold]
    fn error(&self, message: &'static str) -> SyntaxError {
        SyntaxError {
            message,
            offset: self.pos,
        }
    }

    fn scan_spaces(&mut self) {
        self.pos = self.find_ws_end(self.pos);
    }

    fn scan_word(&mut self) -> SResult<&'s str> {
        let mut end = self.pos;

        while is_name_char(self.char_code_at(end)) {
            end += 1;
        }

        if end == self.pos {
            return Err(self.error("Expect a keyword"));
        }

        Ok(self.substring_to_pos(end))
    }

    fn scan_number(&mut self) -> SResult<&'s str> {
        let mut end = self.pos;

        while self.char_code_at(end).is_ascii_digit() {
            end += 1;
        }

        if end == self.pos {
            return Err(self.error("Expect a number"));
        }

        Ok(self.substring_to_pos(end))
    }

    fn scan_string(&mut self) -> SResult<&'s str> {
        let Some(found) = self
            .source
            .get(self.pos + 1..)
            .and_then(|rest| rest.find('\''))
        else {
            self.pos = self.source.len();
            return Err(self.error("Expect an apostrophe"));
        };

        Ok(self.substring_to_pos(self.pos + 1 + found + 1))
    }
}

/// A term during group parsing, before combinators are resolved.
enum Term<'s> {
    Combinator(Combinator),
    Node(SyntaxNode<'s>),
}

/// The result of reading one item.
enum Item<'s> {
    Combinator(Combinator),
    Node(SyntaxNode<'s>),
    Spaces,
}

fn parse_number(digits: &str) -> u32 {
    digits.parse().unwrap_or(u32::MAX)
}

fn read_multiplier_range(scanner: &mut Scanner<'_>) -> SResult<(u32, u32)> {
    scanner.eat(b'{')?;
    scanner.skip_ws();

    let min = scanner.scan_number()?;
    let mut max = None;

    scanner.skip_ws();

    if scanner.char_code() == b',' {
        scanner.pos += 1;
        scanner.skip_ws();

        if scanner.char_code() != b'}' {
            max = Some(scanner.scan_number()?);
            scanner.skip_ws();
        }
    } else {
        max = Some(min);
    }

    scanner.eat(b'}')?;
    Ok((parse_number(min), max.map_or(0, parse_number)))
}

/// Reads a multiplier, returning `(comma, min, max)`.
fn read_multiplier(scanner: &mut Scanner<'_>) -> SResult<Option<(bool, u32, u32)>> {
    Ok(Some(match scanner.char_code() {
        b'*' => {
            scanner.pos += 1;
            (false, 0, 0)
        }
        b'+' => {
            scanner.pos += 1;
            (false, 1, 0)
        }
        b'?' => {
            scanner.pos += 1;
            (false, 0, 1)
        }
        b'#' => {
            scanner.pos += 1;

            if scanner.char_code() == b'{' {
                let (min, max) = read_multiplier_range(scanner)?;

                (true, min, max)
            } else if scanner.char_code() == b'?' {
                // `#?` is one multiplier.
                scanner.pos += 1;
                (true, 0, 0)
            } else {
                (true, 1, 0)
            }
        }
        b'{' => {
            let (min, max) = read_multiplier_range(scanner)?;

            (false, min, max)
        }
        _ => return Ok(None),
    }))
}

fn maybe_multiplied<'s>(
    scanner: &mut Scanner<'s>,
    node: SyntaxNode<'s>,
) -> SResult<SyntaxNode<'s>> {
    let Some((comma, min, max)) = read_multiplier(scanner)? else {
        return Ok(node);
    };
    let multiplier = SyntaxNode::Multiplier {
        comma,
        max,
        min,
        term: Box::new(node),
    };

    // `+#` and `{A}?` stack as nested multipliers.
    if (scanner.char_code() == b'#' && scanner.char_code_at(scanner.pos - 1) == b'+')
        || (scanner.char_code() == b'?' && scanner.char_code_at(scanner.pos - 1) == b'}')
    {
        return maybe_multiplied(scanner, multiplier);
    }

    Ok(multiplier)
}

fn maybe_token<'s>(scanner: &mut Scanner<'s>) -> SResult<Option<SyntaxNode<'s>>> {
    let value = scanner.peek();

    if value.is_empty() {
        return Ok(None);
    }

    maybe_multiplied(scanner, SyntaxNode::Token { value }).map(Some)
}

fn read_property<'s>(scanner: &mut Scanner<'s>) -> SResult<SyntaxNode<'s>> {
    scanner.eat(b'<')?;
    scanner.eat(b'\'')?;

    let name = scanner.scan_word()?;

    scanner.eat(b'\'')?;
    scanner.eat(b'>')?;
    maybe_multiplied(scanner, SyntaxNode::Property { name })
}

fn read_bound<'s>(scanner: &mut Scanner<'s>, sign: f64) -> SResult<Bound<'s>> {
    let number = sign * js::number(scanner.scan_number()?);

    if is_name_char(scanner.char_code()) {
        return Ok(Bound::Dimension {
            number,
            unit: scanner.scan_word()?,
        });
    }

    Ok(Bound::Number(number))
}

fn read_type_range<'s>(scanner: &mut Scanner<'s>) -> SResult<Range<'s>> {
    let mut min = None;
    let mut max = None;
    let mut sign = 1.0;

    scanner.eat(b'[')?;

    if scanner.char_code() == b'-' {
        scanner.peek();
        sign = -1.0;
    }

    if sign < 0.0 && scanner.is_infinity() {
        scanner.peek();
    } else {
        min = Some(read_bound(scanner, sign)?);
    }

    scanner.skip_ws();
    scanner.eat(b',')?;
    scanner.skip_ws();

    if scanner.is_infinity() {
        scanner.peek();
    } else {
        sign = 1.0;

        if scanner.char_code() == b'-' {
            scanner.peek();
            sign = -1.0;
        }

        max = Some(read_bound(scanner, sign)?);
    }

    scanner.eat(b']')?;
    Ok(Range { max, min })
}

fn read_type<'s>(scanner: &mut Scanner<'s>, depth: usize) -> SResult<SyntaxNode<'s>> {
    scanner.eat(b'<')?;

    let word_start = scanner.pos;
    let word = scanner.scan_word()?;

    if word == "boolean-expr" {
        scanner.eat(b'[')?;

        let group = read_implicit_group(scanner, Some(b']'), depth + 1)?;

        scanner.eat(b']')?;
        scanner.eat(b'>')?;

        let term = match group {
            SyntaxNode::Group { mut terms, .. } if terms.len() == 1 => {
                terms.pop().unwrap_or(SyntaxNode::Comma)
            }
            group => group,
        };

        return maybe_multiplied(
            scanner,
            SyntaxNode::Boolean {
                term: Box::new(term),
            },
        );
    }

    let mut name = word;

    if scanner.char_code() == b'(' && scanner.next_char_code() == b')' {
        scanner.pos += 2;
        name = scanner.source.get(word_start..scanner.pos).unwrap_or(word);
    }

    let mut opts = None;

    if scanner.char_code_at(scanner.find_ws_end(scanner.pos)) == b'[' {
        scanner.skip_ws();
        opts = Some(read_type_range(scanner)?);
    }

    scanner.eat(b'>')?;
    maybe_multiplied(scanner, SyntaxNode::Type { name, opts })
}

fn read_keyword_or_function<'s>(scanner: &mut Scanner<'s>) -> SResult<SyntaxNode<'s>> {
    let name = scanner.scan_word()?;

    if scanner.char_code() == b'(' {
        scanner.pos += 1;
        return Ok(SyntaxNode::Function { name });
    }

    maybe_multiplied(scanner, SyntaxNode::Keyword { name })
}

fn read_group<'s>(scanner: &mut Scanner<'s>, depth: usize) -> SResult<SyntaxNode<'s>> {
    scanner.eat(b'[')?;

    let group = read_implicit_group(scanner, Some(b']'), depth + 1)?;

    scanner.eat(b']')?;

    let SyntaxNode::Group {
        combinator, terms, ..
    } = group
    else {
        return Ok(group);
    };
    let disallow_empty = scanner.char_code() == b'!';

    if disallow_empty {
        scanner.pos += 1;
    }

    Ok(SyntaxNode::Group {
        combinator,
        disallow_empty,
        explicit: true,
        terms,
    })
}

fn peek_item<'s>(scanner: &mut Scanner<'s>, depth: usize) -> SResult<Option<Item<'s>>> {
    let code = scanner.char_code();

    Ok(Some(match code {
        b']' | b'*' | b'+' | b'?' | b'#' | b'!' => return Ok(None),
        b'[' => {
            let group = read_group(scanner, depth)?;

            Item::Node(maybe_multiplied(scanner, group)?)
        }
        b'<' => Item::Node(if scanner.next_char_code() == b'\'' {
            read_property(scanner)?
        } else {
            read_type(scanner, depth)?
        }),
        b'|' => {
            let double = scanner.next_char_code() == b'|';

            scanner.pos += if double { 2 } else { 1 };
            Item::Combinator(if double {
                Combinator::Any
            } else {
                Combinator::One
            })
        }
        b'&' => {
            scanner.pos += 1;
            scanner.eat(b'&')?;
            Item::Combinator(Combinator::All)
        }
        b',' => {
            scanner.pos += 1;
            Item::Node(SyntaxNode::Comma)
        }
        b'\'' => {
            let value = scanner.scan_string()?;

            Item::Node(maybe_multiplied(scanner, SyntaxNode::String { value })?)
        }
        b' ' | b'\t' | b'\n' | b'\r' | 0x0C => {
            scanner.scan_spaces();
            Item::Spaces
        }
        b'@' => {
            if is_name_char(scanner.next_char_code()) {
                scanner.pos += 1;
                Item::Node(SyntaxNode::AtKeyword {
                    name: scanner.scan_word()?,
                })
            } else {
                return Ok(maybe_token(scanner)?.map(Item::Node));
            }
        }
        b'{' => {
            // An unquoted `{` is a token unless a digit follows, which marks a multiplier.
            if scanner.next_char_code().is_ascii_digit() {
                return Ok(None);
            }

            return Ok(maybe_token(scanner)?.map(Item::Node));
        }
        _ => {
            if is_name_char(code) {
                Item::Node(read_keyword_or_function(scanner)?)
            } else {
                return Ok(maybe_token(scanner)?.map(Item::Node));
            }
        }
    }))
}

fn read_implicit_group<'s>(
    scanner: &mut Scanner<'s>,
    stop: Option<u8>,
    depth: usize,
) -> SResult<SyntaxNode<'s>> {
    if depth > MAX_DEPTH {
        return Err(scanner.error("Maximum call stack size exceeded"));
    }

    let mut combinators: Vec<Combinator> = Vec::new();
    let mut terms: Vec<Term<'s>> = Vec::new();
    // Whether the previous term was a combinator, absent before the first term.
    let mut previous: Option<bool> = None;
    let mut previous_pos = scanner.pos;
    let mut previous_is_function = false;

    while stop.is_none_or(|stop| scanner.char_code() != stop) {
        let current = if previous_is_function {
            // Function arguments read as a group up to `)`, which stays unconsumed and later
            // becomes a token term. Juxtaposed arguments merge into this group.
            let SyntaxNode::Group {
                combinator,
                terms: mut arguments,
                ..
            } = read_implicit_group(scanner, Some(b')'), depth + 1)?
            else {
                break;
            };

            if arguments.is_empty() {
                previous_is_function = false;
                continue;
            }

            if combinator == Combinator::Space {
                while arguments.len() > 1 {
                    push_combinator(&mut combinators, Combinator::Space);
                    terms.push(Term::Combinator(Combinator::Space));
                    terms.push(Term::Node(arguments.remove(0)));
                }

                match arguments.pop() {
                    Some(node) => Term::Node(node),
                    None => break,
                }
            } else {
                Term::Node(SyntaxNode::Group {
                    combinator,
                    disallow_empty: false,
                    explicit: false,
                    terms: arguments,
                })
            }
        } else {
            match peek_item(scanner, depth)? {
                None => break,
                Some(Item::Spaces) => continue,
                Some(Item::Combinator(combinator)) => Term::Combinator(combinator),
                Some(Item::Node(node)) => Term::Node(node),
            }
        };

        match &current {
            Term::Combinator(combinator) => {
                if previous.is_none_or(|was_combinator| was_combinator) {
                    scanner.pos = previous_pos;
                    return Err(scanner.error("Unexpected combinator"));
                }

                push_combinator(&mut combinators, *combinator);
            }
            Term::Node(_) => {
                if previous == Some(false) {
                    push_combinator(&mut combinators, Combinator::Space);
                    terms.push(Term::Combinator(Combinator::Space));
                }
            }
        }

        previous = Some(matches!(current, Term::Combinator(_)));
        previous_is_function = matches!(current, Term::Node(SyntaxNode::Function { .. }));
        terms.push(current);
        previous_pos = scanner.pos;
    }

    if previous == Some(true) {
        scanner.pos = scanner.pos.saturating_sub(previous_pos);
        return Err(scanner.error("Unexpected combinator"));
    }

    let combinator = regroup_terms(&mut terms, combinators).unwrap_or(Combinator::Space);

    Ok(make_group(terms.into_iter(), combinator))
}

/// Records a combinator once, keeping first-seen order like an object's keys.
fn push_combinator(combinators: &mut Vec<Combinator>, combinator: Combinator) {
    if !combinators.contains(&combinator) {
        combinators.push(combinator);
    }
}

/// Groups terms by combinator precedence, like css-tree's `regroupTerms`. Returns the loosest
/// combinator, which becomes the outer group's combinator.
fn regroup_terms(
    terms: &mut Vec<Term<'_>>,
    mut combinators: Vec<Combinator>,
) -> Option<Combinator> {
    combinators.sort_by_key(|combinator| combinator.precedence());

    let mut last = None;
    let mut remaining = combinators.len();

    for combinator in combinators {
        remaining -= 1;
        last = Some(combinator);

        let mut index = 0usize;
        let mut subgroup_start: isize = 0;

        while index < terms.len() {
            if let Some(Term::Combinator(current)) = terms.get(index) {
                if *current == combinator {
                    if subgroup_start == -1 {
                        subgroup_start = isize::try_from(index).unwrap_or(0) - 1;
                    }

                    terms.remove(index);
                    continue;
                }

                if subgroup_start != -1 {
                    let start = usize::try_from(subgroup_start).unwrap_or(0);

                    if index - start > 1 {
                        let group = make_group(terms.drain(start..index), combinator);

                        terms.insert(start, Term::Node(group));
                        index = start + 1;
                    }
                }

                subgroup_start = -1;
            }

            index += 1;
        }

        if subgroup_start != -1 && remaining > 0 {
            let start = usize::try_from(subgroup_start)
                .unwrap_or(0)
                .min(terms.len());
            let group = make_group(terms.drain(start..index.min(terms.len())), combinator);

            terms.insert(start, Term::Node(group));
        }
    }

    last
}

fn make_group<'s>(terms: impl Iterator<Item = Term<'s>>, combinator: Combinator) -> SyntaxNode<'s> {
    SyntaxNode::Group {
        combinator,
        disallow_empty: false,
        explicit: false,
        terms: terms
            .filter_map(|term| match term {
                Term::Node(node) => Some(node),
                Term::Combinator(_) => None,
            })
            .collect(),
    }
}

/// Serializes a definition like css-tree's `generate` without options, as lexer errors print
/// syntaxes.
pub fn generate(node: &SyntaxNode<'_>) -> String {
    let mut output = String::new();

    generate_into(node, &mut output);
    output
}

fn generate_into(node: &SyntaxNode<'_>, output: &mut String) {
    match node {
        SyntaxNode::Group {
            combinator,
            disallow_empty,
            explicit,
            terms,
        } => {
            let mut body = String::new();

            for (index, term) in terms.iter().enumerate() {
                if index > 0 {
                    if *combinator == Combinator::Space {
                        body.push(' ');
                    } else {
                        body.push(' ');
                        body.push_str(combinator.as_str());
                        body.push(' ');
                    }
                }

                generate_into(term, &mut body);
            }

            if *explicit {
                output.push_str(if body.starts_with(',') { "[" } else { "[ " });
                output.push_str(&body);
                output.push_str(" ]");
            } else {
                output.push_str(&body);
            }

            if *disallow_empty {
                output.push('!');
            }
        }
        SyntaxNode::Multiplier {
            comma,
            max,
            min,
            term,
        } => {
            generate_into(term, output);
            generate_multiplier(*comma, *min, *max, output);
        }
        SyntaxNode::Boolean { term } => {
            output.push_str("<boolean-expr[");
            generate_into(term, output);
            output.push_str("]>");
        }
        SyntaxNode::Type { name, opts } => {
            output.push('<');
            output.push_str(name);

            if let Some(range) = opts {
                output.push_str(" [");
                generate_bound(range.min, "-\u{221E}", output);
                output.push(',');
                generate_bound(range.max, "\u{221E}", output);
                output.push(']');
            }

            output.push('>');
        }
        SyntaxNode::Property { name } => {
            output.push_str("<'");
            output.push_str(name);
            output.push_str("'>");
        }
        SyntaxNode::Keyword { name } => output.push_str(name),
        SyntaxNode::AtKeyword { name } => {
            output.push('@');
            output.push_str(name);
        }
        SyntaxNode::Function { name } => {
            output.push_str(name);
            output.push('(');
        }
        SyntaxNode::String { value } | SyntaxNode::Token { value } => output.push_str(value),
        SyntaxNode::Comma => output.push(','),
    }
}

fn generate_bound(bound: Option<Bound<'_>>, infinity: &str, output: &mut String) {
    match bound {
        None => output.push_str(infinity),
        Some(Bound::Number(number)) => js::integer_to_string(number, output),
        Some(Bound::Dimension { number, unit }) => {
            js::integer_to_string(number, output);
            output.push_str(unit);
        }
    }
}

fn generate_multiplier(comma: bool, min: u32, max: u32, output: &mut String) {
    match (min, max) {
        (0, 0) => output.push_str(if comma { "#?" } else { "*" }),
        (0, 1) => output.push('?'),
        (1, 0) => output.push(if comma { '#' } else { '+' }),
        (1, 1) => {}
        _ => {
            if comma {
                output.push('#');
            }

            if min == max {
                let _ = write!(output, "{{{min}}}");
            } else if max == 0 {
                let _ = write!(output, "{{{min},}}");
            } else {
                let _ = write!(output, "{{{min},{max}}}");
            }
        }
    }
}
