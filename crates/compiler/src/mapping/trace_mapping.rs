//! Queries existing source maps, mirroring the subset of `@jridgewell/trace-mapping` 0.3 the
//! compiler uses: construction from an encoded map or JSON, `eachMapping`, and
//! `originalPositionFor` with its default greatest-lower-bound bias.
//!
//! Sources resolve like `@jridgewell/resolve-uri` 3.1 against an empty map URL, so relative paths
//! are normalized exactly as the JavaScript library returns them. A segment whose source or name
//! index is out of range reads `None`, where JavaScript reads `undefined`. Only malformed maps
//! carry such indexes.

use serde_json::Value as Json;

use crate::error::{Error, Result};
use crate::mapping::codec::{self, Mappings};
use crate::mapping::gen_mapping::EncodedSourceMap;

/// A decoded source map ready for queries.
#[derive(Clone, Debug)]
pub struct TraceMap {
    decoded: Mappings,
    /// Generated file name.
    pub file: Option<String>,
    /// Original binding names.
    pub names: Vec<String>,
    /// Sources resolved against the source root.
    pub resolved_sources: Vec<String>,
    /// Source contents.
    pub sources_content: Option<Vec<Option<String>>>,
}

/// One decoded mapping, as `eachMapping` reports it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MappingItem<'a> {
    /// Zero-based generated column.
    pub generated_column: i64,
    /// One-based generated line.
    pub generated_line: i64,
    /// Original name, when the segment has one.
    pub name: Option<&'a str>,
    /// Zero-based original column.
    pub original_column: Option<i64>,
    /// One-based original line.
    pub original_line: Option<i64>,
    /// Resolved source.
    pub source: Option<&'a str>,
}

/// The original position of a generated position, as `originalPositionFor` returns it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OriginalPosition<'a> {
    /// Zero-based original column.
    pub column: Option<i64>,
    /// One-based original line.
    pub line: Option<i64>,
    /// Original name.
    pub name: Option<&'a str>,
    /// Resolved source.
    pub source: Option<&'a str>,
}

impl TraceMap {
    /// Decodes an encoded map.
    pub fn new(map: &EncodedSourceMap) -> Self {
        let prefix = map
            .source_root
            .as_deref()
            .filter(|root| !root.is_empty())
            .map(|root| format!("{root}/"))
            .unwrap_or_default();

        Self {
            decoded: codec::decode(&map.mappings),
            file: map.file.clone(),
            names: map.names.clone(),
            resolved_sources: map
                .sources
                .iter()
                .map(|source| resolve(&format!("{prefix}{}", source.as_deref().unwrap_or("")), ""))
                .collect(),
            sources_content: map.sources_content.clone(),
        }
    }

    /// Parses a JSON source map, as `new TraceMap(json)` does.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid JSON or a map without string `mappings` and a `sources` list.
    pub fn from_json(json: &str) -> Result<Self> {
        let value: Json = serde_json::from_str(json).map_err(|error| {
            Error::Syntax(crate::js::json_error(json).unwrap_or_else(|| error.to_string()))
        })?;
        let strings = |key: &str| -> Option<Vec<Option<String>>> {
            value.get(key)?.as_array().map(|items| {
                items
                    .iter()
                    .map(|item| item.as_str().map(str::to_owned))
                    .collect()
            })
        };
        let Some(mappings) = value.get("mappings").and_then(Json::as_str) else {
            return Err(Error::Message(format!("invalid source map: {value}")));
        };
        let Some(sources) = strings("sources") else {
            return Err(Error::Message(format!("invalid source map: {value}")));
        };

        Ok(Self::new(&EncodedSourceMap {
            file: value.get("file").and_then(Json::as_str).map(str::to_owned),
            ignore_list: None,
            mappings: mappings.to_owned(),
            names: strings("names")
                .unwrap_or_default()
                .into_iter()
                .map(Option::unwrap_or_default)
                .collect(),
            source_root: value
                .get("sourceRoot")
                .and_then(Json::as_str)
                .map(str::to_owned),
            sources,
            sources_content: strings("sourcesContent"),
        }))
    }

    /// Iterates every segment in generated order.
    pub fn mappings(&self) -> impl Iterator<Item = MappingItem<'_>> {
        self.decoded
            .iter()
            .enumerate()
            .flat_map(move |(line, segments)| {
                segments.iter().map(move |segment| {
                    let original = segment.original;

                    MappingItem {
                        generated_column: segment.column,
                        generated_line: i64::try_from(line).unwrap_or(i64::MAX) + 1,
                        name: original
                            .and_then(|original| original.name)
                            .and_then(|index| self.name(index)),
                        original_column: original.map(|original| original.column),
                        original_line: original.map(|original| original.line + 1),
                        source: original.and_then(|original| self.source(original.source)),
                    }
                })
            })
    }

    /// Finds the original position of a one-based line and zero-based column, choosing the
    /// closest segment at or before the column.
    ///
    /// # Errors
    ///
    /// Returns trace-mapping's message for a line below one or a negative column.
    pub fn original_position_for(&self, line: i64, column: i64) -> Result<OriginalPosition<'_>> {
        const NONE: OriginalPosition<'static> = OriginalPosition {
            column: None,
            line: None,
            name: None,
            source: None,
        };

        let line = line - 1;

        if line < 0 {
            return Err(Error::message(
                "`line` must be greater than 0 (lines start at line 1)",
            ));
        }

        if column < 0 {
            return Err(Error::message(
                "`column` must be greater than or equal to 0 (columns start at column 0)",
            ));
        }

        let Some(segments) = usize::try_from(line)
            .ok()
            .and_then(|line| self.decoded.get(line))
        else {
            return Ok(NONE);
        };
        // The first segment at the column, or else the last one before it.
        let index = match segments.partition_point(|segment| segment.column < column) {
            index
                if segments
                    .get(index)
                    .is_some_and(|segment| segment.column == column) =>
            {
                index
            }
            0 => return Ok(NONE),
            index => index - 1,
        };
        let Some(original) = segments.get(index).and_then(|segment| segment.original) else {
            return Ok(NONE);
        };

        Ok(OriginalPosition {
            column: Some(original.column),
            line: Some(original.line + 1),
            name: original.name.and_then(|index| self.name(index)),
            source: self.source(original.source),
        })
    }

    fn name(&self, index: i64) -> Option<&str> {
        usize::try_from(index)
            .ok()
            .and_then(|index| self.names.get(index))
            .map(String::as_str)
    }

    fn source(&self, index: i64) -> Option<&str> {
        usize::try_from(index)
            .ok()
            .and_then(|index| self.resolved_sources.get(index))
            .map(String::as_str)
    }
}

/// URL kinds in resolve-uri's precedence order.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
enum Kind {
    Empty = 1,
    Hash = 2,
    Query = 3,
    Relative = 4,
    AbsolutePath = 5,
    SchemeRelative = 6,
    Absolute = 7,
}

#[derive(Clone, Debug)]
struct Url {
    hash: String,
    host: String,
    kind: Kind,
    path: String,
    port: String,
    query: String,
    scheme: String,
    user: String,
}

/// Resolves `input` against `base`, as `@jridgewell/resolve-uri` does.
pub fn resolve(input: &str, base: &str) -> String {
    if input.is_empty() && base.is_empty() {
        return String::new();
    }

    let mut url = parse(input);
    let mut kind = url.kind;

    if !base.is_empty() && kind != Kind::Absolute {
        let base_url = parse(base);

        if kind <= Kind::Empty {
            url.hash.clone_from(&base_url.hash);
        }

        if kind <= Kind::Hash {
            url.query.clone_from(&base_url.query);
        }

        if kind <= Kind::Relative {
            merge(&mut url, &base_url);
        }

        if kind <= Kind::AbsolutePath {
            url.user.clone_from(&base_url.user);
            url.host.clone_from(&base_url.host);
            url.port.clone_from(&base_url.port);
        }

        if kind <= Kind::SchemeRelative {
            url.scheme.clone_from(&base_url.scheme);
        }

        kind = kind.max(base_url.kind);
    }

    normalize(&mut url, kind);

    let query_hash = format!("{}{}", url.query, url.hash);

    match kind {
        Kind::Empty | Kind::Hash | Kind::Query => query_hash,
        Kind::Relative => {
            let path = url.path.get(1..).unwrap_or_default();

            if path.is_empty() {
                return if query_hash.is_empty() {
                    ".".to_owned()
                } else {
                    query_hash
                };
            }

            let reference = if base.is_empty() { input } else { base };

            if relative(reference) && !relative(path) {
                return format!("./{path}{query_hash}");
            }

            format!("{path}{query_hash}")
        }
        Kind::AbsolutePath => format!("{}{query_hash}", url.path),
        Kind::SchemeRelative | Kind::Absolute => format!(
            "{}//{}{}{}{}{query_hash}",
            url.scheme, url.user, url.host, url.port, url.path
        ),
    }
}

/// Matches `^[.?#]`.
fn relative(input: &str) -> bool {
    input.starts_with(['.', '?', '#'])
}

/// Matches `^[\w+.-]+:\/\/`.
fn absolute(input: &str) -> bool {
    let scheme = scheme_length(input);

    scheme > 0
        && input
            .get(scheme..)
            .is_some_and(|rest| rest.starts_with("://"))
}

/// Measures `[\w+.-]+`.
fn scheme_length(input: &str) -> usize {
    input
        .bytes()
        .take_while(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'+' | b'.' | b'-')
        })
        .count()
}

fn parse(input: &str) -> Url {
    if input.starts_with("//") {
        let mut url = parse_absolute(&format!("http:{input}"));

        url.scheme.clear();
        url.kind = Kind::SchemeRelative;
        return url;
    }

    if input.starts_with('/') {
        let mut url = parse_absolute(&format!("http://foo.com{input}"));

        url.scheme.clear();
        url.host.clear();
        url.kind = Kind::AbsolutePath;
        return url;
    }

    if input.starts_with("file:") {
        return parse_file(input);
    }

    if absolute(input) {
        return parse_absolute(input);
    }

    let mut url = parse_absolute(&format!("http://foo.com/{input}"));

    url.scheme.clear();
    url.host.clear();
    url.kind = if input.is_empty() {
        Kind::Empty
    } else if input.starts_with('?') {
        Kind::Query
    } else if input.starts_with('#') {
        Kind::Hash
    } else {
        Kind::Relative
    };
    url
}

/// Matches `^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?`.
fn parse_absolute(input: &str) -> Url {
    let scheme_end = scheme_length(input) + 1;
    let scheme = input.get(..scheme_end).unwrap_or_default().to_owned();
    let mut rest = input.get(scheme_end + 2..).unwrap_or_default();
    let user_length = rest
        .find(['@', '/', '#', '?'])
        .filter(|index| rest.as_bytes().get(*index) == Some(&b'@'))
        .map(|index| index + 1);
    let user = match user_length {
        Some(length) => {
            let user = rest.get(..length).unwrap_or_default().to_owned();

            rest = rest.get(length..).unwrap_or_default();
            user
        }
        None => String::new(),
    };
    let host_length = rest.find([':', '/', '#', '?']).unwrap_or(rest.len());
    let host = rest.get(..host_length).unwrap_or_default().to_owned();

    rest = rest.get(host_length..).unwrap_or_default();

    let digits = rest
        .strip_prefix(':')
        .map(|digits| digits.bytes().take_while(u8::is_ascii_digit).count())
        .filter(|count| *count > 0);
    let port = match digits {
        Some(count) => {
            let port = rest.get(..=count).unwrap_or_default().to_owned();

            rest = rest.get(count + 1..).unwrap_or_default();
            port
        }
        None => String::new(),
    };
    let path = if rest.starts_with('/') {
        let length = rest.find(['#', '?']).unwrap_or(rest.len());
        let path = rest.get(..length).unwrap_or_default().to_owned();

        rest = rest.get(length..).unwrap_or_default();
        path
    } else {
        "/".to_owned()
    };
    let query = if rest.starts_with('?') {
        let length = rest.find('#').unwrap_or(rest.len());
        let query = rest.get(..length).unwrap_or_default().to_owned();

        rest = rest.get(length..).unwrap_or_default();
        query
    } else {
        String::new()
    };
    // `.` stops at line terminators.
    let hash = if rest.starts_with('#') {
        let length = rest
            .find(['\n', '\r', '\u{2028}', '\u{2029}'])
            .unwrap_or(rest.len());

        rest.get(..length).unwrap_or_default().to_owned()
    } else {
        String::new()
    };

    Url {
        hash,
        host,
        kind: Kind::Absolute,
        path,
        port,
        query,
        scheme,
        user,
    }
}

/// Matches `^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?` case-insensitively.
fn parse_file(input: &str) -> Url {
    let mut rest = input.get(5..).unwrap_or_default();
    let mut host = String::new();

    if let Some(after) = rest.strip_prefix("//") {
        let bytes = after.as_bytes();
        let drive =
            bytes.first().is_some_and(u8::is_ascii_alphabetic) && bytes.get(1) == Some(&b':');

        if drive {
            rest = after;
        } else {
            let length = after.find(['/', '#', '?']).unwrap_or(after.len());

            after
                .get(..length)
                .unwrap_or_default()
                .clone_into(&mut host);
            rest = after.get(length..).unwrap_or_default();
        }
    }

    let path_length = rest.find(['#', '?']).unwrap_or(rest.len());
    let path = rest.get(..path_length).unwrap_or_default();

    rest = rest.get(path_length..).unwrap_or_default();

    let query = if rest.starts_with('?') {
        let length = rest.find('#').unwrap_or(rest.len());
        let query = rest.get(..length).unwrap_or_default().to_owned();

        rest = rest.get(length..).unwrap_or_default();
        query
    } else {
        String::new()
    };
    let hash = if rest.starts_with('#') {
        let length = rest
            .find(['\n', '\r', '\u{2028}', '\u{2029}'])
            .unwrap_or(rest.len());

        rest.get(..length).unwrap_or_default().to_owned()
    } else {
        String::new()
    };

    Url {
        hash,
        host,
        kind: Kind::Absolute,
        path: if path.starts_with('/') {
            path.to_owned()
        } else {
            format!("/{path}")
        },
        port: String::new(),
        query,
        scheme: "file:".to_owned(),
        user: String::new(),
    }
}

fn merge(url: &mut Url, base: &Url) {
    let mut base = base.clone();
    let kind = base.kind;

    normalize(&mut base, kind);

    if url.path == "/" {
        url.path = base.path;
    } else {
        // Resolution happens relative to the base path's directory.
        let directory = if base.path.ends_with("/..") {
            base.path.as_str()
        } else {
            base.path
                .get(..base.path.rfind('/').map_or(0, |index| index + 1))
                .unwrap_or_default()
        };

        url.path = format!("{directory}{}", url.path);
    }
}

/// Removes empty, current, and parent directories, keeping excess parents of relative paths.
fn normalize(url: &mut Url, kind: Kind) {
    let relative = kind <= Kind::Relative;
    let mut pieces: Vec<&str> = Vec::new();
    let mut positive = 0_usize;
    let mut trailing = false;

    for piece in url.path.split('/').skip(1) {
        if piece.is_empty() {
            trailing = true;
            continue;
        }

        trailing = false;

        if piece == "." {
            continue;
        }

        if piece == ".." {
            if positive > 0 {
                trailing = true;
                positive -= 1;
                pieces.pop();
            } else if relative {
                pieces.push(piece);
            }

            continue;
        }

        pieces.push(piece);
        positive += 1;
    }

    let mut path = String::new();

    for piece in &pieces {
        path.push('/');
        path.push_str(piece);
    }

    if path.is_empty() || (trailing && !path.ends_with("/..")) {
        path.push('/');
    }

    url.path = path;
}
