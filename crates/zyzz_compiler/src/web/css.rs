//! Emits deterministic CSS, class mappings, and live theme scopes from ordered styles.
//!
//! This mirrors `Css.compile`. Atomic output shares only nonconflicting declaration domains, and
//! conflicting rules retain authored order by default. Independent composition deduplicates
//! complete applications and shares equal atomic domain declarations under short names. Theme
//! references serialize in the same order as the TypeScript compiler, because anonymous
//! variable names and fallback rules follow first-reference order.

use std::borrow::Cow;
use std::fmt::Write as _;
use std::rc::Rc;
use std::sync::Arc;

use indexmap::IndexMap;
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::error::{Error, Result};
use crate::generated::cascade;
use crate::generated::literal::Kind;
use crate::internal::token::{Composition, CssOutput, Part, Reference};
use crate::internal::{identity, literal, targets};
use crate::js;
use crate::style::{Declaration, Labels, NamedStyle, Value};
use crate::web::internal::class_name::{self, CreateOptions, Registry, Units, Used, Visibility};
use crate::web::internal::contributions;
use crate::web::internal::themes::{Emitted, Resource, Scope, Shared, Themes};

/// Fixed class identities used by CSS-only consumers, keyed by style name.
pub type Names = FxHashMap<Arc<str>, Arc<str>>;

/// Environment-independent compiler input.
#[derive(Clone, Copy, Debug, Default)]
pub struct Options<'a> {
    /// Composition for styles without their own mode. Ordered by default, preserving precedence
    /// across combined class lists.
    pub composition: Option<Composition>,
    /// Eager module-level stylesheet contributions, supplied as static data.
    pub contributions: &'a [contributions::Definition],
    /// CSS representation; atomic declarations are the default.
    pub css_output: Option<CssOutput>,
    /// Retains live definitions for development updates.
    pub development: bool,
    /// Readable source bindings and consumer-owned configuration namespaces.
    pub labels: Option<&'a Labels>,
    /// Fixed class identities used by CSS-only consumers.
    pub names: Option<&'a Names>,
    /// Emits the `color-scheme` selection classes.
    pub schemes: bool,
    /// Explicit consumer-owned namespace for independently delivered stylesheets.
    pub scope: Option<&'a str>,
    /// Separates generated token rules for hosts with independent CSS resources.
    pub shared: Option<Shared>,
    /// Ordered definitions; no themes or source adapter is required.
    pub styles: &'a [Arc<NamedStyle>],
    /// Named scopes; only variables referenced by these styles are emitted.
    pub vars: Option<&'a [(Arc<str>, Scope)]>,
}

/// Static web artifacts keyed by authored names.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Output {
    /// Readable space-separated class identifiers per authored style, in insertion order.
    pub classes: IndexMap<Arc<str>, String, FxBuildHasher>,
    /// Contribution text separated for graph-wide hoisting.
    pub contribution_css: Option<String>,
    /// Factored CSS preserving cascade behavior, without reset or layers.
    pub css: String,
    /// Exact emitted rule bodies retained for graph-wide collision diagnostics.
    pub rules: IndexMap<String, String, FxBuildHasher>,
    /// Ordinary scope and style rules when contributions were supplied.
    pub scoped_css: Option<String>,
    /// Shared token resources omitted from this module's stylesheet.
    pub shared: Option<Vec<Resource>>,
    /// Shared rule names chosen by this compilation, for graph cache validation.
    pub units: Used,
    /// Scope classes keyed by the supplied theme labels.
    pub vars: IndexMap<Arc<str>, String, FxBuildHasher>,
}

/// A stable failure category.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Code {
    /// Generated or explicit identities collide.
    IdentityCollision,
    /// A declaration or contribution cannot be serialized.
    InvalidDeclaration,
    /// A style name is empty or repeated.
    InvalidName,
    /// A CSS output mode is neither atomic nor grouped.
    InvalidOutput,
    /// A theme scope cannot be emitted.
    InvalidTheme,
}

impl Code {
    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::IdentityCollision => "identity_collision",
            Self::InvalidDeclaration => "invalid_declaration",
            Self::InvalidName => "invalid_name",
            Self::InvalidOutput => "invalid_output",
            Self::InvalidTheme => "invalid_theme",
        }
    }
}

/// A literal compilation failure.
#[derive(Clone, Debug, PartialEq)]
pub struct Diagnostic {
    /// Stable failure category.
    pub code: Code,
    /// Explanation of the unsupported input.
    pub message: String,
    /// Authored style name, followed by a property when applicable.
    pub path: Vec<Arc<str>>,
}

impl Diagnostic {
    /// Creates a diagnostic.
    #[cold]
    pub fn new(code: Code, message: impl Into<String>, path: Vec<Arc<str>>) -> Self {
        Self {
            code,
            message: message.into(),
            path,
        }
    }
}

/// Formats the message of `Css.CompileError`.
pub fn error_message(diagnostics: &[Diagnostic]) -> String {
    let mut output = String::new();

    for (index, diagnostic) in diagnostics.iter().enumerate() {
        if index > 0 {
            output.push('\n');
        }

        output.push('[');

        for (position, part) in diagnostic.path.iter().enumerate() {
            if position > 0 {
                output.push(',');
            }

            js::write_string(&mut output, part);
        }

        output.push_str("]: ");
        output.push_str(&diagnostic.message);
    }

    output
}

/// Emits atomic or grouped CSS without reading files or generating runtime code.
///
/// Class lists are scoped to the complete compilation input. Empty styles return an empty class
/// list and no rule. Without `units`, independent declaration units are named in a private
/// registry, as one standalone compilation does.
///
/// # Errors
///
/// Returns [`Error::Css`] if declarations or themes are invalid, or class identities collide.
pub fn compile(options: &Options<'_>, units: Option<&mut Units<'_>>) -> Result<Output> {
    if let Some(units) = units {
        return compile_with(options, units);
    }

    let mut registry = Registry::new();
    let mut units = registry.scope("", "", Visibility::All);

    compile_with(options, &mut units)
}

/// One group of same-property declarations under nested conditions, in authored order.
#[derive(Clone, Debug)]
struct Item<'a> {
    conditions: Rc<[Arc<str>]>,
    property: &'a str,
    value: Rc<str>,
}

/// Conditions and declarations retained for rules wrapped by media or supports queries.
#[derive(Clone, Debug)]
struct Conditional {
    conditions: Rc<[Arc<str>]>,
    value: Rc<str>,
}

/// A conflict domain's shared body, or `false` once two uses differ.
#[derive(Clone, Debug, PartialEq)]
enum Shareable {
    Body(String),
    Conflicting,
}

#[derive(Debug, Default)]
struct SharedRules {
    atomic: FxHashMap<String, String>,
    grouped: FxHashMap<String, String>,
}

impl SharedRules {
    fn get(&self, output: CssOutput) -> &FxHashMap<String, String> {
        match output {
            CssOutput::Atomic => &self.atomic,
            CssOutput::Grouped => &self.grouped,
        }
    }

    fn get_mut(&mut self, output: CssOutput) -> &mut FxHashMap<String, String> {
        match output {
            CssOutput::Atomic => &mut self.atomic,
            CssOutput::Grouped => &mut self.grouped,
        }
    }
}

/// Interned conflict domains joined by authored shorthands.
#[derive(Debug, Default)]
struct Domains {
    ids: FxHashMap<Box<str>, u32>,
    parents: Vec<u32>,
}

impl Domains {
    fn intern(&mut self, name: &str) -> u32 {
        if let Some(id) = self.ids.get(name) {
            return *id;
        }

        let id = u32::try_from(self.parents.len()).unwrap_or(u32::MAX);

        self.ids.insert(name.into(), id);
        self.parents.push(id);
        id
    }

    fn root(&mut self, id: u32) -> u32 {
        let mut current = id;

        while let Some(parent) = self.parents.get(current as usize).copied() {
            if parent == current {
                break;
            }

            current = parent;
        }

        // Path compression keeps later lookups constant.
        let mut node = id;

        while let Some(parent) = self.parents.get(node as usize).copied() {
            if parent == current {
                break;
            }

            if let Some(slot) = self.parents.get_mut(node as usize) {
                *slot = current;
            }

            node = parent;
        }

        current
    }

    fn union(&mut self, child: u32, parent: u32) {
        if let Some(slot) = self.parents.get_mut(child as usize) {
            *slot = parent;
        }
    }
}

/// Per-style naming state shared by the emission helpers.
struct Application<'a> {
    css_name: String,
    css_namespace: Option<Arc<str>>,
    explicit: Option<&'a Arc<str>>,
    independent: bool,
    index: usize,
    mode: CssOutput,
    name: &'a Arc<str>,
    names: Vec<String>,
    ordinal: usize,
}

/// Line shorthands whose longhands share one conflict domain once any of them is authored.
#[derive(Debug, Default)]
struct Lines {
    border: bool,
    column_rule: bool,
    outline: bool,
}

struct Compiler<'a> {
    conditional_rules: FxHashMap<String, Conditional>,
    conflicts: FxHashMap<&'a str, u32>,
    css_names: FxHashMap<&'a str, Box<str>>,
    diagnostics: Vec<Diagnostic>,
    domains: Domains,
    groups: FxHashMap<u32, Shareable>,
    identical: FxHashMap<Option<Arc<str>>, SharedRules>,
    identities: FxHashMap<String, (Arc<str>, usize)>,
    lines: Lines,
    logical_sizing: bool,
    nested_composition: bool,
    ordered: FxHashMap<u32, Shareable>,
    owned: FxHashMap<usize, FxHashMap<u32, Vec<String>>>,
    resets: bool,
    rules: IndexMap<String, String, FxBuildHasher>,
    runs: FxHashMap<usize, FxHashMap<u32, usize>>,
    selectors: FxHashMap<String, Arc<str>>,
    serialized: FxHashMap<usize, Rc<str>>,
    themes: Option<Themes>,
}

fn composition(style: &NamedStyle, options: &Options<'_>) -> Composition {
    style
        .composition
        .or(options.composition)
        .unwrap_or(Composition::Ordered)
}

/// Development keeps every style ordered so names survive value edits.
fn isolated(style: &NamedStyle, options: &Options<'_>) -> bool {
    composition(style, options) == Composition::Independent && !options.development
}

fn is_layer(condition: Option<&Arc<str>>) -> bool {
    condition.is_some_and(|condition| js::trim(condition) == "@layer")
}

/// Matches `^@(media|supports)\b`.
fn media_or_supports(condition: &str) -> bool {
    ["@media", "@supports"].iter().any(|prefix| {
        condition
            .strip_prefix(prefix)
            .is_some_and(|rest| !rest.starts_with(|character: char| js::is_word(character)))
    })
}

/// Wraps a body in conditions, outermost first.
fn wrap(conditions: &[Arc<str>], body: &str) -> String {
    if conditions.is_empty() {
        return body.to_owned();
    }

    let mut output = String::with_capacity(
        body.len()
            + conditions
                .iter()
                .map(|condition| condition.len() + 2)
                .sum::<usize>(),
    );

    for condition in conditions {
        output.push_str(condition);
        output.push('{');
    }

    output.push_str(body);

    for _ in conditions {
        output.push('}');
    }

    output
}

fn with(conditions: &[Arc<str>], condition: Option<&Arc<str>>) -> Vec<Arc<str>> {
    let mut next = conditions.to_vec();

    if let Some(condition) = condition {
        next.push(Arc::clone(condition));
    }

    next
}

fn canonical(property: &str) -> &str {
    literal::alias(property).unwrap_or(property)
}

/// Matches `^(min|max)?(<names>)$` without case.
fn sizing(property: &str, names: &[&str]) -> bool {
    let rest = property
        .get(..3)
        .filter(|prefix| prefix.eq_ignore_ascii_case("min") || prefix.eq_ignore_ascii_case("max"))
        .and_then(|_| property.get(3..));

    names.iter().any(|name| {
        property.eq_ignore_ascii_case(name)
            || rest.is_some_and(|rest| rest.eq_ignore_ascii_case(name))
    })
}

/// Encodes the output-mode tree for application identity, as `JSON.stringify` distinguishes it.
fn representation(output: &mut String, style: &NamedStyle) {
    output.push(match style.css_output {
        Some(CssOutput::Atomic) => 'a',
        Some(CssOutput::Grouped) => 'g',
        None => '-',
    });

    if let Some(rules) = &style.rules {
        output.push('(');

        for rule in rules {
            representation(output, &rule.style);
        }

        output.push(')');
    }
}

impl<'a> Compiler<'a> {
    fn css_name(&mut self, property: &'a str) -> &str {
        self.css_names
            .entry(property)
            .or_insert_with(|| literal::name(property).into())
    }

    fn domain<'p>(&self, property: &'p str) -> Cow<'p, str> {
        if self.resets
            && !property.starts_with("--")
            && property != "direction"
            && property != "unicodeBidi"
        {
            return Cow::Borrowed("all");
        }

        let fixed = |name: &'static str| Cow::Borrowed(name);

        if matches!(
            property,
            "marker" | "markerStart" | "markerMid" | "markerEnd"
        ) {
            return fixed("marker");
        }

        if property.starts_with("corner") {
            return fixed("cornerShape");
        }

        if property.starts_with("containIntrinsic") {
            return fixed("containIntrinsicSize");
        }

        if property.starts_with("interestDelay") {
            return fixed("interestDelay");
        }

        if property.starts_with("backgroundPosition") {
            return fixed("backgroundPosition");
        }

        if self.lines.column_rule && property.starts_with("columnRule") {
            return fixed("columnRule");
        }

        if self.lines.outline && property.starts_with("outline") {
            return fixed("outline");
        }

        if property.starts_with("borderImage") {
            return fixed("borderImage");
        }

        if property.starts_with("border") {
            if self.lines.border {
                return fixed("border");
            }

            if property.ends_with("Color") {
                return fixed("borderColor");
            }

            if property.ends_with("Style") {
                return fixed("borderStyle");
            }

            if property.ends_with("Width") {
                return fixed("borderWidth");
            }

            return fixed("borderRadius");
        }

        if matches!(property, "flexDirection" | "flexFlow" | "flexWrap") {
            return fixed("flexFlow");
        }

        for (prefix, name) in [
            ("pageBreakAfter", "breakAfter"),
            ("pageBreakBefore", "breakBefore"),
            ("pageBreakInside", "breakInside"),
            ("breakAfter", "breakAfter"),
            ("breakBefore", "breakBefore"),
            ("breakInside", "breakInside"),
        ] {
            if property == prefix {
                return fixed(name);
            }
        }

        if matches!(property, "fontStretch" | "fontWidth") {
            return fixed("fontWidth");
        }

        if property.starts_with("fontSynthesis") {
            return fixed("fontSynthesis");
        }

        if matches!(
            property,
            "whiteSpace"
                | "whiteSpaceCollapse"
                | "whiteSpaceTrim"
                | "textWrap"
                | "textWrapMode"
                | "textWrapStyle"
        ) {
            return fixed("whiteSpace");
        }

        if matches!(property, "wordWrap" | "overflowWrap") {
            return fixed("overflowWrap");
        }

        if property.starts_with("margin") {
            return fixed("margin");
        }

        if property.starts_with("padding") {
            return fixed("padding");
        }

        if matches!(
            property,
            "overflow" | "overflowX" | "overflowY" | "overflowBlock" | "overflowInline"
        ) {
            return fixed("overflow");
        }

        if property.starts_with("overscrollBehavior") {
            return fixed("overscrollBehavior");
        }

        if property.starts_with("scrollMargin") {
            return fixed("scrollMargin");
        }

        if property.starts_with("scrollPadding") {
            return fixed("scrollPadding");
        }

        if matches!(property, "columnGap" | "gap" | "rowGap") {
            return fixed("gap");
        }

        if property.starts_with("inset") || matches!(property, "top" | "right" | "bottom" | "left")
        {
            return fixed("inset");
        }

        if self.logical_sizing && sizing(property, &["width", "height", "blockSize", "inlineSize"])
        {
            if property.starts_with("min") {
                return fixed("min-size");
            }

            if property.starts_with("max") {
                return fixed("max-size");
            }

            return fixed("size");
        }

        Cow::Borrowed(property)
    }

    fn domain_root(&mut self, property: &str) -> u32 {
        let name = self.domain(canonical(property)).into_owned();
        let id = self.domains.intern(&name);

        self.domains.root(id)
    }

    /// Unions only authored shorthands. Unrelated axes retain their original factoring, and
    /// recursion includes nested and reset-only shorthands without parsing CSS values.
    fn join(&mut self, property: &str, target: &str, visited: &mut FxHashSet<String>) {
        if !visited.insert(property.to_owned()) {
            return;
        }

        let current = self.domain_root(property);
        let target_id = self.domains.intern(target);
        let group = self.domains.root(target_id);

        if current != group {
            self.domains.union(current, group);
        }

        if let Some(children) = cascade::shorthand(property) {
            for child in children {
                self.join(child, target, visited);
            }
        }
    }

    fn conflict(&mut self, property: &'a str) -> u32 {
        if let Some(id) = self.conflicts.get(property) {
            return *id;
        }

        let id = self.domain_root(property);

        self.conflicts.insert(property, id);
        id
    }

    fn serialize_token(&mut self, reference: &Arc<Reference>) -> Rc<str> {
        let key = Arc::as_ptr(reference).addr();

        if let Some(value) = self.serialized.get(&key) {
            return Rc::clone(value);
        }

        let value: Rc<str> = self
            .themes
            .get_or_insert_with(Themes::new)
            .serialize(reference)
            .into();

        self.serialized.insert(key, Rc::clone(&value));
        value
    }

    fn write_value(&mut self, output: &mut String, value: &Value) {
        match value {
            Value::Number(number) => js::write_number(output, *number),
            Value::String(text) => output.push_str(text),
            Value::Binding(binding) => {
                output.push_str("var(");
                output.push_str(&binding.name);
                output.push(')');
            }
            Value::Token(reference) => output.push_str(&self.serialize_token(reference)),
            Value::Expression(expression) => {
                for part in &expression.parts {
                    match part {
                        Part::Text(text) => output.push_str(text),
                        Part::Binding(binding) => {
                            output.push_str("var(");
                            output.push_str(&binding.name);
                            output.push(')');
                        }
                        Part::Reference(reference) => {
                            output.push_str(&self.serialize_token(reference));
                        }
                    }
                }
            }
        }
    }

    /// Appends `name:value[!important];`.
    fn write_declaration(&mut self, output: &mut String, declaration: &'a Declaration) {
        output.push_str(self.css_name(&declaration.property));
        output.push(':');
        self.write_value(output, &declaration.value);

        if declaration.important {
            output.push_str("!important");
        }

        output.push(';');
    }

    fn write_nested(&mut self, output: &mut String, style: &'a NamedStyle) {
        if let Some(rules) = &style.rules {
            for rule in rules {
                match &rule.condition {
                    None => self.write_nested(output, &rule.style),
                    Some(condition) => {
                        output.push_str(condition);
                        output.push('{');
                        self.write_nested(output, &rule.style);
                        output.push('}');
                    }
                }
            }

            return;
        }

        for declaration in &style.declarations {
            self.write_declaration(output, declaration);
        }
    }

    fn nested(&mut self, style: &'a NamedStyle) -> String {
        let mut output = String::new();

        self.write_nested(&mut output, style);
        output
    }

    /// Lists declaration groups in authored order. `None` marks styles whose nested grouped
    /// output or anonymous layers emit one opaque rule.
    fn flatten(&mut self, style: &'a NamedStyle, conditions: &[Arc<str>]) -> Option<Vec<Item<'a>>> {
        if style.css_output == Some(CssOutput::Grouped) {
            return None;
        }

        if let Some(rules) = &style.rules {
            let mut items = Vec::new();

            for rule in rules {
                if is_layer(rule.condition.as_ref()) {
                    return None;
                }

                let next = with(conditions, rule.condition.as_ref());

                items.extend(self.flatten(&rule.style, &next)?);
            }

            return Some(items);
        }

        let shared: Rc<[Arc<str>]> = conditions.into();
        let declarations = &style.declarations;
        let mut items = Vec::new();
        let mut index = 0;

        while let Some(first) = declarations.get(index) {
            let property = &*first.property;
            let mut value = String::new();

            // Same-property fallbacks stay ordered; they form one semantic value.
            while let Some(declaration) = declarations
                .get(index)
                .filter(|declaration| &*declaration.property == property)
            {
                self.write_declaration(&mut value, declaration);
                index += 1;
            }

            items.push(Item {
                conditions: Rc::clone(&shared),
                property,
                value: value.into(),
            });
        }

        Some(items)
    }

    fn by_domain(&mut self, items: &[Item<'a>]) -> IndexMap<u32, Vec<usize>, FxBuildHasher> {
        let mut result: IndexMap<u32, Vec<usize>, FxBuildHasher> = IndexMap::default();

        for (index, item) in items.iter().enumerate() {
            let key = self.conflict(item.property);

            result.entry(key).or_default().push(index);
        }

        result
    }

    fn collision(&mut self, name: &Arc<str>) {
        self.diagnostics.push(Diagnostic::new(
            Code::IdentityCollision,
            "Generated class names conflict. Supply distinct config or style ids.",
            vec![Arc::clone(name)],
        ));
    }

    fn emit(
        &mut self,
        state: &mut Application<'a>,
        body: String,
        label: &str,
        shared: bool,
        output: CssOutput,
        conditional: Option<Conditional>,
    ) -> Option<String> {
        if body.is_empty() {
            return None;
        }

        let reusable = state.explicit.is_none()
            && (shared
                || (state.independent && state.mode == CssOutput::Grouped && output == state.mode));
        let previous = if reusable {
            self.identical
                .get(&state.css_namespace)
                .and_then(|rules| rules.get(output).get(&body))
                .cloned()
        } else {
            None
        };

        if let Some(previous) = &previous
            && !state.names.contains(previous)
        {
            state.names.push(previous.clone());
            return Some(previous.clone());
        }

        let shared = shared && previous.is_none();
        // Contextual slots preserve authored ordering; development names survive value edits.
        let slot = state.ordinal;

        state.ordinal += 1;

        let namespace = state.css_namespace.as_deref();
        let identity = if let Some(explicit) = state.explicit {
            let mut identity = String::with_capacity(explicit.len() + label.len() + 16);
            let _ = write!(identity, "{explicit}-{}-", state.mode.as_str());

            class_name::encode_into(&mut identity, label);

            let _ = write!(identity, "-{slot}");
            identity
        } else if output == CssOutput::Grouped && state.mode == CssOutput::Grouped {
            let mut identity = String::with_capacity(state.css_name.len() + 16);

            identity.push_str("z-");

            if let Some(namespace) = namespace.filter(|namespace| !namespace.is_empty()) {
                identity.push_str(namespace);
                identity.push('-');
            }

            identity.push_str(&state.css_name);

            if slot > 0 {
                let _ = write!(identity, "__{slot}");
            }

            identity
        } else {
            class_name::create(&CreateOptions {
                body: &body,
                context: (!shared).then_some(state.css_name.as_str()),
                namespace,
                property: label,
                slot: (!shared).then_some(slot),
            })
        };
        let owner =
            (state.mode == CssOutput::Atomic && !shared).then(|| (Arc::clone(state.name), slot));

        if self
            .rules
            .get(&identity)
            .is_some_and(|existing| *existing != body)
            || owner.as_ref().is_some_and(|owner| {
                self.identities
                    .get(&identity)
                    .is_some_and(|existing| existing != owner)
            })
        {
            self.collision(state.name);
        }

        if let Some(owner) = owner {
            self.identities.insert(identity.clone(), owner);
        }

        if let Some(conditional) = conditional
            && conditional
                .conditions
                .iter()
                .any(|condition| media_or_supports(condition))
        {
            self.conditional_rules.insert(identity.clone(), conditional);
        }

        if let Some(explicit) = state.explicit {
            self.rules.insert(identity.clone(), body);
            self.selectors
                .insert(identity.clone(), Arc::clone(explicit));
        } else {
            if reusable {
                self.identical
                    .entry(state.css_namespace.clone())
                    .or_default()
                    .get_mut(output)
                    .insert(body.clone(), identity.clone());
            }

            self.rules.insert(identity.clone(), body);
            state.names.push(identity.clone());
        }

        Some(identity)
    }

    fn atoms(
        &mut self,
        state: &mut Application<'a>,
        style: &'a NamedStyle,
        conditions: &[Arc<str>],
    ) {
        if style.css_output == Some(CssOutput::Grouped) {
            let inner = self.nested(style);

            self.emit(
                state,
                wrap(conditions, &inner),
                "style",
                false,
                CssOutput::Grouped,
                None,
            );
            return;
        }

        if let Some(rules) = &style.rules {
            for rule in rules {
                if is_layer(rule.condition.as_ref()) {
                    // Repeating an anonymous layer would change cascade precedence.
                    let inner = self.nested(&rule.style);
                    let all = with(conditions, rule.condition.as_ref());
                    let mode = state.mode;

                    self.emit(state, wrap(&all, &inner), "layer", false, mode, None);
                    continue;
                }

                let next = with(conditions, rule.condition.as_ref());

                self.atoms(state, &rule.style, &next);
            }

            return;
        }

        let declarations = &style.declarations;
        let shared_conditions: Rc<[Arc<str>]> = conditions.into();
        let mut index = 0;

        while let Some(first) = declarations.get(index) {
            let property = &*first.property;
            let start = index;

            index += 1;

            // Same-property fallbacks stay ordered; they form one semantic value.
            while declarations
                .get(index)
                .is_some_and(|declaration| &*declaration.property == property)
            {
                index += 1;
            }

            let domain = self.conflict(property);

            if let Some(reused) = self
                .runs
                .get(&state.index)
                .and_then(|runs| runs.get(&domain))
                .and_then(|owner| self.owned.get(owner))
                .and_then(|owned| owned.get(&domain))
            {
                for identity in reused {
                    if !state.names.contains(identity) {
                        state.names.push(identity.clone());
                    }
                }

                continue;
            }

            let mut value = String::new();

            for declaration in declarations.get(start..index).unwrap_or_default() {
                self.write_declaration(&mut value, declaration);
            }

            let body = wrap(conditions, &value);
            let shared = !self.nested_composition
                && conditions.is_empty()
                && self.ordered.get(&domain) != Some(&Shareable::Conflicting);
            let mode = state.mode;
            let identity = self.emit(
                state,
                body,
                property,
                shared,
                mode,
                Some(Conditional {
                    conditions: Rc::clone(&shared_conditions),
                    value: value.into(),
                }),
            );

            if let Some(identity) = identity {
                self.owned
                    .entry(state.index)
                    .or_default()
                    .entry(domain)
                    .or_default()
                    .push(identity);
            }
        }
    }

    /// Independent class lists never combine, so only declarations within one conflict domain
    /// need relative order. Equal domain bodies share one rule.
    fn share(&mut self, state: &mut Application<'a>, style: &'a NamedStyle, units: &mut Units<'_>) {
        let Some(items) = self.flatten(style, &[]) else {
            self.atoms(state, style, &[]);
            return;
        };

        for list in self.by_domain(&items).into_values() {
            // Conditional rules stay contextual to keep their order against base declarations.
            if list
                .iter()
                .filter_map(|index| items.get(*index))
                .any(|item| !item.conditions.is_empty())
            {
                for item in list.iter().filter_map(|index| items.get(*index)) {
                    let mode = state.mode;

                    self.emit(
                        state,
                        wrap(&item.conditions, &item.value),
                        item.property,
                        false,
                        mode,
                        Some(Conditional {
                            conditions: Rc::clone(&item.conditions),
                            value: Rc::clone(&item.value),
                        }),
                    );
                }

                continue;
            }

            let mut body = String::new();

            for item in list.iter().filter_map(|index| items.get(*index)) {
                body.push_str(&item.value);
            }

            let identity = units.name(&body, state.css_namespace.as_deref());

            if self
                .rules
                .get(&identity)
                .is_some_and(|existing| *existing != body)
            {
                self.collision(state.name);
            }

            self.rules.insert(identity.clone(), body);
            state.names.push(identity);
        }
    }
}

/// The `Css.CompileError` for an output mode that is neither atomic nor grouped.
///
/// Typed output modes cannot be invalid in Rust, so hosts decoding untyped input report the
/// first invalid mode in the order `Css.compile` validates them: the compilation option, then
/// each style before its rules and its web branch.
#[cold]
pub fn invalid_output(path: Vec<Arc<str>>) -> Error {
    Error::Css(vec![Diagnostic::new(
        Code::InvalidOutput,
        "cssOutput must be atomic or grouped.",
        path,
    )])
}

fn compile_with(options: &Options<'_>, units: &mut Units<'_>) -> Result<Output> {
    let styles: Vec<Arc<NamedStyle>> = options.styles.iter().map(targets::web).collect();
    let mut compiler = Compiler {
        conditional_rules: FxHashMap::default(),
        conflicts: FxHashMap::default(),
        css_names: FxHashMap::default(),
        diagnostics: Vec::new(),
        domains: Domains::default(),
        groups: FxHashMap::default(),
        identical: FxHashMap::default(),
        identities: FxHashMap::default(),
        lines: Lines::default(),
        logical_sizing: false,
        nested_composition: styles
            .iter()
            .any(|style| style.rules.is_some() && !isolated(style, options)),
        ordered: FxHashMap::default(),
        owned: FxHashMap::default(),
        resets: false,
        rules: IndexMap::default(),
        runs: FxHashMap::default(),
        selectors: FxHashMap::default(),
        serialized: FxHashMap::default(),
        themes: None,
    };

    run(&mut compiler, options, &styles, units)
}

fn collect<'s>(style: &'s NamedStyle, properties: &mut IndexMap<&'s str, (), FxBuildHasher>) {
    for declaration in &style.declarations {
        properties.insert(&declaration.property, ());
    }

    for rule in style.rules.iter().flatten() {
        collect(&rule.style, properties);
    }
}

fn run<'a>(
    compiler: &mut Compiler<'a>,
    options: &Options<'a>,
    styles: &'a [Arc<NamedStyle>],
    units: &mut Units<'_>,
) -> Result<Output> {
    // Conditional and composed declarations join the same conflict domains.
    let mut properties: IndexMap<&str, (), FxBuildHasher> = IndexMap::default();

    for style in styles {
        collect(style, &mut properties);
    }

    // Logical dimensions may alias either physical axis in inherited writing modes. Preserve
    // physical-only factoring when no logical dimension is authored.
    compiler.logical_sizing = properties
        .keys()
        .any(|property| sizing(canonical(property), &["blockSize", "inlineSize"]));
    compiler.resets = properties.contains_key("all");

    for property in properties.keys() {
        if literal::rule(property).is_some_and(|rule| rule.kind == Kind::Line) {
            let name = canonical(property);

            if name.starts_with("border") {
                compiler.lines.border = true;
            } else if name == "columnRule" {
                compiler.lines.column_rule = true;
            } else if name == "outline" {
                compiler.lines.outline = true;
            }
        }
    }

    let mut shorthands: IndexMap<&str, (), FxBuildHasher> = IndexMap::default();

    for property in properties.keys() {
        shorthands.insert(canonical(property), ());
    }

    for property in shorthands.keys() {
        if cascade::shorthand(property).is_some() {
            let target = compiler.domain(property).into_owned();

            compiler.join(property, &target, &mut FxHashSet::default());
        }
    }

    // Sharing is safe only when every use of a conflict domain has the same declaration
    // sequence. Conditions conservatively retain contextual identities, and isolated class
    // lists never combine, so atomic sharing considers ordered styles only.
    for style in styles {
        let mut domains: FxHashMap<u32, (String, bool, &str)> = FxHashMap::default();
        let mut order: Vec<u32> = Vec::new();

        for item in &style.declarations {
            let property = &*item.property;
            let key = compiler.conflict(property);
            let mut body = String::new();

            compiler.write_declaration(&mut body, item);

            let entry = domains.entry(key).or_insert_with(|| {
                order.push(key);
                (String::new(), false, property)
            });

            entry.0.push_str(&body);
            entry.1 |= entry.2 != property;
        }

        let combinable = !isolated(style, options);

        for key in order {
            let Some((body, mixed, _)) = domains.get(&key) else {
                continue;
            };
            let maps: &mut [&mut FxHashMap<u32, Shareable>] = if combinable {
                &mut [&mut compiler.groups, &mut compiler.ordered]
            } else {
                &mut [&mut compiler.groups]
            };

            for map in maps.iter_mut() {
                let next = match map.get(&key) {
                    Some(Shareable::Conflicting) => Shareable::Conflicting,
                    _ if *mixed => Shareable::Conflicting,
                    Some(Shareable::Body(previous)) if previous != body => Shareable::Conflicting,
                    _ => Shareable::Body(body.clone()),
                };

                map.insert(key, next);
            }
        }
    }

    let default_mode = options.css_output.unwrap_or(CssOutput::Atomic);
    let mut occurrences: FxHashMap<u32, usize> = FxHashMap::default();

    for style in styles {
        for declaration in &style.declarations {
            let key = compiler.conflict(&declaration.property);

            *occurrences.entry(key).or_default() += 1;
        }
    }

    let explicit_name = |style: &NamedStyle| -> Option<&Arc<str>> {
        options.names.and_then(|names| names.get(&style.name))
    };

    // An ordered atomic style reuses the rules of the previous style that set a domain to the
    // same sequence: no differing rule sits between them.
    if !options.development {
        type Key = Vec<(Rc<[Arc<str>]>, Rc<str>)>;
        let mut last: FxHashMap<u32, (Key, usize)> = FxHashMap::default();

        for (index, style) in styles.iter().enumerate() {
            if isolated(style, options) {
                continue;
            }

            let items = if style.css_output.unwrap_or(default_mode) == CssOutput::Atomic
                && explicit_name(style).is_none()
            {
                compiler.flatten(style, &[])
            } else {
                None
            };

            // Grouped, explicit, and opaque rules may set any domain.
            let Some(items) = items else {
                last.clear();
                continue;
            };

            for (domain, list) in compiler.by_domain(&items) {
                let key: Key = list
                    .iter()
                    .filter_map(|position| items.get(*position))
                    .map(|item| (Rc::clone(&item.conditions), Rc::clone(&item.value)))
                    .collect();

                match last.get(&domain) {
                    Some((previous, owner)) if *previous == key => {
                        compiler
                            .runs
                            .entry(index)
                            .or_default()
                            .insert(domain, *owner);
                    }
                    _ => {
                        last.insert(domain, (key, index));
                    }
                }
            }
        }
    }

    let labels = options.labels;
    let scope_namespace: Option<Arc<str>> = options
        .scope
        .filter(|scope| !scope.is_empty())
        .map(|scope| identity::name(scope).into());
    let mut classes: IndexMap<Arc<str>, String, FxBuildHasher> = IndexMap::default();
    let mut explicit_bodies: FxHashMap<Arc<str>, String> = FxHashMap::default();
    let mut explicit_modes: FxHashSet<(Arc<str>, &'static str)> = FxHashSet::default();
    let mut applications: FxHashMap<String, String> = FxHashMap::default();

    for (index, style) in styles.iter().enumerate() {
        let mode = style.css_output.unwrap_or(default_mode);
        let independent =
            composition(style, options) == Composition::Independent && !options.development;

        if style.name.is_empty() || classes.contains_key(&style.name) {
            compiler.diagnostics.push(Diagnostic::new(
                Code::InvalidName,
                "Style names must be nonempty and unique.",
                vec![Arc::clone(&style.name)],
            ));
            continue;
        }

        let explicit = explicit_name(style);

        if let Some(explicit) = explicit {
            let body = compiler.nested(style);

            if explicit_bodies
                .get(explicit)
                .is_some_and(|previous| *previous != body)
            {
                compiler.diagnostics.push(Diagnostic::new(
                    Code::IdentityCollision,
                    "An explicit id is used for different styles.",
                    vec![Arc::clone(&style.name)],
                ));
            }

            explicit_bodies.insert(Arc::clone(explicit), body);
            classes.insert(Arc::clone(&style.name), explicit.to_string());

            if !explicit_modes.insert((Arc::clone(explicit), mode.as_str())) {
                continue;
            }
        }

        let application = (explicit.is_none() && independent).then(|| {
            let mut key = String::from(mode.as_str());

            key.push(':');

            if style.rules.is_some() {
                representation(&mut key, style);
            }

            key.push(':');
            compiler.write_nested(&mut key, style);
            key
        });

        if let Some(application) = &application
            && let Some(class) = applications.get(application)
        {
            classes.insert(Arc::clone(&style.name), class.clone());
            continue;
        }

        let label = labels.and_then(|labels| labels.get(&style.name));
        let mut state = Application {
            css_name: label.map_or_else(
                || class_name::encode(&style.name),
                |label| label.name.to_string(),
            ),
            css_namespace: label
                .and_then(|label| label.namespace.clone())
                .or_else(|| scope_namespace.clone()),
            explicit,
            independent,
            index,
            mode,
            name: &style.name,
            names: explicit
                .map(|explicit| vec![explicit.to_string()])
                .unwrap_or_default(),
            ordinal: 0,
        };

        match mode {
            CssOutput::Grouped => {
                let mut shared: Vec<&Declaration> = Vec::new();
                let mut local: Vec<&Declaration> = Vec::new();

                for declaration in &style.declarations {
                    let key = compiler.conflict(&declaration.property);
                    let reusable = style.rules.is_none()
                        && independent
                        && compiler.groups.get(&key) != Some(&Shareable::Conflicting)
                        && occurrences.get(&key).copied().unwrap_or_default() > 1;

                    if reusable {
                        shared.push(declaration);
                    } else {
                        local.push(declaration);
                    }
                }

                if !shared.is_empty() && !local.is_empty() {
                    let mut body = String::new();

                    for declaration in shared {
                        compiler.write_declaration(&mut body, declaration);
                    }

                    compiler.emit(&mut state, body, "shared", false, mode, None);

                    let mut body = String::new();

                    for declaration in local {
                        compiler.write_declaration(&mut body, declaration);
                    }

                    compiler.emit(&mut state, body, "style", false, mode, None);
                } else {
                    let body = compiler.nested(style);

                    compiler.emit(&mut state, body, "style", false, mode, None);
                }
            }
            CssOutput::Atomic if explicit.is_none() && independent => {
                compiler.share(&mut state, style, units);
            }
            CssOutput::Atomic => compiler.atoms(&mut state, style, &[]),
        }

        let mut seen: FxHashSet<&str> = FxHashSet::default();
        let mut list = String::new();

        for name in &state.names {
            if seen.insert(name) {
                if !list.is_empty() {
                    list.push(' ');
                }

                list.push_str(name);
            }
        }

        if let Some(application) = application {
            applications.insert(application, list.clone());
        }

        classes.insert(Arc::clone(&style.name), list);
    }

    if !compiler.diagnostics.is_empty() {
        return Err(Error::Css(std::mem::take(&mut compiler.diagnostics)));
    }

    let contribution_css = contributions::render(options.contributions, &mut |output, style| {
        compiler.write_nested(output, style);
    })
    .map_err(|message| {
        Error::Css(vec![Diagnostic::new(
            Code::InvalidDeclaration,
            message,
            vec![Arc::from("contributions")],
        )])
    })?;
    let scopes = if compiler.themes.is_some() || options.vars.is_some() || options.schemes {
        compiler
            .themes
            .get_or_insert_with(Themes::new)
            .emit(
                options.vars.unwrap_or_default(),
                options.schemes,
                options.shared,
            )
            .map_err(|message| {
                Error::Css(vec![Diagnostic::new(
                    Code::InvalidTheme,
                    message,
                    vec![Arc::from("vars")],
                )])
            })?
    } else {
        Emitted::default()
    };
    let mut scoped_css = String::with_capacity(
        scopes.css.len()
            + compiler
                .rules
                .iter()
                .map(|(name, body)| name.len() + body.len() + 4)
                .sum::<usize>(),
    );

    scoped_css.push_str(&scopes.css);

    for (name, body) in &compiler.rules {
        if !scoped_css.is_empty() {
            scoped_css.push('\n');
        }

        let mut selector = String::with_capacity(name.len() + 1);

        selector.push('.');
        selector.push_str(&class_name::selector(
            compiler
                .selectors
                .get(name)
                .map_or(name.as_str(), |explicit| explicit),
        ));

        let conditional = compiler.conditional_rules.get(name).filter(|conditional| {
            !conditional
                .conditions
                .iter()
                .any(|condition| condition.starts_with('@') && !media_or_supports(condition))
        });
        let Some(conditional) = conditional else {
            scoped_css.push_str(&selector);
            scoped_css.push('{');
            scoped_css.push_str(body);
            scoped_css.push('}');
            continue;
        };

        // Inactive conditions must surround the class rather than leave a matched empty wrapper.
        let (at_rules, nested): (Vec<Arc<str>>, Vec<Arc<str>>) = conditional
            .conditions
            .iter()
            .cloned()
            .partition(|condition| condition.starts_with('@'));
        let inner = wrap(&nested, &conditional.value);
        let mut rule = String::with_capacity(selector.len() + inner.len() + 2);

        rule.push_str(&selector);
        rule.push('{');
        rule.push_str(&inner);
        rule.push('}');
        scoped_css.push_str(&wrap(&at_rules, &rule));
    }

    let mut rules = std::mem::take(&mut compiler.rules);

    for rule in &scopes.rules {
        let mut conditions = String::from("[");

        for (index, condition) in rule.conditions.iter().enumerate() {
            if index > 0 {
                conditions.push(',');
            }

            js::write_string(&mut conditions, condition);
        }

        conditions.push(']');

        let key = format!(
            "@scope:{}:{}:{}",
            rule.selector.get(1..).unwrap_or_default(),
            identity::name(&rule.property),
            identity::name(&conditions)
        );

        rules.insert(key, rule.value.clone());
    }

    let css = match (contribution_css.is_empty(), scoped_css.is_empty()) {
        (true, _) => scoped_css.clone(),
        (false, true) => contribution_css.clone(),
        (false, false) => format!("{contribution_css}\n{scoped_css}"),
    };
    let has_contributions = !contribution_css.is_empty();

    Ok(Output {
        classes,
        contribution_css: has_contributions.then_some(contribution_css),
        css,
        rules,
        scoped_css: has_contributions.then_some(scoped_css),
        shared: (!scopes.resources.is_empty()).then_some(scopes.resources),
        units: units.used().clone(),
        vars: scopes.classes,
    })
}
