//! Resolves relative imports within a closed set of supplied source modules.
//!
//! Callers without a build host supply every module up front. Build adapters supply their own
//! edges instead, so no filesystem or package lookup happens here.

use crate::error::{Error, Result};

const EXTENSIONS: [&str; 12] = [
    ".cjs", ".cjsx", ".cts", ".ctsx", ".js", ".jsx", ".mjs", ".mjsx", ".mts", ".mtsx", ".ts",
    ".tsx",
];

/// Matches `/\.[cm]?[jt]sx?$/`.
fn script(path: &str) -> bool {
    let Some(index) = path.rfind('.') else {
        return false;
    };
    let extension = &path[index + 1..];
    let extension = extension.strip_prefix(['c', 'm']).unwrap_or(extension);
    let extension = extension.strip_suffix('x').unwrap_or(extension);

    extension == "js" || extension == "ts"
}

/// Matches `/\.[a-z0-9]+$/i`.
fn extension(path: &str) -> bool {
    path.rfind('.').is_some_and(|index| {
        let extension = &path[index + 1..];

        !extension.is_empty() && extension.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}

/// Matches `/\.[cm]?jsx?$/`.
fn javascript(path: &str) -> bool {
    script(path)
        && path
            .rfind('.')
            .is_some_and(|index| path[index..].contains('j'))
}

/// Matches `/\.[^/]+$/`: a dot in the last segment with at least one character after it.
fn named(path: &str) -> bool {
    let segment = path.rsplit('/').next().unwrap_or(path);

    segment
        .char_indices()
        .any(|(index, character)| character == '.' && index + 1 < segment.len())
}

fn replace_suffix(path: &str, from: &str, to: &str) -> String {
    path.strip_suffix(from)
        .map_or_else(|| path.to_owned(), |stem| format!("{stem}{to}"))
}

/// Resolves a relative specifier against the importing module, or `None` for bare specifiers
/// and non-script files.
///
/// `has` reports whether a module identity was supplied.
///
/// # Errors
///
/// Returns the TypeScript messages for imports that escape the graph, match no supplied module,
/// or match several.
pub fn resolve(
    module_id: &str,
    specifier: &str,
    has: impl Fn(&str) -> bool,
) -> Result<Option<String>> {
    if !specifier.starts_with('.') {
        return Ok(None);
    }

    if extension(specifier) && !script(specifier) {
        return Ok(None);
    }

    let mut parts: Vec<&str> = module_id.split('/').collect();

    parts.pop();

    for part in specifier.split('/') {
        if part == "." || part.is_empty() {
            continue;
        }

        if part == ".." {
            if parts.pop().is_none() {
                return Err(Error::Message(
                    "Source import escapes the supplied graph.".to_owned(),
                ));
            }
        } else {
            parts.push(part);
        }
    }

    let path = parts.join("/");

    if has(&path) {
        return Ok(Some(path));
    }

    let candidates: Vec<String> = if javascript(&path) {
        vec![
            replace_suffix(&path, ".js", ".ts"),
            replace_suffix(&path, ".js", ".tsx"),
            replace_suffix(&path, ".jsx", ".tsx"),
            replace_suffix(&path, ".mjs", ".mts"),
            replace_suffix(&path, ".cjs", ".cts"),
        ]
    } else if named(&path) {
        Vec::new()
    } else {
        EXTENSIONS
            .iter()
            .flat_map(|extension| {
                [
                    format!("{path}{extension}"),
                    format!("{path}/index{extension}"),
                ]
            })
            .collect()
    };
    let mut matches: Vec<String> = Vec::new();

    for candidate in candidates {
        if !matches.contains(&candidate) && has(&candidate) {
            matches.push(candidate);
        }
    }

    match matches.len() {
        1 => Ok(matches.pop()),
        0 => Err(Error::Message(format!(
            "Missing source module: {specifier}"
        ))),
        _ => Err(Error::Message(format!(
            "Ambiguous source import: {specifier}"
        ))),
    }
}
