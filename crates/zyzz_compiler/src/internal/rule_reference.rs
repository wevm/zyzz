//! Decides which properties accept references to named stylesheet rules.

/// A named stylesheet rule kind that declarations can reference.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Kind {
    /// `@color-profile`
    ColorProfile,
    /// `@counter-style`
    CounterStyle,
    /// `@function`
    CssFunction,
    /// `@custom-media`
    CustomMedia,
    /// `@font-palette-values`
    FontPaletteValues,
    /// `@position-try`
    PositionTry,
}

/// Whether a property can reference a rule of this kind.
pub fn accepts(kind: Kind, property: &str) -> bool {
    match kind {
        Kind::CssFunction => true,
        Kind::CustomMedia => false,
        _ if property.starts_with("--") => true,
        Kind::CounterStyle => matches!(
            property,
            "fallback" | "listStyle" | "listStyleType" | "speakAs" | "system"
        ),
        Kind::FontPaletteValues => property == "fontPalette",
        Kind::PositionTry => matches!(property, "positionTry" | "positionTryFallbacks"),
        Kind::ColorProfile => false,
    }
}

/// Whether a reference interpolated after `prefix` sits in an accepted expression position.
///
/// Color profiles are accepted only as the color space of a relative `color()` function.
pub fn accepts_expression(kind: Kind, property: &str, prefix: &str) -> bool {
    if kind != Kind::ColorProfile {
        return accepts(kind, property);
    }

    let text = strip_comments(prefix);
    let mut groups: Vec<(String, usize)> = Vec::new();
    let mut characters = text.char_indices();
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

        match character {
            '"' | '\'' => quote = Some(character),
            '(' => {
                let before = text.get(..index).unwrap_or_default();
                let name: String = before
                    .chars()
                    .rev()
                    .take_while(|character| crate::js::is_word(*character) || *character == '-')
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect();

                groups.push((name.to_lowercase(), index + 1));
            }
            ')' => {
                groups.pop();
            }
            _ => {}
        }
    }

    let Some((name, start)) = groups.last() else {
        return false;
    };

    if quote.is_some() || name != "color" {
        return false;
    }

    let body = text.get(*start..).unwrap_or_default();

    if crate::js::trim(body).is_empty() {
        return true;
    }

    relative_color_space(body)
}

/// Replaces each comment with a space, matching `/\/\*[\s\S]*?\*\//g`.
fn strip_comments(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut rest = value;

    while let Some(start) = rest.find("/*") {
        let Some(end) = rest.get(start + 2..).and_then(|after| after.find("*/")) else {
            break;
        };

        output.push_str(rest.get(..start).unwrap_or_default());
        output.push(' ');
        rest = rest.get(start + 2 + end + 2..).unwrap_or_default();
    }

    output.push_str(rest);
    output
}

/// Matches `^\s*from\s+(?:#[\da-f]+|[-\w]+(?:\([\s\S]*\))?)\s+$` case-insensitively.
fn relative_color_space(body: &str) -> bool {
    let text = body.trim_start_matches(crate::js::is_whitespace);
    let Some(after) = text
        .get(..4)
        .filter(|word| word.eq_ignore_ascii_case("from"))
        .and(text.get(4..))
    else {
        return false;
    };
    let value = after.trim_start_matches(crate::js::is_whitespace);

    if value.len() == after.len() {
        return false;
    }

    let rest = if let Some(hex) = value.strip_prefix('#') {
        let digits = hex.bytes().take_while(u8::is_ascii_hexdigit).count();

        if digits == 0 {
            return false;
        }

        hex.get(digits..).unwrap_or_default()
    } else {
        let name = value
            .chars()
            .take_while(|character| crate::js::is_word(*character) || *character == '-')
            .count();

        if name == 0 {
            return false;
        }

        value.get(name..).unwrap_or_default()
    };
    let trimmed = rest.trim_end_matches(crate::js::is_whitespace);

    if trimmed.len() == rest.len() {
        return false;
    }

    trimmed.is_empty()
        || (trimmed.starts_with('(') && trimmed.ends_with(')') && !value.starts_with('#'))
}
