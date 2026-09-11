/** Exercises packed marker identity, runtime state attributes, and CSS relationships. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import { Marker } from 'zyzz/runtime'
const config = `import {Css} from 'zyzz/web';export const card=Css.marker({state:['open','closed'],selected:[true,false]});`
const app = `import {css} from 'zyzz';import {Css} from 'zyzz/web';import {card} from 'library';export {card};export const styles={ancestor:css({[Css.ancestor(card,{data:{state:'open'}})]:{color:'red'}}),descendant:css({[Css.descendant(card,{data:{selected:false}})]:{color:'blue'}}),before:css({[Css.siblingBefore(card)]:{color:'green'}}),after:css({[Css.siblingAfter(card)]:{color:'purple'}}),either:css({[Css.anySibling(card)]:{color:'orange'}})};`
function compile() {
  const library = Graph.compile({
    modules: {
      'marker.ts': config,
      'index.ts': `export {card} from './marker.js';`,
    },
  })
  const output = Graph.compile({
    contracts: { 'library/index.js': library.contracts['index.ts']! },
    imports: {
      'app.ts': { library: 'library/index.js', zyzz: null, 'zyzz/web': null },
    },
    modules: { 'app.ts': app },
  })
  return { library, output }
}
async function bundle() {
  const { library, output } = compile()
  const result = await Esbuild.build({
    stdin: {
      contents: output.modules['app.ts']!.code,
      loader: 'ts',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Fixture',
    alias: {
      'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
      'zyzz/web': Path.resolve('src/web/index.ts'),
      zyzz: Path.resolve('src/index.ts'),
    },
    plugins: [
      {
        name: 'library',
        setup(build) {
          build.onResolve({ filter: /^library$/ }, () => ({
            path: 'marker',
            namespace: 'fixture',
          }))
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: library.modules['marker.ts']!.code,
            loader: 'ts',
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  return {
    code: result.outputFiles[0]!.text,
    css: output.modules['app.ts']!.css,
  }
}
describe('marker', () => {
  test('retains mutable marker aliases used only at runtime', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {Css} from 'zyzz/web';const card=Css.marker();let active=card;export const attrs=active();`,
      },
    })
    expect(
      result.modules['app.ts']!.code.includes('active()'),
    ).toMatchInlineSnapshot('true')
  })
  test('links packed marker identities and validates runtime state subsets', async () => {
    const { code, css } = await bundle()
    const fixture = Vm.runInNewContext(`${code};Fixture;`) as {
      card: (input?: Record<string, unknown>) => Record<string, string>
    }
    expect(fixture.card({ selected: false, state: 'open' }))
      .toMatchInlineSnapshot(`
      {
        "data-z-1dwt1t61ri6uf4-card-63-61-72-64": "",
        "data-z-1dwt1t61ri6uf4-card-63-61-72-64-selected": "false",
        "data-z-1dwt1t61ri6uf4-card-63-61-72-64-state": "open",
      }
    `)
    expect(() =>
      fixture.card({ unknown: 'open' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown marker state: unknown]`,
    )
    expect(() =>
      fixture.card({ state: 'invalid' }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid marker state: state]`)
    expect(() =>
      fixture.card({ [Symbol('unknown')]: 'open' }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: Unknown marker state: symbol]',
    )
    expect(css).toMatchInlineSnapshot(`
      ".z-style-1e8a67z1uaws1j-127{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64][data-z-1dwt1t61ri6uf4-card-63-61-72-64-state="open"]) &{color:red;}}
      .z-style-1e8a67z1uaws1j-202{&:where(:has([data-z-1dwt1t61ri6uf4-card-63-61-72-64][data-z-1dwt1t61ri6uf4-card-63-61-72-64-selected="false"])){color:blue;}}
      .z-style-1e8a67z1uaws1j-278{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) ~ &{color:green;}}
      .z-style-1e8a67z1uaws1j-333{&:where(:has(~ [data-z-1dwt1t61ri6uf4-card-63-61-72-64])){color:purple;}}
      .z-style-1e8a67z1uaws1j-389{:is(:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) ~ &, &:where(:has(~ [data-z-1dwt1t61ri6uf4-card-63-61-72-64]))){color:orange;}}"
    `)
  })
  test('preserves identities across offsets and rejects invalid schemas and predicates', () => {
    const before = Graph.compile({ modules: { 'marker.ts': config } })
    const malformed = JSON.parse(before.contracts['marker.ts']!)
    malformed.exports.card.binding = 'data-z-other'
    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(malformed) },
        imports: { 'app.ts': { lib: 'lib.js', zyzz: null, 'zyzz/web': null } },
        modules: {
          'app.ts': `import {card} from 'lib';import {css} from 'zyzz';import {Css} from 'zyzz/web';export const style=css({[Css.ancestor(card)]:{color:'red'}});`,
        },
      }),
    ).toThrow()
    const after = Graph.compile({
      modules: { 'marker.ts': '// leading edit\n' + config },
    })
    expect(
      JSON.parse(before.contracts['marker.ts']!).exports.card.marker.id ===
        JSON.parse(after.contracts['marker.ts']!).exports.card.marker.id,
    ).toMatchInlineSnapshot('true')
    const invalid = [
      'Css.marker({state:[]})',
      "Css.marker({state:[false,'false']})",
      "Css.marker({state:['open'],State:['closed']})",
    ]
    expect(
      invalid.map((expression) => {
        try {
          Graph.compile({
            modules: {
              'app.ts': `import {Css} from 'zyzz/web';export const marker=${expression};`,
            },
          })
          return 'accepted'
        } catch (error) {
          return (error as Error).message
        }
      }),
    ).toMatchInlineSnapshot(`
      [
        "app.ts:49: Marker states require nonempty finite value arrays.",
        "app.ts:49: Marker values must be distinct strings or booleans, including their serialization.",
        "app.ts:49: Marker state names must be distinct data-name fragments without reserved keys.",
      ]
    `)
  })
  test('respects lexical aliases and compiles literal ampersands, undefined and dynamic relationships', () => {
    const output = Graph.compile({
      modules: {
        'app.ts': `import {css} from 'zyzz';import {Css} from 'zyzz/web';const card=Css.marker(undefined);const alias=card;function other(card:unknown){const alias=card;return alias}export {alias};export const style=css((values:{color:'#123'|'#456'})=>({[Css.ancestor(card,{data:undefined,has:'[href*="&"]/* & */'})]:{color:values.color}}));`,
      },
    })
    expect(
      output.modules['app.ts']!.css.includes('[href*='),
    ).toMatchInlineSnapshot('true')
  })
  test('rejects uncompiled helpers, null data, nested has and NUL states', () => {
    for (const expression of [
      `const unused={[Css.ancestor(card)]:{color:'red'}}`,
      `const style=css({[Css.ancestor(card,{data:null})]:{color:'red'}})`,
      `const style=css({[Css.descendant(card,{has:'a'})]:{color:'red'}})`,
      `const invalid=Css.marker({state:['\\0']})`,
      `const invalid=Css.marker({state:['\\r']})`,
      `const invalid=Css.marker({state:['\\ud800']})`,
      `const invalid=css({[Css.descendant(card,':visited')]:{color:'red'}})`,
    ])
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {css} from 'zyzz';import {Css} from 'zyzz/web';const card=Css.marker();${expression}`,
          },
        }),
      ).toThrow()
  })
  test('unwraps factories and freezes their public rewrite spans', async () => {
    const source =
      "import {Css} from 'zyzz/web';export const card=(Css['marker']({state:[`open`]}))!"
    const extracted = Source.extract({ moduleId: 'marker.ts', source })
    expect(Object.isFrozen(extracted.markerCalls)).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(extracted.markerCalls![0])).toMatchInlineSnapshot(
      'true',
    )
    const result = Graph.compile({ modules: { 'marker.ts': source } })
    expect(
      (
        await Esbuild.transform(result.modules['marker.ts']!.code, {
          loader: 'ts',
        })
      ).code.includes('zyzz/web'),
    ).toMatchInlineSnapshot('false')
  })
  test('rejects inherited and class-instance schemas before creating attribute bindings', () => {
    class Schema {
      state = ['open']
    }
    for (const schema of [Object.create({ state: ['open'] }), new Schema()])
      expect(() =>
        Marker.create({ id: 'data-z-card', schema: Marker.schema(schema) })(),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Error: Marker schemas require a plain record.]',
      )
  })
  test('does not publish a marker through a type-only export', () => {
    const output = Graph.compile({
      modules: {
        'marker.ts': `import {Css} from 'zyzz/web';const card=Css.marker();type card=typeof card;export type {card}`,
      },
    })
    expect(output.contracts['marker.ts']).toMatchInlineSnapshot('undefined')
  })
  test('observes ancestor, descendant, and sibling direction in Chromium', async () => {
    const { code, css } = await bundle()
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${css}</style><main id="root"><span id="ancestor"></span></main><div id="descendant"><input id="child"></div><div><i id="earlier"></i><b id="before"></b></div><div><b id="after"></b><i id="later"></i></div><div><i id="peer"></i><b id="either"></b></div>`,
      )
      await page.addScriptTag({ content: code })
      await page.evaluate(
        `for(const id of ['root','child','earlier','later','peer'])for(const [key,value]of Object.entries(Fixture.card({state:'open',selected:false})))document.getElementById(id).setAttribute(key,value);for(const id of ['ancestor','descendant','before','after','either'])document.getElementById(id).className=Fixture.styles[id]().className`,
      )
      expect(
        await page
          .locator('#ancestor')
          .evaluate((el) => getComputedStyle(el).color),
        'ancestor',
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('#descendant')
          .evaluate((el) => getComputedStyle(el).color),
        'descendant',
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(
        await page
          .locator('#before')
          .evaluate((el) => getComputedStyle(el).color),
        'before',
      ).toMatchInlineSnapshot('"rgb(0, 128, 0)"')
      expect(
        await page
          .locator('#after')
          .evaluate((el) => getComputedStyle(el).color),
        'after',
      ).toMatchInlineSnapshot('"rgb(128, 0, 128)"')
      expect(
        await page
          .locator('#either')
          .evaluate((el) => getComputedStyle(el).color),
        'either',
      ).toMatchInlineSnapshot('"rgb(255, 165, 0)"')
      await page.locator('#earlier').evaluate((el) => el.remove())
      expect(
        await page
          .locator('#before')
          .evaluate((el) => getComputedStyle(el).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
    } finally {
      await browser.close()
    }
  })
})
