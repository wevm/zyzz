/** Verifies declaration source ownership and UTF-8/legacy output through public compilers. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const source = `import {counterStyle,fontFace,page,viewTransition,customMedia,cssFunction,namespace,importCss,global} from 'zyzz/web';
export const dots=counterStyle({system:'cyclic',symbols:'"●"'});
fontFace({fontFamily:'Evidence',src:'url(/evidence.ttf)'});
page({descriptors:{size:'A4','@top-center':{content:'"Page"'}}});
viewTransition({navigation:'auto'});
export const compact=customMedia('(width < 40rem)');
export const twice=cssFunction({parameters:[{name:'--x',syntax:'<length>'}],returns:'<length>',body:{result:'calc(var(--x) * 2)'}});
namespace({prefix:'s',uri:'urn:svg'});
importCss({url:'https://example.com/base.css'});
global({'s|item':{color:'red'}});`

describe('compile', () => {
  test('counts contribution CSS separately from theme output', () => {
    const output = Transform.compile({
      moduleId: 'theme.ts',
      source: `import {Config} from 'zyzz';import {counterStyle,fontFace} from 'zyzz/web';
const config=Config.create({theme:{color:{brand:'red'}}});
export const dots=counterStyle({symbols:'"x"'});
fontFace({fontFamily:'Evidence',src:'url(/font.ttf)'});
export namespace styles {
  export const text = config.css({color:'brand'})
}`,
    })
    const trace = new Trace.TraceMap(output.cssMap)
    const line =
      output.css
        .split('\n')
        .findIndex((line) => line.startsWith('@font-face')) + 1
    expect(Trace.originalPositionFor(trace, { line, column: 0 }))
      .toMatchInlineSnapshot(`
      {
        "column": 0,
        "line": 4,
        "name": null,
        "source": "theme.ts",
      }
    `)
  })
  test('maps hoisted declarations back to their source calls in direct and packed output', () => {
    const direct = Transform.compile({ moduleId: 'rules.ts', source })
    const library = Graph.compile({ modules: { 'rules.ts': source } })
    const packed = Graph.compile({
      contracts: { 'lib/rules.js': library.contracts['rules.ts']! },
      imports: { 'app.ts': { lib: 'lib/rules.js' } },
      modules: { 'app.ts': `import 'lib'` },
    })
    const origins = (css: string, map: typeof direct.cssMap) => {
      const trace = new Trace.TraceMap(map)
      return css.split('\n').flatMap((line, index) =>
        /^@(?:import|namespace|counter-style|font-face|page|view-transition|custom-media|function)\b/.test(
          line,
        )
          ? [
              {
                rule: line.split(/[ {]/)[0],
                ...Trace.originalPositionFor(trace, {
                  line: index + 1,
                  column: 0,
                }),
              },
            ]
          : [],
      )
    }
    expect(origins(direct.css, direct.cssMap)).toMatchInlineSnapshot(`
      [
        {
          "column": 0,
          "line": 9,
          "name": null,
          "rule": "@import",
          "source": "rules.ts",
        },
        {
          "column": 0,
          "line": 8,
          "name": null,
          "rule": "@namespace",
          "source": "rules.ts",
        },
        {
          "column": 18,
          "line": 2,
          "name": null,
          "rule": "@counter-style",
          "source": "rules.ts",
        },
        {
          "column": 0,
          "line": 3,
          "name": null,
          "rule": "@font-face",
          "source": "rules.ts",
        },
        {
          "column": 0,
          "line": 4,
          "name": null,
          "rule": "@page",
          "source": "rules.ts",
        },
        {
          "column": 0,
          "line": 5,
          "name": null,
          "rule": "@view-transition",
          "source": "rules.ts",
        },
        {
          "column": 21,
          "line": 6,
          "name": null,
          "rule": "@custom-media",
          "source": "rules.ts",
        },
        {
          "column": 19,
          "line": 7,
          "name": null,
          "rule": "@function",
          "source": "rules.ts",
        },
      ]
    `)
    expect(origins(packed.sharedCss!, packed.sharedCssMap!))
      .toMatchInlineSnapshot(`
      [
        {
          "column": 0,
          "line": 9,
          "name": null,
          "rule": "@import",
          "source": "lib/rules.ts",
        },
        {
          "column": 0,
          "line": 8,
          "name": null,
          "rule": "@namespace",
          "source": "lib/rules.ts",
        },
        {
          "column": 18,
          "line": 2,
          "name": null,
          "rule": "@counter-style",
          "source": "lib/rules.ts",
        },
        {
          "column": 0,
          "line": 3,
          "name": null,
          "rule": "@font-face",
          "source": "lib/rules.ts",
        },
        {
          "column": 0,
          "line": 4,
          "name": null,
          "rule": "@page",
          "source": "lib/rules.ts",
        },
        {
          "column": 0,
          "line": 5,
          "name": null,
          "rule": "@view-transition",
          "source": "lib/rules.ts",
        },
        {
          "column": 21,
          "line": 6,
          "name": null,
          "rule": "@custom-media",
          "source": "lib/rules.ts",
        },
        {
          "column": 19,
          "line": 7,
          "name": null,
          "rule": "@function",
          "source": "lib/rules.ts",
        },
      ]
    `)
  })
  test('keeps Unicode content and explicit legacy document conditions without an encoding declaration', () => {
    const output = Transform.compile({
      moduleId: 'legacy.ts',
      source: `import {global} from 'zyzz/web';global({'@document url-prefix("https://example.com/")':{body:{'&::before':{content:'"héllo ●"'}}}});`,
    })
    expect({
      css: output.css,
      utf8: new TextDecoder('utf-8', { fatal: true }).decode(
        new TextEncoder().encode(output.css),
      ),
      charset: output.css.includes('@charset'),
      bom: output.css.charCodeAt(0) === 0xfeff,
    }).toMatchInlineSnapshot(`
      {
        "bom": false,
        "charset": false,
        "css": "@document url-prefix("https://example.com/"){body{&::before{content:"héllo ●";}}}",
        "utf8": "@document url-prefix("https://example.com/"){body{&::before{content:"héllo ●";}}}",
      }
    `)
  })
})
