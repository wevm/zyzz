//! Serialization through the public `generate` function, traversal through `walk` and
//! `walk_visit`, and identifier decoding. Expectations come from css-tree 3.2.1.

use css::{Context, Node, ParseOptions, Walk, generate, ident, parse, walk, walk_visit};
use insta::assert_snapshot;

fn generated(source: &str, context: Context<'_>) -> String {
    let ast = parse(source, &ParseOptions::context(context)).expect("source parses");

    match generate(&ast, ast.root()) {
        Ok(text) => text,
        Err(error) => format!("error: {error}"),
    }
}

#[test]
fn generate_stylesheet_without_whitespace() {
    let output = generated(
        "a  >  b , c { color : red ; margin : -1px+2px  ; } @media screen and (color) { x { y: z } }",
        Context::StyleSheet,
    );

    assert_snapshot!(output, @"a>b,c{color:red;margin:-1px+2px}@media screen and (color){x{y:z}}");
}

#[test]
fn generate_value_inserts_required_spaces() {
    let output = generated(
        r#"1px -2px a-b 3 - 4 "q\"" url( "a b" ) #fff 10% u+0-7f"#,
        Context::Value,
    );

    assert_snapshot!(output, @r#"1px -2px a-b 3 - 4"q\""url(a\ b)#fff 10%u+0-7f"#);
}

#[test]
fn generate_fails_like_css_tree_on_constructor_feature() {
    let output = generated("@media constructor() {}", Context::StyleSheet);

    assert_snapshot!(output, @"error: Unknown node type: undefined");
}

#[test]
fn generate_media_queries_with_flipped_modifiers() {
    let mut ast = parse(
        "not print, screen and (color), (hover)",
        &ParseOptions::context(Context::MediaQueryList),
    )
    .expect("media list parses");
    let queries = ast.children(ast.root()).to_vec();
    let mut inactive = Vec::new();

    for query in queries {
        let Some(Node::MediaQuery {
            condition,
            media_type,
            modifier,
        }) = ast.get_mut(query)
        else {
            continue;
        };

        if media_type.is_some() {
            *modifier = if modifier.is_some_and(|value| value.eq_ignore_ascii_case("not")) {
                None
            } else {
                Some("not")
            };
            inactive.push(generate(&ast, query).expect("query generates"));
        } else if let Some(condition) = *condition {
            inactive.push(generate(&ast, condition).expect("condition generates"));
        }
    }

    assert_snapshot!(inactive.join(" | "), @"print | not screen and (color) | (hover)");
}

#[test]
fn walk_visits_in_css_tree_field_order() {
    let ast = parse(
        "@media x { a { b: c } @supports (d: e) { @page {} } } f { @layer g; }",
        &ParseOptions::default(),
    )
    .expect("stylesheet parses");
    let mut types = Vec::new();

    walk(&ast, ast.root(), |_, node| {
        types.push(node.type_name());
        Walk::Continue
    });

    assert_snapshot!(types.join(" "), @"StyleSheet Atrule AtrulePrelude MediaQueryList MediaQuery Block Rule SelectorList Selector TypeSelector Block Declaration Value Identifier Atrule AtrulePrelude Condition SupportsDeclaration Declaration Value Identifier Block Atrule Block Rule SelectorList Selector TypeSelector Block Atrule AtrulePrelude LayerList Layer");

    let mut names = Vec::new();

    walk_visit(&ast, ast.root(), "Atrule", |_, node| {
        if let Node::Atrule { name, .. } = node {
            names.push(*name);
        }
    });

    assert_snapshot!(names.join(" "), @"media supports page layer");
}

#[test]
fn ident_decode_resolves_escapes() {
    let decoded: Vec<String> = [
        "\\72 ed", "a\\\nb", "\\0", "\\110000", "\\D800", "x\\", "\\é",
    ]
    .iter()
    .map(|value| ident::decode(value).into_owned())
    .collect();

    assert_snapshot!(format!("{decoded:?}"), @r#"["red", "ab", "�", "�", "�", "x", "é"]"#);
}
