//! Tokenization through the public `tokenize` iterator. Expectations come from css-tree 3.2.1,
//! with its UTF-16 offsets converted to UTF-8.

use insta::assert_snapshot;
use zyzz_css_syntax::tokenize;

fn tokens(source: &str) -> String {
    tokenize(source)
        .map(|token| {
            format!(
                "{} {}..{} {:?}",
                token.kind.name(),
                token.start,
                token.end,
                &source[token.start as usize..token.end as usize]
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn tokenize_mixed_source() {
    let output = tokens(r#"a{color:red/*c*/}@media (x>1px){} url( x ) "s\"" #id -->"#);

    assert_snapshot!(output, @r##"
    ident-token 0..1 "a"
    {-token 1..2 "{"
    ident-token 2..7 "color"
    colon-token 7..8 ":"
    ident-token 8..11 "red"
    comment-token 11..16 "/*c*/"
    }-token 16..17 "}"
    at-keyword-token 17..23 "@media"
    whitespace-token 23..24 " "
    (-token 24..25 "("
    ident-token 25..26 "x"
    delim-token 26..27 ">"
    dimension-token 27..30 "1px"
    )-token 30..31 ")"
    {-token 31..32 "{"
    }-token 32..33 "}"
    whitespace-token 33..34 " "
    url-token 34..42 "url( x )"
    whitespace-token 42..43 " "
    string-token 43..48 "\"s\\\"\""
    whitespace-token 48..49 " "
    hash-token 49..52 "#id"
    whitespace-token 52..53 " "
    CDC-token 53..56 "-->"
    "##);
}

#[test]
fn tokenize_reports_utf8_offsets() {
    let output = tokens("é 10ñ \"ü\" url(ö) \\e9 x");

    assert_snapshot!(output, @r#"
    ident-token 0..2 "é"
    whitespace-token 2..3 " "
    dimension-token 3..7 "10ñ"
    whitespace-token 7..8 " "
    string-token 8..12 "\"ü\""
    whitespace-token 12..13 " "
    url-token 13..20 "url(ö)"
    whitespace-token 20..21 " "
    ident-token 21..26 "\\e9 x"
    "#);
}

#[test]
fn tokenize_skips_byte_order_mark() {
    let output = tokens("\u{feff}a b");

    assert_snapshot!(output, @r#"
    ident-token 3..4 "a"
    whitespace-token 4..5 " "
    ident-token 5..6 "b"
    "#);
}

#[test]
fn tokenize_clamps_bad_url_at_end() {
    let output = tokens("url(\\9-->; e\\0 ");

    assert_snapshot!(output, @r#"bad-url-token 0..15 "url(\\9-->; e\\0 ""#);
}
