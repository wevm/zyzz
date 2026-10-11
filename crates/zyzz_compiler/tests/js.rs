//! Formats the `SyntaxError` messages of `JSON.parse`, whose expected values come from V8.

mod json_error {
    use zyzz_compiler::js;

    #[test]
    fn end() {
        insta::assert_snapshot!(js::json_error("").unwrap_or_default(), @r#"Unexpected end of JSON input"#);
    }

    #[test]
    fn open_object() {
        insta::assert_snapshot!(js::json_error("{").unwrap_or_default(), @r#"Expected property name or '}' in JSON at position 1 (line 1 column 2)"#);
    }

    #[test]
    fn unquoted_key() {
        insta::assert_snapshot!(js::json_error("{a").unwrap_or_default(), @r#"Expected property name or '}' in JSON at position 1 (line 1 column 2)"#);
    }

    #[test]
    fn missing_colon() {
        insta::assert_snapshot!(js::json_error("{\"a\"").unwrap_or_default(), @r#"Expected ':' after property name in JSON at position 4 (line 1 column 5)"#);
    }

    #[test]
    fn missing_value() {
        insta::assert_snapshot!(js::json_error("{\"a\":").unwrap_or_default(), @r#"Unexpected end of JSON input"#);
    }

    #[test]
    fn open_property() {
        insta::assert_snapshot!(js::json_error("{\"a\":1").unwrap_or_default(), @r#"Expected ',' or '}' after property value in JSON at position 6 (line 1 column 7)"#);
    }

    #[test]
    fn trailing_property_comma() {
        insta::assert_snapshot!(js::json_error("{\"a\":1,}").unwrap_or_default(), @r#"Expected double-quoted property name in JSON at position 7 (line 1 column 8)"#);
    }

    #[test]
    fn open_array() {
        insta::assert_snapshot!(js::json_error("[1").unwrap_or_default(), @r#"Expected ',' or ']' after array element in JSON at position 2 (line 1 column 3)"#);
    }

    #[test]
    fn array_gap() {
        insta::assert_snapshot!(js::json_error("[1 2]").unwrap_or_default(), @r#"Expected ',' or ']' after array element in JSON at position 3 (line 1 column 4)"#);
    }

    #[test]
    fn trailing_element_comma() {
        insta::assert_snapshot!(js::json_error("[1,]").unwrap_or_default(), @r#"Unexpected token ']', "[1,]" is not valid JSON"#);
    }

    #[test]
    fn unterminated_string() {
        insta::assert_snapshot!(js::json_error("\"abc").unwrap_or_default(), @r#"Unterminated string in JSON at position 4 (line 1 column 5)"#);
    }

    #[test]
    fn control_character() {
        insta::assert_snapshot!(js::json_error("\"a\nb\"").unwrap_or_default(), @r#"Bad control character in string literal in JSON at position 2 (line 1 column 3)"#);
    }

    #[test]
    fn bad_escape() {
        insta::assert_snapshot!(js::json_error("\"\\x\"").unwrap_or_default(), @r#"Bad escaped character in JSON at position 2 (line 1 column 3)"#);
    }

    #[test]
    fn bad_unicode() {
        insta::assert_snapshot!(js::json_error("{\"a\":\"\\u12\"}").unwrap_or_default(), @r#"Bad Unicode escape in JSON at position 10 (line 1 column 11)"#);
    }

    #[test]
    fn missing_exponent() {
        insta::assert_snapshot!(js::json_error("1e+").unwrap_or_default(), @r#"Exponent part is missing a number in JSON at position 3 (line 1 column 4)"#);
    }

    #[test]
    fn minus_sign() {
        insta::assert_snapshot!(js::json_error("-a").unwrap_or_default(), @r#"No number after minus sign in JSON at position 1 (line 1 column 2)"#);
    }

    #[test]
    fn fraction() {
        insta::assert_snapshot!(js::json_error("1.e").unwrap_or_default(), @r#"Unterminated fractional number in JSON at position 2 (line 1 column 3)"#);
    }

    #[test]
    fn leading_zero() {
        insta::assert_snapshot!(js::json_error("{\"a\":01}").unwrap_or_default(), @r#"Unexpected number in JSON at position 6 (line 1 column 7)"#);
    }

    #[test]
    fn trailing_value() {
        insta::assert_snapshot!(js::json_error("{\"a\":1}x").unwrap_or_default(), @r#"Unexpected non-whitespace character after JSON at position 7 (line 1 column 8)"#);
    }

    #[test]
    fn literal_end() {
        insta::assert_snapshot!(js::json_error("tru").unwrap_or_default(), @r#"Unexpected end of JSON input"#);
    }

    #[test]
    fn literal_mismatch() {
        insta::assert_snapshot!(js::json_error("{\"a\":tx}").unwrap_or_default(), @r#"Unexpected token 'x', "{"a":tx}" is not valid JSON"#);
    }

    #[test]
    fn special_source() {
        insta::assert_snapshot!(js::json_error("undefined").unwrap_or_default(), @r#""undefined" is not valid JSON"#);
    }

    #[test]
    fn long_start() {
        insta::assert_snapshot!(js::json_error("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").unwrap_or_default(), @r#"Unexpected token 'a', "aaaaaaaaaa"... is not valid JSON"#);
    }

    #[test]
    fn long_middle() {
        insta::assert_snapshot!(js::json_error("{\"key\":\"value\", \"other\": oops, \"last\": true}").unwrap_or_default(), @r#"Unexpected token 'o', ..." "other": oops, "las"... is not valid JSON"#);
    }

    #[test]
    fn long_end() {
        insta::assert_snapshot!(js::json_error("{\"key\":\"value\",\"other\":[1,2,3,]}").unwrap_or_default(), @r#"Unexpected token ']', ..."r":[1,2,3,]}" is not valid JSON"#);
    }

    #[test]
    fn line_breaks() {
        insta::assert_snapshot!(js::json_error("{\r\n\"a\":1,\n\r  b").unwrap_or_default(), @r#"Expected double-quoted property name in JSON at position 13 (line 4 column 3)"#);
    }

    #[test]
    fn utf16_position() {
        insta::assert_snapshot!(js::json_error("{\"é😀\":1 x}").unwrap_or_default(), @r#"Expected ',' or '}' after property value in JSON at position 9 (line 1 column 10)"#);
    }

    #[test]
    fn valid() {
        assert_eq!(
            js::json_error(r#" {"a":[1,-0.5e+3,"\u00e9",true,null]} "#),
            None
        );
    }
}
