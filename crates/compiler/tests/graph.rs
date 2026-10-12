//! Compiles source graphs through the JSON operations the host adapters call.

use compiler::api;

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
    fn malformed_contracts() {
        insta::assert_snapshot!(
            api::call("graph.compile", r#"{"contracts":{"lib":"{"},"modules":{}}"#),
            @r#"{"error":{"name":"Source.ExtractError","diagnostics":[{"code":"unsupported_syntax","end":0,"message":"Invalid library contract: Expected property name or '}' in JSON at position 1 (line 1 column 2)","source":"lib","start":0}],"message":"lib:0: Invalid library contract: Expected property name or '}' in JSON at position 1 (line 1 column 2)"}}"#
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
    use compiler::compiler::handles::Compiler;

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

    #[test]
    fn repeated_failures() {
        let mut compiler = Compiler::default();
        let valid = r#"{"modules":{}}"#;
        let invalid = r#"{"contracts":{"lib":"{}"},"modules":{}}"#;

        compiler.compile(valid);

        // A failing snapshot reports its error again rather than the earlier success.
        insta::assert_snapshot!(
            compiler.compile(invalid),
            @r#"{"error":{"name":"Source.ExtractError","diagnostics":[{"code":"unsupported_syntax","end":0,"message":"Invalid library contract: Unsupported Zyzz contract version.","source":"lib","start":0}],"message":"lib:0: Invalid library contract: Unsupported Zyzz contract version."}}"#
        );
        insta::assert_snapshot!(
            compiler.compile(invalid),
            @r#"{"error":{"name":"Source.ExtractError","diagnostics":[{"code":"unsupported_syntax","end":0,"message":"Invalid library contract: Unsupported Zyzz contract version.","source":"lib","start":0}],"message":"lib:0: Invalid library contract: Unsupported Zyzz contract version."}}"#
        );
        insta::assert_snapshot!(compiler.compile(valid), @r#"{"same":true}"#);
    }

    #[test]
    fn alternating_snapshots() {
        let mut compiler = Compiler::default();
        let button =
            r#""button.ts":"import {style} from 'zyzz';export const button=style({color:'red'});""#;
        let card =
            r#""card.ts":"import {style} from 'zyzz';export const card=style({opacity:0.5});""#;
        let mut compile = |modules: &str| -> serde_json::Value {
            // Host-resolved imports keep the cache while modules enter and leave the graph.
            serde_json::from_str(
                &compiler.compile(&format!(
                    r#"{{"imports":{{"button.ts":{{"zyzz":null}},"card.ts":{{"zyzz":null}}}},"modules":{{{modules}}}}}"#
                )),
            )
            .unwrap_or_default()
        };
        let both = format!("{button},{card}");

        assert!(compile(&both)["modules"]["card.ts"].is_object());
        insta::assert_snapshot!(compile(button)["modules"]["button.ts"].to_string(), @"0");

        // The card output is the one the host decoded before the snapshot without it.
        insta::assert_snapshot!(compile(&both)["modules"]["card.ts"].to_string(), @"0");
    }
}

mod transform {
    use super::api;

    #[test]
    fn invalid_output_modes() {
        insta::assert_snapshot!(
            api::call(
                "transform.compile",
                r#"{"cssOutput":"nested","moduleId":"card.ts","source":"import {style} from 'zyzz';export const card=style({color:'red'});"}"#,
            ),
            @r#"{"error":{"name":"Css.CompileError","diagnostics":[{"code":"invalid_output","message":"cssOutput must be atomic or grouped.","path":["cssOutput"]}],"message":"[\"cssOutput\"]: cssOutput must be atomic or grouped."}}"#
        );

        let output: serde_json::Value = serde_json::from_str(&api::call(
            "transform.compile",
            r#"{"composition":"mixed","moduleId":"card.ts","source":"import {style} from 'zyzz';export const card=style({color:'red'});"}"#,
        ))
        .unwrap_or_default();

        insta::assert_snapshot!(output["css"].as_str().unwrap_or_default(), @".z-text-red{color:red;}");
    }

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
    fn malformed_contracts() {
        insta::assert_snapshot!(
            api::call("contract.dependencies", r#"{"moduleId":"lib","contract":"{"}"#),
            @r#"{"error":{"name":"SyntaxError","message":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}}"#
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
