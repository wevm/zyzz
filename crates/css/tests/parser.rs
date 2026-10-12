//! Parsing through the public `parse` function across contexts, including css-tree's error
//! recovery. Expectations come from css-tree 3.2.1.

mod support;

use css::{Context, ParseOptions, parse};
use insta::assert_snapshot;

fn tree(source: &str, context: Context<'_>) -> String {
    match parse(source, &ParseOptions::context(context)) {
        Ok(ast) => support::render(&ast, ast.root()),
        Err(error) => format!("error: {error}"),
    }
}

#[test]
fn parse_stylesheet_with_nesting() {
    let output = tree(
        "a > b:hover { color: red !important; @media (width >= 600px) { & .c { margin: 0 auto } } }",
        Context::StyleSheet,
    );

    assert_snapshot!(output, @r#"
    StyleSheet
      Rule
        .prelude
          SelectorList
            Selector
              TypeSelector name="a"
              Combinator name=">"
              TypeSelector name="b"
              PseudoClassSelector name="hover"
        .block
          Block
            Declaration important=true property="color"
              .value
                Value
                  Identifier name="red"
            Atrule name="media"
              .prelude
                AtrulePrelude
                  MediaQueryList
                    MediaQuery
                      .condition
                        Condition kind="media"
                          FeatureRange kind="media" leftComparison=">="
                            .left
                              Identifier name="width"
                            .middle
                              Dimension value="600" unit="px"
              .block
                Block
                  Rule
                    .prelude
                      SelectorList
                        Selector
                          NestingSelector
                          Combinator name=" "
                          ClassSelector name="c"
                    .block
                      Block
                        Declaration important=false property="margin"
                          .value
                            Value
                              Number value="0"
                              Identifier name="auto"
    "#);
}

#[test]
fn parse_value_pads_sign_operators() {
    let output = tree("calc(100% - 2px) 1px+2px, var(--x, 1px)", Context::Value);

    assert_snapshot!(output, @r#"
    Value
      Function name="calc"
        Percentage value="100"
        Operator value=" - "
        Dimension value="2" unit="px"
      Dimension value="1" unit="px"
      Dimension value="+2" unit="px"
      Operator value=","
      Function name="var"
        Identifier name="--x"
        Operator value=","
        Raw value=" 1px"
    "#);
}

#[test]
fn parse_value_rejects_trailing_input() {
    let output = tree("a;b", Context::Value);

    assert_snapshot!(output, @"error: Unexpected input");
}

#[test]
fn parse_media_query_list() {
    let output = tree(
        "screen and (min-width: 100px), not print, (10px < width <= 20em), (orientation: landscape)",
        Context::MediaQueryList,
    );

    assert_snapshot!(output, @r#"
    MediaQueryList
      MediaQuery mediaType="screen"
        .condition
          Condition kind="media"
            Feature kind="media" name="min-width"
              .value
                Dimension value="100" unit="px"
      MediaQuery modifier="not" mediaType="print"
      MediaQuery
        .condition
          Condition kind="media"
            FeatureRange kind="media" leftComparison="<" rightComparison="<="
              .left
                Dimension value="10" unit="px"
              .middle
                Identifier name="width"
              .right
                Dimension value="20" unit="em"
      MediaQuery
        .condition
          Condition kind="media"
            Feature kind="media" name="orientation"
              .value
                Identifier name="landscape"
    "#);
}

#[test]
fn parse_supports_condition() {
    let output = tree(
        "@supports (display: grid) and (not (a b c)) {}",
        Context::StyleSheet,
    );

    assert_snapshot!(output, @r#"
    StyleSheet
      Atrule name="supports"
        .prelude
          AtrulePrelude
            Condition kind="supports"
              SupportsDeclaration
                .declaration
                  Declaration important=false property="display"
                    .value
                      Value
                        Identifier name="grid"
              Identifier name="and"
              Condition kind="supports"
                Identifier name="not"
                Condition kind="supports"
                  Identifier name="a"
                  Identifier name="b"
                  Identifier name="c"
        .block
          Block
    "#);
}

#[test]
fn parse_recovers_with_raw_nodes() {
    let output = tree(
        "a { color: ; b: (; c: d } @foo bar; e{",
        Context::StyleSheet,
    );

    assert_snapshot!(output, @r#"
    StyleSheet
      Rule
        .prelude
          SelectorList
            Selector
              TypeSelector name="a"
        .block
          Block
            Declaration important=false property="color"
              .value
                Value
            Declaration important=false property="b"
              .value
                Raw value="(; c: d } @foo bar; e{"
    "#);
}

#[test]
fn parse_declaration_list() {
    let output = tree(
        "result: calc(var(--x) * 2); @media (min-width: 1px) { result: 1px }; --y:",
        Context::DeclarationList,
    );

    assert_snapshot!(output, @r#"
    DeclarationList
      Declaration important=false property="result"
        .value
          Value
            Function name="calc"
              Function name="var"
                Identifier name="--x"
              Operator value="*"
              Number value="2"
      Atrule name="media"
        .prelude
          AtrulePrelude
            MediaQueryList
              MediaQuery
                .condition
                  Condition kind="media"
                    Feature kind="media" name="min-width"
                      .value
                        Dimension value="1" unit="px"
        .block
          Block
            Declaration important=false property="result"
              .value
                Value
                  Dimension value="1" unit="px"
      Declaration important=false property="--y"
        .value
          Raw value=""
    "#);
}

#[test]
fn parse_property_registration() {
    let output = tree(
        r#"@property --x { syntax: "<length>"; inherits: false; initial-value: 0px }"#,
        Context::StyleSheet,
    );

    assert_snapshot!(output, @r#"
    StyleSheet
      Atrule name="property"
        .prelude
          AtrulePrelude
            Identifier name="--x"
        .block
          Block
            Declaration important=false property="syntax"
              .value
                Value
                  String value="<length>"
            Declaration important=false property="inherits"
              .value
                Value
                  Identifier name="false"
            Declaration important=false property="initial-value"
              .value
                Value
                  Dimension value="0" unit="px"
    "#);
}
