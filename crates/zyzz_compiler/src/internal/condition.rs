//! Classifies and normalizes nested condition keys such as selectors and at-rule queries.

use crate::error::{Error, Result};

const NESTED_AT_RULES: [&str; 6] = [
    "media",
    "supports",
    "container",
    "scope",
    "layer",
    "document",
];

/// Whether a style key opens a nested condition rather than naming a property.
pub fn is(key: &str) -> bool {
    if key.starts_with("--") {
        return false;
    }

    // Property names start with neither prefix and nest nothing, so they skip the scan.
    if !matches!(key.as_bytes().first(), Some(b':' | b'@'))
        && memchr::memchr(b'&', key.as_bytes()).is_none()
    {
        return false;
    }

    if nested(key) || key.starts_with(':') || matches!(key, "@starting-style" | "@scope" | "@layer")
    {
        return true;
    }

    let Some(rest) = key.strip_prefix('@') else {
        return false;
    };

    NESTED_AT_RULES.iter().any(|name| {
        rest.strip_prefix(name).is_some_and(|after| {
            matches!(
                after.as_bytes().first(),
                Some(b'\t' | b'\n' | b'\r' | 0x0c | b' ' | b'(')
            ) || after.starts_with("/*")
        })
    })
}

/// Whether a selector key contains an unquoted, uncommented `&`.
pub fn nested(key: &str) -> bool {
    let mut characters = key.char_indices().peekable();
    let mut quote = None;

    while let Some((index, character)) = characters.next() {
        if character == '\\' {
            characters.next();
            continue;
        }

        if let Some(open) = quote {
            if character == open {
                quote = None;
            }
            continue;
        }

        if character == '"' || character == '\'' {
            quote = Some(character);
            continue;
        }

        if character == '/' && key.as_bytes().get(index + 1) == Some(&b'*') {
            let Some(end) = find(key, "*/", index + 2) else {
                return false;
            };

            skip_to(&mut characters, end + 1);
        } else if character == '&' {
            return true;
        }
    }

    false
}

/// Folds line breaks to spaces and validates delimiter balance.
///
/// # Errors
///
/// Returns the TypeScript compiler's message for unterminated comments, incomplete escapes,
/// unbalanced delimiters, block delimiters, and selector lists without explicit `&` selectors.
pub fn normalize(key: &str) -> Result<String> {
    let bytes = key.as_bytes();
    let mut characters = key.char_indices().peekable();
    let mut stack: Vec<char> = Vec::new();
    let mut quote = None;
    let mut output = String::with_capacity(key.len());
    let mut scoped = false;
    let mut list = false;

    while let Some((index, character)) = characters.next() {
        if quote.is_none() && character == '/' && bytes.get(index + 1) == Some(&b'*') {
            let end = find(key, "*/", index + 2)
                .ok_or_else(|| Error::message("Unterminated condition comment."))?;

            for comment in key.get(index..end + 2).unwrap_or_default().chars() {
                output.push(if matches!(comment, '\n' | '\r' | '\u{c}') {
                    ' '
                } else {
                    comment
                });
            }

            skip_to(&mut characters, end + 1);
            continue;
        }

        if character == '\\' {
            let (_, next) = characters
                .next()
                .ok_or_else(|| Error::message("Incomplete condition escape."))?;

            if !matches!(next, '\n' | '\r' | '\u{c}') {
                output.push(character);
                output.push(next);
            } else if next == '\r' && characters.peek().is_some_and(|(_, after)| *after == '\n') {
                characters.next();
            }
            continue;
        }

        if let Some(open) = quote {
            output.push(character);
            if character == open {
                quote = None;
            }
            continue;
        }

        match character {
            '"' | '\'' => quote = Some(character),
            '(' => stack.push(')'),
            '[' => stack.push(']'),
            ')' | ']' => {
                if stack.pop() != Some(character) {
                    return Err(Error::message("Unbalanced condition delimiters."));
                }
            }
            '{' | '}' => return Err(Error::message("Unexpected condition block delimiter.")),
            '&' => scoped = true,
            ',' if stack.is_empty() && !key.starts_with('@') => {
                if !scoped {
                    return Err(Error::message(
                        "Selector lists require explicit & selectors.",
                    ));
                }
                scoped = false;
                list = true;
            }
            _ => {}
        }

        output.push(if matches!(character, '\n' | '\r' | '\u{c}') {
            ' '
        } else {
            character
        });
    }

    if quote.is_some() || !stack.is_empty() {
        return Err(Error::message("Unbalanced condition delimiters."));
    }

    if list && !scoped {
        return Err(Error::message(
            "Selector lists require explicit & selectors.",
        ));
    }

    Ok(output)
}

const LOCAL_PSEUDO_ELEMENTS: [&str; 7] = [
    "before",
    "after",
    "first-letter",
    "first-line",
    "marker",
    "placeholder",
    "selection",
];

/// Whether a condition still selects the styled element itself, so dynamic slots stay local.
pub fn local(key: &str) -> bool {
    if key.starts_with('@') {
        return true;
    }

    let bytes = key.as_bytes();
    let mut characters = key.char_indices().peekable();
    let mut nesting = 0_i32;
    let mut quoted = None;

    while let Some((index, character)) = characters.next() {
        if quoted.is_none() && character == '/' && bytes.get(index + 1) == Some(&b'*') {
            let Some(end) = find(key, "*/", index + 2) else {
                return false;
            };

            skip_to(&mut characters, end + 1);
            continue;
        }

        if character == '\\' {
            characters.next();
            continue;
        }

        if let Some(open) = quoted {
            if character == open {
                quoted = None;
            }
            continue;
        }

        match character {
            '"' | '\'' => quoted = Some(character),
            '(' | '[' => nesting += 1,
            ')' | ']' => nesting -= 1,
            ',' if nesting == 0 => {
                let before = crate::js::trim(key.get(..index).unwrap_or_default());
                let after = crate::js::trim(key.get(index + 1..).unwrap_or_default());

                return local(before) && local(after);
            }
            _ => {}
        }
    }

    if !key.starts_with('&') && (!key.starts_with(':') || nested(key)) {
        return false;
    }

    let mut characters = key.char_indices().peekable();
    let mut depth = 0_i32;
    let mut quote = None;

    while let Some((index, character)) = characters.next() {
        if quote.is_none() && character == '/' && bytes.get(index + 1) == Some(&b'*') {
            let Some(end) = find(key, "*/", index + 2) else {
                return false;
            };

            skip_to(&mut characters, end + 1);
            continue;
        }

        if character == '\\' {
            characters.next();
            continue;
        }

        if let Some(open) = quote {
            if character == open {
                quote = None;
            }
            continue;
        }

        if character == '"' || character == '\'' {
            quote = Some(character);
            continue;
        }

        if depth == 0 && character == ':' && bytes.get(index + 1) == Some(&b':') {
            let name: String = key
                .get(index + 2..)
                .unwrap_or_default()
                .chars()
                .take_while(|character| character.is_ascii_alphabetic() || *character == '-')
                .map(|character| character.to_ascii_lowercase())
                .collect();

            if name.is_empty() || !LOCAL_PSEUDO_ELEMENTS.contains(&name.as_str()) {
                return false;
            }
        }

        match character {
            '(' | '[' => depth += 1,
            ')' | ']' => depth -= 1,
            _ if depth == 0
                && (crate::js::is_whitespace(character)
                    || matches!(character, '+' | '~' | '>' | ',')
                    || (character == '&' && index != 0)) =>
            {
                return false;
            }
            _ => {}
        }
    }

    true
}

/// Finds `needle` at or after a byte offset.
fn find(haystack: &str, needle: &str, from: usize) -> Option<usize> {
    haystack
        .get(from..)
        .and_then(|rest| memchr::memmem::find(rest.as_bytes(), needle.as_bytes()))
        .map(|offset| from + offset)
}

/// Advances a character iterator until the next character starts after `last`.
fn skip_to(characters: &mut std::iter::Peekable<std::str::CharIndices<'_>>, last: usize) {
    while characters.peek().is_some_and(|(index, _)| *index <= last) {
        characters.next();
    }
}
