//! Compiles native graphs and single native modules through the JSON operations and the
//! incremental compiler the host adapters call.

use zyzz_compiler::api;

/// Native graphs, whose expected values come from `Graph.compile` on the same inputs.
mod native {
    use serde_json::{Value, json};
    use zyzz_compiler::compiler::handles::Compiler;

    use super::api;

    /// Two sets as `Wire.encode` writes them for `{ styles: { styles: [] }, vars }`.
    const SETS: &str = r##"{"objects":[["c",{"keys":["variableSet"],"variableSet":true}],["m",0,null,[["color.ink",{"r":[["light","#111111"],["dark","#222222"]]}],["spacing.gap","4px"]],null,null],["c",{"keys":["variableSet"],"variableSet":true}],["m",2,null,[["color.ink","#333333"],["spacing.gap","8px"]],null,null]],"strings":[],"styles":[],"vars":[["base",1],["roomy",3]]}"##;

    const CARD: &str = "import {Config} from 'zyzz';const {style}=Config.create({vars:{color:{ink:'#000000'},spacing:{gap:'2px'}}});export const card=style({color:'ink',paddingTop:'gap'});";

    fn compile(input: &Value) -> Value {
        serde_json::from_str(&api::call("graph.compile", &input.to_string())).unwrap_or_default()
    }

    fn incremental(compiler: &mut Compiler, input: &Value) -> Value {
        serde_json::from_str(&compiler.compile(&input.to_string())).unwrap_or_default()
    }

    fn text(value: &Value) -> &str {
        value.as_str().unwrap_or_default()
    }

    #[test]
    fn profiles() {
        let output = compile(&json!({
            "modules": {
                "config.ts": "import {Config} from 'zyzz';export const {vars}=Config.create({vars:{spacing:{gap:'4px'}}});",
                "nested/left.ts": "import {useVars} from 'zyzz/react-native/react';import {vars} from '../config.js';export const left=()=>useVars(vars).spacing;",
            },
            "native": { "colorScheme": "light" },
        }));

        insta::assert_snapshot!(output["dependencies"].to_string(), @r#"{"config.ts":[],"nested/left.ts":["config.ts"]}"#);
        insta::assert_snapshot!(text(&output["modules"]["config.ts"]["code"]), @r#"

        import {Native as __zyzzNative,NativeVars as __zyzzNativeVars} from 'zyzz/runtime';


        export const __zyzzProfile1qmhxptznjoqt=__zyzzNativeVars.create(JSON.parse("{\"defaultVars\":\"default\",\"profiles\":{\"default\":{\"dark\":{\"spacing\":{\"gap\":4}},\"light\":{\"spacing\":{\"gap\":4}}}},\"unnamed\":true}"));

        import {Config} from 'zyzz';export const {vars}=Config.create({vars:{spacing:{gap:'4px'}}});
        "#);
        insta::assert_snapshot!(text(&output["modules"]["nested/left.ts"]["code"]), @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';



        import {__zyzzProfile1qmhxptznjoqt} from "../config.js";
        import {useVars} from 'zyzz/react-native/react';import {vars} from '../config.js';export const left=()=>useVars((__zyzzProfile1qmhxptznjoqt as typeof vars)).spacing;
        "#);
        insta::assert_snapshot!(output["modules"]["nested/left.ts"]["edits"].to_string(), @r#"[{"start":112,"end":116,"code":"(__zyzzProfile1qmhxptznjoqt as typeof vars)","expression":true},{"start":0,"end":0,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\nimport {__zyzzProfile1qmhxptznjoqt} from \"../config.js\";\n","expression":false}]"#);
        insta::assert_snapshot!(output["modules"]["nested/left.ts"]["map"]["mappings"].to_string(), @r#"";;;;;;AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,2CAAI,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC""#);
    }

    #[test]
    fn runtime_profiles() {
        let output = compile(&json!({
            "imports": {
                "left.ts": { "#theme": "theme/config.ts", "zyzz/react-native/react": null },
                "theme/config.ts": { "zyzz": null },
            },
            "modules": {
                "left.ts": "import {useVars} from 'zyzz/react-native/react';import {vars} from '#theme';export const left=()=>useVars(vars).spacing;",
                "theme/config.ts": "import {Config} from 'zyzz';export const {vars}=Config.create({vars:{spacing:{gap:'4px'}}});",
            },
            "native": { "colorScheme": "light", "runtime": true },
        }));

        insta::assert_snapshot!(text(&output["modules"]["left.ts"]["code"]), @r##"

        import {Native as __zyzzNative} from 'zyzz/runtime';



        import {__zyzzProfilepgnfv31patdnf} from "#theme";
        import {useVars} from 'zyzz/react-native/react';import {vars} from '#theme';export const left=()=>useVars((__zyzzProfilepgnfv31patdnf)).spacing;
        "##);
    }

    #[test]
    fn sets() {
        let contextual = compile(&json!({
            "modules": { "card.ts": CARD },
            "native": { "colorScheme": "light", "contextual": true, "vars": SETS },
        }));
        let object: Value = serde_json::from_str(SETS).unwrap_or_default();
        let decoded = compile(&json!({
            "modules": { "card.ts": CARD },
            "native": { "colorScheme": "light", "contextual": true, "vars": object },
        }));

        insta::assert_snapshot!(text(&contextual["modules"]["card.ts"]["code"]), @r##"

        import {Native as __zyzzNative,NativeContext as __zyzzNativeContext} from 'zyzz/runtime';

        const __zyzzNativeContextFactory0=<const T0 extends (input:never)=>import('zyzz/runtime').Native.Props<object>,>(__zyzzNativeTable0:T0)=>__zyzzNativeContext.create({"base":{"light":__zyzzNativeTable0,"dark":__zyzzNativeTable0},"roomy":{"light":__zyzzNativeTable0,"dark":__zyzzNativeTable0}},"default");


        import {Config} from 'zyzz';const {style}=Config.create({vars:{color:{ink:'#000000'},spacing:{gap:'2px'}}});export const card=__zyzzNativeContextFactory0((__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"color":"#000000","paddingTop":2}}}) as import('zyzz/runtime').Native.Callable<{}>));
        "##);
        assert_eq!(decoded, contextual);

        let missing = compile(&json!({
            "modules": { "card.ts": CARD },
            "native": { "colorScheme": "light", "set": "missing", "vars": SETS },
        }));

        insta::assert_snapshot!(missing.to_string(), @r#"{"error":{"name":"StyleSheet.SelectionError","message":"Select an existing set label and light or dark colorScheme."}}"#);
    }

    #[test]
    fn web_only_options() {
        insta::assert_snapshot!(
            compile(&json!({ "modules": {}, "native": { "colorScheme": "light" }, "reset": "body{}" })).to_string(),
            @r#"{"error":{"name":"Native.CompileError","message":"The CSS reset is only supported by web builds."}}"#
        );
        insta::assert_snapshot!(
            compile(&json!({ "compiler": false, "modules": {}, "native": { "colorScheme": "light" } })).to_string(),
            @r#"{"error":{"name":"Native.CompileError","message":"Native graph compilation requires source rewriting."}}"#
        );
    }

    #[test]
    fn snapshots() {
        let mut compiler = Compiler::default();
        let modules = json!({
            "a.ts": "import {style} from 'zyzz';export const a=style({opacity:0.5});",
            "b.ts": "import {style} from 'zyzz';export const b=style({fontFamily:'Inter'});",
        });
        let edited = json!({
            "a.ts": modules["a.ts"],
            "b.ts": "import {style} from 'zyzz';export const b=style({opacity:0.25});",
        });
        let native = json!({ "colorScheme": "light", "fonts": { "Inter": "Inter-Regular" } });
        let bold = json!({ "colorScheme": "light", "fonts": { "Inter": "Inter-Bold" } });
        let first = incremental(
            &mut compiler,
            &json!({ "modules": modules, "native": native }),
        );

        insta::assert_snapshot!(text(&first["modules"]["b.ts"]["code"]), @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';




        import {style} from 'zyzz';export const b=(__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"fontFamily":"Inter-Regular"}}}) as import('zyzz/runtime').Native.Callable<{}>);
        "#);
        insta::assert_snapshot!(
            incremental(&mut compiler, &json!({ "modules": modules, "native": native })).to_string(),
            @r#"{"same":true}"#
        );

        let edit = incremental(
            &mut compiler,
            &json!({ "modules": edited, "native": native }),
        );

        insta::assert_snapshot!(edit["modules"]["a.ts"].to_string(), @"0");
        insta::assert_snapshot!(text(&edit["modules"]["b.ts"]["code"]), @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';




        import {style} from 'zyzz';export const b=(__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.25}}}) as import('zyzz/runtime').Native.Callable<{}>);
        "#);

        // Other fonts invalidate every module.
        let fonts = incremental(
            &mut compiler,
            &json!({ "modules": modules, "native": bold }),
        );

        insta::assert_snapshot!(text(&fonts["modules"]["a.ts"]["code"]), @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';




        import {style} from 'zyzz';export const a=(__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}}) as import('zyzz/runtime').Native.Callable<{}>);
        "#);
        insta::assert_snapshot!(text(&fonts["modules"]["b.ts"]["code"]), @r#"

        import {Native as __zyzzNative} from 'zyzz/runtime';




        import {style} from 'zyzz';export const b=(__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"fontFamily":"Inter-Bold"}}}) as import('zyzz/runtime').Native.Callable<{}>);
        "#);

        // Unchanged set text keeps the decoded sets, which the graph compares by identity.
        let sets = json!({ "colorScheme": "light", "set": "roomy", "vars": SETS });
        let first = incremental(&mut compiler, &json!({ "modules": edited, "native": sets }));

        assert!(first["modules"]["b.ts"]["code"].is_string());
        insta::assert_snapshot!(
            incremental(&mut compiler, &json!({ "modules": edited, "native": sets })).to_string(),
            @r#"{"same":true}"#
        );
    }
}

/// Single-module native compilation, whose expected values come from `Native.compile`.
mod native_compile {
    use serde_json::{Value, json};

    use super::api;

    fn compile(input: &Value) -> Value {
        serde_json::from_str(&api::call("native.compile", &input.to_string())).unwrap_or_default()
    }

    #[test]
    fn utf16_offsets() {
        let output = compile(&json!({
            "colorScheme": "light",
            "context": true,
            "contextual": false,
            "moduleId": "babel/Fixture.ts",
            "platform": "ios",
            "runtime": true,
            "source": "#!/usr/bin/env node\n'use client';\n/* 😀 */\nimport { style } from 'zyzz'\nexport const box = style({\n  width: '10px',\n})\nexport const marker = 'original-location'",
            "units": { "px": 1 },
        }));

        insta::assert_snapshot!(output["code"].as_str().unwrap_or_default(), @r#"
        #!/usr/bin/env node
        'use client';
        import {Native as __zyzzNative} from 'zyzz/runtime';





        /* 😀 */
        import { style } from 'zyzz'
        export const box = __zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"width":10}}})
        export const marker = 'original-location'
        "#);
        insta::assert_snapshot!(output["edits"].to_string(), @r#"[{"start":91,"end":118,"code":"__zyzzNative.create({\"axes\":{},\"defaults\":{},\"styles\":{\"0\":{\"width\":10}}})","expression":true},{"start":33,"end":33,"code":"\nimport {Native as __zyzzNative} from 'zyzz/runtime';\n\n\n\n\n","expression":false}]"#);
        insta::assert_snapshot!(output["map"].as_str().unwrap_or_default(), @r##"{"version":3,"sources":["babel/Fixture.ts"],"sourcesContent":["#!/usr/bin/env node\n'use client';\n/* 😀 */\nimport { style } from 'zyzz'\nexport const box = style({\n  width: '10px',\n})\nexport const marker = 'original-location'"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;AAClB,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;;;;;;;AACZ,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;AACP,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;AAC3B,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;AAGnB,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}"##);
        insta::assert_snapshot!(output["recipes"].to_string(), @r#"{"style-d5ec5oapytnk-91":{"axes":{},"defaults":{},"styles":{"default":{"light":{"0":{"width":10}},"dark":{"0":{"width":10}}}}}}"#);
    }

    #[test]
    fn variants() {
        let output = compile(&json!({
            "colorScheme": "light",
            "moduleId": "button.ts",
            "source": "import {variants} from 'zyzz';export const button=variants({base:{opacity:1},variants:{tone:{quiet:{opacity:0.5}}}});",
        }));

        insta::assert_snapshot!(output["code"].as_str().unwrap_or_default(), @r#"

        import {Native as __zyzzNative,NativeStatic as __zyzzNativeStatic} from 'zyzz/runtime';




        import {variants} from 'zyzz';export const button=(__zyzzNativeStatic.create({"axes":{"tone":["quiet"]},"defaults":{},"rules":[{"matches":[],"steps":["0"]},{"matches":[["tone",["quiet"]]],"steps":["1"]}],"styles":{"0":{"opacity":1},"1":{"opacity":0.5}}}) as import('zyzz/runtime').Native.Callable<{"tone":readonly ["quiet"]}>);
        "#);
        insta::assert_snapshot!(output["recipes"].to_string(), @"{}");
    }

    #[test]
    fn unsupported_selectors() {
        insta::assert_snapshot!(
            api::call(
                "native.compile",
                &json!({
                    "colorScheme": "light",
                    "moduleId": "app.ts",
                    "source": "import {style} from 'zyzz';export const card=style({selectors:{'&:hover':{opacity:1}}});",
                })
                .to_string()
            ),
            @r#"{"error":{"name":"StyleSheet.CompileError","diagnostics":[{"code":"unsupported_feature","message":"Selectors, queries, and nested rules are not supported on native.","path":["style-1e8a67z1uaws1j-45"]}],"message":"[\"style-1e8a67z1uaws1j-45\"]: Selectors, queries, and nested rules are not supported on native."}}"#
        );
    }
}
