/** Verifies immutable props bindings and aliases without repeating input evaluation. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Util from 'node:util'
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
        "className": "z-p-4px-huk5nJ-0",
      }
    `)
    expect(module.exports.apply(true)).toMatchInlineSnapshot(`
      {
        "className": "z-p-4px-k-DdDR-0 z-text-red-k-DdDR-1",
      }
    `)
  })

  test('preserves TDZ reads for omitted bindings', async () => {
    for (const sentinel of ['false', 'null', 'undefined']) {
      const compiled = Transform.compile({
        moduleId: 'tdz.ts',
        source: `import {cx} from 'zyzz';const result=render();const p=${sentinel};function render(){return cx(p)};export {result};`,
      })
      const directory = await Fs.mkdtemp(
        Path.join(process.cwd(), '.fixture-tdz-'),
      )
      try {
        const file = Path.join(directory, 'entry.ts')
        await Fs.writeFile(file, compiled.code)
        const { stdout } = await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import(${JSON.stringify(Url.pathToFileURL(file).href)}).then(()=>console.log('ok')).catch(error=>console.log(error.name))`,
          ],
        )
        expect(stdout.trim()).toMatchInlineSnapshot('"ReferenceError"')
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    }
  })

  test('allows asserted JSX spreads and limits HTML metadata to composed applications', async () => {
    const compiled = Transform.compile({
      moduleId: 'spread.tsx',
      source: `import {css,cx} from 'zyzz';const a=css({color:'red'});const p=a();const view=<div {...(p as css.Props)} />;export const composed=cx(p);`,
    })
    expect(compiled.code.includes('__zyzzComposition')).toMatchInlineSnapshot(
      `true`,
    )
    const html = Transform.compile({
      moduleId: 'html.ts',
      source: `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'html'});const a=css({color:'red'});const p=a();export const composed=cx(p);export const standalone=a();`,
    })
    const bundled = await Esbuild.build({
      stdin: { contents: html.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const result = new Function(
      `${bundled.outputFiles![0]!.text};return App;`,
    )()
    expect(Reflect.ownKeys(result.standalone)).toMatchInlineSnapshot(`
    [
      "class",
    ]
  `)
    expect(
      Object.getOwnPropertySymbols(result.composed).length,
    ).toMatchInlineSnapshot(`1`)
  })
  test('keeps omitted bindings separate from conditional styles', async () => {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      for (const output of ['react', 'html']) {
        for (const sentinel of ['false', 'null', 'undefined']) {
          const compiled = Transform.compile({
            moduleId: 'omitted.ts',
            source: `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'${output}'});const a=css({color:'red'});export function apply(enabled:boolean){const p=${sentinel};return cx(p,enabled && a())}`,
          })
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
          const page = await browser.newPage()
          await page.setContent(
            `<style>body{color:black}${compiled.css}</style><div></div>`,
          )
          await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
          await page.evaluate(
            `document.querySelector('div').className=App.apply(false).className ?? App.apply(false).class`,
          )
          expect(
            await page
              .locator('div')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
          await page.evaluate(
            `document.querySelector('div').className=App.apply(true).className ?? App.apply(true).class`,
          )
          expect(
            await page
              .locator('div')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
          await page.close()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
