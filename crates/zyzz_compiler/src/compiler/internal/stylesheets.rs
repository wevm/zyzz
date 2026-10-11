//! Carries source-owned stylesheet sections across packed boundaries and rebases their assets.

use std::fmt::Write as _;
use std::sync::Arc;

use lightningcss::properties::custom::{Token, TokenOrValue};
use lightningcss::rules::CssRule;
use lightningcss::rules::keyframes::KeyframesName;
use lightningcss::values::url::Url;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};
use rustc_hash::FxHashMap;

use crate::compiler::internal::lightning::Options;
use crate::compiler::internal::{at_rules, namespaces};
use crate::data::Data;
use crate::error::{Error, Result};
use crate::js::{self, Record};
use crate::mapping::gen_mapping::{EncodedSourceMap, GenMapping, Mapping, Position};
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

/// Combined stylesheet output of reachable sections.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Rendered {
    /// Relocated asset targets keyed by `zyzz-asset:` placeholder, in first-use order.
    pub assets: Record<String>,
    /// Combined CSS: the layer order statement, then each section in import, namespace, and
    /// rule rank order.
    pub css: String,
    /// Line-level map from each section's output to its contribution in source text.
    pub map: EncodedSourceMap,
    /// Owning contract or source of each asset placeholder.
    pub owners: Record<String>,
}

/// Combines reachable sections, layer constraints, source maps, and asset identities.
///
/// Duplicate sections with one source and key collapse. Namespaces and relative assets are
/// rewritten per section, and named rules (counter styles, position fallbacks, palettes, color
/// profiles, functions, custom media, and keyframes) must agree across sources.
///
/// # Errors
///
/// Returns [`Error::StylesheetConflict`] for conflicting sections, namespace URIs, or rule
/// identities, and the at-rule transport's, layer order's, or asset resolution's messages.
pub fn render(sections: &[Section]) -> Result<Rendered> {
    let mut seen: Vec<((&str, Option<&str>), Signature<'_>)> = Vec::new();
    let mut ordered: Vec<&Section> = Vec::new();

    for section in sections {
        let identity = (&*section.source, section.key.as_deref());
        let signature = Signature::of(section);

        match seen.iter().find(|(prior, _)| *prior == identity) {
            Some((_, prior)) if *prior != signature => {
                return Err(conflict(
                    section,
                    "Conflicting packed stylesheet contributions.",
                ));
            }
            Some(_) => {}
            None => {
                seen.push((identity, signature));
                ordered.push(section);
            }
        }
    }

    ordered.sort_by_key(|section| rank(&section.css));

    let mut uris: FxHashMap<&str, &str> = FxHashMap::default();

    for section in &ordered {
        for entry in section.namespaces.iter().flatten() {
            if uris
                .insert(&entry.name, &entry.uri)
                .is_some_and(|previous| previous != &*entry.uri)
            {
                return Err(conflict(section, "Conflicting namespace identity."));
            }
        }
    }

    let lists: Vec<&[Arc<str>]> = ordered
        .iter()
        .flat_map(|section| section.layers.iter().map(Vec::as_slice))
        .collect();
    let layers = contributions::order(&lists).map_err(Error::Message)?;
    let mut map = GenMapping::new(Some("zyzz.shared.css"));
    let mut state = Relocation::default();
    let mut chunks: Vec<String> = Vec::new();

    if !layers.is_empty() {
        chunks.push(format!("@layer {};", layers.join(",")));
    }

    let mut line = u32::try_from(chunks.len()).unwrap_or(u32::MAX) + 1;

    for section in ordered {
        if section.css.is_empty() {
            continue;
        }

        let (namespaced, _) = namespaces::rewrite(
            &section.css,
            section.namespaces.as_deref().unwrap_or_default(),
            None,
            false,
        )?;

        state.changed = namespaced != *section.css;
        state.owner = section
            .owner
            .as_ref()
            .unwrap_or(&section.source)
            .to_string();
        state.source = section.source.to_string();

        let rewritten = at_rules::transform_with(
            &Options {
                code: &namespaced,
                filename: &section.source,
                ..Options::default()
            },
            &mut state,
        )?;

        let css = if state.changed {
            // Decoding the transformed bytes drops a leading byte order mark.
            let code = rewritten
                .code
                .strip_prefix('\u{feff}')
                .unwrap_or(&rewritten.code);

            code.trim_end_matches(js::is_whitespace).to_owned()
        } else {
            section.css.to_string()
        };

        let content = section.content.as_deref().unwrap_or_default();
        let start = section
            .start
            .map_or(0, |start| usize::try_from(start).unwrap_or(usize::MAX));
        let before = js::slice(content, 0, start);
        let original = Position {
            column: u32::try_from(js::utf16_len(
                before.rsplit('\n').next().unwrap_or_default(),
            ))
            .unwrap_or(u32::MAX),
            line: u32::try_from(before.split('\n').count()).unwrap_or(u32::MAX),
        };
        let count = u32::try_from(css.split('\n').count()).unwrap_or(u32::MAX);

        map.set_source_content(&section.source, section.content.as_deref());

        for index in 0..count {
            map.add_mapping(&Mapping {
                generated: Position {
                    column: 0,
                    line: line.saturating_add(index),
                },
                name: None,
                original: Some(original),
                source: Some(&section.source),
            });
        }

        chunks.push(css);
        line = line.saturating_add(count);
    }

    Ok(Rendered {
        assets: state.assets,
        css: chunks.join("\n"),
        map: map.to_encoded_map(),
        owners: state.owners,
    })
}

/// The values whose `JSON.stringify` deduplicates sections with one source and key.
#[derive(PartialEq)]
struct Signature<'s> {
    content: Option<&'s str>,
    css: &'s str,
    layers: &'s [Vec<Arc<str>>],
    // Extracted entries serialize with a leading `kind`, so they differ from packed entries
    // unless the list is empty.
    namespaces: Option<(&'s [namespace::Definition], bool)>,
    start: Option<u32>,
}

impl<'s> Signature<'s> {
    fn of(section: &'s Section) -> Self {
        Self {
            content: section.content.as_deref(),
            css: &section.css,
            layers: &section.layers,
            namespaces: section
                .namespaces
                .as_deref()
                .map(|list| (list, section.authored_namespaces && !list.is_empty())),
            start: section.start,
        }
    }
}

/// Orders imports, then namespace statements, before other rules.
fn rank(css: &str) -> u8 {
    if css.starts_with("@import ") {
        0
    } else if css.starts_with("@namespace ") {
        1
    } else {
        2
    }
}

#[cold]
fn conflict(section: &Section, message: impl Into<String>) -> Error {
    Error::StylesheetConflict {
        message: message.into(),
        source: section
            .owner
            .as_ref()
            .unwrap_or(&section.source)
            .to_string(),
    }
}

/// A named rule's first source and signature.
struct Identity {
    signature: String,
    source: String,
}

/// Relocation and identity state shared across sections while rendering.
#[derive(Default)]
struct Relocation {
    animations: FxHashMap<String, Identity>,
    assets: Record<String>,
    changed: bool,
    identities: FxHashMap<String, Identity>,
    owner: String,
    owners: Record<String>,
    source: String,
}

impl Relocation {
    /// Returns the placeholder for a relative asset, recording its target and owner.
    fn relocate(&mut self, url: &str) -> Result<Option<String>> {
        if url.is_empty() || absolute(url) {
            return Ok(None);
        }

        self.changed = true;

        let target = resolve(&self.source, url)?;
        let key = format!("zyzz-asset:{}", encode_uri_component(&target));

        self.assets.insert(key.as_str(), target);
        self.owners.insert(key.as_str(), self.owner.clone());

        Ok(Some(key))
    }

    /// Records a named rule, failing when another source or a different rule claimed it.
    fn claim(&mut self, animation: bool, key: String, name: &str, signature: String) -> Result<()> {
        let claims = if animation {
            &mut self.animations
        } else {
            &mut self.identities
        };

        if claims.get(&key).is_some_and(|previous| {
            previous.source != self.source || previous.signature != signature
        }) {
            let message = if animation {
                format!("Conflicting animation identity: {name}; supply distinct declaration ids.")
            } else {
                format!("Conflicting stylesheet identity: {name}; supply distinct declaration ids.")
            };

            return Err(Error::StylesheetConflict {
                message,
                source: self.owner.clone(),
            });
        }

        claims.insert(
            key,
            Identity {
                signature,
                source: self.source.clone(),
            },
        );

        Ok(())
    }
}

impl<'i> Visitor<'i> for Relocation {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES | VisitTypes::URLS
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        match rule {
            CssRule::Import(import) => {
                if let Some(url) = self.relocate(&import.url)? {
                    at_rules::relocate_import(import, &url);
                }
            }
            CssRule::Keyframes(keyframes) => {
                let name = match &keyframes.name {
                    KeyframesName::Custom(name) => name.to_string(),
                    KeyframesName::Ident(name) => name.0.to_string(),
                };

                self.claim(true, name.clone(), &name, signature(&keyframes.keyframes))?;
            }
            CssRule::CounterStyle(counter) => {
                let name = counter.name.0.to_string();

                self.claim(
                    false,
                    format!("counter-style:{name}"),
                    &name,
                    signature(&counter.declarations),
                )?;
            }
            CssRule::FontPaletteValues(palette) => {
                let name = palette.name.0.to_string();

                self.claim(
                    false,
                    format!("font-palette-values:{name}"),
                    &name,
                    signature(&palette.properties),
                )?;
            }
            CssRule::PositionTry(position) => {
                let name = position.name.0.to_string();

                self.claim(
                    false,
                    format!("position-try:{name}"),
                    &name,
                    signature(&position.declarations),
                )?;
            }
            CssRule::Unknown(unknown) => {
                let palette = unknown.name.starts_with("-zyzz-fpv-");
                let named = palette
                    || ["color-profile", "function", "custom-media"].contains(&&*unknown.name);
                let name = match unknown.prelude.0.first() {
                    Some(TokenOrValue::DashedIdent(name)) if named => Some(name.0.to_string()),
                    Some(TokenOrValue::Function(function))
                        if named && &*unknown.name == "function" =>
                    {
                        Some(function.name.0.to_string())
                    }
                    _ => None,
                };

                if let Some(name) = name {
                    let kind = if palette {
                        "font-palette-values"
                    } else {
                        &unknown.name
                    };
                    // Debug renderings escape NUL, so the separator keeps the pair unambiguous.
                    let data = format!(
                        "{}\0{}",
                        signature(&unknown.prelude),
                        signature(&unknown.block)
                    );

                    self.claim(false, format!("{kind}:{name}"), &name, data)?;
                }
            }
            _ => {}
        }

        rule.visit_children(self)
    }

    fn visit_url(&mut self, url: &mut Url<'i>) -> Result<()> {
        if let Some(value) = self.relocate(&url.url)? {
            url.url = value.into();
        }

        Ok(())
    }
}

/// An equality key for a rule node, standing in for `JSON.stringify` of the binding's AST.
///
/// The `Debug` rendering covers every field the JSON form has, including source locations of
/// URLs. Token sign flags and integer values, which the JSON form omits, are cleared first. The
/// keys differ from JSON equality only where negative zero meets zero.
fn signature<'i, R, T>(node: &T) -> String
where
    Detach: Visitor<'i, R, Error = std::convert::Infallible>,
    R: Visit<'i, R, Detach>,
    T: Clone + std::fmt::Debug + Visit<'i, R, Detach>,
{
    let mut node = node.clone();
    let Ok(()) = node.visit(&mut Detach);

    format!("{node:?}")
}

/// Clears the number token fields the binding's JSON form omits.
struct Detach;

impl<'i> Visitor<'i> for Detach {
    type Error = std::convert::Infallible;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::TOKENS
    }

    fn visit_token(
        &mut self,
        token: &mut TokenOrValue<'i>,
    ) -> std::result::Result<(), Self::Error> {
        if let TokenOrValue::Token(
            Token::Number {
                has_sign,
                int_value,
                ..
            }
            | Token::Percentage {
                has_sign,
                int_value,
                ..
            }
            | Token::Dimension {
                has_sign,
                int_value,
                ..
            },
        ) = token
        {
            *has_sign = false;
            *int_value = None;
        }

        token.visit_children(self)
    }
}

/// Matches `/^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i`.
fn absolute(url: &str) -> bool {
    let mut bytes = url.bytes();

    match bytes.next() {
        Some(b'/' | b'?' | b'#') => true,
        Some(first) if first.is_ascii_alphabetic() => {
            bytes.find(|byte| !(byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'.' | b'-')))
                == Some(b':')
        }
        _ => false,
    }
}

/// Percent-encodes UTF-8 bytes like `encodeURIComponent`, keeping `A-Za-z0-9-_.!~*'()`.
fn encode_uri_component(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            output.push(char::from(byte));
        } else {
            let _ = write!(output, "%{byte:02X}");
        }
    }

    output
}
