//! Adapts standard at-rules and descriptors that precede the pinned output parser's grammar.
//!
//! [`transform`] validates newer rules with css-tree grammars and dedicated checks, renames the
//! at-keywords the output parser would drop or rewrite to markers it keeps as unknown rules,
//! transforms the result, and restores the original at-keywords in the output:
//!
//! - **`@property`:** renamed to a `zyzz-property` marker when a registration's syntax string
//!   contains a backslash.
//! - **`@font-feature-values` and `@font-palette-values`:** renamed to `-zyzz-ffv-` and
//!   `-zyzz-fpv-` markers, which keep newer descriptors and palette font-family lists.
//! - **Anonymous import layers:** with a visitor, a line-start `@import "…" layer` becomes
//!   `layer(zyzz-anonymous-import)` while the visitor runs.
//!
//! Markers grow until the source does not contain them, so restoration never touches authored
//! text.
//!
//! # Visitors
//!
//! [`transform_with`] takes a lightningcss [`Visitor`], the Rust form of the binding's visitor
//! object. It covers every caller's visitor without another hook: import and URL relocation,
//! relative-asset rejection, rule identities, selector inspection, and rule removal. The
//! contract follows the binding's:
//!
//! - **Timing:** the visitor runs once, after validation and parsing and before minification,
//!   over the transported stylesheet. Renamed rules appear as unknown rules named by their
//!   markers, such as `-zyzz-fpv-000000000`.
//! - **Order:** the binding calls a rule visitor before visiting the rule's children. A visitor
//!   that inspects a rule in `visit_rule` before calling `visit_children` sees rules in the same
//!   document order. An import rule's URL is not a [`Url`] value, so relocation handles
//!   [`CssRule::Import`] in `visit_rule` and [`Url`] in `visit_url`.
//! - **Changes:** mutations print into the output before markers are restored. Removing rules
//!   takes a `visit_rule_list` override, the counterpart of returning `[]`.
//! - **Errors:** a visitor error aborts the transform and returns unchanged, as a thrown
//!   visitor error propagates through the binding.
//!
//! [`relocate_import`] reproduces the rule that `relocateImport` returns through the binding's
//! JSON form, including its loss of anonymous layers that the import marker does not cover.

use std::borrow::Cow;

use lightningcss::rules::import::ImportRule;
use lightningcss::visitor::Visitor;
#[cfg(doc)]
use lightningcss::{rules::CssRule, values::url::Url};

use crate::compiler::internal::identifiers::{self, Separator};
use crate::compiler::internal::lightning::{self, Options, Output};
use crate::compiler::internal::{
    color_profiles, descriptors, functions, keyframes, properties, view_transitions,
};
use crate::error::{Error, Result};
use crate::js;

/// Validates and transforms a stylesheet, transporting newer at-rules through the output parser.
///
/// When at-keywords are transported, a source map describes the renamed stylesheet, as the
/// TypeScript adapter returns it.
///
/// # Errors
///
/// Returns the first validation failure, or the output parser's message.
pub fn transform(options: &Options<'_>) -> Result<Output> {
    match Transport::prepare(options.code, false)? {
        None => lightning::transform(options),
        Some(transport) => {
            let output = lightning::transform(&Options {
                code: &transport.code,
                ..*options
            })?;

            Ok(transport.restore(output))
        }
    }
}

/// Validates and transforms a stylesheet like [`transform`], running a visitor over the
/// transported stylesheet before minification.
///
/// # Errors
///
/// Returns the first validation failure, the output parser's message, or the visitor's error.
pub fn transform_with<V>(options: &Options<'_>, visitor: &mut V) -> Result<Output>
where
    V: for<'i> Visitor<'i, Error = Error>,
{
    match Transport::prepare(options.code, true)? {
        None => lightning::transform_with(options, visitor),
        Some(transport) => {
            let output = lightning::transform_with(
                &Options {
                    code: &transport.code,
                    ..*options
                },
                visitor,
            )?;

            Ok(transport.restore(output))
        }
    }
}

/// Validates a stylesheet as `AtRules.transform` with `errorRecovery: false` does.
///
/// The transported stylesheet is parsed without minifying or printing, which cannot fail for
/// these options, so the result matches a discarded transform.
///
/// # Errors
///
/// Returns the first validation failure, or the output parser's message.
pub fn validate(code: &str, filename: &str) -> Result<()> {
    let transport = Transport::prepare(code, false)?;
    let options = Options {
        code: transport
            .as_ref()
            .map_or(code, |transport| transport.code.as_str()),
        filename,
        ..Options::default()
    };

    lightning::parse(&options).map(|_| ())
}

/// Renames actual at-keywords without touching strings, comments, or function arguments.
///
/// Matches `@before` case-insensitively when the next character cannot continue the name.
/// Returns the source unchanged when it contains an unterminated comment.
pub fn rename<'s>(source: &'s str, before: &str, after: &str) -> Cow<'s, str> {
    let bytes = source.as_bytes();
    let mut output: Option<String> = None;
    let mut copied = 0;
    let mut quote = None;
    let mut parentheses = 0_i64;
    let mut index = 0;

    // Special characters are ASCII, so stepping bytes visits them as JavaScript code units do.
    // An escape skips its first byte, and continuation bytes are never special.
    while let Some(&byte) = bytes.get(index) {
        if byte == b'\\' {
            index += 2;
            continue;
        }

        if let Some(open) = quote {
            if byte == open {
                quote = None;
            }

            index += 1;
            continue;
        }

        match byte {
            b'"' | b'\'' => quote = Some(byte),
            b'/' if bytes.get(index + 1) == Some(&b'*') => {
                let Some(end) = bytes
                    .get(index + 2..)
                    .and_then(|rest| memchr::memmem::find(rest, b"*/"))
                else {
                    return Cow::Borrowed(source);
                };

                index += end + 4;
                continue;
            }
            b'(' => parentheses += 1,
            b')' => parentheses -= 1,
            b'@' if parentheses == 0 => {
                if let Some(length) = source
                    .get(index + 1..)
                    .and_then(|rest| keyword(rest, before))
                {
                    let output = output
                        .get_or_insert_with(|| String::with_capacity(source.len() + after.len()));

                    output.push_str(source.get(copied..index).unwrap_or_default());
                    output.push('@');
                    output.push_str(after);
                    index += 1 + length;
                    copied = index;
                    continue;
                }
            }
            _ => {}
        }

        index += 1;
    }

    match output {
        None => Cow::Borrowed(source),
        Some(mut output) => {
            output.push_str(source.get(copied..).unwrap_or_default());
            Cow::Owned(output)
        }
    }
}

/// Returns the byte length of `before` at the start of `rest` when it matches like
/// `rest.slice(0, before.length).toLowerCase() === before` and no `[\w-]` follows.
fn keyword(rest: &str, before: &str) -> Option<usize> {
    let length = match rest.as_bytes().get(..before.len()) {
        Some(head) if head.is_ascii() && before.is_ascii() => head
            .eq_ignore_ascii_case(before.as_bytes())
            .then_some(before.len())?,
        _ => lowercase_prefix(rest, before)?,
    };

    let continues = rest
        .as_bytes()
        .get(length)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_' || *byte == b'-');

    (!continues).then_some(length)
}

/// Compares the UTF-16 prefix of `rest` as long as `before` after JavaScript lowercasing.
fn lowercase_prefix(rest: &str, before: &str) -> Option<usize> {
    let units = js::utf16_len(before);
    let mut counted = 0;
    let mut end = 0;

    for (offset, character) in rest.char_indices() {
        if counted >= units {
            break;
        }

        counted += character.len_utf16();
        end = offset + character.len_utf8();
    }

    // A prefix that splits a surrogate pair ends in a lone surrogate no `&str` equals.
    if counted > units {
        return None;
    }

    (rest.get(..end)?.to_lowercase() == before).then_some(end)
}

/// Points an import rule at a relocated URL, as the rule `relocateImport` returns.
///
/// The binding serializes an anonymous layer as `null`, which the returned rule omits, so an
/// anonymous layer the import marker did not cover is dropped.
pub fn relocate_import(rule: &mut ImportRule<'_>, url: &str) {
    rule.url = url.to_owned().into();

    if matches!(rule.layer, Some(None)) {
        rule.layer = None;
    }
}

/// Renamed source and the markers to restore in the output.
struct Transport {
    code: String,
    features: String,
    import: String,
    palette: String,
    property: String,
}

impl Transport {
    /// Validates the source and renames transported at-keywords. Returns `None` when the
    /// original code transforms unchanged.
    fn prepare(code: &str, visitor: bool) -> Result<Option<Self>> {
        // Stylesheets without an @ byte cannot require at-keyword transport.
        if !code.contains('@') {
            return Ok(None);
        }

        // Decoding drops a leading byte order mark.
        let source = code.strip_prefix('\u{feff}').unwrap_or(code);

        if at_keyword(
            source,
            &[
                "counter-style",
                "custom-media",
                "document",
                "font-face",
                "font-palette-values",
                "page",
            ],
        ) {
            descriptors::validate(source)?;
        }

        if at_keyword(source, &["function"]) {
            functions::validate(source)?;
        }

        let properties = at_keyword(source, &["property"]) && properties::validate(source)?;
        let property = unique(source, "zyzz-property");
        let lower = source.to_lowercase();

        validate_features(source, &lower)?;

        // The binding cannot round-trip the nested option of anonymous import layers. Visitors
        // see a temporary layer name, which the output restores.
        let import = unique(source, "zyzz-anonymous-import");
        let imports = if visitor {
            mark_imports(source, &import)
        } else {
            Cow::Borrowed(source)
        };
        let features = numbered(&lower, "-zyzz-ffv-");
        let palette = numbered(&lower, "-zyzz-fpv-");

        // The pinned parser silently drops font-family lists from palette rules.
        let mut renamed = imports;

        if properties {
            renamed = apply(renamed, "property", &property);
        }

        if lower.contains("@font-feature-values") {
            renamed = apply(renamed, "font-feature-values", &features);
        }

        if lower.contains("@font-palette-values") {
            renamed = apply(renamed, "font-palette-values", &palette);
        }

        if lower.contains("@color-profile") {
            color_profiles::validate(&renamed)?;
        }

        if lower.contains("@keyframes") {
            keyframes::validate(&renamed)?;
        }

        if lower.contains("@view-transition") {
            let marker = unique(source, "-zyzz-view-transition");

            view_transitions::validate(&rename(&renamed, "view-transition", &marker), &marker)?;
        }

        if renamed == source {
            return Ok(None);
        }

        Ok(Some(Self {
            code: renamed.into_owned(),
            features,
            import,
            palette,
            property,
        }))
    }

    /// Restores transported at-keywords and anonymous import layers in transformed output. The
    /// source map still describes the renamed stylesheet.
    fn restore(&self, output: Output) -> Output {
        Output {
            code: self.restore_code(&output.code),
            map: output.map,
        }
    }

    fn restore_code(&self, output: &str) -> String {
        // Decoding the output drops a leading byte order mark here too.
        let output = output.strip_prefix('\u{feff}').unwrap_or(output);
        let layer = format!("layer({})", self.import);
        let unmarked = replace_all(output, &layer, "layer");
        let restored = rename(&unmarked, &self.property, "property");
        let restored = rename(&restored, &self.features, "font-feature-values");

        rename(&restored, &self.palette, "font-palette-values").into_owned()
    }
}

/// Renames within owned or borrowed text, keeping the original when nothing changes.
fn apply<'s>(text: Cow<'s, str>, before: &str, after: &str) -> Cow<'s, str> {
    let renamed = match rename(&text, before, after) {
        Cow::Owned(renamed) => Some(renamed),
        Cow::Borrowed(_) => None,
    };

    renamed.map_or(text, Cow::Owned)
}

fn replace_all<'s>(text: &'s str, from: &str, to: &str) -> Cow<'s, str> {
    let mut output: Option<String> = None;
    let mut copied = 0;

    for (index, _) in text.match_indices(from) {
        let output = output.get_or_insert_with(|| String::with_capacity(text.len()));

        output.push_str(text.get(copied..index).unwrap_or_default());
        output.push_str(to);
        copied = index + from.len();
    }

    match output {
        None => Cow::Borrowed(text),
        Some(mut output) => {
            output.push_str(text.get(copied..).unwrap_or_default());
            Cow::Owned(output)
        }
    }
}

/// Matches `/@(?:name|…)\b/i`: an at-keyword followed by a character outside `\w`.
fn at_keyword(source: &str, names: &[&str]) -> bool {
    let bytes = source.as_bytes();

    memchr::memchr_iter(b'@', bytes).any(|at| {
        let rest = bytes.get(at + 1..).unwrap_or_default();

        names.iter().any(|name| {
            rest.get(..name.len())
                .is_some_and(|head| head.eq_ignore_ascii_case(name.as_bytes()))
                && !rest
                    .get(name.len())
                    .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
        })
    })
}

/// Extends a marker with `-x` until the source does not contain it.
fn unique(source: &str, base: &str) -> String {
    let mut marker = base.to_owned();

    while source.contains(&marker) {
        marker.push_str("-x");
    }

    marker
}

/// Counts a nine-digit base-36 suffix up until the lowercase source does not contain the marker.
fn numbered(lower: &str, prefix: &str) -> String {
    let mut suffix = 0;
    let mut marker = format!("{prefix}000000000");

    while lower.contains(&marker) {
        suffix += 1;
        marker = format!("{prefix}{:0>9}", js::radix(suffix, 36));
    }

    marker
}

/// Applies `/^(\s*@import\s+(?:url\()?"(?:\\.|[^"\\])*"\)?\s+)layer(?=[\s;])/gm`, replacing
/// the match with `$1layer(marker)`.
fn mark_imports<'s>(source: &'s str, marker: &str) -> Cow<'s, str> {
    let mut output: Option<String> = None;
    let mut copied = 0;
    let mut position = 0;

    loop {
        if let Some(end) = import_layer(source, position) {
            let output = output.get_or_insert_with(|| String::with_capacity(source.len() + 64));

            output.push_str(source.get(copied..end).unwrap_or_default());
            output.push('(');
            output.push_str(marker);
            output.push(')');
            copied = end;
            position = end;
        }

        let Some(next) = next_line(source, position) else {
            break;
        };

        position = next;
    }

    match output {
        None => Cow::Borrowed(source),
        Some(mut output) => {
            output.push_str(source.get(copied..).unwrap_or_default());
            Cow::Owned(output)
        }
    }
}

/// Returns the offset after the first line terminator at or after `from`.
fn next_line(source: &str, from: usize) -> Option<usize> {
    source
        .get(from..)?
        .char_indices()
        .find_map(|(offset, character)| {
            matches!(character, '\n' | '\r' | '\u{2028}' | '\u{2029}')
                .then(|| from + offset + character.len_utf8())
        })
}

/// Matches an anonymous layer import at a line start, returning the offset after `layer`.
fn import_layer(source: &str, start: usize) -> Option<usize> {
    let mut rest = source
        .get(start..)?
        .trim_start_matches(js::is_whitespace)
        .strip_prefix("@import")?;
    let spaced = rest.trim_start_matches(js::is_whitespace);

    if spaced.len() == rest.len() {
        return None;
    }

    rest = spaced;

    if rest.starts_with("url(\"") {
        rest = rest.get(4..)?;
    }

    rest = rest.strip_prefix('"')?;

    let mut characters = rest.char_indices();
    let close = loop {
        match characters.next()? {
            (offset, '"') => break offset,
            (_, '\\') => {
                let (_, escaped) = characters.next()?;

                if matches!(escaped, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
                    return None;
                }
            }
            _ => {}
        }
    };

    rest = rest.get(close + 1..)?;
    rest = rest.strip_prefix(')').unwrap_or(rest);

    let spaced = rest.trim_start_matches(js::is_whitespace);

    if spaced.len() == rest.len() {
        return None;
    }

    rest = spaced.strip_prefix("layer")?;

    rest.starts_with(|character: char| js::is_whitespace(character) || character == ';')
        .then(|| source.len() - rest.len())
}

/// Validates font-feature-values blocks, then the standard rule without newer `font-display`
/// descriptors, before transport shields them from the output parser.
fn validate_features(source: &str, lower: &str) -> Result<()> {
    const NAME: &[u8] = b"font-feature-values";

    if !lower.contains("@font-feature-values") {
        return Ok(());
    }

    let masked = mask(source);
    let starts: Vec<usize> = memchr::memchr_iter(b'@', &masked)
        .filter(|at| {
            masked
                .get(at + 1..at + 1 + NAME.len())
                .is_some_and(|name| name.eq_ignore_ascii_case(NAME))
                && character(source, &masked, at + 1 + NAME.len())
                    .is_some_and(|(next, _)| js::is_whitespace(next) || next == '{')
        })
        .collect();

    for start in starts {
        features(source, &masked, start)?;
    }

    Ok(())
}

/// Checks one font-feature-values block and validates it without `font-display` descriptors.
fn features(source: &str, masked: &[u8], start: usize) -> Result<()> {
    let invalid_block = || Error::message("Invalid font-feature-values block.");
    let invalid_display = || Error::message("Invalid font-display descriptor.");
    let find = |byte: u8, from: usize| {
        masked
            .get(from..)
            .and_then(|rest| memchr::memchr(byte, rest))
            .map(|offset| from + offset)
    };

    let open = find(b'{', start).ok_or_else(invalid_block)?;
    let mut depth = 1_i64;
    let mut end = open + 1;
    let mut plain = source.get(start..=open).unwrap_or_default().to_owned();
    let mut cursor = open + 1;

    while depth != 0
        && let Some(&byte) = masked.get(end)
    {
        match byte {
            b'{' => depth += 1,
            b'}' => depth -= 1,
            _ if depth == 1 && font_display(source, masked, end) => {
                let finish = find(b';', end);
                let close = find(b'}', end);
                let boundary = match (finish, close) {
                    (Some(finish), Some(close)) if finish < close => finish,
                    (_, Some(close)) => close,
                    (_, None) => return Err(invalid_display()),
                };
                let descriptor = source.get(end..boundary).unwrap_or_default();
                let value = descriptor.find(':').map_or(descriptor, |colon| {
                    descriptor.get(colon + 1..).unwrap_or_default()
                });
                let names = identifiers::list(value, Separator::Space);

                if !matches!(names.as_deref(), Some([name]) if ["auto", "block", "fallback", "optional", "swap"]
                    .contains(&name.to_ascii_lowercase().as_str()))
                {
                    return Err(invalid_display());
                }

                plain.push_str(source.get(cursor..end).unwrap_or_default());
                cursor = boundary + usize::from(finish == Some(boundary));
                end = cursor;
                continue;
            }
            _ => {}
        }

        end += 1;
    }

    if depth != 0 {
        return Err(invalid_block());
    }

    plain.push_str(source.get(cursor..end).unwrap_or_default());

    lightning::parse(&Options {
        code: &plain,
        filename: "font-feature-values.css",
        ..Options::default()
    })?;

    Ok(())
}

/// Matches `/^font-display\s*:/i` at a masked offset.
fn font_display(source: &str, masked: &[u8], start: usize) -> bool {
    const NAME: &[u8] = b"font-display";

    if !masked
        .get(start..start + NAME.len())
        .is_some_and(|name| name.eq_ignore_ascii_case(NAME))
    {
        return false;
    }

    let mut offset = start + NAME.len();

    while let Some((next, length)) = character(source, masked, offset) {
        if next == ':' {
            return true;
        }

        if !js::is_whitespace(next) {
            return false;
        }

        offset += length;
    }

    false
}

/// Reads the masked character at an offset: a space inside a masked span, otherwise the source
/// character.
fn character(source: &str, masked: &[u8], offset: usize) -> Option<(char, usize)> {
    if masked.get(offset)? != source.as_bytes().get(offset)? {
        return Some((' ', 1));
    }

    let next = source.get(offset..)?.chars().next()?;

    Some((next, next.len_utf8()))
}

/// Replaces strings and comments with spaces of equal byte length, like replacing
/// `/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\//g` matches with spaces.
fn mask(source: &str) -> Vec<u8> {
    let bytes = source.as_bytes();
    let mut masked = bytes.to_vec();
    let mut index = 0;

    while let Some(&byte) = bytes.get(index) {
        let end = match byte {
            b'"' | b'\'' => quoted(source, index, char::from(byte)),
            b'/' if bytes.get(index + 1) == Some(&b'*') => bytes
                .get(index + 2..)
                .and_then(|rest| memchr::memmem::find(rest, b"*/"))
                .map(|end| index + end + 4),
            _ => None,
        };

        match end.and_then(|end| masked.get_mut(index..end).map(|span| (span, end))) {
            Some((span, end)) => {
                span.fill(b' ');
                index = end;
            }
            None => index += 1,
        }
    }

    masked
}

/// Returns the offset after a terminated string starting at `start`, where an escape may not
/// precede a line terminator.
fn quoted(source: &str, start: usize, quote: char) -> Option<usize> {
    let mut characters = source.get(start + 1..)?.char_indices();

    loop {
        match characters.next()? {
            (offset, character) if character == quote => return Some(start + 2 + offset),
            (_, '\\') => {
                let (_, escaped) = characters.next()?;

                if matches!(escaped, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
                    return None;
                }
            }
            _ => {}
        }
    }
}
