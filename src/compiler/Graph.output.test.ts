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
          const library = await Library.create(root, 'react', producer)
          const contract = await Fs.readFile(
            Path.join(library.installed, 'index.js.zyzz.json'),
            'utf8',
          )
          const libraryCss = await Fs.readFile(
            Path.join(library.installed, 'style.css'),
            'utf8',
          )
          expect(JSON.parse(contract).version).toBe(17)
          expect(
            JSON.parse(contract).exports.controls.members.button.style.style
              .cssOutput,
          ).toBe(producer)
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
            expect(app.css.includes('{color:red;padding:6px;}')).toBe(
              producer === 'grouped',
            )
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
                      paddingLeft: style.paddingLeft,
                      paddingRight: style.paddingRight,
                      opacity: style.opacity,
                      border: style.borderTopWidth,
                      keys: Object.keys(props).filter(
                        (key) =>
                          !['className', 'style'].includes(key) &&
                          !key.startsWith('data-'),
                      ),
                    }
                  }, active)
                  expect(value).toEqual({
                    paddingLeft: '5px',
                    paddingRight: active ? '20px' : '4px',
                    opacity: active ? '1' : '0.5',
                    border: active ? '3px' : '0px',
                    keys: [],
                  })
                }
                await page.setViewportSize({ width: 900, height: 400 })
                expect(
                  await page
                    .locator('#card')
                    .evaluate(
                      (element) => getComputedStyle(element).paddingRight,
                    ),
                ).toBe('12px')
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
      modules: Library.sources('react', 'grouped'),
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
    ).toThrow('Invalid packed CSS output')

    const old = JSON.parse(metadata)
    old.version = 16
    expect(() =>
      Graph.compile({
        contracts: { 'library/index.js': JSON.stringify(old) },
        modules: {},
      }),
    ).toThrow('Invalid packed CSS output')

    const conflicting = metadata.replaceAll(
      '"cssOutput":"grouped"',
      '"cssOutput":"atomic"',
    )
    expect(() =>
      Graph.compile({
        contracts: { 'first.js': metadata, 'second.js': conflicting },
        modules: {},
      }),
    ).toThrow('Conflicting packed CSS output')
  })
})
