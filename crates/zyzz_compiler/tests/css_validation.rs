//! Exercises CSS validation, at-rule transport, namespace rewriting, and stylesheet rendering,
//! from authored stylesheets to transformed output and the diagnostics the TypeScript compiler
//! reports.
//!
//! Snapshots record the TypeScript functions' results for the same inputs, including the
//! lightningcss npm binding's error messages.

use std::fmt::Write as _;

use lightningcss::rules::CssRule;
use lightningcss::targets::Browsers;
use lightningcss::values::url::Url;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};
use zyzz_compiler::compiler::internal::lightning::Options;
use zyzz_compiler::compiler::internal::{
    at_rules, color_profiles, descriptors, expression, functions, keyframes, namespaces,
    properties, stylesheets, view_transitions,
};
use zyzz_compiler::error::{Error, Result};
use zyzz_compiler::mapping::gen_mapping::{GenMapping, Mapping, Position};
use zyzz_compiler::web::internal::namespace;

/// Formats a result as its value or its error message.
fn outcome<T: std::fmt::Display>(result: Result<T>) -> String {
    match result {
        Ok(value) => value.to_string(),
        Err(error) => format!("Error: {}", error.text()),
    }
}

/// Formats a validation result.
fn checked(result: Result<()>) -> String {
    outcome(result.map(|()| "ok"))
}

fn transform(code: &str) -> String {
    outcome(
        at_rules::transform(&Options {
            code,
            filename: "test.css",
            ..Options::default()
        })
        .map(|output| output.code),
    )
}

/// Matches `/^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i`, the relocation hosts' absolute URL test.
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

/// Relocates relative imports and URLs like the stylesheet bundler's visitor.
struct Relocate;

impl<'i> Visitor<'i> for Relocate {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES | VisitTypes::URLS
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Import(import) = rule
            && !import.url.is_empty()
            && !absolute(&import.url)
        {
            let url = format!("zyzz-asset:{}", import.url);

            at_rules::relocate_import(import, &url);
        }

        rule.visit_children(self)
    }

    fn visit_url(&mut self, url: &mut Url<'i>) -> Result<()> {
        if !url.url.is_empty() && !absolute(&url.url) {
            url.url = format!("zyzz-asset:{}", url.url).into();
        }

        Ok(())
    }
}

/// Rejects relative assets like source contribution validation.
struct Reject;

impl<'i> Visitor<'i> for Reject {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES | VisitTypes::URLS
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Import(import) = rule
            && !absolute(&import.url)
        {
            return Err(Error::message(
                "Relative contribution assets require Graph.compile and a relocation host.",
            ));
        }

        rule.visit_children(self)
    }

    fn visit_url(&mut self, url: &mut Url<'i>) -> Result<()> {
        if absolute(&url.url) {
            return Ok(());
        }

        Err(Error::message(
            "Relative contribution assets require Graph.compile and a relocation host.",
        ))
    }
}

/// Records the names of unknown rules, as stylesheet identity checks read transported markers.
#[derive(Default)]
struct Names(Vec<String>);

impl<'i> Visitor<'i> for Names {
    type Error = Error;

    fn visit_types(&self) -> VisitTypes {
        VisitTypes::RULES
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<()> {
        if let CssRule::Unknown(unknown) = &*rule {
            self.0.push(unknown.name.to_string());
        }

        rule.visit_children(self)
    }
}

#[test]
fn transform_transports_newer_at_rules() {
    insta::assert_snapshot!(transform(r#"@property --a { syntax: "<len\gth>"; inherits: false; initial-value: 0px; }"#), @r#"
    @property --a {
      syntax: "<length>";
      inherits: false;
      initial-value: 0;
    }
    "#);

    insta::assert_snapshot!(transform(r#"@property --b { syntax: "\\66 oo | bar"; inherits: false; initial-value: bar; }"#), @r#"
    @property --b {
      syntax: "\\66 oo | bar"; inherits: false; initial-value: bar;
    }
    "#);

    insta::assert_snapshot!(transform("@font-feature-values Font One { font-display: swap; @styleset { nice-style: 12; } }"), @"
    @font-feature-values Font One {
      font-display: swap; @styleset { nice-style: 12; }
    }
    ");

    insta::assert_snapshot!(transform("@font-palette-values --p { font-family: A, B; base-palette: 1; override-colors: 0 red; }"), @"
    @font-palette-values --p {
      font-family: A, B; base-palette: 1; override-colors: 0 red;
    }
    ");

    insta::assert_snapshot!(transform("@view-transition { navigation: auto; types: slide fade; }"), @"
    @view-transition {
      navigation: auto;
      types: slide fade;
    }
    ");

    insta::assert_snapshot!(transform("@color-profile --swop { src: url(swop.icc); rendering-intent: perceptual; }"), @r#"
    @color-profile --swop {
      src: url("swop.icc"); rendering-intent: perceptual;
    }
    "#);
}

#[test]
fn transform_reports_invalid_rules() {
    insta::assert_snapshot!(transform("@font-feature-values Font { font-display: wrong; }"), @"Error: Invalid font-display descriptor.");

    insta::assert_snapshot!(transform("@font-feature-values Font { font-display: swap"), @"Error: Invalid font-display descriptor.");

    insta::assert_snapshot!(transform("@view-transition { types: none slide; }"), @"Error: Invalid view-transition types.");

    insta::assert_snapshot!(transform("@color-profile --x { src: url(a.icc) url(b.icc); }"), @"Error: Color-profile src requires one URL.");

    insta::assert_snapshot!(transform("@keyframes k { 150% { opacity: 0 } }"), @"Error: Ordinary keyframe offsets must be within 0–100%.");

    insta::assert_snapshot!(transform("@keyframes k { 0% { opacity: 0 !important } }"), @"Error: Keyframes forbid important declarations.");

    insta::assert_snapshot!(transform("@counter-style c { system: numeric; symbols: a; }"), @"Error: Numeric and alphabetic counters require at least two symbols.");

    insta::assert_snapshot!(transform("@font-face { font-family: X; size-adjust: -5%; }"), @"Error: @font-face size-adjust cannot be negative.");

    insta::assert_snapshot!(transform("@function --f(--a <length>: red) { result: 1px; }"), @"Error: Invalid CSS function argument for its declared syntax.");

    insta::assert_snapshot!(transform("@property --a { syntax: \"<length>\"; inherits: maybe; initial-value: 0px; }"), @"Error: Property registration requires boolean inherits.");

    insta::assert_snapshot!(transform(".a { color: red; } ?"), @"Error: Unexpected end of input");
}

#[test]
fn transform_minifies_for_targets() {
    let output = at_rules::transform(&Options {
        code: ".a { user-select: none; inset: 0 }\n@media (width >= 30em) { .b { color: rgb(0 0 0 / 50%) } }",
        filename: "targets.css",
        minify: true,
        targets: Some(Browsers {
            chrome: Some(80 << 16),
            safari: Some(12 << 16),
            ..Browsers::default()
        }),
        ..Options::default()
    });

    insta::assert_snapshot!(outcome(output.map(|output| output.code)), @".a{-webkit-user-select:none;user-select:none;top:0;bottom:0;left:0;right:0}@media (min-width:30em){.b{color:#00000080}}");
}

#[test]
fn transform_recovers_from_invalid_rules() {
    let output = at_rules::transform(&Options {
        code: ".a { color: red } .b { ? } @media (min-width: 1px) { .c { margin: 0 } }",
        error_recovery: true,
        filename: "recovery.css",
        ..Options::default()
    });

    insta::assert_snapshot!(outcome(output.map(|output| output.code)), @"
    .a {
      color: red;
    }

    @media (width >= 1px) {
      .c {
        margin: 0;
      }
    }
    ");
}

#[test]
fn transform_with_relocates_imports_and_urls() {
    let code = "@import \"a.css\" layer;\n@import 'b.css' layer;\n@import url(\"c.css\") layer(base) supports(display: grid);\n@import \"https://x.test/d.css\" layer;\n.a { background: url(e.png) }";
    let output = at_rules::transform_with(
        &Options {
            code,
            filename: "imports.css",
            ..Options::default()
        },
        &mut Relocate,
    );

    insta::assert_snapshot!(outcome(output.map(|output| output.code)), @r#"
    @import "zyzz-asset:a.css" layer;
    @import "zyzz-asset:b.css";
    @import "zyzz-asset:c.css" layer(base) supports(display: grid);
    @import "https://x.test/d.css" layer;

    .a {
      background: url("zyzz-asset:e.png");
    }
    "#);
}

#[test]
fn transform_with_returns_visitor_errors() {
    let output = at_rules::transform_with(
        &Options {
            code: "@font-palette-values --p { font-family: A; }\n.a { background: url(e.png) }",
            filename: "reject.css",
            ..Options::default()
        },
        &mut Reject,
    );

    insta::assert_snapshot!(outcome(output.map(|output| output.code)), @"Error: Relative contribution assets require Graph.compile and a relocation host.");
}

#[test]
fn transform_with_visits_transported_markers() {
    let mut names = Names::default();
    let output = at_rules::transform_with(
        &Options {
            code: r#"/* -zyzz-fpv-000000000 */
@font-palette-values --p { font-family: A; }
@property --a { syntax: "\\66 oo | bar"; inherits: false; initial-value: bar; }
@zyzz-property {}"#,
            filename: "markers.css",
            ..Options::default()
        },
        &mut names,
    );

    insta::assert_snapshot!(outcome(output.map(|output| output.code)), @r#"
    @font-palette-values --p {
      font-family: A;
    }

    @property --a {
      syntax: "\\66 oo | bar"; inherits: false; initial-value: bar;
    }

    @zyzz-property {
      
    }
    "#);

    insta::assert_snapshot!(names.0.join("\n"), @"
    -zyzz-fpv-000000001
    zyzz-property-x
    zyzz-property
    ");
}

#[test]
fn rename_skips_strings_comments_and_arguments() {
    let source = "@Property --a {} .a::after { content: \"@property\" } /* @property */ @supports selector(@property) {} @property-x {} @\\property {}";

    insta::assert_snapshot!(at_rules::rename(source, "property", "zyzz-property"), @r#"@zyzz-property --a {} .a::after { content: "@property" } /* @property */ @supports selector(@property) {} @property-x {} @\property {}"#);

    insta::assert_snapshot!(at_rules::rename("@property --a {} /* open", "property", "zyzz-property"), @"@property --a {} /* open");
}

#[test]
fn descriptors_check() {
    let check = |rule: &str, name: &str, value: &str| {
        checked(descriptors::check(&descriptors::Descriptor {
            name,
            rule,
            value,
        }))
    };

    insta::assert_snapshot!(check("page", "size", "A4 landscape"), @"ok");

    insta::assert_snapshot!(check("page", "size", "calc(1px + red)"), @r#"Error: Unexpected token Function("calc")"#);

    insta::assert_snapshot!(check("page", "pageMarginSafety", "clamp"), @"ok");

    insta::assert_snapshot!(check("font-face", "fontDisplay", "sometimes"), @"
    Error: Invalid @font-face font-display: Mismatch
      syntax: auto | block | swap | fallback | optional
       value: sometimes
      --------^
    ");
}

#[test]
fn descriptors_media() {
    insta::assert_snapshot!(checked(descriptors::media("(min-width: 30em) and (orientation: landscape)")), @"ok");

    insta::assert_snapshot!(checked(descriptors::media("(min-width: )")), @"ok");
}

#[test]
fn descriptors_validate() {
    insta::assert_snapshot!(checked(descriptors::validate("@custom-media --narrow (max-width: 30em);")), @"ok");

    insta::assert_snapshot!(checked(descriptors::validate("@custom-media narrow (max-width: 30em);")), @"Error: Custom-media requires a dashed name and query.");

    insta::assert_snapshot!(checked(descriptors::validate("@page :first { size: A4; bleed: auto; }")), @"ok");

    insta::assert_snapshot!(checked(descriptors::validate("@page :nth(2) { size: A4; }")), @"
    Error: Invalid page selector: Mismatch
      syntax: <page-selector-list>
       value: :nth(2)
      ---------^
    ");

    insta::assert_snapshot!(checked(descriptors::validate("@counter-style c { system: additive; additive-symbols: 1 a, 2 b; }")), @"Error: Additive symbol weights must strictly descend.");

    insta::assert_snapshot!(checked(descriptors::validate("@counter-style c { system: cyclic; symbols: a; range: 5 1; }")), @"Error: Counter ranges must have increasing bounds.");

    insta::assert_snapshot!(checked(descriptors::validate("@font-face { font-family: X; font-weight: 0; }")), @"
    Error: Invalid @font-face font-weight: Mismatch
      syntax: <font-weight-absolute>{1,2}
       value: 0
      --------^
    ");

    insta::assert_snapshot!(checked(descriptors::validate("@font-palette-values --p { font-family: A; override-colors: 0 currentcolor; }")), @"Error: Palette overrides require absolute colors.");

    insta::assert_snapshot!(checked(descriptors::validate("@document url(http://x.test) { a { color: red } }")), @"ok");
}

#[test]
fn functions_value() {
    let value = |syntax: &str, input: &str| {
        outcome(functions::value(syntax, input).map(|matched| format!("{matched:?}")))
    };

    insta::assert_snapshot!(value("<length> | auto", " auto "), @r#"Some("auto")"#);

    insta::assert_snapshot!(value("<length> | auto", "{ 4px }"), @r#"Some("<length>")"#);

    insta::assert_snapshot!(value("type(small | large+)", "large large"), @r#"Some("large+")"#);

    insta::assert_snapshot!(value("item#", "item, item"), @r#"Some("item#")"#);

    insta::assert_snapshot!(value("<color>", "var(--x)"), @"None");

    insta::assert_snapshot!(value("<length>", "red"), @"Error: Invalid CSS function argument for its declared syntax.");

    insta::assert_snapshot!(value("<length>", "1px; color: red"), @"Error: Unexpected input");
}

#[test]
fn functions_validate() {
    insta::assert_snapshot!(checked(functions::validate("@function --f(--a <length>: 1px, --b) returns <length> { result: calc(var(--a) * 2); }")), @"ok");

    insta::assert_snapshot!(checked(functions::validate("@function f(--a) { result: 1; }")), @"Error: CSS function names require a dashed identifier.");

    insta::assert_snapshot!(checked(functions::validate("@function --f(--a, --a) { result: 1; }")), @"Error: CSS function parameters require unique dashed names.");

    insta::assert_snapshot!(checked(functions::validate("@function --f(--a <nope>) { result: 1; }")), @"Error: Invalid CSS function parameter syntax.");

    insta::assert_snapshot!(checked(functions::validate("@function --f() returns <length { result: 1; }")), @"Error: Invalid CSS function return syntax.");

    insta::assert_snapshot!(checked(functions::validate("@function --f() { @media (width > 1px) { result: 1; } color: red; }")), @"Error: Invalid CSS function body context.");

    insta::assert_snapshot!(checked(functions::validate("@function --f() { @media (width >) { result: 1; } }")), @"ok");
}

#[test]
fn properties_initial() {
    insta::assert_snapshot!(checked(properties::initial("1px solid red")), @"ok");

    insta::assert_snapshot!(checked(properties::initial("red; color: blue")), @"Error: Unexpected input");
}

#[test]
fn properties_validate() {
    let validate = |source: &str| outcome(properties::validate(source));

    insta::assert_snapshot!(validate("@property --a { syntax: \"<length>\"; inherits: false; initial-value: 0px; }"), @"false");

    insta::assert_snapshot!(validate(r#"@property --a { syntax: "\\66 oo | bar"; inherits: false; initial-value: bar; }"#), @"true");

    insta::assert_snapshot!(validate("@property --a { syntax: \"<length>\"; inherits: false; initial-value: 1em; }"), @"Error: Registered initial values must be computationally independent.");

    insta::assert_snapshot!(validate("@property --a { syntax: \"<color>\"; inherits: false; initial-value: 1px; }"), @"Error: Registered initial values must match the declared syntax.");

    insta::assert_snapshot!(validate("@property --a { syntax: \"<length>\"; inherits: false; }"), @"Error: Non-universal property registrations require an initial value.");

    insta::assert_snapshot!(validate("@property a { syntax: \"*\"; inherits: false; }"), @"Error: Property registration requires a custom-property name and descriptors.");

    insta::assert_snapshot!(validate("@property --a { syntax: \"<string>\"; inherits: false; initial-value: \"x\"; }"), @"Error: Property registration requires a supported syntax string.");

    insta::assert_snapshot!(validate("@property --a { syntax: \"*\"; inherits: true; color: red; }"), @"Error: Unknown property descriptor.");
}

#[test]
fn keyframes_validate() {
    insta::assert_snapshot!(checked(keyframes::validate("@media print { @keyframes k { from { opacity: 0 } -10% { opacity: 1 } } }")), @"Error: Ordinary keyframe offsets must be within 0–100%.");

    insta::assert_snapshot!(checked(keyframes::validate("@keyframes k { cover 150% { opacity: 0 } }")), @"ok");
}

#[test]
fn keyframes_accepts() {
    let accepts = |selector: &str| keyframes::accepts(selector).to_string();

    insta::assert_snapshot!(accepts("from, 50%, to"), @"true");

    insta::assert_snapshot!(accepts("entry 120%"), @"true");

    insta::assert_snapshot!(accepts("101%"), @"false");

    insta::assert_snapshot!(accepts("50%{opacity:1} 60%"), @"false");
}

#[test]
fn color_profiles_validate() {
    insta::assert_snapshot!(checked(color_profiles::validate("@color-profile device-cmyk { src: url(cmyk.icc); components: cyan, magenta; }")), @"ok");

    insta::assert_snapshot!(checked(color_profiles::validate("@color-profile --x { src: url(a.icc); components: a, none, b; }")), @"Error: Color-profile components require comma-separated identifiers other than none.");

    insta::assert_snapshot!(checked(color_profiles::validate("@color-profile --x { rendering-intent: saturation; }")), @"Error: Color-profile requires a src descriptor.");

    insta::assert_snapshot!(checked(color_profiles::validate("@color-profile --x { src: url(a.icc); gamma: 2; }")), @"Error: Unknown color-profile descriptor.");
}

#[test]
fn view_transitions_validate() {
    let validate = |source: &str| checked(view_transitions::validate(source, "-zyzz-vt"));

    insta::assert_snapshot!(validate("@-zyzz-vt { navigation: auto; types: --slide fade; }"), @"ok");

    insta::assert_snapshot!(validate("@-zyzz-vt { navigation: auto none; }"), @"Error: Invalid view-transition navigation.");

    insta::assert_snapshot!(validate("@-zyzz-vt { types: inherit; }"), @"Error: Invalid view-transition types.");

    insta::assert_snapshot!(validate("@-zyzz-vt { navigation: 1; }"), @"Error: Invalid view-transition descriptor.");

    insta::assert_snapshot!(validate("@-zyzz-vt foo { navigation: auto; }"), @"Error: View-transition rules require a descriptor block and no prelude.");

    insta::assert_snapshot!(validate("@-zyzz-vt { duration: 1s; }"), @"Error: Invalid view-transition descriptor.");
}

#[test]
fn expression_matcher() {
    let matches = expression::matcher();

    insta::assert_snapshot!(matches("box-shadow", "0 0 4px rgb(1 2 3)").to_string(), @"true");

    insta::assert_snapshot!(matches("box-shadow", "0 0 4px solid").to_string(), @"false");

    insta::assert_snapshot!(matches("--x", "anything").to_string(), @"false");

    insta::assert_snapshot!(matches("colour", "red").to_string(), @"false");
}

fn definition(name: &str, prefix: Option<&str>, uri: &str) -> namespace::Definition {
    namespace::Definition {
        name: name.into(),
        prefix: prefix.map(Into::into),
        uri: uri.into(),
    }
}

#[test]
fn namespaces_rewrite_selectors() {
    let namespaces = [
        definition("z-svg", Some("s\\76 g"), "http://www.w3.org/2000/svg"),
        definition("z-html", None, "urn:\"html\""),
    ];
    let css = "@namespace z-svg url(x);\nrect, svg|circle > .a { fill: red }\n:is(svg|a, b)::before { color: blue }\n[svg|href], ::slotted(svg|a) { color: green }";
    let (output, map) = namespaces::rewrite(css, &namespaces, None, true).unwrap_or_default();

    insta::assert_snapshot!(output, @r#"
    @namespace z-html "urn:\"html\"";
    @namespace z-svg "x";

    z-html|rect, z-svg|circle > z-html|*.a {
      fill: red;
    }

    z-html|*:is(z-svg|a, z-html|b):before {
      color: #00f;
    }

    z-html|*[z-svg|href], z-html|*::slotted(svg|a) {
      color: green;
    }
    "#);

    assert!(map.is_none());
}

#[test]
fn namespaces_rewrite_composes_maps() {
    let mut previous = GenMapping::new(Some("module.ts.css"));

    for (line, column) in [(1, 0), (1, 6), (2, 0)] {
        previous.add_mapping(&Mapping {
            generated: Position { column, line },
            name: None,
            original: Some(Position {
                column: column + 10,
                line: line + 4,
            }),
            source: Some("module.ts"),
        });
    }

    previous.set_source_content("module.ts", Some("export {}"));

    let previous = previous.to_encoded_map();
    let (output, map) = namespaces::rewrite(
        "rect { fill: red }\n.é😀 { fill: blue }",
        &[definition("z-svg", None, "http://www.w3.org/2000/svg")],
        Some(&previous),
        true,
    )
    .unwrap_or_default();

    insta::assert_snapshot!(output, @r#"
    @namespace z-svg "http://www.w3.org/2000/svg";
    z-svg|rect {
      fill: red;
    }

    z-svg|*.é😀 {
      fill: #00f;
    }
    "#);

    insta::assert_snapshot!(map.map(|map| map.to_json()).unwrap_or_default(), @r#"{"version":3,"file":"module.ts.css","names":[],"sources":["module.ts"],"sourcesContent":["export {}"],"mappings":";AAIU;;;;AACA","ignoreList":[]}"#);
}

fn section(source: &str, css: &str) -> stylesheets::Section {
    stylesheets::Section {
        css: css.into(),
        source: source.into(),
        ..stylesheets::Section::default()
    }
}

fn rendered(sections: &[stylesheets::Section]) -> String {
    match stylesheets::render(sections) {
        Ok(rendered) => {
            let mut output = rendered.css;

            for (key, target) in &rendered.assets {
                let _ = write!(output, "\nasset {key} -> {target}");
            }

            for (key, owner) in &rendered.owners {
                let _ = write!(output, "\nowner {key} -> {owner}");
            }

            output.push('\n');
            output.push_str(&rendered.map.to_json());
            output
        }
        Err(Error::Conflict { message, source }) => format!("Conflict from {source}: {message}"),
        Err(error) => format!("Error: {}", error.text()),
    }
}

#[test]
fn stylesheets_render_relocates_assets() {
    let mut first = section(
        "app/main.ts",
        "@import \"./base.css\" layer;\n.a { background: url(\"./img/é x.png\") }",
    );

    first.content = Some("const a = 1\nconst b = style({})".into());
    first.layers = vec![vec!["base".into(), "theme".into()]];
    first.owner = Some("pkg/contract.json".into());
    first.start = Some(18);

    let second = section("app/nested/deep.ts", "@import \"https://x.test/a.css\";");

    insta::assert_snapshot!(rendered(&[first.clone(), second, first]), @r#"
    @layer base,theme;
    @import "zyzz-asset:app%2Fbase.css" layer;

    .a {
      background: url("zyzz-asset:app%2Fimg%2F%C3%A9%20x.png");
    }
    @import "https://x.test/a.css";
    asset zyzz-asset:app%2Fbase.css -> app/base.css
    asset zyzz-asset:app%2Fimg%2F%C3%A9%20x.png -> app/img/é x.png
    owner zyzz-asset:app%2Fbase.css -> pkg/contract.json
    owner zyzz-asset:app%2Fimg%2F%C3%A9%20x.png -> pkg/contract.json
    {"version":3,"file":"zyzz.shared.css","names":[],"sources":["app/main.ts","app/nested/deep.ts"],"sourcesContent":["const a = 1\nconst b = style({})",null],"mappings":";AACM;AAAA;AAAA;AAAA;AAAA;ACDN","ignoreList":[]}
    "#);
}

#[test]
fn stylesheets_render_rejects_conflicts() {
    let mut first = section("a.ts", ".a { color: red }");
    let mut second = section("a.ts", ".a { color: blue }");

    first.key = Some("k".into());
    second.key = Some("k".into());

    insta::assert_snapshot!(rendered(&[first, second]), @"Conflict from a.ts: Conflicting packed stylesheet contributions.");

    insta::assert_snapshot!(rendered(&[
        section("a.ts", "@keyframes spin { to { rotate: 1turn } }"),
        section("b.ts", "@keyframes spin { to { rotate: 1turn } }"),
    ]), @"Conflict from b.ts: Conflicting animation identity: spin; supply distinct declaration ids.");

    let mut palette = section("a.ts", "@font-palette-values --p { font-family: A; }");
    let mut changed = section("a.ts", "@font-palette-values --p { font-family: B; }");

    palette.key = Some("one".into());
    changed.key = Some("two".into());

    insta::assert_snapshot!(rendered(&[palette, changed]), @"Conflict from a.ts: Conflicting stylesheet identity: --p; supply distinct declaration ids.");

    let mut svg = section("a.ts", "rect { fill: red }");
    let mut other = section("b.ts", "circle { fill: blue }");

    svg.namespaces = Some(vec![definition(
        "z-nsvg",
        None,
        "http://www.w3.org/2000/svg",
    )]);
    other.namespaces = Some(vec![definition("z-nsvg", None, "urn:other")]);
    other.owner = Some("pkg/contract.json".into());

    insta::assert_snapshot!(rendered(&[svg, other]), @"Conflict from pkg/contract.json: Conflicting namespace identity.");

    insta::assert_snapshot!(rendered(&[section("a.ts", ".a { background: url(../../x.png) }")]), @"Error: Asset path escapes the supplied graph.");
}

/// Host stylesheet transport through the JSON operation `AtRules.transform` calls.
mod transport {
    use zyzz_compiler::api;

    #[test]
    fn renamed_at_keywords() {
        insta::assert_snapshot!(
            api::call(
                "css.transport",
                r#"{"code":"@font-feature-values Inter{font-display:swap;@styleset{nice:1}}","visitor":false}"#,
            ),
            @r#"{"code":"@-zyzz-ffv-000000000 Inter{font-display:swap;@styleset{nice:1}}","features":"-zyzz-ffv-000000000","import":"zyzz-anonymous-import","palette":"-zyzz-fpv-000000000","property":"zyzz-property"}"#
        );
    }

    #[test]
    fn unchanged_stylesheets() {
        insta::assert_snapshot!(
            api::call("css.transport", r#"{"code":"@media print{a{color:red}}","visitor":false}"#),
            @"null"
        );
    }

    #[test]
    fn invalid_descriptors() {
        insta::assert_snapshot!(
            api::call(
                "css.transport",
                r#"{"code":"@font-feature-values Inter{font-display:soon}","visitor":false}"#,
            ),
            @r#"{"error":{"name":"Error","message":"Invalid font-display descriptor."}}"#
        );
    }
}
