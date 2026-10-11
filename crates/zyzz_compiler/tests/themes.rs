//! Exercises configuration, theme, and variable collection through the extraction walk.
//!
//! Snapshots record the TypeScript compiler's results for the same sources, so they hold the
//! Rust port to byte-identical names, types, diagnostics, and UTF-16 offsets.

#[path = "support/walk.rs"]
mod walk;

use std::fmt::Write as _;

use oxc_allocator::Allocator;
use rustc_hash::FxHashMap;
use zyzz_compiler::compiler::internal::identifiers::{self, Separator};
use zyzz_compiler::compiler::internal::syntax::{self, Parsed};
use zyzz_compiler::compiler::internal::themes::{self, AliasBinding};
use zyzz_compiler::compiler::internal::{statics, vars};
use zyzz_compiler::error::Error;
use zyzz_compiler::internal::identity;
use zyzz_compiler::js::Record;

/// The source adapter's namespace hash for variable bindings.
fn namespace(value: &str) -> String {
    let mut first: u32 = 2_166_136_261;
    let mut second: u32 = 2_246_822_507;

    for code in value.encode_utf16() {
        first = (first ^ u32::from(code)).wrapping_mul(16_777_619);
        second = (second ^ u32::from(code)).wrapping_mul(3_266_489_909);
    }

    format!(
        "{}{}",
        zyzz_compiler::js::radix(u64::from(first), 36),
        zyzz_compiler::js::radix(u64::from(second), 36)
    )
}

fn error(output: &mut String, parsed: &Parsed<'_>, error: &Error) {
    match error {
        Error::Themes { message, span } => {
            let _ = writeln!(
                output,
                "error {message} @{}..{}",
                parsed.utf16(span.start),
                parsed.utf16(span.end)
            );
        }
        error => {
            let _ = writeln!(output, "error {}", error.text());
        }
    }
}

fn list(items: impl IntoIterator<Item = String>) -> String {
    let items: Vec<String> = items.into_iter().map(|item| format!("'{item}'")).collect();

    format!("[{}]", items.join(", "))
}

/// Collects a module and renders its collected data and walk reads.
fn render(module_id: &str, source: &str, native: bool) -> String {
    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, source, module_id);
    let statics = statics::collect(
        &allocator,
        parsed.program,
        &parsed.semantic,
        FxHashMap::default(),
    );
    let mut output = String::new();
    let variables = match vars::collect(&parsed, &namespace(module_id), &Record::new(), module_id) {
        Ok(variables) => variables,
        Err(failure) => {
            error(&mut output, &parsed, &failure);

            return output.trim_end().to_owned();
        }
    };
    let options = themes::Options {
        native,
        namespace: format!(
            "src-{}-{}",
            identity::label("card"),
            identity::compact(module_id)
        )
        .into(),
        static_bindings: statics.bindings().collect(),
        ..themes::Options::default()
    };
    let mut themes = match themes::collect(&parsed, options) {
        Ok(themes) => themes,
        Err(failure) => {
            error(&mut output, &parsed, &failure);

            return output.trim_end().to_owned();
        }
    };
    let outcome = walk::walk(&parsed, &variables, themes.as_mut());
    let at = |offset: u32| parsed.utf16(offset);

    if let Some(themes) = themes.as_mut() {
        for call in &themes.calls {
            let _ = writeln!(
                output,
                "call {} | {} | {}",
                call.name,
                call.token_type,
                call.type_text.as_deref().unwrap_or("None")
            );
        }

        for alias in &themes.aliases {
            let bindings = alias.bindings.as_ref().map_or_else(
                || "None".to_owned(),
                |bindings| {
                    list(bindings.iter().map(|binding| {
                        match binding {
                            AliasBinding::Style => "style",
                            AliasBinding::Variants => "variants",
                        }
                        .to_owned()
                    }))
                },
            );
            let _ = writeln!(
                output,
                "alias {} {}..{} bindings={bindings} retained={}",
                alias.call.name,
                at(alias.call.start),
                at(alias.call.end),
                alias.retained
            );
        }

        for (start, style) in &themes.styles {
            let _ = writeln!(
                output,
                "style {}..{} recipe={} output={} contract={}",
                at(*start),
                at(style.call.span.end),
                style.recipe,
                style.output.map_or("None", |_| "html"),
                style
                    .theme
                    .metadata
                    .contract
                    .identity
                    .as_deref()
                    .unwrap_or("None")
            );
        }

        for (start, token) in &themes.tokens {
            let _ = writeln!(
                output,
                "token {}..{} {} {} web={}",
                at(*start),
                at(token.end),
                token.reference.group,
                token.reference.path,
                token.reference.web
            );
        }

        for (start, application) in &themes.scope_applications {
            let _ = writeln!(
                output,
                "scope {}..{} output={}",
                at(*start),
                at(application.end),
                application.output.map_or("None", |_| "html")
            );
        }

        for name in &themes.selections {
            let _ = writeln!(output, "selection {name}");
        }

        for read in &themes.vars_reads {
            let _ = writeln!(
                output,
                "vars-read {}..{} owner={} default={} sets={}",
                at(read.start),
                at(read.end),
                read.owner,
                read.default_vars,
                list(read.vars.keys().map(ToString::to_string))
            );
        }

        let styles: Vec<(u32, u32)> = themes
            .styles
            .iter()
            .map(|(start, style)| (*start, style.call.span.end))
            .collect();

        for (start, end) in styles {
            if let Ok(Some(context)) = themes.native_context(start, end) {
                let _ = writeln!(
                    output,
                    "native default={} sets={}",
                    context.default_vars,
                    list(context.vars.keys().map(ToString::to_string))
                );
            }
        }
    }

    for call in &variables.calls {
        if let Some(slot) = call.slots.get("value") {
            let _ = writeln!(
                output,
                "variable {}..{} {} {} explicit={}",
                at(call.start),
                at(call.end),
                slot.name,
                slot.domain.as_str(),
                call.explicit
            );
        }
    }

    for (start, read) in &variables.references {
        let _ = writeln!(
            output,
            "variable-read {}..{} {}",
            at(*start),
            at(read.end),
            read.reference.name
        );
    }

    for registration in &variables.registrations {
        let _ = writeln!(
            output,
            "registration {} {} inherits={} initial={}",
            registration.name,
            registration.syntax,
            registration.inherits,
            registration.initial_value.to_js_string()
        );
    }

    for (name, link) in variables.exports.iter() {
        let _ = writeln!(
            output,
            "export {name} {} members={}",
            link.binding,
            list(
                link.members
                    .iter()
                    .flat_map(Record::keys)
                    .map(ToString::to_string)
            )
        );
    }

    for diagnostic in &outcome.diagnostics {
        if let Error::Themes { message, span } = diagnostic {
            let _ = writeln!(
                output,
                "diagnostic {message} @{}..{}",
                at(span.start),
                at(span.end)
            );
        }
    }

    for (start, owner) in &outcome.reads {
        let _ = writeln!(
            output,
            "read {} {}",
            at(*start),
            match owner {
                walk::Owner::Themes => "themes",
                walk::Owner::Vars => "vars",
            }
        );
    }

    output.trim_end().to_owned()
}

#[test]
fn collect_reads_a_named_variable_catalog() {
    let source = "import { Config, Vars } from 'zyzz';
const base = Vars.define({color: {brand: '#06c'}, spacing: {md: '8px'}});
const mint = Vars.extend(base, {color: {brand: '#175'}});
const config = Config.create({defaultVars: 'base', vars: {base, mint}, layers: ['reset', 'components']});
const { style, vars } = config;
export const card = style({color: vars.color.brand, padding: 'md'});
export const scope = vars({set: 'mint'});
";

    insta::assert_snapshot!(render("app/card.tsx", source, false), @r##"
    call src-card-9DUtIHiEpjK-base | {readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}} | import('zyzz').Vars.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>
    call src-card-9DUtIHiEpjK-mint | {readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}} | import('zyzz').Vars.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>
    call src-card-9DUtIHiEpjK-config-base | {readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}} | import('zyzz').Config.VariableConfig<{readonly "layers":readonly ["reset","components"];readonly "vars":{readonly "base":{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}};readonly "mint":{readonly "color":{readonly "brand":"#175"};readonly "spacing":{readonly "md":"8px"}}};readonly "defaultVars":"base"}>
    alias src-card-9DUtIHiEpjK-config-base 299..305 bindings=None retained=true
    style 327..374 recipe=false output=None contract=src-card-9DUtIHiEpjK-config
    token 341..357 color color.brand web=false
    scope 397..416 output=None
    selection src-card-9DUtIHiEpjK-config-base
    native default=base sets=['base', 'mint']
    read 50 themes
    read 124 themes
    read 136 themes
    read 184 themes
    read 227 themes
    read 233 themes
    read 283 themes
    read 290 themes
    read 299 themes
    read 327 themes
    read 341 themes
    read 397 themes
    "##);
}

#[test]
fn collect_derives_and_extends_identified_variable_sets() {
    let source = "import { Vars, Config } from 'zyzz';
const theme = Vars.define({color: {brand: '#06c'}}, (vars) => ({color: {ring: Vars.compose('color', ['color-mix(in srgb, ', vars.color.brand, ' 40%, white)'])}}), {id: 'brand'});
const wide = Vars.extend(theme, {spacing: {page: '24px'}});
const config = Config.create({id: 'site', vars: wide, shorthands: {px: ['paddingLeft', 'paddingRight']}});
const card = config.style({outlineColor: theme.color.ring, px: wide.spacing.page});
";

    insta::assert_snapshot!(render("app/card.tsx", source, false), @r##"
    call id-brand | {readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>}} | import('zyzz').Vars.Definition<{readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>}}>
    call brand-wide | {readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>};readonly "spacing":{readonly "page":"24px"}} | import('zyzz').Vars.Definition<{readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>};readonly "spacing":{readonly "page":"24px"}}>
    call id-site-theme | {readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>};readonly "spacing":{readonly "page":"24px"}} | import('zyzz').Config.VariableConfig<{readonly "id":"site";readonly "shorthands":{readonly "px":readonly ["paddingLeft","paddingRight"]};readonly "vars":{readonly "color":{readonly "brand":"#06c";readonly "ring":import('zyzz').Vars.Composition<'color'>};readonly "spacing":{readonly "page":"24px"}}}>
    style 396..465 recipe=false output=None contract=id-site
    token 424..440 color color.ring web=false
    token 446..463 spacing spacing.page web=false
    read 51 themes
    read 115 themes
    read 229 themes
    read 241 themes
    read 291 themes
    read 324 themes
    read 396 themes
    read 424 themes
    read 446 themes
    "##);
}

#[test]
fn reference_reports_escaping_and_unknown_reads() {
    let source = "import { Config } from 'zyzz';
const config = Config.create({vars: {color: {brand: '#06c'}}});
const escaped = [config];
const loose = config.vars.color.brand;
const missing = config.style({color: config.vars.color.nope});
const optional = config.style({color: config.vars.color?.brand});
const selected = config.themes();
";

    insta::assert_snapshot!(render("app/card.tsx", source, false), @r##"
    call src-card-9DUtIHiEpjK-config-theme | {readonly "color":{readonly "brand":"#06c"}} | import('zyzz').Config.VariableConfig<{readonly "vars":{readonly "color":{readonly "brand":"#06c"}}}>
    style 176..221 recipe=false output=None contract=src-card-9DUtIHiEpjK-config
    style 240..287 recipe=false output=None contract=src-card-9DUtIHiEpjK-config
    token 135..158 color color.brand web=false
    diagnostic Use direct configuration style calls or static theme members; configurations cannot escape or be mutated. @112..118
    diagnostic Unknown theme token path. @197..219
    diagnostic Token paths require static property names without optional access. @261..285
    diagnostic Theme selection requires a named catalog. @306..319
    read 46 themes
    read 135 themes
    read 176 themes
    read 240 themes
    "##);
}

#[test]
fn reference_records_native_variable_reads() {
    let source = "import { Config } from 'zyzz';
import { useVars } from 'zyzz/react-native';
const config = Config.create({defaultVars: 'light', vars: {light: {color: {text: '#111'}}, dark: {color: {text: '#eee'}}}});
export function Screen() { const vars = useVars(config.vars); return vars; }
const text = config.style({color: config.vars.color.text});
";

    insta::assert_snapshot!(render("app/card.tsx", source, true), @r##"
    call src-card-9DUtIHiEpjK-config-light | {readonly "color":{readonly "text":"#111"}} | import('zyzz').Config.VariableConfig<{readonly "vars":{readonly "light":{readonly "color":{readonly "text":"#111"}};readonly "dark":{readonly "color":{readonly "text":"#eee"}}};readonly "defaultVars":"light"}>
    style 291..336 recipe=false output=None contract=src-card-9DUtIHiEpjK-config
    token 312..334 color color.text web=false
    vars-read 249..260 owner=src-card-9DUtIHiEpjK-config-light default=light sets=['light', 'dark']
    native default=light sets=['light', 'dark']
    read 91 themes
    read 249 themes
    read 291 themes
    read 312 themes
    "##);
}

#[test]
fn vars_collect_resolves_groups_namespaces_and_registrations() {
    let source = "import { variable, Config } from 'zyzz';
const label = '\u{1f3a8} caf\u{e9}';
const tokens = {accent: variable('color'), size: {gap: variable('length', {inherits: false, initialValue: '4px'})}};
namespace motion { export const speed = variable('number', {id: 'speed'}); }
const config = Config.create({});
const card = config.style({color: tokens.accent, vars: {[motion.speed]: 2}});
export { tokens, motion };
";

    insta::assert_snapshot!(render("app/card.tsx", source, false), @r##"
    call src-card-9DUtIHiEpjK-config | {} | import('zyzz').Config.create.ReturnType<{}>
    style 307..370 recipe=false output=None contract=src-card-9DUtIHiEpjK-config
    variable 90..107 --z-tokens-accent color explicit=false
    variable 121..179 --z-tokens-size-gap length explicit=false
    variable 223..256 --z-speed number explicit=true
    variable-read 215..220 --z-speed
    variable-read 328..341 --z-tokens-accent
    variable-read 351..363 --z-speed
    registration --z-tokens-size-gap <length> inherits=false initial=4px
    export tokens z-v16pyvuydsbk0w-81 members=['accent', 'size']
    export motion z-v16pyvuydsbk0w-193 members=['speed']
    read 90 vars
    read 121 vars
    read 223 vars
    read 275 themes
    read 307 themes
    read 328 vars
    read 351 vars
    read 381 vars
    read 389 vars
    "##);
}

#[test]
fn collect_reports_invalid_definitions() {
    let sources = [
        "import { Vars } from 'zyzz';\nexport const theme = Vars.define({color: {brand: 'red'}});",
        "import { Config } from 'zyzz';\nconst config = Config.create({layers: ['base'], defaultLayer: 'inherit'});",
        "import { Config } from 'zyzz';\nconst config = Config.create({defaultVars: 'a', vars: {a: {color: {brand: 'red'}}, b: {spacing: {brand: '1px'}}}});",
        "import { Config } from 'zyzz';\nconst config = Config.create({vars: {color: {accent: 'red'}, spacing: {accent: '1px'}}, mappings: {color: ['color'], spacing: ['color']}});",
        "import { Vars } from 'zyzz';\nconst theme = Vars.define({color: {brand: 'red'}}, (vars, extra) => ({}));",
        "import { Vars } from 'zyzz';\nconst theme = Vars.define({color: {brand: 'red'}}, {id: ''});",
        "import { variable } from 'zyzz';\nconst gap = variable('length', {inherits: false, initialValue: '-4px'});",
        "import { variable } from 'zyzz';\nfunction make() { return variable('color') }",
    ];
    let output: Vec<String> = sources
        .iter()
        .map(|source| render("app/card.ts", source, false))
        .collect();

    insta::assert_snapshot!(output.join("\n"), @r##"
    error Define local themes with a module-level const; exported themes require source linking. @42..86
    error Layer names must be plain CSS identifiers, optionally dotted. @46..104
    error Theme "b" must have the default theme's complete token paths and domains. @46..145
    error Ambiguous variable token accent for color. @46..169
    error Derived variables require one named parameter and a literal return value. @80..101
    error Definition options require one nonempty literal id.
    error Unsigned variable registrations require a nonnegative literal initialValue. @64..103
    error variable requires a module-level constant. @58..75
    "##);
}

#[test]
fn identifiers_decode_css_identifiers() {
    let inputs = [
        "card",
        "--brand",
        "a\\.b",
        "\\31 23",
        "a b",
        "1abc",
        "a/**/",
        "\u{e9}",
        "a, b",
        "a,,b",
        "--x, y",
        "url(a.png)",
        "url(a.png); color: red",
        "a /* c */ b",
        "x\\,y",
    ];
    let output: Vec<String> = inputs
        .iter()
        .map(|input| {
            serde_json::json!([
                input,
                identifiers::read(input),
                identifiers::list(input, Separator::Comma),
                identifiers::list(input, Separator::Space),
                identifiers::url(input),
            ])
            .to_string()
        })
        .collect();

    insta::assert_snapshot!(output.join("\n"), @r##"
    ["card","card",["card"],["card"],false]
    ["--brand","--brand",["--brand"],["--brand"],false]
    ["a\\.b","a.b",["a.b"],["a.b"],false]
    ["\\31 23","123",["123"],["123"],false]
    ["a b",null,null,["a","b"],false]
    ["1abc",null,null,null,false]
    ["a/**/","a",["a"],["a"],false]
    ["é","é",["é"],["é"],false]
    ["a, b",null,["a","b"],null,false]
    ["a,,b",null,null,null,false]
    ["--x, y",null,["--x","y"],null,false]
    ["url(a.png)",null,null,null,true]
    ["url(a.png); color: red",null,null,null,false]
    ["a /* c */ b",null,null,["a","b"],false]
    ["x\\,y","x,y",["x,y"],["x,y"],false]
    "##);
}
