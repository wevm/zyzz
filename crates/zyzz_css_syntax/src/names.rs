//! Keyword and property name analysis, following css-tree's `names` utilities.

use std::borrow::Cow;

use crate::js;

/// A keyword split into its vendor prefix and base name, like css-tree's `keyword()`.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Keyword<'a> {
    /// Lowercase name without the vendor prefix.
    pub basename: Cow<'a, str>,
    /// Whether the name starts with `--`.
    pub custom: bool,
    /// Lowercase name.
    pub name: Cow<'a, str>,
    /// Vendor prefix including both hyphens, such as `-webkit-`, or empty.
    pub vendor: Cow<'a, str>,
}

/// A property name split into hack, vendor prefix, and base name, like css-tree's
/// `property()`.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Property<'a> {
    /// Name without the hack and vendor prefix.
    pub basename: Cow<'a, str>,
    /// Whether the name, after any hack, starts with `--`.
    pub custom: bool,
    /// Leading browser hack such as `*` or `_`, or empty.
    pub hack: &'static str,
    /// Name without the hack, lowercased unless custom.
    pub name: Cow<'a, str>,
    /// Vendor prefix including both hyphens, or empty.
    pub vendor: Cow<'a, str>,
}

/// Reports whether `value[offset..]` starts with `--` and has at least two code units.
pub fn is_custom_property(value: &str, offset: usize) -> bool {
    value.as_bytes().get(offset..offset + 2) == Some(b"--")
}

/// Returns the vendor prefix of `value[offset..]`, such as `-moz-`, or an empty string.
pub fn vendor_prefix(value: &str, offset: usize) -> &str {
    let bytes = value.as_bytes();

    if js::utf16_length(value.get(offset..).unwrap_or_default()) >= 3
        && bytes.get(offset) == Some(&b'-')
        && bytes.get(offset + 1) != Some(&b'-')
        && let Some(found) = bytes
            .get(offset + 2..)
            .and_then(|rest| rest.iter().position(|byte| *byte == b'-'))
    {
        return value
            .get(offset..offset + 2 + found + 1)
            .unwrap_or_default();
    }

    ""
}

/// Splits a keyword into vendor prefix and base name after lowercasing it.
pub fn keyword(value: &str) -> Keyword<'_> {
    let name = js::to_lower_case(value);
    let custom = is_custom_property(&name, 0);
    let vendor_length = if custom {
        0
    } else {
        vendor_prefix(&name, 0).len()
    };
    let (vendor, basename) = split(&name, vendor_length);

    Keyword {
        basename,
        custom,
        name: name.clone(),
        vendor,
    }
}

/// Splits a property name into hack, vendor prefix, and base name.
pub fn property(value: &str) -> Property<'_> {
    let bytes = value.as_bytes();
    let hack: &'static str = match bytes.first() {
        Some(b'/') => {
            if bytes.get(1) == Some(&b'/') {
                "//"
            } else {
                "/"
            }
        }
        Some(b'_') => "_",
        Some(b'*') => "*",
        Some(b'$') => "$",
        Some(b'#') => "#",
        Some(b'+') => "+",
        Some(b'&') => "&",
        _ => "",
    };
    let custom = is_custom_property(value, hack.len());
    let lowered = if custom {
        Cow::Borrowed(value)
    } else {
        js::to_lower_case(value)
    };
    let vendor_length = if custom {
        0
    } else {
        vendor_prefix(&lowered, hack.len()).len()
    };
    let name = slice_cow(&lowered, hack.len());
    let (vendor, basename) = split(&name, vendor_length);

    Property {
        basename,
        custom,
        hack,
        name,
        vendor,
    }
}

/// Splits a possibly owned string at a byte offset into two possibly owned halves.
fn split<'a>(value: &Cow<'a, str>, at: usize) -> (Cow<'a, str>, Cow<'a, str>) {
    match value {
        Cow::Borrowed(text) => (
            Cow::Borrowed(text.get(..at).unwrap_or_default()),
            Cow::Borrowed(text.get(at..).unwrap_or_default()),
        ),
        Cow::Owned(text) => (
            Cow::Owned(text.get(..at).unwrap_or_default().to_owned()),
            Cow::Owned(text.get(at..).unwrap_or_default().to_owned()),
        ),
    }
}

/// Returns the suffix of a possibly owned string from a byte offset.
fn slice_cow<'a>(value: &Cow<'a, str>, from: usize) -> Cow<'a, str> {
    match value {
        Cow::Borrowed(text) => Cow::Borrowed(text.get(from..).unwrap_or_default()),
        Cow::Owned(text) => Cow::Owned(text.get(from..).unwrap_or_default().to_owned()),
    }
}
