//! Normalizes CSS lexical spellings before keyword comparison.

/// Replaces comments with spaces, decodes escapes, and lowercases ASCII letters.
///
/// Escapes that decode to anything other than an ASCII word character or `-` become U+FFFD, so an
/// escaped keyword never compares equal to a different keyword.
pub fn normalize(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut output = String::with_capacity(text.len());
    let mut index = 0;

    while let Some(&byte) = bytes.get(index) {
        if byte == b'/' && bytes.get(index + 1) == Some(&b'*') {
            if let Some(end) =
                memchr::memmem::find(bytes.get(index + 2..).unwrap_or_default(), b"*/")
            {
                output.push(' ');
                index += end + 4;
                continue;
            }
        }

        if byte == b'\\' {
            let body = text.get(index + 1..).unwrap_or_default();
            let hex = body
                .bytes()
                .take(6)
                .take_while(u8::is_ascii_hexdigit)
                .count();

            if hex > 0 {
                let point = u32::from_str_radix(body.get(..hex).unwrap_or_default(), 16)
                    .unwrap_or(0)
                    .min(0x10_ffff);
                let mut length = 1 + hex;
                let rest = body.as_bytes().get(hex..).unwrap_or_default();

                if rest.starts_with(b"\r\n") {
                    length += 2;
                } else if matches!(rest.first(), Some(b' ' | b'\t' | b'\n' | b'\r' | 0x0c)) {
                    length += 1;
                }

                push_decoded(&mut output, char::from_u32(point));
                index += length;
                continue;
            }

            if let Some(character) = body.chars().next()
                && !matches!(character, '\n' | '\r' | '\u{c}')
            {
                push_decoded(&mut output, Some(character));
                index += 1 + character.len_utf8();
                continue;
            }
        }

        let character = text
            .get(index..)
            .and_then(|rest| rest.chars().next())
            .unwrap_or('\u{fffd}');

        output.push(character.to_ascii_lowercase());
        index += character.len_utf8();
    }

    output
}

fn push_decoded(output: &mut String, character: Option<char>) {
    match character {
        Some(character)
            if character.is_ascii_alphanumeric() || character == '_' || character == '-' =>
        {
            output.push(character.to_ascii_lowercase());
        }
        _ => output.push('\u{fffd}'),
    }
}
