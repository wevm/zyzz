//! Compiles source graphs through the JSON operations the host adapters call.

use zyzz_compiler::api;

mod compile {
    use super::api;

    #[test]
    fn empty_graph() {
        insta::assert_snapshot!(
            api::call("graph.compile", r#"{"modules":{}}"#),
            @r#"{"contracts":{},"dependencies":{},"modules":{}}"#
        );
    }

    #[test]
    fn conflicting_sources() {
        insta::assert_snapshot!(
            api::call(
                "graph.compile",
                r#"{"contracts":{"a.ts":"{}"},"modules":{"a.ts":""}}"#
            ),
            @r#"{"error":{"name":"Source.ExtractError","diagnostics":[{"code":"unsupported_syntax","end":0,"message":"A module cannot supply both source and a library contract.","source":"a.ts","start":0}],"message":"a.ts:0: A module cannot supply both source and a library contract."}}"#
        );
    }

    #[test]
    fn invalid_contracts() {
        insta::assert_snapshot!(
            api::call("graph.compile", r#"{"contracts":{"lib":"{}"},"modules":{}}"#),
            @r#"{"error":{"name":"Source.ExtractError","diagnostics":[{"code":"unsupported_syntax","end":0,"message":"Invalid library contract: Unsupported Zyzz contract version.","source":"lib","start":0}],"message":"lib:0: Invalid library contract: Unsupported Zyzz contract version."}}"#
        );
    }
}

mod create {
    use super::api;

    #[test]
    fn unchanged_snapshots() {
        let created = api::call("graph.create", "");
        let handle: serde_json::Value = serde_json::from_str(&created).unwrap_or_default();
        let handle = handle["handle"].as_u64().unwrap_or_default();
        let input = format!(r#"{{"handle":{handle},"modules":{{}}}}"#);

        insta::assert_snapshot!(
            api::call("graph.compile", &input),
            @r#"{"contracts":{},"dependencies":{},"modules":{}}"#
        );
        insta::assert_snapshot!(api::call("graph.compile", &input), @r#"{"same":true}"#);

        api::call("graph.release", &format!(r#"{{"handle":{handle}}}"#));

        insta::assert_snapshot!(
            api::call("graph.compile", &input),
            @r#"{"error":{"name":"Error","message":"Unknown graph compiler: 1"}}"#
        );
    }
}
