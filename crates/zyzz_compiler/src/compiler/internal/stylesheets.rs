//! Carries source-owned stylesheet sections across packed boundaries and rebases their assets.

use std::sync::Arc;

use rustc_hash::FxHashMap;

use crate::data::Data;
use crate::error::{Error, Result};
use crate::mapping::gen_mapping::EncodedSourceMap;
use crate::web::internal::contributions;
use crate::web::internal::namespace;

/// Ordered CSS owned by one portable source module.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Section {
    /// Whether `namespaces` holds extracted `@namespace` contributions, which serialize with
    /// their contribution `kind` first.
    pub authored_namespaces: bool,
    /// Original source text, for source maps.
    pub content: Option<Arc<str>>,
    /// Ordered emitted CSS before host asset relocation.
    pub css: Arc<str>,
    /// Import chain to the declaring contract when repacked through dependencies.
    pub dependency: Option<Vec<Arc<str>>>,
    /// Stable contribution identity within its source module.
    pub key: Option<Arc<str>>,
    /// Authored layer-order constraints retained across packages.
    pub layers: Vec<Vec<Arc<str>>>,
    /// Isolated selector namespaces of the source owner.
    pub namespaces: Option<Vec<namespace::Definition>>,
    /// Trusted graph owner. Reading external metadata ignores it.
    pub owner: Option<Arc<str>>,
    /// Portable identity of the contributing source module.
    pub source: Arc<str>,
    /// UTF-16 start offset of the contribution in the original source text.
    pub start: Option<u32>,
}

/// Resolves a relative path within a portable graph, keeping query and hash suffixes.
///
/// # Errors
///
/// Returns the TypeScript message when the path escapes the graph.
pub fn resolve(source: &str, reference: &str) -> Result<String> {
    let suffix_start = reference.find(['?', '#']);
    let (pathname, suffix) =
        suffix_start.map_or((reference, ""), |start| reference.split_at(start));
    let mut parts: Vec<&str> = source.split('/').collect();

    parts.pop();

    for part in pathname.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            if parts.pop().is_none() {
                return Err(Error::Message(
                    "Asset path escapes the supplied graph.".to_owned(),
                ));
            }
        } else {
            parts.push(part);
        }
    }

    Ok(parts.join("/") + suffix)
}

/// Makes a module location relative to another module, for relocation within a package.
pub fn relative(owner: &str, source: &str) -> String {
    let mut from: Vec<&str> = owner.split('/').collect();

    from.pop();

    let to: Vec<&str> = source.split('/').collect();
    let shared = from
        .iter()
        .zip(&to)
        .take_while(|(left, right)| left == right)
        .count();
    let mut parts: Vec<&str> = from
        .get(shared..)
        .unwrap_or_default()
        .iter()
        .map(|_| "..")
        .collect();

    parts.extend(to.get(shared..).unwrap_or_default());
    parts.join("/")
}

fn invalid_section() -> Error {
    Error::Message("Invalid packed stylesheet section.".to_owned())
}

/// A safe nonnegative integer offset.
#[expect(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "The value is checked to be a nonnegative integer within u32 range."
)]
fn offset(value: f64) -> Option<u32> {
    (value.fract() == 0.0 && (0.0..=f64::from(u32::MAX)).contains(&value)).then_some(value as u32)
}

fn strings(value: &Data) -> Option<Vec<Arc<str>>> {
    let Data::Array(items) = value else {
        return None;
    };

    items
        .iter()
        .map(|item| item.as_str().map(Arc::from))
        .collect()
}

/// Reads namespace metadata at the packed-library boundary.
///
/// `identifier` decodes a CSS identifier, returning `None` when it is invalid.
///
/// # Errors
///
/// Returns the TypeScript messages for malformed namespace entries.
pub fn namespaces(
    value: &Data,
    identifier: &dyn Fn(&str) -> Option<String>,
) -> Result<Vec<namespace::Definition>> {
    let invalid = || Error::Message("Invalid packed namespace.".to_owned());

    if value.is_undefined() {
        return Ok(Vec::new());
    }

    let Data::Array(entries) = value else {
        return Err(Error::Message("Invalid packed namespaces.".to_owned()));
    };

    entries
        .iter()
        .map(|entry| {
            let Data::Object(entry) = entry else {
                return Err(invalid());
            };
            let field = |key: &str| entry.get(key).cloned().unwrap_or(Data::Undefined);
            let (name, prefix, uri) = (field("name"), field("prefix"), field("uri"));
            let valid_name = name.as_str().is_some_and(|name| {
                name.strip_prefix("z-n").is_some_and(|rest| {
                    !rest.is_empty()
                        && rest.bytes().all(|byte| {
                            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'
                        })
                })
            });
            let valid_prefix = match &prefix {
                Data::Undefined => true,
                Data::String(prefix) => identifier(prefix).is_some(),
                _ => false,
            };
            let (true, true, Some(name), Some(uri)) =
                (valid_name, valid_prefix, name.as_str(), uri.as_str())
            else {
                return Err(invalid());
            };

            Ok(namespace::Definition {
                name: Arc::from(name),
                prefix: prefix.as_str().map(Arc::from),
                uri: Arc::from(uri),
            })
        })
        .collect()
}

/// Reads packed sections as validated data.
///
/// `validate` parses a section's CSS, as `AtRules.transform` does before emission, and
/// `identifier` decodes namespace prefixes.
///
/// # Errors
///
/// Returns the TypeScript messages for malformed sections, conflicting source content, invalid
/// CSS, and unsatisfiable layer orders.
pub fn read(
    value: &Data,
    validate: &dyn Fn(&str, &str) -> Result<()>,
    identifier: &dyn Fn(&str) -> Option<String>,
) -> Result<Vec<Section>> {
    if value.is_undefined() {
        return Ok(Vec::new());
    }

    let Data::Array(items) = value else {
        return Err(Error::Message(
            "Invalid packed stylesheet sections.".to_owned(),
        ));
    };
    let mut contents: FxHashMap<Arc<str>, Arc<str>> = FxHashMap::default();
    let mut sections = Vec::with_capacity(items.len());

    for item in items.iter() {
        let Data::Object(section) = item else {
            return Err(invalid_section());
        };
        let field = |key: &str| section.get(key).cloned().unwrap_or(Data::Undefined);
        let (Some(source), Some(css)) = (
            field("source").as_str().map(Arc::from),
            field("css").as_str().map(Arc::<str>::from),
        ) else {
            return Err(invalid_section());
        };
        let content = match field("content") {
            Data::Undefined => None,
            Data::String(content) => Some(content),
            _ => return Err(invalid_section()),
        };
        let start = match field("start") {
            Data::Undefined => None,
            Data::Number(start) => Some(offset(start).ok_or_else(invalid_section)?),
            _ => return Err(invalid_section()),
        };
        let key = match field("key") {
            Data::Undefined => None,
            Data::String(key) => Some(key),
            _ => return Err(invalid_section()),
        };
        let dependency = match field("dependency") {
            Data::Undefined => None,
            value => match strings(&value) {
                Some(chain)
                    if !chain.is_empty()
                        && chain.iter().all(|specifier| {
                            !specifier.is_empty() && !specifier.contains('\0')
                        }) =>
                {
                    Some(chain)
                }
                _ => return Err(invalid_section()),
            },
        };
        let Data::Array(layers) = field("layers") else {
            return Err(invalid_section());
        };
        let layers: Vec<Vec<Arc<str>>> = layers
            .iter()
            .map(strings)
            .collect::<Option<_>>()
            .ok_or_else(invalid_section)?;

        if let Some(content) = &content {
            if let Some(existing) = contents.get(&source)
                && existing != content
            {
                return Err(Error::Message(
                    "Conflicting packed source content.".to_owned(),
                ));
            }

            contents.insert(Arc::clone(&source), Arc::clone(content));
        }

        if !css.is_empty() {
            validate(&source, &css)?;
        }

        let namespaces = match field("namespaces") {
            Data::Undefined => None,
            value => Some(namespaces(&value, identifier)?),
        };

        sections.push(Section {
            authored_namespaces: false,
            content,
            css,
            dependency,
            key,
            layers,
            namespaces,
            owner: None,
            source,
            start,
        });
    }

    let lists: Vec<&[Arc<str>]> = sections
        .iter()
        .flat_map(|section| section.layers.iter().map(Vec::as_slice))
        .collect();

    contributions::order(&lists).map_err(Error::Message)?;

    for section in &mut sections {
        if let Some(content) = contents.get(&section.source) {
            section.content = Some(Arc::clone(content));
        }
    }

    Ok(sections)
}

/// Serializes source text once per packed source identity.
pub fn write(sections: &[Section]) -> Vec<Section> {
    let mut sources: Vec<&str> = Vec::new();

    sections
        .iter()
        .map(|section| {
            let mut copy = section.clone();

            if section.content.is_some() && !sources.contains(&&*section.source) {
                sources.push(&section.source);
            } else {
                copy.content = None;
            }

            copy
        })
        .collect()
}

/// Combined reachable sections with their layer order, source map, and relocated assets.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Rendered {
    /// Portable asset targets keyed by emitted placeholders.
    pub assets: Vec<(String, String)>,
    /// Combined stylesheet text.
    pub css: String,
    /// Source map of the combined stylesheet.
    pub map: EncodedSourceMap,
    /// Trusted owner of each asset placeholder.
    pub owners: Vec<(String, String)>,
}

/// Combines reachable sections, layer constraints, source maps, and asset identities.
///
/// # Errors
///
/// Returns [`Error::Conflict`] for contributions that disagree, and CSS parse failures.
// Placeholder until the at-rule port lands. Sections without CSS still order their layers.
pub fn render(sections: &[Section]) -> Result<Rendered> {
    if sections.iter().any(|section| !section.css.is_empty()) {
        return Err(Error::Message(
            "Stylesheet rendering is not available in this build.".to_owned(),
        ));
    }

    let lists: Vec<&[Arc<str>]> = sections
        .iter()
        .flat_map(|section| section.layers.iter().map(Vec::as_slice))
        .collect();
    let layers = contributions::order(&lists).map_err(Error::Message)?;

    Ok(Rendered {
        css: if layers.is_empty() {
            String::new()
        } else {
            format!("@layer {};", layers.join(","))
        },
        ..Rendered::default()
    })
}
