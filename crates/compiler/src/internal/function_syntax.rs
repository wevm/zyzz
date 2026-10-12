//! Validates the restricted value syntax accepted by `@function` parameters and results.

/// Syntax components `@function` accepts.
pub const PRIMITIVES: [&str; 15] = [
    "<angle>",
    "<color>",
    "<custom-ident>",
    "<image>",
    "<integer>",
    "<length>",
    "<length-percentage>",
    "<number>",
    "<percentage>",
    "<resolution>",
    "<string>",
    "<time>",
    "<transform-function>",
    "<transform-list>",
    "<url>",
];

const RESERVED: [&str; 6] = [
    "default",
    "inherit",
    "initial",
    "revert",
    "revert-layer",
    "unset",
];

/// Whether a syntax string is `*`, one component, or a `type()` list of alternatives.
pub fn accepts(value: &str) -> bool {
    let text = crate::js::trim(value);

    if text == "*" {
        return true;
    }

    let wrapped = text.starts_with("type(") && text.ends_with(')') && text.len() >= 6;
    let body = if wrapped {
        crate::js::trim(text.get(5..text.len() - 1).unwrap_or_default())
    } else {
        text
    };

    if wrapped && body == "*" {
        return true;
    }

    if !wrapped && body.contains('|') {
        return false;
    }

    let bytes = body.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        while bytes.get(index).is_some_and(|byte| is_space(*byte)) {
            index += 1;
        }

        let Some((end, suffix)) = component(body, index) else {
            return false;
        };

        let atom = body
            .get(index..end - usize::from(suffix))
            .unwrap_or_default();

        if atom.starts_with('<') {
            if !PRIMITIVES.contains(&atom) || (atom == "<transform-list>" && suffix) {
                return false;
            }
        } else if RESERVED.contains(&decode(atom).to_ascii_lowercase().as_str()) {
            return false;
        }

        index = end;

        while bytes.get(index).is_some_and(|byte| is_space(*byte)) {
            index += 1;
        }

        if index == bytes.len() {
            return true;
        }

        if !wrapped || bytes.get(index) != Some(&b'|') {
            return false;
        }

        index += 1;

        if index == bytes.len() {
            return false;
        }
    }

    false
}

/// Whether a syntax accepts `<integer>` but not `<number>`.
pub fn integer_only(syntax: &str) -> bool {
    let value = crate::js::trim(syntax);
    let body = if value.starts_with("type(") {
        crate::js::slice(value, 5, crate::js::utf16_len(value).saturating_sub(1))
    } else {
        value
    };
    let alternatives: Vec<&str> = body
        .split('|')
        .map(|alternative| {
            let alternative = crate::js::trim(alternative);
            alternative.strip_suffix(['+', '#']).unwrap_or(alternative)
        })
        .collect();

    alternatives.contains(&"<integer>") && !alternatives.contains(&"<number>")
}

const fn is_space(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0c)
}

/// Matches one syntax component and an optional `+` or `#` multiplier at a byte offset.
fn component(body: &str, start: usize) -> Option<(usize, bool)> {
    let bytes = body.as_bytes();
    let end = if bytes.get(start) == Some(&b'<') {
        let name = bytes
            .get(start + 1..)?
            .iter()
            .take_while(|byte| byte.is_ascii_lowercase() || **byte == b'-')
            .count();

        if name == 0 || bytes.get(start + 1 + name) != Some(&b'>') {
            ident(body, start)?
        } else {
            start + name + 2
        }
    } else {
        ident(body, start)?
    };
    let suffix = matches!(bytes.get(end), Some(b'+' | b'#'));

    Some((end + usize::from(suffix), suffix))
}

/// Matches `(?:--|-start|start)tail*` at a byte offset.
fn ident(body: &str, start: usize) -> Option<usize> {
    let mut index = if body.get(start..)?.starts_with("--") {
        start + 2
    } else {
        let after = if body.as_bytes().get(start) == Some(&b'-') {
            start + 1
        } else {
            start
        };

        name_unit(body, after, false)?
    };

    while let Some(next) = name_unit(body, index, true) {
        index = next;
    }

    Some(index)
}

/// Matches one identifier code point or escape at a byte offset.
fn name_unit(body: &str, index: usize, tail: bool) -> Option<usize> {
    let character = body.get(index..)?.chars().next()?;

    if character == '\\' {
        let rest = body.get(index + 1..)?;
        let hex = rest
            .bytes()
            .take(6)
            .take_while(u8::is_ascii_hexdigit)
            .count();

        if hex > 0 {
            let space = usize::from(rest.as_bytes().get(hex).is_some_and(|byte| is_space(*byte)));

            return Some(index + 1 + hex + space);
        }

        let next = rest.chars().next()?;

        return (!matches!(next, '\n' | '\r' | '\u{c}')).then_some(index + 1 + next.len_utf8());
    }

    let accepted = character == '_'
        || character.is_ascii_alphabetic()
        || !character.is_ascii()
        || (tail && (character == '-' || character.is_ascii_digit()));

    accepted.then_some(index + character.len_utf8())
}

/// Decodes CSS escapes in an identifier.
fn decode(atom: &str) -> String {
    let mut output = String::with_capacity(atom.len());
    let mut characters = atom.char_indices().peekable();

    while let Some((index, character)) = characters.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }

        let rest = atom.get(index + 1..).unwrap_or_default();
        let hex = rest
            .bytes()
            .take(6)
            .take_while(u8::is_ascii_hexdigit)
            .count();

        if hex > 0 {
            let point = u32::from_str_radix(rest.get(..hex).unwrap_or_default(), 16).unwrap_or(0);
            let decoded = if point == 0 || point > 0x10_ffff {
                None
            } else {
                char::from_u32(point)
            };
            let space = usize::from(rest.as_bytes().get(hex).is_some_and(|byte| is_space(*byte)));

            output.push(decoded.unwrap_or('\u{fffd}'));

            for _ in 0..hex + space {
                characters.next();
            }
        } else if let Some((_, next)) =
            characters.next_if(|(_, next)| !matches!(next, '\n' | '\r' | '\u{c}'))
        {
            output.push(next);
        } else {
            output.push(character);
        }
    }

    output
}
