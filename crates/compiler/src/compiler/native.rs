//! Rewrites shared authoring to native tables and ordered runtime bindings, mirroring
//! `Native.compile`.
//!
//! Each definition call becomes a callable over tables precompiled for the selected set and
//! scheme, or for every set and scheme when the module compiles contextually. Native variable reads
//! become profile constants, packed library exports become native overlays, and `cx` bindings take
//! the runtime composer. Offsets are UTF-8 internally. Edits and generated names carry the UTF-16
//! offsets the TypeScript compiler reports.

use std::fmt::Write as _;
use std::sync::Arc;

use indexmap::{IndexMap, IndexSet};
use oxc_ast::AstKind;
use oxc_ast::ast::{
    BindingPattern, Declaration, ImportDeclarationSpecifier, ImportOrExportKind, Statement,
    TSNamespaceDeclarationBody,
};
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::compiler::internal::edits::Edit;
use crate::compiler::internal::native_bindings::{self, Prepared};
use crate::compiler::internal::native_media;
use crate::compiler::internal::native_vars::{self, Shared};
use crate::compiler::internal::syntax::Parsed;
use crate::compiler::internal::themes::{Context, Link, LinkKind, Output as ThemeOutput};
use crate::compiler::source::{Call, Extracted, NativeContext};
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::recipe;
use crate::internal::theme::Definition;
use crate::js::{self, Record};
use crate::mapping::magic_string::{MagicString, MapOptions};
use crate::react_native::internal::scalar;
use crate::react_native::style_sheet::{self, Schemes, Table, Tables};
use crate::react_native::variants;
use crate::runtime::internal::native_media::write_queries;
use crate::runtime::recipe as runtime;
use crate::style::{self, NamedStyle, Rule};

/// Explicit source and native context of one module, independent of device state.
#[derive(Clone, Debug)]
pub struct Options<'s, 'a> {
    /// Scheme compiled into the module's callables. Other values fail table selection.
    pub color_scheme: Option<&'s str>,
    /// Compiler-owned graph context: canonical identifiers and packed library exports.
    pub context: Option<&'s Context<'a>>,
    /// Retains every set and scheme for render-local selection.
    pub contextual: bool,
    /// Authored `fonts` option, `Data::Undefined` when omitted.
    pub fonts: Data,
    /// Stable source identity, including the TypeScript or JavaScript extension.
    pub module_id: &'s str,
    /// Authored `platform` option, `Data::Undefined` when omitted.
    pub platform: Data,
    /// Babel emission: omits generated type annotations and shares table factories.
    pub runtime: bool,
    /// Label selected from `vars`. Defaults to the token-fallback `default` table.
    pub set: Option<&'s str>,
    /// Graph-owned native variable profiles of this module.
    pub shared: Option<&'s Shared>,
    /// Complete module text.
    pub source: &'a str,
    /// Authored `units` option, `Data::Undefined` when omitted.
    pub units: Data,
    /// Compatible sets by label. Omission compiles the token-fallback `default` table.
    pub vars: Option<&'s Record<Arc<Definition>>>,
}

impl Default for Options<'_, '_> {
    fn default() -> Self {
        Self {
            color_scheme: None,
            context: None,
            contextual: false,
            fonts: Data::Undefined,
            module_id: "",
            platform: Data::Undefined,
            runtime: false,
            set: None,
            shared: None,
            source: "",
            units: Data::Undefined,
            vars: None,
        }
    }
}

/// Executable source with immutable native data and authored source mappings.
#[derive(Debug)]
pub struct Output {
    /// Rewritten TypeScript or JavaScript preserving the original exports.
    pub code: String,
    /// Node replacements for syntax-tree adapters, with UTF-16 offsets.
    pub edits: Vec<Edit>,
    /// Version-three source map with the original content, as JSON.
    pub map: String,
    /// Set and scheme tables of definitions without variant or scalar programs, in JavaScript
    /// own-property order.
    pub recipes: IndexMap<Arc<str>, Arc<variants::Definition>, FxBuildHasher>,
}

/// Every generated binding starts with this prefix, so only module identifiers sharing it can
/// collide with one.
const PREFIX: &str = "__zyzzNative";

/// Most literal values a shared table factory takes as parameters.
const PARAMETERS: usize = 64;

/// Compiles local styles, variants, and variable reads for an explicit native target.
///
/// `extracted` is the native extraction of `options.source`, and `parsed` its syntax.
///
/// # Errors
///
/// Returns [`Error::Native`] for native features outside the static source boundary,
/// [`Error::StyleSheet`] for unsupported native declaration values, [`Error::StyleSheetSelection`]
/// for an unknown set or scheme, and [`Error::Variants`] for invalid or unbounded recipe data.
pub fn compile<'a>(
    options: &Options<'_, 'a>,
    extracted: &Extracted<'a>,
    parsed: &Parsed<'a>,
) -> Result<Output> {
    let source = options.source;
    let program = parsed.program;

    if !extracted.contributions.is_empty()
        || !extracted.variable_calls.is_empty()
        || !extracted.theme_references.is_empty()
        || !extracted.theme_selections.is_empty()
        || (!options.contextual
            && (!extracted.theme_appearances.is_empty() || !extracted.theme_scripts.is_empty()))
    {
        return Err(native(
            "Native static modules do not support CSS contributions, variables, or web set controls.",
        ));
    }

    let graph = options
        .context
        .and_then(|context| context.identifiers.as_ref());
    let names = Names {
        added: FxHashSet::default(),
        graph,
        module: if graph.is_some() {
            FxHashSet::default()
        } else {
            identifiers(parsed, PREFIX)
        },
    };
    let mut helper = PREFIX.to_owned();

    while ["", "Context", "Dynamic", "Static", "Vars"]
        .iter()
        .any(|suffix| names.has(&format!("{helper}{suffix}")))
    {
        helper.push('_');
    }

    let mut dynamic_helper = format!("{helper}Dynamic");

    while names.has(&dynamic_helper) {
        dynamic_helper.push('_');
    }

    let mut rewriter = Rewriter {
        edits: Vec::new(),
        module: MagicString::new(source),
        parsed,
    };
    let mut styles_by_name: FxHashMap<&str, Vec<Arc<NamedStyle>>> = FxHashMap::default();

    for style in &extracted.styles.styles {
        styles_by_name
            .entry(&style.name)
            .or_default()
            .push(Arc::clone(style));
    }

    let mut compiler = Compiler {
        calls: extracted.calls.len(),
        cached: FxHashMap::default(),
        contexts: IndexMap::default(),
        dynamic: false,
        dynamic_helper,
        factories: IndexMap::default(),
        finite: false,
        helper,
        initializers: FxHashMap::default(),
        literals: FxHashMap::default(),
        names,
        options,
        packed: Vec::new(),
        recipes: IndexMap::default(),
        scalar: scalar::Options::read(&options.fonts, &options.units),
        typed: !options.runtime && typed(options.module_id),
    };

    if !extracted.native_vars.is_empty() {
        style_sheet::compile(&style::Definition::default(), &compiler.stylesheet(None))?;
    }

    let (variables, imports) = compiler.variables(extracted, &mut rewriter)?;
    let static_tables = if options.contextual {
        compiler.batch(extracted, &styles_by_name)?
    } else {
        Vec::new()
    };
    let target = Target {
        color_scheme: options.color_scheme,
        contextual: options.contextual,
        set: options.set,
        vars: options.vars,
    };

    for (index, call) in extracted.calls.iter().enumerate() {
        if (call.recipe.is_some() && call.static_recipe.is_none() && call.dynamic_recipe.is_none())
            || call.output == Some(ThemeOutput::Html)
        {
            return Err(native(
                "Native source compilation does not support named conditions or HTML output.",
            ));
        }

        let single;
        let recipe = match (&call.static_recipe, &call.dynamic_recipe) {
            (Some(recipe), _) | (None, Some(recipe)) => recipe,
            (None, None) => {
                single =
                    single_recipe(styles_by_name.get(&*call.name).cloned().unwrap_or_default());
                &single
            }
        };
        let compiled = static_tables.get(index).and_then(Option::as_ref);
        let code = compiler.callable(recipe, &call.name, call, target, compiled, None)?;

        rewriter.overwrite(call.start, call.end, &code, true)?;
    }

    compiler.libraries(program, &mut rewriter)?;

    let compositions = compiler.compositions(program, &mut rewriter)?;

    if !extracted.calls.is_empty()
        || !compositions.is_empty()
        || !compiler.packed.is_empty()
        || !variables.is_empty()
        || !imports.is_empty()
    {
        let offset = prelude_offset(source, program);
        let prelude = compiler.prelude(&variables, &imports, &compositions);

        rewriter.module.append_left(offset, &prelude)?;
        rewriter.edits.push(Edit {
            code: prelude,
            end: parsed.utf16(offset),
            expression: false,
            start: parsed.utf16(offset),
        });
    }

    let map = rewriter
        .module
        .generate_map(&MapOptions {
            hires: true,
            include_content: true,
            source: Some(options.module_id),
        })
        .to_json();

    Ok(Output {
        code: rewriter.module.to_string(),
        edits: rewriter.edits,
        map,
        recipes: javascript_order(compiler.recipes),
    })
}

#[cold]
fn native(message: impl Into<String>) -> Error {
    Error::Native(message.into())
}

/// Reports a helper failure as `Native.CompileError`, keeping native declaration diagnostics.
fn bindings_error(error: Error) -> Error {
    match error {
        Error::StyleSheet(_) => error,
        other => native(other.text()),
    }
}

/// Whether the module id names a TypeScript module, as `/\.[cm]?tsx?$/` tests.
fn typed(module_id: &str) -> bool {
    let Some(index) = module_id.rfind('.') else {
        return false;
    };
    let extension = &module_id[index + 1..];
    let extension = extension.strip_prefix(['c', 'm']).unwrap_or(extension);

    extension == "ts" || extension == "tsx"
}

/// The single rule of a definition without variants.
fn single_recipe(styles: Vec<Arc<NamedStyle>>) -> recipe::Definition {
    recipe::Definition {
        axes: Vec::new(),
        defaults: Vec::new(),
        rules: vec![recipe::Rule {
            matches: Vec::new(),
            value: style::Definition {
                labels: None,
                styles,
            },
        }],
    }
}

/// Moves array-index keys first in ascending order, as JavaScript objects enumerate them.
fn javascript_order<V>(
    entries: IndexMap<Arc<str>, V, FxBuildHasher>,
) -> IndexMap<Arc<str>, V, FxBuildHasher> {
    if entries.keys().all(|key| js::array_index(key).is_none()) {
        return entries;
    }

    let (mut indexes, names): (Vec<_>, Vec<_>) = entries
        .into_iter()
        .partition(|(key, _)| js::array_index(key).is_some());

    indexes.sort_by_key(|(key, _)| js::array_index(key));
    indexes.into_iter().chain(names).collect()
}

/// The offset after a hashbang line and the directive prologue, where the prelude goes.
fn prelude_offset(source: &str, program: &oxc_ast::ast::Program<'_>) -> u32 {
    let mut offset = 0;

    if source.starts_with("#!") {
        // The first line terminator ends the hashbang, as `/\r\n|[\n\r\u2028\u2029]/` finds it.
        let end = source
            .char_indices()
            .find_map(|(index, character)| match character {
                '\r' if source
                    .get(index + 1..)
                    .is_some_and(|rest| rest.starts_with('\n')) =>
                {
                    Some(index + 2)
                }
                '\n' | '\r' | '\u{2028}' | '\u{2029}' => Some(index + character.len_utf8()),
                _ => None,
            })
            .unwrap_or(source.len());

        offset = u32::try_from(end).unwrap_or(u32::MAX);
    }

    // ESTree lists directives as leading expression statements, and an empty one ends the scan.
    for directive in &program.directives {
        if directive.directive.as_str().is_empty() {
            break;
        }

        offset = directive.span.end;
    }

    offset
}

/// Module identifiers ESTree spells `Identifier` that start with `prefix`, the only ones that can
/// collide with a generated binding sharing it.
pub(crate) fn identifiers<'a>(parsed: &Parsed<'a>, prefix: &str) -> FxHashSet<&'a str> {
    let nodes = parsed.semantic.nodes();

    nodes
        .iter_enumerated()
        .filter_map(|(id, node)| {
            let name = match node.kind() {
                // ESTree spells JSX element names as `JSXIdentifier`.
                AstKind::IdentifierReference(identifier) => {
                    if matches!(
                        nodes.parent_kind(id),
                        AstKind::JSXOpeningElement(_)
                            | AstKind::JSXClosingElement(_)
                            | AstKind::JSXMemberExpression(_)
                    ) {
                        return None;
                    }

                    identifier.name.as_str()
                }
                AstKind::BindingIdentifier(identifier) => identifier.name.as_str(),
                AstKind::IdentifierName(identifier) => identifier.name.as_str(),
                AstKind::LabelIdentifier(identifier) => identifier.name.as_str(),
                _ => return None,
            };

            name.starts_with(prefix).then_some(name)
        })
        .collect()
}

/// Names that generated bindings must avoid.
struct Names<'n> {
    /// Generated bindings.
    added: FxHashSet<String>,
    /// Canonical identifiers collected across the graph, which replace the module walk.
    graph: Option<&'n FxHashSet<Arc<str>>>,
    /// Module identifiers.
    module: FxHashSet<&'n str>,
}

impl Names<'_> {
    fn has(&self, name: &str) -> bool {
        self.added.contains(name)
            || self.module.contains(name)
            || self.graph.is_some_and(|graph| graph.contains(name))
    }

    /// Extends `name` with `_` until it is unused, and reserves it.
    fn reserve(&mut self, mut name: String) -> String {
        while self.has(&name) {
            name.push('_');
        }

        self.added.insert(name.clone());
        name
    }
}

/// Source replacements, recorded both in the rewritten module and as adapter edits.
struct Rewriter<'r, 'a> {
    edits: Vec<Edit>,
    module: MagicString<'a>,
    parsed: &'r Parsed<'a>,
}

impl<'a> Rewriter<'_, 'a> {
    fn overwrite(&mut self, start: u32, end: u32, code: &str, expression: bool) -> Result<()> {
        self.edits.push(Edit {
            code: code.to_owned(),
            end: self.parsed.utf16(end),
            expression,
            start: self.parsed.utf16(start),
        });
        self.module.overwrite(start, end, code)?;

        Ok(())
    }

    fn slice(&self, span: Span) -> &'a str {
        self.parsed
            .source
            .get(span.start as usize..span.end as usize)
            .unwrap_or_default()
    }
}

/// The set, scheme, and catalog a callable compiles for.
#[derive(Clone, Copy)]
struct Target<'t> {
    color_scheme: Option<&'t str>,
    contextual: bool,
    set: Option<&'t str>,
    vars: Option<&'t Record<Arc<Definition>>>,
}

/// A shared factory of serialized table structures.
struct Factory {
    name: String,
    /// Number of `v0`, `v1`, ... parameters.
    parameters: usize,
}

/// A factory call and the literal values it passes.
struct Initializer {
    name: String,
    values: Vec<String>,
}

/// The last table a compiled recipe produced, with the callable emitted for it.
struct Cached {
    /// Keeps the recipe alive, so its address identifies it for the cache's lifetime.
    definition: Arc<variants::Definition>,
    styles: Arc<Table>,
    value: String,
}

/// Profile constant names by serialized profile, in emission order.
type Profiles = IndexMap<String, String, FxBuildHasher>;

/// Imports of profiles that other modules define, in first-read order.
type Imports = IndexSet<String, FxBuildHasher>;

/// Set labels and definition addresses identifying a catalog.
type Catalog = Vec<(Arc<str>, usize)>;

/// A catalog and the indexes of the plain definitions that select from it.
type Group<'g> = (Option<&'g Record<Arc<Definition>>>, Vec<usize>);

/// A packed library imported by one statement.
struct Library<'l> {
    exports: &'l Record<Link>,
    /// Namespace binding of the original module, imported on first use.
    imported: Option<String>,
    specifier: &'l str,
}

struct Compiler<'c, 'a> {
    calls: usize,
    /// Last emitted tables by recipe address.
    cached: FxHashMap<usize, Cached>,
    /// Context factory names by expression.
    contexts: IndexMap<String, String, FxBuildHasher>,
    dynamic: bool,
    dynamic_helper: String,
    factories: IndexMap<String, Factory, FxBuildHasher>,
    finite: bool,
    helper: String,
    /// Factory calls by their emitted text.
    initializers: FxHashMap<String, Initializer>,
    /// Emitted table expressions by helper and literal.
    literals: FxHashMap<String, String>,
    names: Names<'c>,
    options: &'c Options<'c, 'a>,
    /// Packed library bindings, in emission order.
    packed: Vec<String>,
    recipes: IndexMap<Arc<str>, Arc<variants::Definition>, FxBuildHasher>,
    scalar: scalar::Options,
    typed: bool,
}

impl Compiler<'_, '_> {
    fn stylesheet(&self, vars: Option<&Record<Arc<Definition>>>) -> style_sheet::Options {
        style_sheet::Options {
            fonts: self.options.fonts.clone(),
            platform: self.options.platform.clone(),
            units: self.options.units.clone(),
            vars: vars.map_or(Data::Undefined, |vars| {
                Data::from(Object::from_entries(vars.iter().map(|(name, theme)| {
                    (Arc::clone(name), Data::Theme(Arc::clone(theme)))
                })))
            }),
        }
    }

    fn bindings<'t>(&self, target: Target<'t>) -> native_bindings::Options<'t> {
        native_bindings::Options {
            color_scheme: target.color_scheme,
            fonts: self.options.fonts.clone(),
            platform: self.options.platform.clone(),
            set: target.set,
            units: self.options.units.clone(),
            vars: target.vars,
        }
    }

    /// Replaces native variable reads with profile constants, and returns the profiles by
    /// serialized value with the imports of profiles other modules define.
    fn variables(
        &mut self,
        extracted: &Extracted<'_>,
        rewriter: &mut Rewriter<'_, '_>,
    ) -> Result<(Profiles, Imports)> {
        let shared = self.options.shared;
        let mut variables =
            shared.map_or_else(IndexMap::default, |shared| shared.definitions.clone());
        let mut imports = IndexSet::default();

        for read in &extracted.native_vars {
            let annotation = if self.typed {
                format!(
                    " as typeof {}",
                    rewriter.slice(Span::new(read.start, read.end))
                )
            } else {
                String::new()
            };

            if let Some(imported) = shared.and_then(|shared| shared.reads.get(&read.start)) {
                if let Some(source) = imported
                    .source
                    .as_deref()
                    .filter(|source| !source.is_empty())
                {
                    imports.insert(format!(
                        "import {{{}}} from {};",
                        imported.name,
                        js::quote(source)
                    ));
                }

                rewriter.overwrite(
                    read.start,
                    read.end,
                    &format!("({}{annotation})", imported.name),
                    true,
                )?;
                continue;
            }

            let definition = native_vars::compile(&native_vars::Options {
                default_vars: &read.default_vars,
                scalar: &self.scalar,
                unnamed: read.unnamed,
                vars: &read.vars,
            })
            .map_err(|error| native(error.text()))?;
            let key = definition.to_json();
            let name = if let Some(name) = variables.get(&key) {
                name.clone()
            } else {
                let name = self
                    .names
                    .reserve(format!("{}Vars{}", self.helper, variables.len()));

                variables.insert(key, name.clone());
                name
            };

            rewriter.overwrite(read.start, read.end, &format!("({name}{annotation})"), true)?;
        }

        Ok((variables, imports))
    }

    /// Compiles plain contextual definitions sharing a catalog in one table batch.
    ///
    /// Batched and individual compilation emit the same tables, so a failing batch falls back to
    /// individual compilation, which reports errors in authored order with their paths.
    fn batch(
        &self,
        extracted: &Extracted<'_>,
        styles_by_name: &FxHashMap<&str, Vec<Arc<NamedStyle>>>,
    ) -> Result<Vec<Option<Arc<variants::Definition>>>> {
        let mut tables = vec![None; extracted.calls.len()];
        // Catalogs group by their sets' identities, as the TypeScript compiler groups shared
        // catalog objects.
        let mut groups: IndexMap<Option<Catalog>, Group<'_>, FxBuildHasher> = IndexMap::default();

        for (index, call) in extracted.calls.iter().enumerate() {
            if call.recipe.is_some()
                || call.static_recipe.is_some()
                || call.dynamic_recipe.is_some()
                || call.slots.is_some()
                || call.output == Some(ThemeOutput::Html)
            {
                continue;
            }

            let vars = call
                .native_context
                .as_ref()
                .map(|context| &context.vars)
                .or(self.options.vars);
            let styles = styles_by_name
                .get(&*call.name)
                .map_or(&[][..], Vec::as_slice);

            if native_media::prepare(Some(styles), vars, &self.scalar)
                .map_err(|error| native(error.text()))?
                .is_some()
            {
                continue;
            }

            let key = vars.map(|vars| {
                vars.iter()
                    .map(|(name, theme)| (Arc::clone(name), Arc::as_ptr(theme).addr()))
                    .collect()
            });

            groups
                .entry(key)
                .or_insert_with(|| (vars, Vec::new()))
                .1
                .push(index);
        }

        for (vars, calls) in groups.values() {
            if calls.len() < 2 {
                continue;
            }

            let members: Vec<&Call<'_>> = calls
                .iter()
                .filter_map(|index| extracted.calls.get(*index))
                .collect();
            let definition = style::Definition {
                labels: None,
                styles: members
                    .iter()
                    .map(|call| {
                        Arc::new(NamedStyle {
                            name: Arc::clone(&call.name),
                            rules: Some(
                                styles_by_name
                                    .get(&*call.name)
                                    .into_iter()
                                    .flatten()
                                    .map(|style| Rule {
                                        condition: None,
                                        style: Arc::clone(style),
                                    })
                                    .collect(),
                            ),
                            ..NamedStyle::default()
                        })
                    })
                    .collect(),
            };
            let compiled = match style_sheet::compile(&definition, &self.stylesheet(*vars)) {
                Ok(compiled) => compiled,
                Err(Error::StyleSheet(_)) => continue,
                Err(error) => return Err(error),
            };

            for (index, call) in calls.iter().zip(&members) {
                let single = |table: &Table| {
                    Arc::new(Object::from_entries([(
                        Arc::from("0"),
                        table.get(&call.name).cloned().unwrap_or(Data::Undefined),
                    )]))
                };
                let styles = Tables {
                    sets: compiled
                        .sets
                        .iter()
                        .map(|(set, schemes)| {
                            (
                                Arc::clone(set),
                                Schemes {
                                    dark: single(&schemes.dark),
                                    light: single(&schemes.light),
                                },
                            )
                        })
                        .collect(),
                };

                if let Some(slot) = tables.get_mut(*index) {
                    *slot = Some(Arc::new(variants::Definition {
                        axes: Vec::new(),
                        defaults: Vec::new(),
                        styles,
                    }));
                }
            }
        }

        Ok(tables)
    }

    /// Emits one definition's callable: a table selection, a binding program, or a contextual
    /// factory over every set and scheme.
    fn callable(
        &mut self,
        recipe: &recipe::Definition,
        name: &str,
        call: &Call<'_>,
        target: Target<'_>,
        compiled: Option<&Arc<variants::Definition>>,
        bindings: Option<&Prepared>,
    ) -> Result<String> {
        let payloads = call
            .recipe
            .as_ref()
            .and_then(|recipe| recipe.payloads.as_ref())
            .is_some_and(|payloads| !payloads.is_empty());
        let program = !recipe.axes.is_empty() || call.slots.is_some() || payloads;

        if target.contextual {
            return self.contextual(recipe, name, call, target, compiled, program);
        }

        if program {
            let scalar = call.slots.is_some() || payloads;

            self.dynamic |= scalar;
            self.finite |= !scalar;

            let options = self.bindings(target);
            let literal = native_bindings::compile(recipe, call, &options, bindings)
                .and_then(|compiled| {
                    if scalar {
                        Ok(compiled.to_json())
                    } else {
                        native_bindings::finite(&compiled).map(|finite| finite.to_json())
                    }
                })
                .map_err(bindings_error)?;
            let helper = if scalar {
                self.dynamic_helper.clone()
            } else {
                format!("{}Static", self.helper)
            };
            let value = self.create(&helper, &literal);

            if !self.typed {
                return Ok(value);
            }

            if call.slots.is_none() && !payloads {
                return Ok(format!(
                    "({value} as import('zyzz/runtime').Native.Callable<{{{}}}>)",
                    axes_type(recipe)
                ));
            }

            let kind = if call.recipe.is_some() {
                "RecipeCallable"
            } else {
                "Callable"
            };
            let input = if call.recipe.is_some() {
                recipe_input(recipe, call)
            } else {
                call.values_type.as_deref().unwrap_or("{}").to_owned()
            };

            return Ok(format!(
                "({value} as import('zyzz/runtime').NativeDynamic.{kind}<{input}>)"
            ));
        }

        let owned;
        let compiled = if let Some(compiled) = compiled {
            compiled
        } else {
            owned = Arc::new(variants::compile(recipe, &self.stylesheet(target.vars))?);
            &owned
        };

        self.recipes.insert(Arc::from(name), Arc::clone(compiled));

        let styles = style_sheet::select(
            &compiled.styles,
            target.set.unwrap_or("default"),
            target.color_scheme,
        )?;
        let key = Arc::as_ptr(compiled).addr();
        let cached = self
            .cached
            .get(&key)
            .filter(|cached| {
                Arc::ptr_eq(&cached.definition, compiled) && same_table(&cached.styles, &styles)
            })
            .map(|cached| cached.value.clone());
        let value = if let Some(value) = cached {
            value
        } else {
            let mut literal = String::from("{\"axes\":");

            recipe::write_axes(&mut literal, &compiled.axes);
            literal.push_str(",\"defaults\":");
            recipe::write_defaults(&mut literal, &compiled.defaults);
            literal.push_str(",\"styles\":");
            style_sheet::write_table(&mut literal, &styles);
            literal.push('}');

            let helper = self.helper.clone();

            self.create(&helper, &literal)
        };

        if self.options.contextual {
            self.cached.insert(
                key,
                Cached {
                    definition: Arc::clone(compiled),
                    styles,
                    value: value.clone(),
                },
            );
        }

        if !self.typed {
            return Ok(value);
        }

        Ok(format!(
            "({value} as import('zyzz/runtime').Native.Callable<{{{}}}>)",
            axes_type(recipe)
        ))
    }

    /// Emits a context factory over every set and scheme, or responsive profiles when the
    /// definition reads media conditions.
    fn contextual(
        &mut self,
        recipe: &recipe::Definition,
        name: &str,
        call: &Call<'_>,
        target: Target<'_>,
        compiled: Option<&Arc<variants::Definition>>,
        program: bool,
    ) -> Result<String> {
        let vars = call
            .native_context
            .as_ref()
            .map(|context| &context.vars)
            .or(target.vars);
        let styles: Vec<Arc<NamedStyle>> = recipe
            .rules
            .iter()
            .flat_map(|rule| rule.value.styles.iter().cloned())
            .collect();
        let media = native_media::prepare(Some(&styles), vars, &self.scalar)
            .map_err(|error| native(error.text()))?;

        if let Some(media) = media {
            let mut profiles = Vec::new();

            for selection in media.selections() {
                let selected = media.select(&selection);
                let next = recipe::Definition {
                    axes: recipe.axes.clone(),
                    defaults: recipe.defaults.clone(),
                    rules: recipe
                        .rules
                        .iter()
                        .map(|rule| recipe::Rule {
                            matches: rule.matches.clone(),
                            value: style::Definition {
                                labels: rule.value.labels.clone(),
                                styles: rule
                                    .value
                                    .styles
                                    .iter()
                                    .map(|style| Arc::new(selected.style(style)))
                                    .collect(),
                            },
                        })
                        .collect(),
                };
                let selected_vars = selected.vars();
                let source;
                let call = match &call.native_context {
                    Some(context) => {
                        source = Call {
                            native_context: Some(NativeContext {
                                default_vars: Arc::clone(&context.default_vars),
                                vars: selected_vars.clone().unwrap_or_default(),
                            }),
                            ..call.clone()
                        };
                        &source
                    }
                    None => call,
                };
                let value = self.callable(
                    &next,
                    name,
                    call,
                    Target {
                        vars: selected_vars.as_ref(),
                        ..target
                    },
                    None,
                    None,
                )?;

                profiles.push(format!("{}:{value}", js::quote(&selection)));
            }

            // A single static table cannot represent the responsive callable.
            self.recipes.shift_remove(name);

            let mut queries = String::new();

            write_queries(&mut queries, &media.queries);

            return Ok(format!(
                "{}Context.responsive({queries},{{{}}})",
                self.helper,
                profiles.join(",")
            ));
        }

        let owned;
        let mut prepared = None;
        let compiled = if program {
            prepared = Some(
                native_bindings::prepare(recipe, call, &self.bindings(Target { vars, ..target }))
                    .map_err(bindings_error)?,
            );
            compiled
        } else if let Some(compiled) = compiled {
            Some(compiled)
        } else {
            owned = Arc::new(variants::compile(recipe, &self.stylesheet(vars))?);
            Some(&owned)
        };
        let default_vars = call
            .native_context
            .as_ref()
            .map(|context| &*context.default_vars)
            .or(target.set)
            .unwrap_or("default");
        let sets: Vec<&str> = match vars {
            Some(vars) => vars.keys().map(|set| &**set).collect(),
            None => vec!["default"],
        };
        let mut tables: IndexMap<String, String, FxBuildHasher> = IndexMap::default();
        let mut alternatives = Vec::with_capacity(sets.len());

        for set in sets {
            let mut values = Vec::with_capacity(2);

            for scheme in ["light", "dark"] {
                let value = self.callable(
                    recipe,
                    name,
                    call,
                    Target {
                        color_scheme: Some(scheme),
                        contextual: false,
                        set: Some(set),
                        vars,
                    },
                    compiled,
                    prepared.as_ref(),
                )?;

                if !tables.contains_key(&value) {
                    let table = format!("{}Table{}", self.helper, tables.len());

                    tables.insert(value.clone(), table);
                }

                values.push((scheme, value));
            }

            alternatives.push((set, values));
        }

        let mut entries = String::new();

        for (index, (set, values)) in alternatives.iter().enumerate() {
            if index > 0 {
                entries.push(',');
            }

            js::write_string(&mut entries, set);
            entries.push_str(":{");

            for (index, (scheme, value)) in values.iter().enumerate() {
                if index > 0 {
                    entries.push(',');
                }

                js::write_string(&mut entries, scheme);
                entries.push(':');
                entries.push_str(tables.get(value).map_or("undefined", String::as_str));
            }

            entries.push('}');
        }

        let parameters: Vec<String> = tables
            .values()
            .enumerate()
            .map(|(index, table)| {
                if self.typed {
                    format!("{table}:T{index}")
                } else {
                    table.clone()
                }
            })
            .collect();
        let types = if self.typed {
            let mut types = String::from("<");

            for index in 0..parameters.len() {
                if index > 0 {
                    types.push(',');
                }

                let _ = write!(
                    types,
                    "const T{index} extends (input:never)=>import('zyzz/runtime').Native.Props<object>"
                );
            }

            types.push_str(",>");
            types
        } else {
            String::new()
        };
        let expression = format!(
            "{types}({})=>{}Context.create({{{entries}}},{})",
            parameters.join(","),
            self.helper,
            js::quote(default_vars)
        );
        let context = if let Some(context) = self.contexts.get(&expression) {
            context.clone()
        } else {
            let context = self.names.reserve(format!(
                "{}ContextFactory{}",
                self.helper,
                self.contexts.len()
            ));

            self.contexts.insert(expression, context.clone());
            context
        };
        let inputs: Option<Vec<(String, Vec<String>)>> = tables
            .keys()
            .map(|value| {
                self.initializers
                    .get(value)
                    .map(|input| (input.name.clone(), input.values.clone()))
            })
            .collect();

        if let Some(inputs) = inputs {
            let mut values = Vec::new();
            let mut arguments = Vec::with_capacity(inputs.len());

            for (input, inputs) in inputs {
                let mut parameters = Vec::with_capacity(inputs.len());

                for value in inputs {
                    parameters.push(format!("v{}", values.len()));
                    values.push(value);
                }

                arguments.push(format!("{input}({})", parameters.join(",")));
            }

            if values.len() <= PARAMETERS {
                return Ok(self.factory(format!("{context}({})", arguments.join(",")), values));
            }
        }

        let tables: Vec<&str> = tables.keys().map(String::as_str).collect();

        Ok(format!("{context}({})", tables.join(",")))
    }

    /// Emits a table creation, sharing one factory per structure in runtime output.
    fn create(&mut self, name: &str, literal: &str) -> String {
        if !self.options.runtime || self.calls < 2 {
            return format!("{name}.create({literal})");
        }

        let key = format!("{name}:{literal}");

        if let Some(cached) = self.literals.get(&key) {
            return cached.clone();
        }

        let (structure, values) = parameterize(literal);
        let value = if values.len() > PARAMETERS {
            format!("{name}.create({literal})")
        } else {
            self.factory(
                format!("{name}.create({structure})"),
                values.into_iter().map(str::to_owned).collect(),
            )
        };

        self.literals.insert(key, value.clone());
        value
    }

    fn factory(&mut self, expression: String, values: Vec<String>) -> String {
        let name = if let Some(factory) = self.factories.get(&expression) {
            factory.name.clone()
        } else {
            let name =
                self.names
                    .reserve(format!("{}Factory{}", self.helper, self.factories.len()));

            self.factories.insert(
                expression,
                Factory {
                    name: name.clone(),
                    parameters: values.len(),
                },
            );
            name
        };
        let value = format!("{name}({})", values.join(","));

        self.initializers
            .insert(value.clone(), Initializer { name, values });
        value
    }

    /// Replaces imports and re-exports of packed native libraries with native overlays.
    fn libraries(
        &mut self,
        program: &oxc_ast::ast::Program<'_>,
        rewriter: &mut Rewriter<'_, '_>,
    ) -> Result<()> {
        let mut explicit = explicit(program);
        let libraries = self
            .options
            .context
            .and_then(|context| context.libraries.as_ref());

        for statement in &program.body {
            let specifier = match statement {
                Statement::ImportDeclaration(declaration)
                    if declaration.import_kind != ImportOrExportKind::Type =>
                {
                    declaration.source.value.as_str()
                }
                Statement::ExportFromDeclaration(declaration)
                    if declaration.export_kind != ImportOrExportKind::Type =>
                {
                    declaration.source.value.as_str()
                }
                Statement::ExportAllDeclaration(declaration)
                    if declaration.export_kind != ImportOrExportKind::Type =>
                {
                    declaration.source.value.as_str()
                }
                _ => continue,
            };
            let Some(exports) = libraries.and_then(|libraries| libraries.get(specifier)) else {
                continue;
            };
            let mut library = Library {
                exports,
                imported: None,
                specifier,
            };

            match statement {
                Statement::ExportAllDeclaration(declaration) => {
                    if let Some(exported) = &declaration.exported {
                        let Some(expression) = self.namespace(&mut library)? else {
                            continue;
                        };
                        let local = self.names.reserve(format!(
                            "{}Export{}",
                            self.helper,
                            self.packed.len()
                        ));

                        self.packed.push(format!(
                            "const {local}={expression};export {{{local} as {}}};",
                            js::quote(exported.name().as_str())
                        ));
                        rewriter.overwrite(
                            declaration.span.start,
                            declaration.span.end,
                            "",
                            false,
                        )?;
                        continue;
                    }

                    for name in exports.keys() {
                        if &**name == "default" || explicit.contains(&**name) {
                            continue;
                        }

                        let Some(expression) =
                            self.value(&mut library, name, exports.get(name), None, &[&**name])?
                        else {
                            continue;
                        };

                        explicit.insert(name.to_string());

                        let local = self.names.reserve(format!(
                            "{}Export{}",
                            self.helper,
                            self.packed.len()
                        ));

                        self.packed.push(format!(
                            "const {local}={expression};export {{{local} as {}}};",
                            js::quote(name)
                        ));
                    }
                }
                Statement::ImportDeclaration(declaration) => {
                    let mut kept = Vec::new();

                    for specifier in declaration.specifiers.iter().flatten() {
                        match specifier {
                            ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace) => {
                                let local = namespace.local.name.as_str();
                                let line = match self.namespace(&mut library)? {
                                    Some(expression) => format!("const {local}={expression};"),
                                    None => format!(
                                        "import * as {local} from {};",
                                        js::quote(library.specifier)
                                    ),
                                };

                                self.packed.push(line);
                            }
                            ImportDeclarationSpecifier::ImportSpecifier(named)
                                if named.import_kind == ImportOrExportKind::Type =>
                            {
                                kept.push(rewriter.slice(named.span).to_owned());
                            }
                            ImportDeclarationSpecifier::ImportSpecifier(named) => {
                                let name = named.imported.name().as_str();

                                match self.value(
                                    &mut library,
                                    name,
                                    exports.get(name),
                                    None,
                                    &[name],
                                )? {
                                    Some(expression) => self
                                        .packed
                                        .push(format!("const {}={expression};", named.local.name)),
                                    None => kept.push(rewriter.slice(named.span).to_owned()),
                                }
                            }
                            ImportDeclarationSpecifier::ImportDefaultSpecifier(default) => {
                                match self.value(
                                    &mut library,
                                    "default",
                                    exports.get("default"),
                                    None,
                                    &["default"],
                                )? {
                                    Some(expression) => self.packed.push(format!(
                                        "const {}={expression};",
                                        default.local.name
                                    )),
                                    None => kept.push(format!("default as {}", default.local.name)),
                                }
                            }
                        }
                    }

                    rewriter.overwrite(
                        declaration.span.start,
                        declaration.span.end,
                        &reexport("import", &kept, library.specifier),
                        false,
                    )?;
                }
                Statement::ExportFromDeclaration(declaration) => {
                    let mut kept = Vec::new();

                    for specifier in &declaration.specifiers {
                        if specifier.export_kind == ImportOrExportKind::Type {
                            kept.push(rewriter.slice(specifier.span).to_owned());
                            continue;
                        }

                        let name = specifier.local.name().as_str();
                        let Some(expression) =
                            self.value(&mut library, name, exports.get(name), None, &[name])?
                        else {
                            kept.push(rewriter.slice(specifier.span).to_owned());
                            continue;
                        };
                        let local = self.names.reserve(format!(
                            "{}Export{}",
                            self.helper,
                            self.packed.len()
                        ));

                        self.packed.push(format!(
                            "const {local}={expression};export {{{local} as {}}};",
                            js::quote(specifier.exported.name().as_str())
                        ));
                    }

                    rewriter.overwrite(
                        declaration.span.start,
                        declaration.span.end,
                        &reexport("export", &kept, library.specifier),
                        false,
                    )?;
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// The namespace binding of a library's original module, imported on first use.
    fn original(&mut self, library: &mut Library<'_>) -> String {
        if let Some(imported) = &library.imported {
            return imported.clone();
        }

        let imported = self
            .names
            .reserve(format!("{}Namespace{}", self.helper, self.packed.len()));

        self.packed.push(format!(
            "import * as {imported} from {};",
            js::quote(library.specifier)
        ));
        library.imported = Some(imported.clone());
        imported
    }

    /// Overlays native members on an original namespace or object.
    fn overlay(&mut self, original: &str, expression: &str) -> String {
        let overrides = self
            .names
            .reserve(format!("{}Members{}", self.helper, self.packed.len()));

        self.packed.push(format!("const {overrides}={expression};"));

        // Getter descriptors retain live bindings outside the recipe contract.
        format!(
            "Object.freeze(Object.defineProperties({{...{original},...{overrides}}},Object.fromEntries(Object.keys({original}).filter(key=>!Object.hasOwn({overrides},key)).map(key=>[key,{{get:()=>Reflect.get({original},key)}}]))))"
        )
    }

    /// The native callable of a packed export, or `None` for exports outside style references.
    fn value(
        &mut self,
        library: &mut Library<'_>,
        name: &str,
        link: Option<&Link>,
        input: Option<&str>,
        path: &[&str],
    ) -> Result<Option<String>> {
        let Some(link) = link.filter(|link| link.kind == LinkKind::StyleReference) else {
            return Ok(None);
        };

        if let Some(members) = &link.members {
            let source = match input {
                Some(input) => input.to_owned(),
                None => format!("{}[{}]", self.original(library), js::quote(name)),
            };
            let mut expression = String::from("{");

            for (index, (member, link)) in members.iter().enumerate() {
                if index > 0 {
                    expression.push(',');
                }

                let mut nested = path.to_vec();

                nested.push(&**member);

                let value = self.value(
                    library,
                    &format!("{name}.{member}"),
                    Some(link),
                    Some(&format!("{source}[{}]", js::quote(member))),
                    &nested,
                )?;
                // A member outside the recipe contract interpolates as `undefined`.
                let _ = write!(
                    expression,
                    "[{}]:{}",
                    js::quote(member),
                    value.as_deref().unwrap_or("undefined")
                );
            }

            expression.push('}');

            return Ok(Some(self.overlay(&source, &expression)));
        }

        let style = link.style.as_deref();
        let recipe = style.and_then(|style| {
            style
                .static_recipe
                .as_ref()
                .or(style.dynamic.as_ref().map(|dynamic| &dynamic.recipe))
        });
        let Some(recipe) = recipe.filter(|_| {
            style.is_some_and(|style| {
                style.output.is_none() && (style.slots.is_empty() || style.dynamic.is_some())
            })
        }) else {
            return Err(native(format!(
                "Packed native callable {name} requires a static recipe contract."
            )));
        };
        let dynamic = style.and_then(|style| style.dynamic.as_ref());
        let call = Call {
            native_context: style.and_then(|style| style.native_context.clone()),
            recipe: dynamic.map(|dynamic| runtime::Definition {
                axes: recipe
                    .axes
                    .iter()
                    .map(|(axis, choices)| (Arc::clone(axis), choices.clone()))
                    .collect(),
                conditions: None,
                default_payloads: dynamic.default_payloads.clone(),
                defaults: recipe
                    .defaults
                    .iter()
                    .map(|(axis, choice)| (Arc::clone(axis), choice.clone()))
                    .collect(),
                payloads: dynamic.payloads.clone(),
            }),
            slots: dynamic.map(|dynamic| dynamic.slots.clone()),
            ..Call::default()
        };
        let target = Target {
            color_scheme: self.options.color_scheme,
            contextual: self.options.contextual,
            set: self.options.set,
            vars: self.options.vars,
        };
        let expression = self.callable(
            recipe,
            &format!("{}:{name}", library.specifier),
            &call,
            target,
            None,
            None,
        )?;

        if dynamic.is_none() || !self.typed {
            return Ok(Some(expression));
        }

        let mut kind = format!("typeof import({})", js::quote(library.specifier));

        for part in path {
            let _ = write!(kind, "[{}]", js::quote(part));
        }

        Ok(Some(format!(
            "({expression} as import('zyzz/runtime').NativeDynamic.From<{kind}>)"
        )))
    }

    /// The native overlay of a library namespace, or `None` without style references.
    fn namespace(&mut self, library: &mut Library<'_>) -> Result<Option<String>> {
        if !library
            .exports
            .values()
            .any(|link| link.kind == LinkKind::StyleReference)
        {
            return Ok(None);
        }

        let imported = self.original(library);
        let exports = library.exports;
        let mut members = Vec::new();

        for (name, link) in exports.iter() {
            let input = format!("{imported}[{}]", js::quote(name));

            if let Some(expression) =
                self.value(library, name, Some(link), Some(&input), &[name])?
            {
                members.push(format!("[{}]:{expression}", js::quote(name)));
            }
        }

        Ok(Some(
            self.overlay(&imported, &format!("{{{}}}", members.join(","))),
        ))
    }

    /// Binds `cx` imports and re-exports from `zyzz` to the runtime composer.
    fn compositions(
        &mut self,
        program: &oxc_ast::ast::Program<'_>,
        rewriter: &mut Rewriter<'_, '_>,
    ) -> Result<Vec<String>> {
        let mut compositions = Vec::new();

        for statement in &program.body {
            match statement {
                Statement::ExportAllDeclaration(declaration)
                    if declaration.source.value.as_str() == "zyzz"
                        && declaration.export_kind != ImportOrExportKind::Type =>
                {
                    return Err(native("Native modules require named re-exports from zyzz."));
                }
                Statement::ExportFromDeclaration(declaration)
                    if declaration.source.value.as_str() == "zyzz"
                        && declaration.export_kind != ImportOrExportKind::Type =>
                {
                    let (cx, kept): (Vec<_>, Vec<_>) =
                        declaration.specifiers.iter().partition(|specifier| {
                            specifier.export_kind != ImportOrExportKind::Type
                                && specifier.local.name().as_str() == "cx"
                        });

                    if cx.is_empty() {
                        continue;
                    }

                    let binding = self.names.reserve(format!("{}Compose", self.helper));

                    compositions.push(format!("const {binding}={}.compose;", self.helper));

                    let kept: Vec<&str> = kept
                        .iter()
                        .map(|specifier| rewriter.slice(specifier.span))
                        .collect();
                    let exports: Vec<String> = cx
                        .iter()
                        .map(|specifier| {
                            format!("{binding} as {}", rewriter.slice(specifier.exported.span()))
                        })
                        .collect();
                    let mut code = String::new();

                    if !kept.is_empty() {
                        let _ = write!(code, "export {{{}}} from 'zyzz';", kept.join(","));
                    }

                    let _ = write!(code, "export {{{}}};", exports.join(","));

                    rewriter.overwrite(
                        declaration.span.start,
                        declaration.span.end,
                        &code,
                        false,
                    )?;
                }
                Statement::ImportDeclaration(declaration)
                    if declaration.source.value.as_str() == "zyzz"
                        && declaration.import_kind != ImportOrExportKind::Type =>
                {
                    let specifiers: Vec<&ImportDeclarationSpecifier<'_>> =
                        declaration.specifiers.iter().flatten().collect();
                    let cx = |specifier: &ImportDeclarationSpecifier<'_>| {
                        matches!(
                            specifier,
                            ImportDeclarationSpecifier::ImportSpecifier(named)
                                if named.import_kind != ImportOrExportKind::Type
                                    && named.imported.name().as_str() == "cx"
                        )
                    };

                    if !specifiers.iter().any(|specifier| cx(specifier)) {
                        continue;
                    }

                    let mut named = Vec::new();
                    let mut other = Vec::new();

                    for specifier in specifiers {
                        if cx(specifier) {
                            compositions.push(format!(
                                "const {}={}.compose;",
                                specifier.local().name,
                                self.helper
                            ));
                        } else if matches!(
                            specifier,
                            ImportDeclarationSpecifier::ImportSpecifier(_)
                        ) {
                            named.push(rewriter.slice(specifier.span()));
                        } else {
                            other.push(rewriter.slice(specifier.span()));
                        }
                    }

                    let named = (!named.is_empty()).then(|| format!("{{{}}}", named.join(",")));
                    let imports: Vec<&str> = other.into_iter().chain(named.as_deref()).collect();
                    let code = if imports.is_empty() {
                        String::new()
                    } else {
                        format!("import {} from 'zyzz';", imports.join(","))
                    };

                    rewriter.overwrite(
                        declaration.span.start,
                        declaration.span.end,
                        &code,
                        false,
                    )?;
                }
                _ => {}
            }
        }

        Ok(compositions)
    }

    /// The runtime import and the module-level factories, contexts, profiles, and bindings.
    fn prelude(&self, variables: &Profiles, imports: &Imports, compositions: &[String]) -> String {
        let helper = &self.helper;
        let mut prelude = String::new();

        let _ = write!(prelude, "\nimport {{Native as {helper}");

        if self.dynamic {
            let _ = write!(prelude, ",NativeDynamic as {}", self.dynamic_helper);
        }

        if self.finite {
            let _ = write!(prelude, ",NativeStatic as {helper}Static");
        }

        if self.options.contextual {
            let _ = write!(prelude, ",NativeContext as {helper}Context");
        }

        if !variables.is_empty() {
            let _ = write!(prelude, ",NativeVars as {helper}Vars");
        }

        prelude.push_str("} from 'zyzz/runtime';\n");

        for (index, (expression, factory)) in self.factories.iter().enumerate() {
            if index > 0 {
                prelude.push('\n');
            }

            let parameters: Vec<String> = (0..factory.parameters)
                .map(|index| format!("v{index}"))
                .collect();
            let _ = write!(
                prelude,
                "const {}=({})=>{expression};",
                factory.name,
                parameters.join(",")
            );
        }

        prelude.push('\n');

        for (index, (expression, name)) in self.contexts.iter().enumerate() {
            if index > 0 {
                prelude.push('\n');
            }

            let _ = write!(prelude, "const {name}={expression};");
        }

        prelude.push('\n');

        let shared = self.options.shared;

        for (index, (value, name)) in variables.iter().enumerate() {
            if index > 0 {
                prelude.push('\n');
            }

            if shared.is_some_and(|shared| shared.definitions.contains_key(value)) {
                prelude.push_str("export ");
            }

            let _ = write!(
                prelude,
                "const {name}={helper}Vars.create(JSON.parse({}));",
                js::quote(value)
            );
        }

        prelude.push('\n');

        let lines: Vec<&str> = imports
            .iter()
            .chain(compositions)
            .chain(&self.packed)
            .map(String::as_str)
            .collect();

        prelude.push_str(&lines.join("\n"));
        prelude.push('\n');
        prelude
    }
}

/// Exported names of value export declarations, which star re-exports must not replace.
fn explicit(program: &oxc_ast::ast::Program<'_>) -> FxHashSet<String> {
    let mut names = FxHashSet::default();

    for statement in &program.body {
        match statement {
            Statement::ExportNamedDeclaration(declaration)
                if declaration.export_kind != ImportOrExportKind::Type =>
            {
                for specifier in &declaration.specifiers {
                    if specifier.export_kind != ImportOrExportKind::Type {
                        names.insert(specifier.exported.name().to_string());
                    }
                }
            }
            Statement::ExportFromDeclaration(declaration)
                if declaration.export_kind != ImportOrExportKind::Type =>
            {
                for specifier in &declaration.specifiers {
                    if specifier.export_kind != ImportOrExportKind::Type {
                        names.insert(specifier.exported.name().to_string());
                    }
                }
            }
            Statement::ExportDeclaration(declaration)
                if declaration.export_kind() != ImportOrExportKind::Type =>
            {
                if let Declaration::VariableDeclaration(variables) = &declaration.declaration {
                    for declarator in &variables.declarations {
                        bind(&declarator.id, &mut names);
                    }
                } else if let Some(name) = declaration_name(&declaration.declaration) {
                    names.insert(name.to_owned());
                }
            }
            _ => {}
        }
    }

    names
}

/// Collects the identifiers a binding pattern declares.
fn bind(pattern: &BindingPattern<'_>, names: &mut FxHashSet<String>) {
    match pattern {
        BindingPattern::BindingIdentifier(identifier) => {
            names.insert(identifier.name.to_string());
        }
        BindingPattern::ObjectPattern(object) => {
            for property in &object.properties {
                bind(&property.value, names);
            }

            if let Some(rest) = &object.rest {
                bind(&rest.argument, names);
            }
        }
        BindingPattern::ArrayPattern(array) => {
            for element in array.elements.iter().flatten() {
                bind(element, names);
            }

            if let Some(rest) = &array.rest {
                bind(&rest.argument, names);
            }
        }
        BindingPattern::AssignmentPattern(assignment) => bind(&assignment.left, names),
    }
}

/// The name of a declaration whose ESTree `id` is an `Identifier`.
fn declaration_name<'a>(declaration: &Declaration<'a>) -> Option<&'a str> {
    match declaration {
        Declaration::FunctionDeclaration(function) => {
            function.id.as_ref().map(|id| id.name.as_str())
        }
        Declaration::ClassDeclaration(class) => class.id.as_ref().map(|id| id.name.as_str()),
        Declaration::TSTypeAliasDeclaration(alias) => Some(alias.id.name.as_str()),
        Declaration::TSInterfaceDeclaration(interface) => Some(interface.id.name.as_str()),
        Declaration::TSEnumDeclaration(enumeration) => Some(enumeration.id.name.as_str()),
        // ESTree spells a nested namespace id as a qualified name.
        Declaration::TSNamespaceDeclaration(namespace) => {
            matches!(namespace.body, TSNamespaceDeclarationBody::TSModuleBlock(_))
                .then(|| namespace.id.name.as_str())
        }
        Declaration::TSGlobalDeclaration(_) => Some("global"),
        Declaration::TSImportEqualsDeclaration(import) => Some(import.id.name.as_str()),
        Declaration::VariableDeclaration(_) | Declaration::TSExternalModuleDeclaration(_) => None,
    }
}

/// An import or re-export of the specifiers a library statement keeps, or a bare import.
fn reexport(keyword: &str, kept: &[String], specifier: &str) -> String {
    if kept.is_empty() {
        format!("import {};", js::quote(specifier))
    } else {
        format!(
            "{keyword} {{{}}} from {};",
            kept.join(","),
            js::quote(specifier)
        )
    }
}

/// `{"axis":readonly ["choice"]}` members of a finite callable type.
fn axes_type(recipe: &recipe::Definition) -> String {
    let mut output = String::new();

    for (index, (axis, choices)) in recipe.axes.iter().enumerate() {
        if index > 0 {
            output.push(';');
        }

        js::write_string(&mut output, axis);
        output.push_str(":readonly ");
        recipe::write_strings(&mut output, choices);
    }

    output
}

/// The selection input type of a dynamic recipe, with each payload's authored type.
fn recipe_input(recipe: &recipe::Definition, call: &Call<'_>) -> String {
    let mut output = String::from("{");

    for (index, (axis, choices)) in recipe.axes.iter().enumerate() {
        if index > 0 {
            output.push(';');
        }

        let types = call.recipe_types.as_ref().and_then(|types| types.get(axis));

        js::write_string(&mut output, axis);
        output.push_str("?:");

        for (index, choice) in choices.iter().enumerate() {
            if index > 0 {
                output.push('|');
            }

            match types
                .and_then(|types| types.get(choice))
                .filter(|kind| !kind.is_empty())
            {
                Some(kind) => {
                    output.push('{');
                    js::write_string(&mut output, choice);
                    output.push(':');
                    output.push_str(kind);
                    output.push('}');
                }
                None if matches!(&**choice, "true" | "false") => output.push_str(choice),
                None => js::write_string(&mut output, choice),
            }
        }

        output.push_str("|null|undefined");
    }

    output.push('}');
    output
}

/// Whether two tables hold the same style objects under the same names.
fn same_table(left: &Table, right: &Table) -> bool {
    if std::ptr::eq(left, right) {
        return true;
    }

    left.len() == right.len()
        && right
            .properties()
            .zip(left.properties())
            .all(|(entry, other)| {
                let value = match entry.1 {
                    crate::data::Property::Value(value) => value,
                    crate::data::Property::Accessor => &Data::Undefined,
                };
                // Tables of one recipe list their names in one order, so lookups are rare.
                let cached = if entry.0 == other.0 {
                    match other.1 {
                        crate::data::Property::Value(value) => Some(value),
                        crate::data::Property::Accessor => None,
                    }
                } else {
                    left.get(entry.0)
                };

                cached.unwrap_or(&Data::Undefined).same(value)
            })
}

/// Splits a JSON literal into a structure whose values are `v0`, `v1`, ... parameters, as
/// `/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g` matches them.
/// Strings followed by a colon are property names and stay in the structure.
fn parameterize(literal: &str) -> (String, Vec<&str>) {
    let bytes = literal.as_bytes();
    let mut structure = String::with_capacity(literal.len());
    let mut values = Vec::new();
    let mut copied = 0;
    let mut index = 0;

    while index < bytes.len() {
        let Some(end) = token(bytes, index) else {
            index += literal
                .get(index..)
                .and_then(|rest| rest.chars().next())
                .map_or(1, char::len_utf8);
            continue;
        };

        if bytes.get(end) != Some(&b':') {
            structure.push_str(literal.get(copied..index).unwrap_or_default());
            let _ = write!(structure, "v{}", values.len());
            values.push(literal.get(index..end).unwrap_or_default());
            copied = end;
        }

        index = end;
    }

    structure.push_str(literal.get(copied..).unwrap_or_default());
    (structure, values)
}

/// The end of the JSON string, number, or literal starting at `start`.
fn token(bytes: &[u8], start: usize) -> Option<usize> {
    match bytes.get(start)? {
        b'"' => {
            let mut index = start + 1;

            loop {
                match bytes.get(index)? {
                    b'"' => return Some(index + 1),
                    // `.` excludes line terminators, which JSON escapes never contain.
                    b'\\' => {
                        let rest = bytes.get(index + 1..)?;

                        if rest.is_empty()
                            || rest.starts_with(b"\n")
                            || rest.starts_with(b"\r")
                            || rest.starts_with("\u{2028}".as_bytes())
                            || rest.starts_with("\u{2029}".as_bytes())
                        {
                            return None;
                        }

                        index += 2;
                    }
                    _ => index += 1,
                }
            }
        }
        b'-' | b'0'..=b'9' => {
            let digits = |from: usize| {
                bytes
                    .get(from..)
                    .unwrap_or_default()
                    .iter()
                    .take_while(|byte| byte.is_ascii_digit())
                    .count()
            };
            let mut index = start + usize::from(bytes.get(start) == Some(&b'-'));
            let integer = digits(index);

            if integer == 0 {
                return None;
            }

            index += integer;

            if bytes.get(index) == Some(&b'.') {
                let fraction = digits(index + 1);

                if fraction > 0 {
                    index += 1 + fraction;
                }
            }

            if matches!(bytes.get(index), Some(b'e' | b'E')) {
                let sign = usize::from(matches!(bytes.get(index + 1), Some(b'+' | b'-')));
                let exponent = digits(index + 1 + sign);

                if exponent > 0 {
                    index += 1 + sign + exponent;
                }
            }

            Some(index)
        }
        _ => ["true", "false", "null"]
            .iter()
            .find(|word| {
                bytes
                    .get(start..)
                    .is_some_and(|rest| rest.starts_with(word.as_bytes()))
            })
            .map(|word| start + word.len()),
    }
}
