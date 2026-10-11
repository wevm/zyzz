//! Compiles portable declarations into immutable native set tables.
//!
//! This mirrors `StyleSheet.compile`: every supplied set produces a light and a dark table, unit
//! and font conversions use explicit mappings, and structurally equal styles share one
//! [`Arc`], as the TypeScript compiler shares one frozen object.

use std::f64::consts::PI;
use std::sync::Arc;

use rustc_hash::{FxHashMap, FxHashSet};

use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::token::Metadata;
use crate::js;
use crate::react_native::internal::scalar::{self, Decimal, Exponent, Fraction, Kind, Value};
use crate::react_native::internal::tokens::{self, Resolution};
use crate::react_native::internal::{calculation, color, values};
use crate::style::{self, NamedStyle};

/// An explicit color scheme, never inferred from a device.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ColorScheme {
    /// `dark`
    Dark,
    /// `light`
    Light,
}

impl ColorScheme {
    /// Parses the TypeScript spelling.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "dark" => Some(Self::Dark),
            "light" => Some(Self::Light),
            _ => None,
        }
    }

    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Dark => "dark",
            Self::Light => "light",
        }
    }
}

/// A native destination for platform branches.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Platform {
    /// `android`
    Android,
    /// `ios`
    Ios,
}

impl Platform {
    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Android => "android",
            Self::Ios => "ios",
        }
    }
}

/// The stable category of a rejected input.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Code {
    /// `invalid_options`
    InvalidOptions,
    /// `unsupported_feature`
    UnsupportedFeature,
    /// `unsupported_value`
    UnsupportedValue,
}

impl Code {
    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidOptions => "invalid_options",
            Self::UnsupportedFeature => "unsupported_feature",
            Self::UnsupportedValue => "unsupported_value",
        }
    }
}

/// A structured native capability or conversion failure.
#[derive(Clone, Debug, PartialEq)]
pub struct Diagnostic {
    /// Stable category of rejected input.
    pub code: Code,
    /// Explanation of the supported boundary.
    pub message: String,
    /// Set, scheme, style, and property where applicable.
    pub path: Vec<Arc<str>>,
}

/// Formats the message of `StyleSheet.CompileError`.
pub fn error_message(diagnostics: &[Diagnostic]) -> String {
    let mut output = String::new();

    for (index, diagnostic) in diagnostics.iter().enumerate() {
        if index > 0 {
            output.push('\n');
        }

        output.push('[');

        for (index, part) in diagnostic.path.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            js::write_string(&mut output, part);
        }

        output.push_str("]: ");
        output.push_str(&diagnostic.message);
    }

    output
}

/// Native output for one style: converted declarations in JavaScript own-property order.
pub type NativeStyle = Object;

/// One set and scheme table. Each property maps a style name to `Data::Object` holding a
/// [`NativeStyle`].
pub type Table = Object;

/// Light and dark tables for one set. Scheme-independent sets share one table.
#[derive(Clone, Debug)]
pub struct Schemes {
    /// Dark table.
    pub dark: Arc<Table>,
    /// Light table.
    pub light: Arc<Table>,
}

impl Schemes {
    /// Selects a scheme's table.
    pub fn get(&self, scheme: ColorScheme) -> &Arc<Table> {
        match scheme {
            ColorScheme::Dark => &self.dark,
            ColorScheme::Light => &self.light,
        }
    }
}

/// Precompiled tables for every set, in JavaScript own-property order of the set labels.
#[derive(Clone, Debug)]
pub struct Tables {
    /// Set labels and their scheme tables.
    pub sets: Vec<(Arc<str>, Schemes)>,
}

impl Tables {
    /// Looks up a set's tables.
    pub fn get(&self, set: &str) -> Option<&Schemes> {
        self.sets
            .iter()
            .find(|(label, _)| &**label == set)
            .map(|(_, schemes)| schemes)
    }

    /// Appends the tables serialized like `JSON.stringify(compiled.styles)`.
    pub fn write_json(&self, output: &mut String) {
        js::write_object(
            output,
            self.sets.iter().map(|(label, schemes)| (&**label, schemes)),
            |output, schemes| {
                output.push_str("{\"light\":");
                write_table(output, &schemes.light);
                output.push_str(",\"dark\":");
                write_table(output, &schemes.dark);
                output.push('}');
            },
        );
    }
}

/// Appends a table or native style serialized like `JSON.stringify`.
pub fn write_table(output: &mut String, table: &Object) {
    js::write_object(
        output,
        table.iter().filter(|(_, value)| !value.is_undefined()),
        js::write_data,
    );
}

/// Caller-owned mappings and sets. Each field holds the authored JavaScript value, and
/// `Data::Undefined` when omitted, so validation reports the same diagnostics as TypeScript.
#[derive(Clone, Debug)]
pub struct Options {
    /// Authored font-family text mapped to installed native families.
    pub fonts: Data,
    /// Destination for platform branches: `ios`, `android`, or omitted.
    pub platform: Data,
    /// Positive logical-unit scales. `px` defaults to one and `rem` has no default.
    pub units: Data,
    /// Set labels mapped to theme or variable set definitions. Omission creates the token-fallback
    /// `default` table.
    pub vars: Data,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            fonts: Data::Undefined,
            platform: Data::Undefined,
            units: Data::Undefined,
            vars: Data::Undefined,
        }
    }
}

/// Validated options.
struct Settings {
    platform: Option<Platform>,
    scalar: scalar::Options,
}

/// Resolves portable tokens into two static scheme tables per supplied set.
///
/// `px` defaults to one native logical unit. `rem` lengths and font families require mappings.
///
/// # Errors
///
/// Returns [`Error::StyleSheet`] for unsupported semantics or invalid conversion inputs. Option
/// and structure failures report one diagnostic. Declaration failures report every diagnostic in
/// set, scheme, style, and declaration order.
pub fn compile(definition: &style::Definition, options: &Options) -> Result<Tables> {
    let settings = validate(options)?;
    let styles = &definition.styles;
    let mut names: FxHashSet<&str> = FxHashSet::default();
    let mut scalar = true;

    for style in styles {
        if style.name.is_empty() || !names.insert(&style.name) {
            return Err(fail(
                Code::InvalidOptions,
                "Style names must be nonempty and unique.",
                &[Arc::clone(&style.name)],
            ));
        }

        for part in sequence(style)? {
            let platform_branch = part
                .targets
                .as_ref()
                .is_some_and(|targets| targets.android.is_some() || targets.ios.is_some());

            if platform_branch && settings.platform.is_none() {
                return Err(fail(
                    Code::InvalidOptions,
                    "Platform branches require an explicit platform.",
                    &[Arc::clone(&style.name), "targets".into()],
                ));
            }

            let mut declared: FxHashSet<&str> = FxHashSet::default();

            for declaration in &part.declarations {
                if declaration.value.is_object() {
                    scalar = false;
                }

                let path = [Arc::clone(&style.name), Arc::clone(&declaration.property)];

                if scalar::property(&declaration.property).is_none() {
                    return Err(fail(
                        Code::UnsupportedFeature,
                        "Property is outside the native subset.",
                        &path,
                    ));
                }

                if declaration.important || !declared.insert(&declaration.property) {
                    return Err(fail(
                        Code::UnsupportedFeature,
                        "Importance and fallback declarations are not supported on native.",
                        &path,
                    ));
                }
            }
        }
    }

    let vars: Vec<(Arc<str>, Option<Data>)> = match &options.vars {
        Data::Undefined => vec![("default".into(), None)],
        Data::Null => {
            return Err(Error::message("Cannot convert undefined or null to object"));
        }
        other => entries(other)
            .into_iter()
            .map(|(label, set)| (label, Some(set)))
            .collect(),
    };

    if vars.is_empty() {
        return Err(fail(
            Code::InvalidOptions,
            "Supply at least one set, or omit vars for a default table.",
            &["vars".into()],
        ));
    }

    let mut compiler = Compiler {
        diagnostics: Vec::new(),
        interned: FxHashMap::default(),
        settings: &settings,
    };
    let mut sets: Vec<(Arc<str>, Schemes)> = Vec::with_capacity(vars.len());
    let mut independent: Option<Arc<Table>> = None;

    for (label, set) in vars {
        if label.is_empty() {
            return Err(fail(
                Code::InvalidOptions,
                "Theme labels must be nonempty.",
                &["vars".into(), Arc::clone(&label)],
            ));
        }

        let metadata = match &set {
            Some(Data::Theme(theme)) => Some(&theme.metadata),
            _ => None,
        };

        if set.is_some() && metadata.is_none() {
            return Err(fail(
                Code::InvalidOptions,
                "Expected a Theme.define or Config set handle.",
                &["vars".into(), Arc::clone(&label)],
            ));
        }

        let mut resolution = Resolution::default();
        let mut light: Option<Arc<Table>> = None;
        let mut dark: Option<Arc<Table>> = None;

        for scheme in [ColorScheme::Light, ColorScheme::Dark] {
            let table = if let Some(table) = &independent {
                Arc::clone(table)
            } else if scheme == ColorScheme::Dark
                && resolution.scheme_independent
                && compiler.diagnostics.is_empty()
                && let Some(light) = &light
            {
                Arc::clone(light)
            } else {
                let table =
                    Arc::new(compiler.table(styles, &label, scheme, metadata, &mut resolution));

                if scalar && compiler.diagnostics.is_empty() {
                    independent = Some(Arc::clone(&table));
                }

                table
            };

            match scheme {
                ColorScheme::Light => light = Some(table),
                ColorScheme::Dark => dark = Some(table),
            }
        }

        if let (Some(light), Some(dark)) = (light, dark) {
            sets.push((label, Schemes { dark, light }));
        }
    }

    if !compiler.diagnostics.is_empty() {
        return Err(Error::StyleSheet(compiler.diagnostics));
    }

    Ok(Tables { sets })
}

/// Looks up an existing table without allocating or resolving device state.
///
/// # Errors
///
/// Returns [`Error::StyleSheetSelection`] for an unknown set label or a scheme other than `light`
/// or `dark`.
pub fn select(tables: &Tables, set: &str, color_scheme: Option<&str>) -> Result<Arc<Table>> {
    let scheme = color_scheme.and_then(ColorScheme::parse);

    match (scheme, tables.get(set)) {
        (Some(scheme), Some(schemes)) => Ok(Arc::clone(schemes.get(scheme))),
        _ => Err(Error::StyleSheetSelection(
            "Select an existing set label and light or dark colorScheme.".to_owned(),
        )),
    }
}

fn validate(options: &Options) -> Result<Settings> {
    let platform = match &options.platform {
        Data::Undefined => None,
        Data::String(platform) if &**platform == "android" => Some(Platform::Android),
        Data::String(platform) if &**platform == "ios" => Some(Platform::Ios),
        _ => {
            return Err(fail(
                Code::InvalidOptions,
                "Expected an explicit ios or android platform.",
                &["platform".into()],
            ));
        }
    };

    for (unit, scale) in entries(&options.units) {
        let valid = matches!(&*unit, "px" | "rem")
            && match scale {
                Data::Undefined => true,
                Data::Number(scale) => scale.is_finite() && scale > 0.0,
                _ => false,
            };

        if !valid {
            return Err(fail(
                Code::InvalidOptions,
                "Unit scales must be positive finite px or rem conversions.",
                &["units".into(), unit],
            ));
        }
    }

    for (family, mapped) in entries(&options.fonts) {
        let valid = !family.is_empty()
            && matches!(&mapped, Data::String(mapped) if !js::trim(mapped).is_empty());

        if !valid {
            return Err(fail(
                Code::InvalidOptions,
                "Font mappings require nonempty family names.",
                &["fonts".into(), family],
            ));
        }
    }

    Ok(Settings {
        platform,
        scalar: scalar::Options::read(&options.fonts, &options.units),
    })
}

/// Lists entries like `Object.entries(value ?? {})`.
fn entries(value: &Data) -> Vec<(Arc<str>, Data)> {
    match value {
        Data::Object(object) => object
            .iter()
            .map(|(key, value)| (Arc::clone(key), value.clone()))
            .collect(),
        Data::String(text) => text
            .encode_utf16()
            .enumerate()
            .map(|(index, unit)| {
                (
                    index.to_string().into(),
                    Data::String(String::from_utf16_lossy(&[unit]).into()),
                )
            })
            .collect(),
        Data::Array(items) => items
            .iter()
            .enumerate()
            .map(|(index, item)| (index.to_string().into(), item.clone()))
            .collect(),
        _ => Vec::new(),
    }
}

#[cold]
fn fail(code: Code, message: impl Into<String>, path: &[Arc<str>]) -> Error {
    Error::StyleSheet(vec![diagnostic(code, message, path)])
}

#[cold]
fn diagnostic(code: Code, message: impl Into<String>, path: &[Arc<str>]) -> Diagnostic {
    Diagnostic {
        code,
        message: message.into(),
        path: path.to_vec(),
    }
}

/// Flattens nested unconditional rules after their parent, rejecting conditions.
fn sequence(style: &Arc<NamedStyle>) -> Result<Vec<&Arc<NamedStyle>>> {
    let mut parts = vec![style];

    for rule in style.rules.iter().flatten() {
        if rule.condition.is_some() {
            return Err(fail(
                Code::UnsupportedFeature,
                "Selectors, queries, and nested rules are not supported on native.",
                &[Arc::clone(&style.name)],
            ));
        }

        parts.extend(sequence(&rule.style)?);
    }

    Ok(parts)
}

struct Compiler<'a> {
    diagnostics: Vec<Diagnostic>,
    interned: FxHashMap<String, Arc<NativeStyle>>,
    settings: &'a Settings,
}

impl Compiler<'_> {
    fn table(
        &mut self,
        styles: &[Arc<NamedStyle>],
        label: &Arc<str>,
        scheme: ColorScheme,
        metadata: Option<&Metadata>,
        resolution: &mut Resolution,
    ) -> Table {
        let mut table = Table::new();

        for style in styles {
            let mut output = NativeStyle::new();
            let mut line_height: Option<Value> = None;
            let base = [
                Arc::clone(label),
                Arc::from(scheme.as_str()),
                Arc::clone(&style.name),
            ];

            // Validation already rejected conditions, so sequencing cannot fail here.
            for part in sequence(style).unwrap_or_default() {
                for declaration in &part.declarations {
                    let mut path = base.to_vec();

                    path.push(Arc::clone(&declaration.property));

                    let context = Context {
                        metadata,
                        path: &path,
                        scheme,
                        settings: self.settings,
                    };

                    if let Err(diagnostic) =
                        context.declaration(declaration, resolution, &mut output, &mut line_height)
                    {
                        self.diagnostics.push(diagnostic);
                    }
                }

                let branches = [Some("native"), self.settings.platform.map(Platform::as_str)];

                for branch in branches.into_iter().flatten() {
                    let input = part.targets.as_ref().and_then(|targets| match branch {
                        "native" => targets.native.as_ref(),
                        "ios" => targets.ios.as_ref(),
                        _ => targets.android.as_ref(),
                    });
                    let Some(input) = input else {
                        continue;
                    };

                    match values::parse(input) {
                        Ok(native) => {
                            for (key, value) in native.iter() {
                                output.insert(Arc::clone(key), value.clone());
                            }

                            if native.get("lineHeight").is_some() {
                                line_height = None;
                            }
                        }
                        Err(error) => {
                            let mut path = base.to_vec();

                            path.extend(["targets".into(), branch.into()]);
                            self.diagnostics.push(diagnostic(
                                Code::UnsupportedValue,
                                error.text(),
                                &path,
                            ));
                        }
                    }
                }
            }

            if let Some(value) = line_height {
                let mut path = base.to_vec();

                path.push("lineHeight".into());

                if let Err(diagnostic) = self.line_height(&value, &mut output, &path) {
                    self.diagnostics.push(diagnostic);
                }
            }

            let shared = self.intern(output);

            table.insert(Arc::clone(&style.name), Data::Object(shared));
        }

        table
    }

    fn line_height(
        &self,
        value: &Value,
        output: &mut NativeStyle,
        path: &[Arc<str>],
    ) -> std::result::Result<(), Diagnostic> {
        match value {
            Value::Number(multiplier) => {
                let size = match output.get("fontSize") {
                    Some(Data::Number(size)) => Some(*size),
                    _ => None,
                };
                let Some(size) = size.filter(|_| multiplier.is_finite() && *multiplier >= 0.0)
                else {
                    return Err(diagnostic(
                        Code::UnsupportedValue,
                        "Numeric lineHeight requires an explicit fontSize in the same style.",
                        path,
                    ));
                };
                let line_height = multiplier * size;

                output.insert("lineHeight", Data::Number(line_height));

                if !line_height.is_finite() {
                    return Err(diagnostic(
                        Code::UnsupportedValue,
                        "Converted lineHeight must be finite.",
                        path,
                    ));
                }

                Ok(())
            }
            Value::String(_) => {
                let length = length(value, &self.settings.scalar, false, path)?;

                output.insert("lineHeight", Data::Number(length));

                Ok(())
            }
        }
    }

    /// Shares structurally equal styles, keyed like
    /// `JSON.stringify(Object.entries(output).sort(...))`.
    fn intern(&mut self, output: NativeStyle) -> Arc<NativeStyle> {
        let mut entries: Vec<(&Arc<str>, &Data)> = output.iter().collect();

        entries.sort_by(|(left, _), (right, _)| left.encode_utf16().cmp(right.encode_utf16()));

        let mut key = String::from("[");

        for (index, (name, value)) in entries.iter().enumerate() {
            if index > 0 {
                key.push(',');
            }

            key.push('[');
            js::write_string(&mut key, name);
            key.push(',');

            if value.is_undefined() {
                key.push_str("null");
            } else {
                js::write_data(&mut key, value);
            }

            key.push(']');
        }

        key.push(']');

        if let Some(shared) = self.interned.get(&key) {
            return Arc::clone(shared);
        }

        let shared = Arc::new(output);

        self.interned.insert(key, Arc::clone(&shared));
        shared
    }
}

/// The location and inputs of one declaration conversion.
struct Context<'a> {
    metadata: Option<&'a Metadata>,
    path: &'a [Arc<str>],
    scheme: ColorScheme,
    settings: &'a Settings,
}

type Outcome<T> = std::result::Result<T, Diagnostic>;

impl Context<'_> {
    fn fail(&self, code: Code, message: impl Into<String>) -> Diagnostic {
        diagnostic(code, message, self.path)
    }

    fn value_error(&self, error: &Error) -> Diagnostic {
        self.fail(Code::UnsupportedValue, error.text())
    }

    fn options(&self) -> &scalar::Options {
        &self.settings.scalar
    }

    fn declaration(
        &self,
        declaration: &style::Declaration,
        resolution: &mut Resolution,
        output: &mut NativeStyle,
        line_height: &mut Option<Value>,
    ) -> Outcome<()> {
        let property = &*declaration.property;
        let value = tokens::resolve(
            &declaration.value,
            &tokens::Options {
                color_scheme: Some(self.scheme),
                metadata: self.metadata,
                scalar: self.options(),
            },
            resolution,
        )
        .map_err(|error| {
            self.fail(
                match error {
                    tokens::Error::Unsupported(_) => Code::UnsupportedFeature,
                    tokens::Error::Message(_) => Code::UnsupportedValue,
                },
                error.message(),
            )
        })?;

        match property {
            "lineHeight" => {
                *line_height = Some(value);
            }
            "fontVariant" => {
                output.insert("fontVariant", self.font_variant(&value)?);
            }
            "textShadow" => {
                let entries = self.shadows(&value, true)?;

                if entries.len() > 1 {
                    return Err(
                        self.fail(Code::UnsupportedValue, "Native text supports one shadow.")
                    );
                }

                let shadow = entries.first();

                output.insert(
                    "textShadowColor",
                    Data::string(shadow.map_or("transparent", |shadow| &*shadow.color)),
                );
                output.insert(
                    "textShadowOffset",
                    Data::from(Object::from_entries([
                        (
                            "width".into(),
                            Data::Number(shadow.map_or(0.0, |shadow| shadow.offset_x)),
                        ),
                        (
                            "height".into(),
                            Data::Number(shadow.map_or(0.0, |shadow| shadow.offset_y)),
                        ),
                    ])),
                );
                output.insert(
                    "textShadowRadius",
                    Data::Number(shadow.map_or(0.0, |shadow| shadow.blur_radius)),
                );
            }
            "boxShadow" => {
                let entries = self.shadows(&value, false)?;

                output.insert(
                    "boxShadow",
                    Data::Array(Arc::new(entries.iter().map(Shadow::to_data).collect())),
                );
            }
            "transform" => {
                output.insert("transform", self.transform(&value)?);
            }
            "transformOrigin" => {
                output.insert("transformOrigin", self.origin(&value)?);
            }
            _ => self.scalar(property, &value, output)?,
        }

        Ok(())
    }

    fn scalar(&self, property: &str, value: &Value, output: &mut NativeStyle) -> Outcome<()> {
        let options = self.options();
        let Some(kind) = scalar::property(property) else {
            return Err(self.fail(
                Code::UnsupportedFeature,
                "Property is outside the native subset.",
            ));
        };
        let converted = scalar::convert(kind, value, options)
            .map_err(|error| self.value_error(&error))?
            .to_data();

        match property {
            "padding" | "margin" => {
                let parts = self.parts(value)?;
                let mut sides = Vec::with_capacity(parts.len());

                for part in &parts {
                    sides.push(length(part, options, property == "margin", self.path)?);
                }

                // Conversion validated one to four parts.
                let Some([top, right, bottom, left]) = box_sides(&sides) else {
                    return Ok(());
                };

                for (side, value) in [
                    ("Top", top),
                    ("Right", right),
                    ("Bottom", bottom),
                    ("Left", left),
                ] {
                    output.insert(format!("{property}{side}"), Data::Number(value));
                }
            }
            "flex" => {
                let flex =
                    scalar::flex(value, options).map_err(|error| self.value_error(&error))?;

                output.insert("flexBasis", flex.basis.to_data());
                output.insert("flexGrow", Data::Number(flex.grow));
                output.insert("flexShrink", Data::Number(flex.shrink));
            }
            "inset" => {
                let parts = self.parts(value)?;
                let mut sides = Vec::with_capacity(parts.len());

                for part in &parts {
                    sides.push(
                        scalar::convert(Kind::Offset, part, options)
                            .map_err(|error| self.value_error(&error))?,
                    );
                }

                // Conversion validated one to four parts.
                let Some([top, right, bottom, left]) = box_sides(&sides) else {
                    return Ok(());
                };

                for (side, value) in [
                    ("top", top),
                    ("right", right),
                    ("bottom", bottom),
                    ("left", left),
                ] {
                    output.insert(side, value.to_data());
                }
            }
            "borderColor" | "borderWidth" => {
                let suffix = if property == "borderColor" {
                    "Color"
                } else {
                    "Width"
                };

                for side in ["Top", "Right", "Bottom", "Left"] {
                    output.insert(format!("border{side}{suffix}"), converted.clone());
                }
            }
            "borderRadius" => {
                for corner in ["TopLeft", "TopRight", "BottomRight", "BottomLeft"] {
                    output.insert(format!("border{corner}Radius"), converted.clone());
                }
            }
            "gap" => {
                output.insert("columnGap", converted.clone());
                output.insert("rowGap", converted);
            }
            _ => output.insert(property, converted),
        }

        Ok(())
    }

    fn parts(&self, value: &Value) -> Outcome<Vec<Value>> {
        match value {
            Value::Number(_) => Ok(vec![value.clone()]),
            Value::String(text) => Ok(calculation::parts(text)
                .map_err(|error| self.value_error(&error))?
                .into_iter()
                .map(Value::from)
                .collect()),
        }
    }

    fn font_variant(&self, value: &Value) -> Outcome<Data> {
        let Value::String(text) = value else {
            return Err(self.fail(Code::UnsupportedValue, "Expected static font variants."));
        };
        let keywords: Vec<Data> = if &**text == "normal" {
            Vec::new()
        } else {
            split_whitespace(js::trim(text))
                .into_iter()
                .map(Data::from)
                .collect()
        };
        let record =
            Object::from_entries([("fontVariant".into(), Data::Array(Arc::new(keywords)))]);

        match values::parse(&Data::from(record)) {
            Ok(parsed) => Ok(parsed
                .get("fontVariant")
                .cloned()
                .unwrap_or(Data::Undefined)),
            Err(_) => Err(self.fail(
                Code::UnsupportedValue,
                "Font variant keywords require an explicit native equivalent.",
            )),
        }
    }

    fn origin(&self, value: &Value) -> Outcome<Data> {
        let options = self.options();
        let text = value.to_js_string();
        let lower = js::trim(&text).to_ascii_lowercase();
        let parts = split_whitespace(&lower);

        if parts.first().is_none_or(|first| first.is_empty()) || parts.len() > 3 {
            return Err(self.fail(
                Code::UnsupportedValue,
                "Expected one to three transform-origin values.",
            ));
        }

        let horizontal = ["left", "center", "right"];
        let vertical = ["top", "center", "bottom"];
        let mut x = parts.first().copied().unwrap_or_default();
        let mut y = parts.get(1).copied().unwrap_or("center");
        let z = parts.get(2).copied().unwrap_or("0");

        if parts.len() == 1 && matches!(x, "top" | "bottom") {
            (x, y) = ("center", x);
        } else if matches!(x, "top" | "bottom") || matches!(y, "left" | "right") {
            if !vertical.contains(&x) || !horizontal.contains(&y) {
                return Err(self.fail(
                    Code::UnsupportedValue,
                    "Transform-origin keywords must identify different axes.",
                ));
            }

            (x, y) = (y, x);
        }

        let mut values = Vec::with_capacity(3);

        for (index, part) in [x, y].into_iter().enumerate() {
            let keywords = if index == 0 { horizontal } else { vertical };

            if let Some(keyword) = keywords.iter().position(|keyword| *keyword == part) {
                values.push(Data::string(match keyword {
                    0 => "0%",
                    1 => "50%",
                    _ => "100%",
                }));
                continue;
            }

            if scalar::PERCENTAGE.matches_suffixed(part, "%") {
                if !js::to_number(part.strip_suffix('%').unwrap_or_default()).is_finite() {
                    return Err(self.fail(
                        Code::UnsupportedValue,
                        "Transform-origin percentages must be finite.",
                    ));
                }

                values.push(Data::string(part));
                continue;
            }

            values.push(Data::Number(length(
                &Value::from(part),
                options,
                true,
                self.path,
            )?));
        }

        values.push(Data::Number(length(
            &Value::from(z),
            options,
            true,
            self.path,
        )?));

        Ok(Data::Array(Arc::new(values)))
    }

    fn shadows(&self, value: &Value, text: bool) -> Outcome<Vec<Shadow>> {
        let options = self.options();
        let input = match value {
            Value::String(input) if &**input == "none" => return Ok(Vec::new()),
            Value::String(input) => input,
            Value::Number(_) => {
                return Err(self.fail(Code::UnsupportedValue, "Expected a static shadow list."));
            }
        };
        let mut output = Vec::new();

        for shadow in split_shadows(input) {
            let mut lengths: Vec<f64> = Vec::new();
            let mut color: Option<String> = None;
            let mut inset = false;

            for part in shadow_parts(js::trim(shadow)) {
                if part == "inset" && !inset {
                    inset = true;
                    continue;
                }

                if color.is_none()
                    && let Some(parsed) = color::parse(part)
                {
                    color = Some(parsed);
                    continue;
                }

                lengths.push(length(&Value::from(part), options, true, self.path)?);
            }

            let maximum = if text { 3 } else { 4 };
            let valid = (2..=maximum).contains(&lengths.len())
                && !(text && inset)
                && lengths.get(2).copied().unwrap_or(0.0) >= 0.0;
            let (true, Some(color)) = (valid, color) else {
                return Err(self.fail(
                    Code::UnsupportedValue,
                    "Shadows require two to four lengths, a nonnegative blur, and an explicit absolute color.",
                ));
            };

            output.push(Shadow {
                blur_radius: lengths.get(2).copied().unwrap_or(0.0),
                color: color.into(),
                inset,
                offset_x: lengths.first().copied().unwrap_or(0.0),
                offset_y: lengths.get(1).copied().unwrap_or(0.0),
                spread_distance: lengths.get(3).copied().unwrap_or(0.0),
            });
        }

        Ok(output)
    }

    fn transform(&self, value: &Value) -> Outcome<Data> {
        let options = self.options();
        let invalid_list =
            || self.fail(Code::UnsupportedValue, "Expected a static transform list.");
        let Value::String(input) = value else {
            return Err(invalid_list());
        };
        let mut remaining = js::trim(input);

        if remaining.is_empty() {
            return Err(invalid_list());
        }

        let mut output: Vec<(&'static str, Operation)> = Vec::new();

        if remaining == "none" {
            return Ok(Data::Array(Arc::new(Vec::new())));
        }

        let px = options.units.px.unwrap_or(1.0);

        while !remaining.is_empty() {
            let Some((raw, body, length_matched)) = function(remaining) else {
                return Err(self.fail(
                    Code::UnsupportedValue,
                    "Expected literal transform arguments.",
                ));
            };
            let name = raw.to_ascii_lowercase();
            let args: Vec<&str> = body.split(',').map(js::trim).collect();
            let limit = match name.as_str() {
                "matrix" => 6,
                "matrix3d" => 16,
                "translate" | "scale" => 2,
                _ => 1,
            };

            if args.len() > limit || args.iter().any(|arg| arg.is_empty()) {
                return Err(self.fail(Code::UnsupportedValue, "Invalid transform argument count."));
            }

            let argument = args.first().copied().unwrap_or_default();

            match name.as_str() {
                "matrix" | "matrix3d" => {
                    let numbers: Option<Vec<f64>> = args
                        .iter()
                        .map(|arg| {
                            let number = js::to_number(arg);

                            (MATRIX.matches(arg) && number.is_finite()).then_some(number)
                        })
                        .collect();
                    let (true, Some(values)) = (args.len() == limit, numbers) else {
                        return Err(self.fail(
                            Code::UnsupportedValue,
                            "Matrices require six or sixteen finite numbers.",
                        ));
                    };
                    let mut matrix = if let [a, b, c, d, e, f] = values.as_slice() {
                        vec![
                            *a, *b, 0.0, 0.0, *c, *d, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, *e, *f, 0.0,
                            1.0,
                        ]
                    } else {
                        values
                    };

                    // Conjugate the matrix by the length scale, including projective components.
                    for index in [12, 13, 14] {
                        if let Some(entry) = matrix.get_mut(index) {
                            *entry *= px;
                        }
                    }

                    for index in [3, 7, 11] {
                        if let Some(entry) = matrix.get_mut(index) {
                            *entry /= px;
                        }
                    }

                    if !matrix.iter().all(|entry| entry.is_finite()) {
                        return Err(self.fail(
                            Code::UnsupportedValue,
                            "Converted matrix values must be finite.",
                        ));
                    }

                    output.push(("matrix", Operation::Matrix(matrix)));
                }
                "translate" | "translatex" | "translatey" => {
                    let mut values = Vec::with_capacity(args.len());

                    for arg in &args {
                        if scalar::PERCENTAGE.matches_suffixed(arg, "%") {
                            if !js::to_number(arg.strip_suffix('%').unwrap_or_default()).is_finite()
                            {
                                return Err(self.fail(
                                    Code::UnsupportedValue,
                                    "Transform percentages must be finite.",
                                ));
                            }

                            values.push(Value::from(*arg));
                        } else {
                            values.push(Value::Number(length(
                                &Value::from(*arg),
                                options,
                                true,
                                self.path,
                            )?));
                        }
                    }

                    let first = values.first().cloned().unwrap_or(Value::Number(0.0));

                    if name == "translatey" {
                        output.push(("translateY", Operation::Scalar(first)));
                    } else {
                        output.push(("translateX", Operation::Scalar(first)));

                        if name == "translate" {
                            output.push((
                                "translateY",
                                Operation::Scalar(
                                    values.get(1).cloned().unwrap_or(Value::Number(0.0)),
                                ),
                            ));
                        }
                    }
                }
                "scale" | "scalex" | "scaley" => {
                    let mut values = Vec::with_capacity(args.len());

                    for arg in &args {
                        let number = js::to_number(arg);

                        if !MATRIX.matches(arg) || !number.is_finite() {
                            return Err(
                                self.fail(Code::UnsupportedValue, "Scale requires finite numbers.")
                            );
                        }

                        values.push(number);
                    }

                    let first = values.first().copied().unwrap_or_default();

                    if name == "scale" && values.len() == 1 {
                        output.push(("scale", Operation::Scalar(Value::Number(first))));
                    } else if name == "scaley" {
                        output.push(("scaleY", Operation::Scalar(Value::Number(first))));
                    } else {
                        output.push(("scaleX", Operation::Scalar(Value::Number(first))));

                        if name == "scale" {
                            output.push((
                                "scaleY",
                                Operation::Scalar(Value::Number(
                                    values.get(1).copied().unwrap_or_default(),
                                )),
                            ));
                        }
                    }
                }
                "rotate" | "rotatex" | "rotatey" | "rotatez" | "skewx" | "skewy" => {
                    let matched = ANGLE.prefix(argument);
                    let unit = argument
                        .get(matched..)
                        .unwrap_or_default()
                        .to_ascii_lowercase();
                    let angle =
                        matched > 0 && matches!(unit.as_str(), "deg" | "grad" | "rad" | "turn");

                    if !angle && argument != "0" {
                        return Err(self.fail(
                            Code::UnsupportedValue,
                            "Rotation and skew require literal angles.",
                        ));
                    }

                    let (amount, unit) = if angle {
                        (
                            js::to_number(argument.get(..matched).unwrap_or_default()),
                            unit.as_str(),
                        )
                    } else {
                        (0.0, "deg")
                    };
                    let number = amount
                        * match unit {
                            "turn" => 360.0,
                            "grad" => 0.9,
                            _ => 1.0,
                        };

                    if !number.is_finite() {
                        return Err(
                            self.fail(Code::UnsupportedValue, "Transform angles must be finite.")
                        );
                    }

                    let mut converted = js::number(number);

                    converted.push_str(if unit == "rad" { "rad" } else { "deg" });

                    // Native transform entries have one key. Normalize CSS's case-insensitive
                    // function names.
                    let property = match name.as_str() {
                        "rotate" => "rotate",
                        "rotatex" => "rotateX",
                        "rotatey" => "rotateY",
                        "rotatez" => "rotateZ",
                        "skewx" => "skewX",
                        _ => "skewY",
                    };

                    output.push((property, Operation::Scalar(Value::String(converted.into()))));
                }
                "perspective" => {
                    let distance = length(&Value::from(argument), options, false, self.path)?;

                    // CSS clamps perspective distances below one CSS pixel before unit conversion.
                    output.push((
                        "perspective",
                        Operation::Scalar(Value::Number(distance.max(px))),
                    ));
                }
                _ => {
                    let mut path = self.path.to_vec();

                    path.push(raw.into());

                    return Err(diagnostic(
                        Code::UnsupportedFeature,
                        "Transform function is outside the native subset.",
                        &path,
                    ));
                }
            }

            remaining = remaining
                .get(length_matched..)
                .unwrap_or_default()
                .trim_start_matches(js::is_whitespace);
        }

        if output.len() > 1
            && output
                .iter()
                .any(|(_, operation)| matches!(operation, Operation::Matrix(_)))
        {
            let combined = self.compose(&output)?;

            return Ok(Data::Array(Arc::new(vec![Data::from(
                Object::from_entries([("matrix".into(), numbers(&combined))]),
            )])));
        }

        Ok(Data::Array(Arc::new(
            output
                .into_iter()
                .map(|(key, operation)| {
                    Data::from(Object::from_entries([(
                        key.into(),
                        match operation {
                            Operation::Matrix(matrix) => numbers(&matrix),
                            Operation::Scalar(value) => value.to_data(),
                        },
                    )]))
                })
                .collect(),
        )))
    }

    /// Multiplies ordered transform entries into one column-major matrix.
    fn compose(&self, output: &[(&'static str, Operation)]) -> Outcome<[f64; 16]> {
        const IDENTITY: [f64; 16] = [
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        let mut combined = IDENTITY;

        for (key, operation) in output {
            let mut matrix = IDENTITY;

            match (*key, operation) {
                ("matrix", Operation::Matrix(values)) => {
                    for (entry, value) in matrix.iter_mut().zip(values) {
                        *entry = *value;
                    }
                }
                (key, Operation::Scalar(value)) if key.starts_with("translate") => {
                    let Value::Number(value) = value else {
                        return Err(self.fail(
                            Code::UnsupportedValue,
                            "Matrix composition requires absolute translations.",
                        ));
                    };

                    matrix[if key == "translateX" { 12 } else { 13 }] = *value;
                }
                ("perspective", Operation::Scalar(Value::Number(value))) => {
                    matrix[11] = -1.0 / value;
                }
                (key, Operation::Scalar(Value::Number(value))) if key.starts_with("scale") => {
                    if key != "scaleY" {
                        matrix[0] = *value;
                    }

                    if key != "scaleX" {
                        matrix[5] = *value;
                    }
                }
                (key, Operation::Scalar(Value::String(value))) => {
                    let angle = js::parse_float(value)
                        * if value.ends_with("rad") {
                            1.0
                        } else {
                            PI / 180.0
                        };

                    match key {
                        "skewX" => matrix[4] = js::tan(angle),
                        "skewY" => matrix[1] = js::tan(angle),
                        _ => {
                            let (a, b) = match key {
                                "rotateX" => (1, 2),
                                "rotateY" => (2, 0),
                                _ => (0, 1),
                            };

                            matrix[a * 4 + a] = js::cos(angle);
                            matrix[b * 4 + b] = js::cos(angle);
                            matrix[a * 4 + b] = js::sin(angle);
                            matrix[b * 4 + a] = -js::sin(angle);
                        }
                    }
                }
                _ => {}
            }

            let previous = combined;

            for (index, entry) in combined.iter_mut().enumerate() {
                let row = index % 4;
                let column = index / 4;
                let mut sum = 0.0;

                for k in 0..4 {
                    sum += previous[k * 4 + row] * matrix[column * 4 + k];
                }

                *entry = sum;
            }
        }

        if !combined.iter().all(|entry| entry.is_finite()) {
            return Err(self.fail(
                Code::UnsupportedValue,
                "Converted matrix values must be finite.",
            ));
        }

        Ok(combined)
    }
}

/// One transform entry before conversion into data.
enum Operation {
    Matrix(Vec<f64>),
    Scalar(Value),
}

/// A converted shadow.
struct Shadow {
    blur_radius: f64,
    color: Arc<str>,
    inset: bool,
    offset_x: f64,
    offset_y: f64,
    spread_distance: f64,
}

impl Shadow {
    fn to_data(&self) -> Data {
        // Key order matches the TypeScript object literal.
        Data::from(Object::from_entries([
            ("offsetX".into(), Data::Number(self.offset_x)),
            ("offsetY".into(), Data::Number(self.offset_y)),
            ("blurRadius".into(), Data::Number(self.blur_radius)),
            ("spreadDistance".into(), Data::Number(self.spread_distance)),
            ("color".into(), Data::String(Arc::clone(&self.color))),
            ("inset".into(), Data::Bool(self.inset)),
        ]))
    }
}

/// `[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`, case-insensitively, for matrix and scale numbers.
const MATRIX: Decimal = Decimal {
    exponent: Exponent::Any,
    fraction: Fraction::Optional,
    sign: true,
};

const ANGLE: Decimal = MATRIX;

fn numbers(values: &[f64]) -> Data {
    Data::Array(Arc::new(
        values.iter().map(|value| Data::Number(*value)).collect(),
    ))
}

/// Expands one to four sides like `[top, right = top, bottom = top, left = right]`.
fn box_sides<T: Clone>(values: &[T]) -> Option<[T; 4]> {
    let top = values.first()?.clone();
    let right = values.get(1).cloned().unwrap_or_else(|| top.clone());
    let bottom = values.get(2).cloned().unwrap_or_else(|| top.clone());
    let left = values.get(3).cloned().unwrap_or_else(|| right.clone());

    Some([top, right, bottom, left])
}

fn length(
    value: &Value,
    options: &scalar::Options,
    signed: bool,
    path: &[Arc<str>],
) -> Outcome<f64> {
    scalar::length(value, options, signed)
        .map_err(|error| diagnostic(Code::UnsupportedValue, error.text(), path))
}

/// Splits like `split(/\s+/)` on text without surrounding whitespace.
fn split_whitespace(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return vec![""];
    }

    text.split(js::is_whitespace)
        .filter(|part| !part.is_empty())
        .collect()
}

/// Matches `^([a-z][a-z0-9]*)\(([^()]*)\)` case-insensitively, returning the name, the
/// arguments, and the matched length.
fn function(text: &str) -> Option<(&str, &str, usize)> {
    let bytes = text.as_bytes();

    if !bytes.first().is_some_and(u8::is_ascii_alphabetic) {
        return None;
    }

    let name = bytes
        .iter()
        .take_while(|byte| byte.is_ascii_alphanumeric())
        .count();

    if bytes.get(name) != Some(&b'(') {
        return None;
    }

    let body = bytes
        .get(name + 1..)?
        .iter()
        .position(|byte| matches!(byte, b'(' | b')'))?;

    if bytes.get(name + 1 + body) != Some(&b')') {
        return None;
    }

    Some((
        text.get(..name)?,
        text.get(name + 1..name + 1 + body)?,
        name + body + 2,
    ))
}

/// Splits like `split(/,(?![^()]*\))/)`: on commas not followed by a closing parenthesis before
/// any opening one.
fn split_shadows(text: &str) -> Vec<&str> {
    let bytes = text.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0;

    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b',' {
            continue;
        }

        let inside = bytes
            .get(index + 1..)
            .unwrap_or_default()
            .iter()
            .find(|byte| matches!(byte, b'(' | b')'))
            == Some(&b')');

        if !inside {
            parts.push(text.get(start..index).unwrap_or_default());
            start = index + 1;
        }
    }

    parts.push(text.get(start..).unwrap_or_default());
    parts
}

/// Matches `/[a-z]+\([^()]*\)|[^\s]+/gi`, returning every match in order.
fn shadow_parts(text: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut index = 0;

    while index < text.len() {
        let rest = text.get(index..).unwrap_or_default();
        let Some(character) = rest.chars().next() else {
            break;
        };

        if let Some((_, _, length)) = function_letters(rest) {
            parts.push(rest.get(..length).unwrap_or_default());
            index += length;
            continue;
        }

        if js::is_whitespace(character) {
            index += character.len_utf8();
            continue;
        }

        let length = rest
            .char_indices()
            .find(|(_, character)| js::is_whitespace(*character))
            .map_or(rest.len(), |(offset, _)| offset);

        parts.push(rest.get(..length).unwrap_or_default());
        index += length;
    }

    parts
}

/// Matches `^[a-z]+\([^()]*\)` case-insensitively.
fn function_letters(text: &str) -> Option<(&str, &str, usize)> {
    let bytes = text.as_bytes();
    let name = bytes
        .iter()
        .take_while(|byte| byte.is_ascii_alphabetic())
        .count();

    if name == 0 || bytes.get(name) != Some(&b'(') {
        return None;
    }

    let body = bytes
        .get(name + 1..)?
        .iter()
        .position(|byte| matches!(byte, b'(' | b')'))?;

    if bytes.get(name + 1 + body) != Some(&b')') {
        return None;
    }

    Some((
        text.get(..name)?,
        text.get(name + 1..name + 1 + body)?,
        name + body + 2,
    ))
}
