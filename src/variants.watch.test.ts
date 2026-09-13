/** Verifies source composition through real watch publication, recovery, and browser rendering. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'
import * as Watch from '../test/fixtures/Watch.js'

describe('variants', () => {
  test('preserves imported ownership across edits, failed builds, renames, and removal', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-variants-watch-'))
    const outDir = Path.join(root, 'output')
    const source = `import {variants,css} from 'zyzz';
export const button=variants({base:{padding:'2px'},variants:{size:{sm:{padding:'4px'},lg:{padding:'12px'}}},defaultVariants:{size:'sm'}});
export const override=css({paddingLeft:'3px'});`
    const app = (
      file: string,
    ) => `import {cx} from 'zyzz';import {button,override} from './${file}.js';
export function apply(){return cx(button({size:'lg'}),override())}`
    const browser = await chromium.launch()
    const host = await Host.create({
      outDir,
      packageId: 'watch-variants',
      root,
    })
    const notifications = Watch.create({
      path: 'styles.ts.css',
      timeoutMs: 10000,
    })

    try {
      await Fs.writeFile(Path.join(root, 'styles.ts'), source)
      await Fs.writeFile(Path.join(root, 'app.ts'), app('styles'))
      await host.build()
      const initial = JSON.parse(
        await Fs.readFile(Path.join(outDir, 'styles.ts.zyzz.json'), 'utf8'),
      )
      const page = await browser.newPage()

      async function render(file = 'styles') {
        const bundled = await Esbuild.build({
          entryPoints: [Path.join(outDir, 'app.ts')],
          bundle: true,
          write: false,
          format: 'iife',
          globalName: 'App',
          alias: { 'zyzz/runtime': Path.resolve('dist/runtime/index.js') },
        })
        const css =
          (await Fs.readFile(Path.join(outDir, `${file}.ts.css`), 'utf8')) +
          (await Fs.readFile(Path.join(outDir, 'app.ts.css'), 'utf8'))
        await page.setContent(
          `<style>${css}</style><button id="actual"></button><button id="native" style="padding:12px;padding-left:3px"></button>`,
        )
        await page.addScriptTag({ content: bundled.outputFiles[0]!.text })
        await page.evaluate(
          `{const props=App.apply(); const element=document.querySelector('#actual'); for(const [name,value] of Object.entries(props))element.setAttribute(name==='className'?'class':name,value);}`,
        )
        return page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).paddingLeft)
      }

      expect(await render()).toMatchInlineSnapshot('"3px"')
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page
          .locator('#native')
          .evaluate((element) => getComputedStyle(element).paddingRight),
      ).toMatchInlineSnapshot('"12px"')
      let recovering = false
      host.watch({
        onResult(event) {
          // Atomic filesystem edits may enqueue another notification for the failed source.
          if (recovering && 'error' in event) return
          notifications.onResult(event)
        },
      })
      await notifications.next(() =>
        Watch.write({
          path: Path.join(root, 'styles.ts'),
          source: source.replace("'3px'", "'7px'"),
        }),
      )
      expect(await render()).toMatchInlineSnapshot('"7px"')
      const changed = JSON.parse(
        await Fs.readFile(Path.join(outDir, 'styles.ts.zyzz.json'), 'utf8'),
      )
      expect(
        changed.exports.button.binding === initial.exports.button.binding,
      ).toMatchInlineSnapshot('true')
      const published = await Fs.readFile(Path.join(outDir, 'app.ts'), 'utf8')

      await expect(
        notifications.next(() =>
          Watch.write({
            path: Path.join(root, 'styles.ts'),
            source: source.replace("'12px'", 'unknown'),
          }),
        ),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: watch-variants/styles.ts:133: Expected a literal string or number; expressions are not evaluated.]`,
      )
      expect(
        (await Fs.readFile(Path.join(outDir, 'app.ts'), 'utf8')) === published,
      ).toMatchInlineSnapshot('true')
      recovering = true
      await notifications.next(() =>
        Watch.write({ path: Path.join(root, 'styles.ts'), source }),
      )
      expect(await render()).toMatchInlineSnapshot('"3px"')
      await host.close()

      await Fs.rename(
        Path.join(root, 'styles.ts'),
        Path.join(root, 'renamed.ts'),
      )
      await Fs.writeFile(Path.join(root, 'app.ts'), app('renamed'))
      const reopened = await Host.create({
        outDir,
        packageId: 'watch-variants',
        root,
      })
      try {
        await reopened.build()
        expect(await render('renamed')).toMatchInlineSnapshot('"3px"')
        expect(
          (await Fs.readdir(outDir)).some((file) =>
            file.startsWith('styles.ts'),
          ),
        ).toMatchInlineSnapshot('false')
        await Fs.rm(Path.join(root, 'app.ts'))
        await Fs.rm(Path.join(root, 'renamed.ts'))
        expect((await reopened.build()).files).toMatchInlineSnapshot('[]')
      } finally {
        await reopened.close()
      }
    } finally {
      await host.close()
      await browser.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 60000)
})
