/** Exercises mixed CSS modes through source-free npm archives and browser composition. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Library from '../../test/fixtures/VariantLibrary.js'

describe('compile', () => {
  test('retains producer modes and dynamic composition across all mode pairs', async () => {
    const browser = await chromium.launch()
    try {
      for (const producer of ['atomic', 'grouped'] as const) {
        const root = await Fs.mkdtemp(Path.resolve('.fixture-css-output-'))
        try {
          const library = await Library.create(root, {
            cssOutput: producer,
            output: 'react',
          })
          const contract = await Fs.readFile(
            Path.join(library.installed, 'index.js.zyzz.json'),
            'utf8',
          )
          const libraryCss = await Fs.readFile(
            Path.join(library.installed, 'style.css'),
            'utf8',
          )
          expect(JSON.parse(contract).version).toMatchInlineSnapshot(`17`)
          if (producer === 'atomic')
            expect(
              JSON.parse(contract).exports.controls.members.button.style.style
                .cssOutput,
            ).toMatchInlineSnapshot(`"atomic"`)
          else
            expect(
              JSON.parse(contract).exports.controls.members.button.style.style
                .cssOutput,
            ).toMatchInlineSnapshot(`"grouped"`)
          expect(await Fs.readdir(library.installed)).not.toContain('styles.ts')

          for (const consumer of ['atomic', 'grouped'] as const) {
            const source = `import {Config,cx} from 'zyzz';import {controls,style} from '@acme/variants';
const {css}=Config.create({cssOutput:'${consumer}'});
const override=css({paddingLeft:'5px'});
export const authored=style({color:'red',padding:'6px'});
export function sample(active:boolean){return cx(controls.button({size:active?{custom:{padding:'20px'}}:undefined,active,conditions:{wide:{size:'lg'}}}),override())}`
            const input = {
              contracts: { 'library/index.js': contract },
              imports: {
                'app.ts': { '@acme/variants': 'library/index.js', zyzz: null },
              },
              modules: { 'app.ts': source },
            }
            const result = Graph.compile(input)
            const app = result.modules['app.ts']!
            if (producer === 'grouped')
              expect(
                app.css.includes('{color:red;padding:6px;}'),
              ).toMatchInlineSnapshot(`true`)
            else
              expect(
                app.css.includes('{color:red;padding:6px;}'),
              ).toMatchInlineSnapshot(`false`)
            const built = await Esbuild.build({
              bundle: true,
              format: 'iife',
              globalName: 'fixture',
              platform: 'browser',
              stdin: { contents: app.code, loader: 'ts', resolveDir: root },
              write: false,
            })
            const page = await browser.newPage({
              viewport: { width: 450, height: 400 },
            })
            try {
              // Both independent stylesheet orders must preserve explicit cx precedence.
              for (const css of [
                libraryCss + '\n' + app.css,
                app.css + '\n' + libraryCss,
              ]) {
                await page.setContent(
                  `<style>${result.sharedCss ?? ''}\n${css}</style><div id="card"></div>`,
                )
                await page.addScriptTag({ content: built.outputFiles[0]!.text })
                for (const active of [false, true, false]) {
                  const value = await page.evaluate((active) => {
                    const sample = (
                      window as unknown as {
                        fixture: {
                          sample(active: boolean): Record<string, unknown>
                        }
                      }
                    ).fixture.sample
                    const props = sample(active)
                    const element = document.querySelector(
                      '#card',
                    ) as HTMLElement
                    for (const name of element.getAttributeNames())
                      if (name !== 'id') element.removeAttribute(name)
                    element.className = props.className as string
                    for (const [key, value] of Object.entries(props)) {
                      if (key.startsWith('data-'))
                        element.setAttribute(key, String(value))
                      if (key === 'style')
                        for (const [name, scalar] of Object.entries(
                          value as Record<string, string>,
                        ))
                          element.style.setProperty(name, scalar)
                    }
                    const style = getComputedStyle(element)
                    return {
                      border: style.borderTopWidth,
                      keys: Object.keys(props).filter(
                        (key) =>
                          !['className', 'style'].includes(key) &&
                          !key.startsWith('data-'),
                      ),
                      opacity: style.opacity,
                      paddingLeft: style.paddingLeft,
                      paddingRight: style.paddingRight,
                    }
                  }, active)
                  if (active)
                    expect(value).toMatchInlineSnapshot(`
                    {
                      "border": "3px",
                      "keys": [],
                      "opacity": "1",
                      "paddingLeft": "5px",
                      "paddingRight": "20px",
                    }
                  `)
                  else
                    expect(value).toMatchInlineSnapshot(`
                    {
                      "border": "0px",
                      "keys": [],
                      "opacity": "0.5",
                      "paddingLeft": "5px",
                      "paddingRight": "4px",
                    }
                  `)
                }
                await page.setViewportSize({ width: 900, height: 400 })
                expect(
                  await page
                    .locator('#card')
                    .evaluate(
                      (element) => getComputedStyle(element).paddingRight,
                    ),
                ).toMatchInlineSnapshot(`"12px"`)
                await page.setViewportSize({ width: 450, height: 400 })
              }
            } finally {
              await page.close()
            }
          }
        } finally {
          await Fs.rm(root, { force: true, recursive: true })
        }
      }
    } finally {
      await browser.close()
    }
  }, 180000)

  test('rejects invalid or conflicting packed output identities', () => {
    const compiled = Graph.compile({
      modules: Library.sources({ cssOutput: 'grouped', output: 'react' }),
    })
    const metadata = compiled.contracts['@acme/variants/index.ts']!
    const data = JSON.parse(metadata)
    const theme = Object.values(data.themes)[0] as { cssOutput: string }
    theme.cssOutput = 'automatic'
    expect(() =>
      Graph.compile({
        contracts: { 'library/index.js': JSON.stringify(data) },
        modules: {},
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library/index.js:0: Invalid library contract: Invalid packed CSS output mode.]`,
    )

    const old = JSON.parse(metadata)
    old.version = 16
    const legacy = Graph.compile({
      contracts: { 'library/index.js': JSON.stringify(old) },
      imports: { 'app.ts': { './library/index.js': 'library/index.js' } },
      modules: {
        'app.ts': `import {controls} from './library/index.js';export const props=controls.button();`,
      },
    })
    expect(legacy.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z_theme-13yvj2m4fsr2i-css-theme{--z-t13yvj2m4fsr2i-css-color_2e_brand:light-dark(#0066cc,#99ccff);}"`,
    )

    const conflicting = metadata.replaceAll(
      '"cssOutput":"grouped"',
      '"cssOutput":"atomic"',
    )
    expect(() =>
      Graph.compile({
        contracts: { 'first.js': metadata, 'second.js': conflicting },
        modules: {},
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second.js:0: Invalid library contract: Conflicting packed CSS output modes for one theme identity.]`,
    )
  })
  test('upgrades missing legacy output modes through a source barrel', () => {
    const compiled = Graph.compile({
      modules: Library.sources({ cssOutput: 'atomic' }),
    })
    const data = JSON.parse(
      compiled.contracts['@acme/variants/index.ts']!,
      (key, value) => (key === 'cssOutput' ? undefined : value),
    )
    data.version = 16
    const contract = JSON.stringify(data)
    const barrel = Graph.compile({
      contracts: {
        'legacy.js': contract,
        'current.js': compiled.contracts['@acme/variants/index.ts']!,
      },
      imports: { 'barrel.ts': { './legacy.js': 'legacy.js' } },
      modules: { 'barrel.ts': `export {controls} from './legacy.js';` },
    })
    const consumer = Graph.compile({
      contracts: { 'barrel.js': barrel.contracts['barrel.ts']! },
      imports: { 'app.ts': { './barrel.js': 'barrel.js' } },
      modules: {
        'app.ts': `import {controls} from './barrel.js';export const props=controls.button();`,
      },
    })
    expect(consumer.modules['app.ts']!.code).toMatchInlineSnapshot(
      `"import {controls} from './barrel.js';export const props=controls.button();"`,
    )
    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z_theme-13yvj2m4fsr2i-css-theme{--z-t13yvj2m4fsr2i-css-color_2e_brand:light-dark(#0066cc,#99ccff);}"`,
    )
  })
})

test('shares published identities across consumers and retains nested child modes', () => {
  const first = Graph.compile({
    modules: {
      'first.ts':
        "import {Config} from 'zyzz'; const {css}=Config.create({cssOutput:'grouped'}); export const base=css({color:'red',padding:'8px'})",
    },
  })
  const packed = JSON.parse(first.contracts['first.ts']!)
  const grouped = packed.exports.base.style.style
  // Model a previously packed composition whose atomic parent owns a grouped child.
  packed.exports.base.style.style = {
    ...grouped,
    cssOutput: 'atomic',
    declarations: [],
    rules: [{ style: grouped }],
  }
  const second = Graph.compile({
    contracts: { 'first.js': JSON.stringify(packed) },
    imports: { 'second.ts': { './first.js': 'first.js' } },
    modules: { 'second.ts': "export {base} from './first.js'" },
  })
  const result = Graph.compile({
    contracts: { 'second.js': second.contracts['second.ts']! },
    imports: {
      'a.ts': { './second.js': 'second.js', zyzz: null },
      'b.ts': { './second.js': 'second.js', zyzz: null },
    },
    modules: {
      'a.ts':
        "import {css,cx} from 'zyzz'; import {base} from './second.js'; const local=css({opacity:0.5}); export const props=cx(base(),local())",
      'b.ts':
        "import {css,cx} from 'zyzz'; import {base} from './second.js'; const local=css({opacity:1}); export const props=cx(base(),local())",
    },
  })
  expect(
    Object.fromEntries(
      Object.entries(result.modules).map(([name, output]) => [
        name,
        output.css,
      ]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "a.ts": ".z_theme-1mlrxl41f5va70-css{}
    .z-opacity-mhlaoe-0{opacity:0.5;}
    .z-style-H1-Qft-0{color:red;padding:8px;}
    .z-opacity-H1-Qft-1{opacity:0.5;}",
      "b.ts": ".z_theme-1mlrxl41f5va70-css{}
    .z-opacity-1-uwnrRp-0{opacity:1;}
    .z-style-SxroK2-0{color:red;padding:8px;}
    .z-opacity-1-SxroK2-1{opacity:1;}",
    }
  `)
})
