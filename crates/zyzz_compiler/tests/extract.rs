//! Verifies `Source.extract` end to end through the `source.extract` operation and the graph API,
//! from module text to the encoded calls, styles, themes, contributions, and diagnostics.
//! Expected values are the TypeScript compiler's results on the same sources, encoded by the
//! differential oracle in the same format.

use oxc_allocator::Allocator;
use serde_json::{Value, json};
use zyzz_compiler::api;
use zyzz_compiler::compiler::internal::themes::{Context, Link};
use zyzz_compiler::compiler::internal::wire::{Contracts, Encoder};
use zyzz_compiler::compiler::source::{self, Options, Target};
use zyzz_compiler::js::{Record, Utf16Index};

/// Prints JSON, keeping each value that fits within 96 columns on one line.
fn pretty(value: &Value, depth: usize, column: usize, output: &mut String) {
    let compact = value.to_string();

    if column + compact.len() <= 96 {
        output.push_str(&compact);
        return;
    }

    let pad = "  ".repeat(depth + 1);

    match value {
        Value::Array(items) => {
            output.push_str("[\n");

            for (index, item) in items.iter().enumerate() {
                output.push_str(&pad);
                pretty(item, depth + 1, pad.len(), output);
                output.push_str(if index + 1 < items.len() { ",\n" } else { "\n" });
            }

            output.push_str(&"  ".repeat(depth));
            output.push(']');
        }
        Value::Object(entries) => {
            output.push_str("{\n");

            for (index, (key, item)) in entries.iter().enumerate() {
                let key = Value::String(key.clone()).to_string();

                output.push_str(&pad);
                output.push_str(&key);
                output.push_str(": ");
                pretty(item, depth + 1, pad.len() + key.len() + 2, output);
                output.push_str(if index + 1 < entries.len() {
                    ",\n"
                } else {
                    "\n"
                });
            }

            output.push_str(&"  ".repeat(depth));
            output.push('}');
        }
        _ => output.push_str(&compact),
    }
}

fn print(value: &Value) -> String {
    let mut output = String::new();

    pretty(value, 0, 0, &mut output);
    output
}

/// Runs `source.extract` and prints the result.
fn extract(module_id: &str, source: &str, options: &Value) -> String {
    let mut input = json!({ "moduleId": module_id, "source": source });

    if let (Some(input), Some(options)) = (input.as_object_mut(), options.as_object()) {
        input.extend(options.clone());
    }

    let output: Value =
        serde_json::from_str(&api::call("source.extract", &input.to_string())).unwrap_or_default();

    print(&output)
}

/// Extracts one module of a graph with links to the exports of earlier modules.
fn linked(
    module_id: &str,
    source: &str,
    links: &Record<Link>,
    contracts: &mut Contracts,
) -> (Value, Record<Link>) {
    let allocator = Allocator::default();
    let text: &str = allocator.alloc_str(source);
    let context = Context {
        links: links.clone(),
        ..Context::default()
    };
    let options = Options {
        compiler: None,
        context: Some(&context),
        module_id,
        parsed: None,
        source: text,
        target: Target::Web,
    };

    match source::extract(&allocator, &options) {
        Ok(extracted) => {
            let offsets = Utf16Index::new(text);
            let result = Encoder::new(contracts, &offsets).extracted(&extracted);

            (result, extracted.theme_exports.unwrap_or_default())
        }
        Err(error) => (json!({ "error": error.text() }), Record::new()),
    }
}

mod extract {
    use super::*;

    #[test]
    fn styles_and_recipes() {
        let output = extract(
            "src/card.tsx",
            "import { style, variants } from 'zyzz'

export namespace styles {
  export const card = style({ color: 'red', selectors: { '&:hover': { color: 'blue' } } })

  export const button = variants({
    base: { padding: 4 },
    variants: { size: { small: { padding: 2 } } },
    defaultVariants: { size: 'small' },
  })
}
",
            &json!({}),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "contracts": [],
          "result": {
            "namespaces": [],
            "calls": [
              {
                "cssName": "7Zcbld-styles-card",
                "cssNamespace": null,
                "identity": "z-style-7Zcbld-styles-card",
                "end": 156,
                "name": "style-aohfip19p1g4b-88",
                "start": 88
              },
              {
                "cssName": "7Zcbld-styles-button",
                "cssNamespace": null,
                "recipe": {"axes":[["size",["small"]]],"defaults":[["size","small"]]},
                "staticRecipe": {
                  "axes": [["size",["small"]]],
                  "defaults": [["size","small"]],
                  "rules": [
                    {
                      "matches": [],
                      "value": {
                        "styles": [
                          {"name":"style-aohfip19p1g4b-182-0","declarations":[["padding",4,false]]}
                        ]
                      }
                    },
                    {
                      "matches": [["size",["small"]]],
                      "value": {
                        "styles": [
                          {"name":"style-aohfip19p1g4b-182-1","declarations":[["padding",2,false]]}
                        ]
                      }
                    }
                  ]
                },
                "recipeTypes": [],
                "identity": "z-style-7Zcbld-styles-button",
                "end": 314,
                "name": "style-aohfip19p1g4b-182",
                "start": 182
              }
            ],
            "styles": {
              "styles": [
                {
                  "name": "style-aohfip19p1g4b-88",
                  "declarations": [],
                  "rules": [
                    [null,{"name":"style-aohfip19p1g4b-88","declarations":[["color","red",false]]}],
                    [
                      "&:hover",
                      {"name":"style-aohfip19p1g4b-88","declarations":[["color","blue",false]]}
                    ]
                  ]
                },
                {
                  "name": "style-aohfip19p1g4b-182",
                  "declarations": [],
                  "rules": [
                    [null,{"name":"style-aohfip19p1g4b-182","declarations":[["padding",4,false]]}],
                    [
                      "&:where([data-size=\"small\"])",
                      {"name":"style-aohfip19p1g4b-182","declarations":[["padding",2,false]]}
                    ]
                  ]
                }
              ],
              "labels": [
                ["style-aohfip19p1g4b-88","7Zcbld-styles-card",null],
                ["style-aohfip19p1g4b-182","7Zcbld-styles-button",null]
              ]
            },
            "themeAliases": [],
            "themeCalls": [],
            "themeReferences": [],
            "vars": [],
            "collectedThemes": false
          }
        }
        "#);
    }

    #[test]
    fn diagnostics_in_source_order() {
        let output = extract(
            "src/héllo.ts",
            "import { style } from 'zyzz'
// ünïcode before the failures
export const a = style({ color: 1 + 2, width: [ , '1px'] })
export const b = style({ [key]: 'red' })
",
            &json!({}),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "error": {
            "name": "Source.ExtractError",
            "message": "src/héllo.ts:92: Expected a literal string or number; expressions are not evaluated.\nsrc/héllo.ts:106: Fallback arrays require dense literal entries without spreads.\nsrc/héllo.ts:145: Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.",
            "diagnostics": [
              {
                "code": "unsupported_syntax",
                "end": 97,
                "message": "Expected a literal string or number; expressions are not evaluated.",
                "source": "src/héllo.ts",
                "start": 92
              },
              {
                "code": "unsupported_syntax",
                "end": 116,
                "message": "Fallback arrays require dense literal entries without spreads.",
                "source": "src/héllo.ts",
                "start": 106
              },
              {
                "code": "unsupported_syntax",
                "end": 157,
                "message": "Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.",
                "source": "src/héllo.ts",
                "start": 145
              }
            ]
          }
        }
        "#);
    }

    #[test]
    fn stylesheet_contributions() {
        let output = extract(
            "src/sheet.ts",
            "import { style, variable } from 'zyzz'
import { fontFace, keyframes, layers, namespace } from 'zyzz/web'

layers(['reset', 'base'])
namespace({ uri: 'http://www.w3.org/2000/svg', prefix: 'svg' })
fontFace({ '@layer base': { fontFamily: 'Inter', src: 'url(https://x/inter.woff2)', fontWeight: 400 } })

const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const gap = variable('length', { inherits: false, initialValue: '0px' })

export const card = style({ animationName: fade, gap })
",
            &json!({}),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "contracts": [],
          "result": {
            "namespaces": [
              {
                "kind": "namespace",
                "uri": "http://www.w3.org/2000/svg",
                "prefix": "svg",
                "name": "z-n19frzcc1owwamk-3o"
              }
            ],
            "contributions": [
              {
                "kind": "property",
                "name": "--z-gap",
                "syntax": "<length>",
                "inherits": false,
                "initialValue": "0px"
              },
              {"kind":"layers","names":["reset","base"]},
              {
                "kind": "namespace",
                "uri": "http://www.w3.org/2000/svg",
                "prefix": "svg",
                "name": "z-n19frzcc1owwamk-3o"
              },
              {
                "kind": "font-face",
                "declarations": [
                  ["fontFamily","Inter"],
                  ["src","url(https://x/inter.woff2)"],
                  ["fontWeight",400]
                ],
                "within": ["@layer base"]
              },
              {
                "kind": "keyframes",
                "name": "z-k-fade",
                "frames": [
                  {"stop":"from","style":{"name":"contribution","declarations":[["opacity",0,false]]}},
                  {"stop":"to","style":{"name":"contribution","declarations":[["opacity",1,false]]}}
                ]
              }
            ],
            "contributionStarts": [383,106,132,196,315],
            "contributionCalls": [
              {"start":106,"end":131,"kind":"layers"},
              {"start":132,"end":195,"kind":"namespace"},
              {"start":196,"end":300,"kind":"fontFace"},
              {
                "start": 315,
                "end": 370,
                "kind": "keyframes",
                "name": "z-k-fade",
                "binding": 308,
                "exported": false
              }
            ],
            "calls": [
              {
                "cssName": "POmH9e-card",
                "cssNamespace": null,
                "identity": "z-style-POmH9e-card",
                "end": 500,
                "name": "style-19frzcc1owwamk-465",
                "start": 465
              }
            ],
            "styles": {
              "styles": [
                {
                  "name": "style-19frzcc1owwamk-465",
                  "declarations": [
                    ["animationName","z-k-fade",false],
                    [
                      "--z-gap",
                      {"binding":{"dynamic":false,"name":"--z-gap","type":"length","zero":false}},
                      false
                    ]
                  ]
                }
              ],
              "labels": [["style-19frzcc1owwamk-465","POmH9e-card",null]]
            },
            "variableCalls": [
              {
                "end": 443,
                "explicit": false,
                "slots": [["value",{"dynamic":false,"name":"--z-gap","type":"length","zero":false}]],
                "start": 383
              }
            ],
            "themeAliases": [],
            "themeCalls": [],
            "themeReferences": [],
            "vars": [],
            "collectedThemes": false
          }
        }
        "#);
    }

    #[test]
    fn compositions() {
        let output = extract(
            "src/compose.tsx",
            "import { cx, style } from 'zyzz'

export function Card() {
  return <div {...cx(styles.base(), styles.tone())} />
}

namespace styles {
  export const base = style({ color: 'red' })

  export const tone = style({ color: 'blue', padding: 1 })

  export const merged = style([base, { margin: 2 }])
}
",
            &json!({}),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "contracts": [],
          "result": {
            "namespaces": [],
            "calls": [
              {
                "cssName": "Card-0-IqYpBh-styles-base-IqYpBh-styles-tone",
                "composition": ["styles.base","styles.tone"],
                "typography": [],
                "typographyQueries": [],
                "end": 109,
                "name": "composition-1bsvjez17nl8f7-77",
                "start": 77
              },
              {
                "cssName": "IqYpBh-styles-base",
                "cssNamespace": null,
                "end": 181,
                "name": "style-1bsvjez17nl8f7-158",
                "start": 158
              },
              {
                "cssName": "IqYpBh-styles-tone",
                "cssNamespace": null,
                "end": 241,
                "name": "style-1bsvjez17nl8f7-205",
                "start": 205
              },
              {
                "cssName": "IqYpBh-styles-merged",
                "cssNamespace": null,
                "end": 295,
                "name": "style-1bsvjez17nl8f7-267",
                "start": 267
              }
            ],
            "styles": {
              "styles": [
                {"name":"style-1bsvjez17nl8f7-158","declarations":[["color","red",false]]},
                {
                  "name": "style-1bsvjez17nl8f7-205",
                  "declarations": [["color","blue",false],["padding",1,false]]
                },
                {
                  "name": "style-1bsvjez17nl8f7-267",
                  "declarations": [],
                  "rules": [
                    [null,{"name":"style-1bsvjez17nl8f7-158","declarations":[["color","red",false]]}],
                    [null,{"name":"style-1bsvjez17nl8f7-267","declarations":[["margin",2,false]]}]
                  ]
                },
                {
                  "name": "composition-1bsvjez17nl8f7-77",
                  "declarations": [],
                  "rules": [
                    [null,{"name":"style-1bsvjez17nl8f7-158","declarations":[["color","red",false]]}],
                    [
                      null,
                      {
                        "name": "style-1bsvjez17nl8f7-205",
                        "declarations": [["color","blue",false],["padding",1,false]]
                      }
                    ]
                  ],
                  "cssOutput": "atomic"
                }
              ],
              "labels": [
                ["style-1bsvjez17nl8f7-158","IqYpBh-styles-base",null],
                ["style-1bsvjez17nl8f7-205","IqYpBh-styles-tone",null],
                ["style-1bsvjez17nl8f7-267","IqYpBh-styles-merged",null],
                ["composition-1bsvjez17nl8f7-77","Card-0-IqYpBh-styles-base-IqYpBh-styles-tone",null]
              ]
            },
            "themeAliases": [],
            "themeCalls": [],
            "themeReferences": [],
            "vars": [],
            "collectedThemes": false
          }
        }
        "#);
    }

    #[test]
    fn native_contexts() {
        let output = extract(
            "src/native.tsx",
            "import { defineConfig } from 'zyzz'

const { style, vars } = defineConfig({
  vars: { light: { color: { text: 'black' } }, dark: { color: { text: 'white' } } },
  defaultVars: 'light',
})

export const text = style({ color: vars.color.text })
",
            &json!({ "target": "native" }),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "contracts": [
            {
              "complete": false,
              "identity": "src-native-2rTliMKwCGU-style",
              "keys": ["variableSet","mappings","cssOutput"],
              "variableSet": true,
              "cssOutput": "atomic"
            }
          ],
          "result": {
            "namespaces": [],
            "calls": [
              {
                "nativeContext": {
                  "defaultVars": "light",
                  "vars": [
                    [
                      "light",
                      {
                        "className": {
                          "error": "Config.create requires an explicit id without the compiler plugin."
                        },
                        "contract": 0,
                        "cssName": "light",
                        "paths": null,
                        "queries": null,
                        "tokens": {
                          "obj": [
                            [
                              "color",
                              {
                                "obj": [
                                  [
                                    "text",
                                    {"ref":{"c":0,"g":"color","p":"color.text","v":"black","w":false}}
                                  ]
                                ]
                              }
                            ]
                          ]
                        },
                        "values": [["color.text","black"]],
                        "vars": {
                          "obj": [
                            [
                              "color",
                              {
                                "obj": [
                                  [
                                    "text",
                                    {"ref":{"c":0,"g":"color","p":"color.text","v":"black","w":true}}
                                  ]
                                ]
                              }
                            ]
                          ]
                        }
                      }
                    ],
                    [
                      "dark",
                      {
                        "className": {
                          "error": "Config.create requires an explicit id without the compiler plugin."
                        },
                        "contract": 0,
                        "cssName": "dark",
                        "paths": null,
                        "queries": null,
                        "tokens": {
                          "obj": [
                            [
                              "color",
                              {
                                "obj": [
                                  [
                                    "text",
                                    {"ref":{"c":0,"g":"color","p":"color.text","v":"white","w":false}}
                                  ]
                                ]
                              }
                            ]
                          ]
                        },
                        "values": [["color.text","white"]],
                        "vars": {
                          "obj": [
                            [
                              "color",
                              {
                                "obj": [
                                  [
                                    "text",
                                    {"ref":{"c":0,"g":"color","p":"color.text","v":"white","w":true}}
                                  ]
                                ]
                              }
                            ]
                          ]
                        }
                      }
                    ]
                  ]
                },
                "cssName": "MKwCGU-text",
                "cssNamespace": null,
                "identity": "z-style-MKwCGU-text",
                "end": 242,
                "name": "style-at7zn01485b3q-209",
                "start": 209
              }
            ],
            "styles": {
              "styles": [
                {
                  "name": "style-at7zn01485b3q-209",
                  "declarations": [
                    ["color",{"ref":{"c":0,"g":"color","p":"color.text","v":"black","w":false}},false]
                  ],
                  "cssOutput": "atomic"
                }
              ],
              "labels": [["style-at7zn01485b3q-209","MKwCGU-text",null]]
            },
            "themeAliases": [],
            "themeCalls": [
              {
                "appearance": true,
                "catalogOnly": false,
                "directVariables": false,
                "end": 187,
                "function": null,
                "initialization": false,
                "members": [
                  ["[\"themes\",\"light\"]","src-native-2rTliMKwCGU-style-light"],
                  ["[\"themes\",\"dark\"]","src-native-2rTliMKwCGU-style-dark"],
                  ["[\"theme\"]","src-native-2rTliMKwCGU-style-light"],
                  ["[\"vars\"]","src-native-2rTliMKwCGU-style-light"]
                ],
                "name": "src-native-2rTliMKwCGU-style-light",
                "nativeProvider": false,
                "options": {
                  "obj": [
                    ["defaultTheme","light"],
                    [
                      "themes",
                      {
                        "obj": [
                          ["light",{"obj":[["color",{"obj":[["text","black"]]}]]}],
                          ["dark",{"obj":[["color",{"obj":[["text","white"]]}]]}]
                        ]
                      }
                    ]
                  ]
                },
                "output": null,
                "recipe": false,
                "reference": null,
                "root": false,
                "script": true,
                "selection": false,
                "start": 61,
                "tokenType": "{readonly \"color\":{readonly \"text\":\"black\"}}",
                "type": "import('zyzz').Config.VariableConfig<{readonly \"vars\":{readonly \"light\":{readonly \"color\":{readonly \"text\":\"black\"}};readonly \"dark\":{readonly \"color\":{readonly \"text\":\"white\"}}};readonly \"defaultVars\":\"light\"}>",
                "variableConfig": true,
                "variableMappings": null,
                "variableOwner": null,
                "variableSet": false,
                "variables": null
              }
            ],
            "themeReferences": [],
            "vars": [
              [
                "src-native-2rTliMKwCGU-style-light",
                {
                  "className": {
                    "error": "Config.create requires an explicit id without the compiler plugin."
                  },
                  "contract": 0,
                  "cssName": "light",
                  "paths": null,
                  "queries": null,
                  "tokens": {
                    "obj": [
                      [
                        "color",
                        {
                          "obj": [
                            ["text",{"ref":{"c":0,"g":"color","p":"color.text","v":"black","w":false}}]
                          ]
                        }
                      ]
                    ]
                  },
                  "values": [["color.text","black"]],
                  "vars": {
                    "obj": [
                      [
                        "color",
                        {
                          "obj": [
                            ["text",{"ref":{"c":0,"g":"color","p":"color.text","v":"black","w":true}}]
                          ]
                        }
                      ]
                    ]
                  }
                }
              ],
              [
                "src-native-2rTliMKwCGU-style-dark",
                {
                  "className": {
                    "error": "Config.create requires an explicit id without the compiler plugin."
                  },
                  "contract": 0,
                  "cssName": "dark",
                  "paths": null,
                  "queries": null,
                  "tokens": {
                    "obj": [
                      [
                        "color",
                        {
                          "obj": [
                            ["text",{"ref":{"c":0,"g":"color","p":"color.text","v":"white","w":false}}]
                          ]
                        }
                      ]
                    ]
                  },
                  "values": [["color.text","white"]],
                  "vars": {
                    "obj": [
                      [
                        "color",
                        {
                          "obj": [
                            ["text",{"ref":{"c":0,"g":"color","p":"color.text","v":"white","w":true}}]
                          ]
                        }
                      ]
                    ]
                  }
                }
              ]
            ],
            "collectedThemes": true
          }
        }
        "#);
    }

    #[test]
    fn portable_identities() {
        let output = extract(
            "src/portable.ts",
            "import { style } from 'zyzz'

export const card = style({ color: 'red' })
export const named = style({ color: 'blue' }, { id: 'named' })
export const empty = style({})
",
            &json!({ "compiler": false }),
        );

        insta::assert_snapshot!(output, @r#"
        {
          "contracts": [],
          "result": {
            "namespaces": [],
            "calls": [
              {
                "portable": "z-content-_5b__5b__22_color_22__2c__22_red_22__2c_false_5d__5d_",
                "cssName": "MHp5yO-card",
                "cssNamespace": null,
                "identity": "z-style-MHp5yO-card",
                "end": 73,
                "name": "style-725sqk1ijmgmw-50",
                "start": 50
              },
              {
                "portable": "z-style-id-named",
                "cssName": "named",
                "cssNamespace": null,
                "identity": "z-style-id-named",
                "end": 136,
                "name": "style-725sqk1ijmgmw-95",
                "start": 95
              },
              {
                "cssName": "MHp5yO-empty",
                "cssNamespace": null,
                "identity": "z-style-MHp5yO-empty",
                "end": 167,
                "name": "style-725sqk1ijmgmw-158",
                "start": 158
              }
            ],
            "styles": {
              "styles": [
                {"name":"style-725sqk1ijmgmw-50","declarations":[["color","red",false]]},
                {"name":"style-725sqk1ijmgmw-95","declarations":[["color","blue",false]]},
                {"name":"style-725sqk1ijmgmw-158","declarations":[]}
              ],
              "labels": [
                ["style-725sqk1ijmgmw-50","MHp5yO-card",null],
                ["style-725sqk1ijmgmw-95","named",null],
                ["style-725sqk1ijmgmw-158","MHp5yO-empty",null]
              ]
            },
            "themeAliases": [],
            "themeCalls": [],
            "themeReferences": [],
            "vars": [],
            "collectedThemes": false
          }
        }
        "#);
    }

    #[test]
    fn linked_style_references() {
        let mut contracts = Contracts::default();
        let (first, exports) = linked(
            "src/a.ts",
            "import { style } from 'zyzz'
import { keyframes } from 'zyzz/web'

export const card = style({ color: 'red' })
export const fade = keyframes({ from: { opacity: 0 } })
",
            &Record::new(),
            &mut contracts,
        );
        let mut links = Record::new();

        for name in ["card", "fade"] {
            if let Some(link) = exports.get(name) {
                links.insert(name, link.clone());
            }
        }

        let (second, _) = linked(
            "src/b.ts",
            "import { style } from 'zyzz'
import { card, fade } from './a.ts'

export const panel = style({ animationName: fade, selectors: { [`${card} &`]: { color: 'blue' } } })
",
            &links,
            &mut contracts,
        );
        let output = json!({ "contracts": contracts.table(), "modules": [first, second] });

        insta::assert_snapshot!(print(&output), @r#"
        {
          "contracts": [
            {"complete":false,"identity":null,"keys":[],"variableSet":false},
            {"complete":false,"identity":null,"keys":[],"variableSet":false},
            {"complete":false,"identity":null,"keys":[],"variableSet":false}
          ],
          "modules": [
            {
              "namespaces": [],
              "contributions": [
                {
                  "kind": "keyframes",
                  "name": "z-k-fade",
                  "frames": [
                    {"stop":"from","style":{"name":"contribution","declarations":[["opacity",0,false]]}}
                  ]
                }
              ],
              "contributionStarts": [131],
              "contributionCalls": [
                {
                  "start": 131,
                  "end": 166,
                  "kind": "keyframes",
                  "name": "z-k-fade",
                  "binding": 124,
                  "exported": true
                }
              ],
              "themeExports": [
                [
                  "card",
                  {
                    "binding": "z-style-1dmAZw-card",
                    "call": {
                      "appearance": false,
                      "catalogOnly": false,
                      "directVariables": false,
                      "end": 110,
                      "function": null,
                      "initialization": false,
                      "members": null,
                      "name": "z-style-1dmAZw-card",
                      "nativeProvider": false,
                      "options": null,
                      "output": null,
                      "recipe": false,
                      "reference": null,
                      "root": false,
                      "script": false,
                      "selection": false,
                      "start": 87,
                      "tokenType": "{}",
                      "type": null,
                      "variableConfig": false,
                      "variableMappings": null,
                      "variableOwner": null,
                      "variableSet": false,
                      "variables": null
                    },
                    "definition": {
                      "className": {
                        "error": "style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source."
                      },
                      "contract": 0,
                      "cssName": null,
                      "paths": null,
                      "queries": null,
                      "tokens": {"obj":[]},
                      "values": [],
                      "vars": {"obj":[]}
                    },
                    "kind": "style-reference",
                    "members": null,
                    "style": {
                      "attributes": [],
                      "slots": [],
                      "staticRecipe": {
                        "axes": [],
                        "defaults": [],
                        "rules": [
                          {
                            "matches": [],
                            "value": {
                              "styles": [
                                {"name":"style-hhtd0018jbf1a-87","declarations":[["color","red",false]]}
                              ]
                            }
                          }
                        ]
                      },
                      "style": {"name":"style-hhtd0018jbf1a-87","declarations":[["color","red",false]]}
                    }
                  }
                ],
                [
                  "fade",
                  {
                    "binding": "z-k-fade",
                    "call": {
                      "appearance": false,
                      "catalogOnly": false,
                      "directVariables": false,
                      "end": 166,
                      "function": null,
                      "initialization": false,
                      "members": null,
                      "name": "z-k-fade",
                      "nativeProvider": false,
                      "options": null,
                      "output": null,
                      "recipe": false,
                      "reference": null,
                      "root": false,
                      "script": false,
                      "selection": false,
                      "start": 131,
                      "tokenType": "{}",
                      "type": null,
                      "variableConfig": false,
                      "variableMappings": null,
                      "variableOwner": null,
                      "variableSet": false,
                      "variables": null
                    },
                    "definition": {
                      "className": {
                        "error": "style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source."
                      },
                      "contract": 1,
                      "cssName": null,
                      "paths": null,
                      "queries": null,
                      "tokens": {"obj":[]},
                      "values": [],
                      "vars": {"obj":[]}
                    },
                    "kind": "animation",
                    "members": null
                  }
                ]
              ],
              "calls": [
                {
                  "cssName": "1dmAZw-card",
                  "cssNamespace": null,
                  "identity": "z-style-1dmAZw-card",
                  "end": 110,
                  "name": "style-hhtd0018jbf1a-87",
                  "start": 87
                }
              ],
              "styles": {
                "styles": [{"name":"style-hhtd0018jbf1a-87","declarations":[["color","red",false]]}],
                "labels": [["style-hhtd0018jbf1a-87","1dmAZw-card",null]]
              },
              "themeAliases": [],
              "themeCalls": [],
              "themeReferences": [],
              "vars": [],
              "collectedThemes": false
            },
            {
              "namespaces": [],
              "themeExports": [
                [
                  "panel",
                  {
                    "binding": "z-style-JdmrF3-panel",
                    "call": {
                      "appearance": false,
                      "catalogOnly": false,
                      "directVariables": false,
                      "end": 166,
                      "function": null,
                      "initialization": false,
                      "members": null,
                      "name": "z-style-JdmrF3-panel",
                      "nativeProvider": false,
                      "options": null,
                      "output": null,
                      "recipe": false,
                      "reference": null,
                      "root": false,
                      "script": false,
                      "selection": false,
                      "start": 87,
                      "tokenType": "{}",
                      "type": null,
                      "variableConfig": false,
                      "variableMappings": null,
                      "variableOwner": null,
                      "variableSet": false,
                      "variables": null
                    },
                    "definition": {
                      "className": {
                        "error": "style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source."
                      },
                      "contract": 2,
                      "cssName": null,
                      "paths": null,
                      "queries": null,
                      "tokens": {"obj":[]},
                      "values": [],
                      "vars": {"obj":[]}
                    },
                    "kind": "style-reference",
                    "members": null,
                    "style": {
                      "attributes": [],
                      "slots": [],
                      "staticRecipe": {
                        "axes": [],
                        "defaults": [],
                        "rules": [
                          {
                            "matches": [],
                            "value": {
                              "styles": [
                                {
                                  "name": "style-1ueoqjf18jbcq5-87",
                                  "declarations": [],
                                  "rules": [
                                    [
                                      null,
                                      {
                                        "name": "style-1ueoqjf18jbcq5-87",
                                        "declarations": [["animationName","z-k-fade",false]]
                                      }
                                    ],
                                    [
                                      ".z-style-1dmAZw-card &",
                                      {
                                        "name": "style-1ueoqjf18jbcq5-87",
                                        "declarations": [["color","blue",false]]
                                      }
                                    ]
                                  ]
                                }
                              ]
                            }
                          }
                        ]
                      },
                      "style": {
                        "name": "style-1ueoqjf18jbcq5-87",
                        "declarations": [],
                        "rules": [
                          [
                            null,
                            {
                              "name": "style-1ueoqjf18jbcq5-87",
                              "declarations": [["animationName","z-k-fade",false]]
                            }
                          ],
                          [
                            ".z-style-1dmAZw-card &",
                            {"name":"style-1ueoqjf18jbcq5-87","declarations":[["color","blue",false]]}
                          ]
                        ]
                      }
                    }
                  }
                ]
              ],
              "calls": [
                {
                  "cssName": "JdmrF3-panel",
                  "cssNamespace": null,
                  "identity": "z-style-JdmrF3-panel",
                  "end": 166,
                  "name": "style-1ueoqjf18jbcq5-87",
                  "start": 87
                }
              ],
              "styles": {
                "styles": [
                  {
                    "name": "style-1ueoqjf18jbcq5-87",
                    "declarations": [],
                    "rules": [
                      [
                        null,
                        {
                          "name": "style-1ueoqjf18jbcq5-87",
                          "declarations": [["animationName","z-k-fade",false]]
                        }
                      ],
                      [
                        ".z-style-1dmAZw-card &",
                        {"name":"style-1ueoqjf18jbcq5-87","declarations":[["color","blue",false]]}
                      ]
                    ]
                  }
                ],
                "labels": [["style-1ueoqjf18jbcq5-87","JdmrF3-panel",null]]
              },
              "themeAliases": [],
              "themeCalls": [],
              "themeReferences": [],
              "vars": [],
              "collectedThemes": true
            }
          ]
        }
        "#);
    }
}
