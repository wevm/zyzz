/** Verifies immutable props bindings and aliases without repeating input evaluation. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

describe('cx', () => {
  for (const output of ['react', 'html']) {
    test(`retains ${output} props aliases, conditional bindings, and initializer order`, async () => {
      const source = `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'${output}'});
        namespace styles {export const value=css((values:{padding:\`\${number}px\`})=>({padding:values.padding}));export const fixed=css({paddingLeft:'3px'})}
        export let reads=0;
        function value(){reads++;return '12px' as const}
        export function apply(enabled:boolean){const props=styles.value({padding:value()});const alias=props;const optional=enabled && styles.fixed();return cx(alias,optional)};`
      const compiled = Transform.compile({ moduleId: 'bindings.ts', source })
      const bundled = await Esbuild.build({
        stdin: {
          contents: compiled.code,
          loader: 'ts',
          resolveDir: process.cwd(),
        },
        alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
        bundle: true,
        format: 'iife',
        globalName: 'App',
        write: false,
      })
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      })
      try {
        const page = await browser.newPage()
        await page.setContent(`<style>${compiled.css}</style><div></div>`)
        await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
        await page.evaluate(`window.apply = (enabled) => {
          const props=App.apply(enabled);const element=document.querySelector('div');
          for(const name of element.getAttributeNames())element.removeAttribute(name);
          if('class' in props) for(const [name,value]of Object.entries(props))element.setAttribute(name,value);
          else {element.className=props.className;for(const [name,value]of Object.entries(props.style??{}))element.style.setProperty(name,String(value))}
        }`)
        await page.evaluate('apply(false)')
        expect(
          await page
            .locator('div')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"12px"')
        await page.evaluate('apply(true)')
        expect(
          await page
            .locator('div')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"12px 12px 12px 3px"')
        expect(await page.evaluate('App.reads')).toMatchInlineSnapshot('2')
      } finally {
        await browser.close()
      }
    })
  }

  test('rejects property mutation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=a();p.className='changed';export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:109: Applied props bindings must not escape before composition.]`,
    )
  })
  test('rejects function escape', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=a();mutate(p);export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:97: Applied props bindings must not escape before composition.]`,
    )
  })
  test('rejects alias escape', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=a();const alias=p;mutate(alias);export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:115: Applied props bindings must not escape before composition.]`,
    )
  })
  test('rejects inline export', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});export const p=a();export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:94: Applied props bindings must not escape before composition.]`,
    )
  })
  test('rejects exported alias', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const original=a();export const p=original;export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:118: Applied props bindings must not escape before composition.]`,
    )
  })
  test('rejects direct eval', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=css({color:'red'})();eval('delete p.className');export const props=cx(p);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: escape.ts:131: Applied props bindings must not escape before composition.]`,
    )
  })
  test('preserves earlier compositions and conditional asserted aliases', async () => {
    const source = `import {css,cx} from 'zyzz'; const a=css({color:'red'});const b=css({padding:'4px'});
      export function apply(enabled:boolean){const p=a();const alias=<ReturnType<typeof a>>p;const optional=enabled && alias;const inner=cx(b());return cx(inner,optional)}`
    const output = Transform.compile({ moduleId: 'aliases.ts', source })
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'cjs',
      write: false,
    })
    const module = { exports: {} as { apply: (enabled: boolean) => object } }
    new Function('module', 'exports', bundled.outputFiles![0]!.text)(
      module,
      module.exports,
    )
    expect(module.exports.apply(false)).toMatchInlineSnapshot(`
      {
        "className": "z-composition-q3v7jm4ag6tq-238-0",
      }
    `)
    expect(module.exports.apply(true)).toMatchInlineSnapshot(`
      {
        "className": "z-composition-q3v7jm4ag6tq-238",
      }
    `)
  })
})
