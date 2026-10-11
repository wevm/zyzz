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
    use zyzz_compiler::compiler::handles::Compiler;

    #[test]
    fn unchanged_snapshots() {
        let mut compiler = Compiler::default();
        let input = r#"{"modules":{}}"#;

        insta::assert_snapshot!(
            compiler.compile(input),
            @r#"{"contracts":{},"dependencies":{},"modules":{}}"#
        );
        insta::assert_snapshot!(compiler.compile(input), @r#"{"same":true}"#);
    }
}

mod transform {
    use super::api;

    #[test]
    fn variable_slots() {
        let output: serde_json::Value = serde_json::from_str(&api::call(
            "transform.compile",
            r#"{"moduleId":"library.ts","source":"import {variable} from 'zyzz';export const gap=variable('length');"}"#,
        ))
        .unwrap_or_default();

        insta::assert_snapshot!(output["code"].as_str().unwrap_or_default(), @r#"

        import { Variable as __zyzzVariable } from 'zyzz/runtime';
        export const gap=__zyzzVariable.create({"name":"--z-gap","type":"length","variable":true});
        "#);
    }
}

mod repack {
    use super::api;

    #[test]
    fn dependency_chains() {
        let output: serde_json::Value = serde_json::from_str(&api::call(
            "graph.compile",
            r#"{"modules":{"wrapper/index.ts":"import 'dep';export const loaded=true;"},"contracts":{"dep/index.js":"{\"stylesheets\":[{\"source\":\"index.ts\",\"namespaces\":[],\"key\":\"0\",\"css\":\"body{background-image:url(./pixel.svg);}\",\"layers\":[],\"start\":32,\"content\":\"import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./pixel.svg)'}});\"}],\"exports\":{},\"themes\":{},\"version\":31}"},"imports":{"wrapper/index.ts":{"dep":"dep/index.js"}}}"#,
        ))
        .unwrap_or_default();

        insta::assert_snapshot!(
            output["contracts"]["wrapper/index.ts"].as_str().unwrap_or_default(),
            @r#"{"stylesheets":[{"source":"index.ts","namespaces":[],"key":"0","css":"body{background-image:url(./pixel.svg);}","layers":[],"start":32,"dependency":["dep"],"content":"import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./pixel.svg)'}});"}],"exports":{},"themes":{},"version":31}"#
        );
    }
}

mod dependencies {
    use super::api;

    #[test]
    fn repacked_sections() {
        insta::assert_snapshot!(
            api::call(
                "contract.dependencies",
                r#"{"moduleId":"lib/index.js","contract":"{\"stylesheets\":[{\"source\":\"a.ts\",\"dependency\":[\"dep\"],\"css\":\"\",\"layers\":[]},{\"source\":\"b.ts\",\"css\":\"\",\"layers\":[]}],\"exports\":{},\"themes\":{},\"version\":31}"}"#,
            ),
            @r#"{"dependencies":[["dep"],[]]}"#
        );
    }

    #[test]
    fn invalid_contracts() {
        insta::assert_snapshot!(
            api::call("contract.dependencies", r#"{"moduleId":"lib","contract":"{}"}"#),
            @r#"{"error":{"name":"Error","message":"Unsupported Zyzz contract version."}}"#
        );
    }
}
