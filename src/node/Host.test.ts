/**
 * Exercises the public Host workflow through real collaborating modules.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
import * as Watch from '../../test/fixtures/Watch.js'

const project = Path.resolve(import.meta.dirname, '../..')
const source = `import { css } from 'zyzz'; export const button = css({ padding: '8px' });`

describe('create', () => {
  test('await using drains builds and releases output ownership on scope exit', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-dispose-'))
    const outDir = Path.join(root, 'output')
    const options = { outDir, packageId: 'example', root }
    try {
      await Fs.writeFile(Path.join(root, 'button.ts'), source)
      await expect(
        (async () => {
          await using host = await Host.create(options)
          void host.build()
          throw new Error('Scope failed')
        })(),
      ).rejects.toThrowErrorMatchingInlineSnapshot('[Error: Scope failed]')

      expect(
        await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot(`
        ".z-12ydhop55omeb-base0 {
          padding: 8px;
        }
        "
      `)

      await using host = await Host.create(options)
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('processed themes and props render in Chromium', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-css-browser-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({
      css: { minify: true, targets: { safari: 8 << 16 } },
      outDir,
      packageId: 'example',
      root,
    })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      await Fs.writeFile(
        Path.join(root, 'card.ts'),
        `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: '#ff0000' } });
const alternate = Theme.extend(theme, { color: { brand: '#0000ff' } });
export const scope = alternate.className;
export const card = theme.css({ color: 'brand', display: 'flex', padding: '8px' })();`,
      )
      await host.build()
      const bundle = await Esbuild.build({
        alias: { 'zyzz/runtime': Path.join(project, 'src/runtime/index.ts') },
        bundle: true,
        entryPoints: [Path.join(outDir, 'card.ts')],
        format: 'iife',
        globalName: 'Fixture',
        write: false,
      })
      browser = await chromium.launch()
      const page = await browser.newPage()
      await page.setContent('<section><div>Card</div></section>')
      await page.addStyleTag({
        content: await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8'),
      })
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
      await page.evaluate(() => {
        const fixture = (
          window as unknown as {
            Fixture: { card: { className: string }; scope: string }
          }
        ).Fixture
        document.querySelector('section')!.className = fixture.scope
        document.querySelector('div')!.className = fixture.card.className
      })
      expect(
        await page
          .locator('div')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(
        await page
          .locator('div')
          .evaluate((element) => getComputedStyle(element).display),
      ).toMatchInlineSnapshot('"flex"')
      expect(
        await page
          .locator('div')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot('"8px"')
    } finally {
      await browser?.close()
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('processes browser targets and minification with original source maps and recovery', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-css-host-'))
    const outDir = Path.join(root, 'output')
    const options = { minify: true, targets: { safari: 8 << 16 } }
    const host = await Host.create({
      css: options,
      outDir,
      packageId: 'example',
      root,
    })
    const input = `import { css } from 'zyzz';
export const card = css({ display: 'flex', color: '#ff0000' });`
    const path = Path.join(root, 'card.ts')
    try {
      // The lifecycle captures processing options before callers can mutate them.
      options.targets.safari = 99 << 16
      options.minify = false
      await Fs.writeFile(path, input)
      await host.build()
      const css = await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8')
      expect(css).toMatchInlineSnapshot(
        `".z-4lx6a318y1wl5-base0{color:red;display:-webkit-flex;display:flex}"`,
      )
      const map = new Trace.TraceMap(
        await Fs.readFile(Path.join(outDir, 'card.ts.css.map'), 'utf8'),
      )
      expect(Trace.originalPositionFor(map, { column: 0, line: 1 }))
        .toMatchInlineSnapshot(`
        {
          "column": 20,
          "line": 2,
          "name": "style-4lx6a318y1wl5-48",
          "source": "example/card.ts",
        }
      `)
      expect(map.sourcesContent).toMatchInlineSnapshot(`
        [
          ".z-4lx6a318y1wl5-base0{display:flex;color:#ff0000;}",
          "import { css } from 'zyzz';
        export const card = css({ display: 'flex', color: '#ff0000' });",
        ]
      `)
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')
      await Fs.writeFile(path, input.replace("'#ff0000'", "'rgb('"))
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: example/card.ts:78: Expected a hex color, transparent, currentColor, black, or white.]`,
      )
      expect(
        await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot(
        `".z-4lx6a318y1wl5-base0{color:red;display:-webkit-flex;display:flex}"`,
      )
      await Fs.writeFile(path, input.replace('#ff0000', '#0000ff'))
      await host.build()
      expect(
        await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot(
        `".z-4lx6a318y1wl5-base0{color:#00f;display:-webkit-flex;display:flex}"`,
      )
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('can preserve intermediate CSS for another processor', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-raw-css-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({
      css: false,
      outDir,
      packageId: 'example',
      root,
    })
    try {
      await Fs.writeFile(Path.join(root, 'button.ts'), source)
      await host.build()
      expect(
        await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot('".z-12ydhop55omeb-base0{padding:8px;}"')
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('shared theme edits rebuild consumers and recover after missing dependencies', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-graph-host-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({ outDir, packageId: 'example', root })
    const notifications = Watch.create({ path: 'card.ts.css' })
    const themePath = Path.join(root, 'theme.ts')
    const themeSource = `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#06c'}});`
    try {
      await Fs.writeFile(themePath, themeSource)
      await Fs.writeFile(
        Path.join(root, 'card.ts'),
        `import { theme } from './theme.js'; export const props = theme.css({color:'brand'})();`,
      )
      await host.build()
      expect(
        await Fs.readFile(Path.join(outDir, 'theme.ts.zyzz.json'), 'utf8'),
      ).toMatchInlineSnapshot(
        `"{"exports":{"theme":{"binding":"1dre7461ulsxz8-theme","kind":"theme","theme":"1dre7461ulsxz8-theme"}},"themes":{"1dre7461ulsxz8-theme":{"identity":"1dre7461ulsxz8-theme","tokens":{"color":{"brand":"#06c"}}}},"version":1}"`,
      )
      const before = await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8')
      expect(before).toMatchInlineSnapshot(`
        ".z_theme-1dre7461ulsxz8-theme {
          --z-t1dre7461ulsxz8-theme-color_2e_brand: #06c;
        }

        .z-4lx6a318y1wl5-base0 {
          color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #06c);
        }
        "
      `)
      expect((await host.build()).changed).toMatchInlineSnapshot(`[]`)
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Fs.writeFile(themePath, themeSource.replace("'#06c'", "'#175'")),
      )
      expect(
        await Fs.readFile(Path.join(outDir, 'theme.ts.zyzz.json'), 'utf8'),
      ).toMatchInlineSnapshot(
        `"{"exports":{"theme":{"binding":"1dre7461ulsxz8-theme","kind":"theme","theme":"1dre7461ulsxz8-theme"}},"themes":{"1dre7461ulsxz8-theme":{"identity":"1dre7461ulsxz8-theme","tokens":{"color":{"brand":"#175"}}}},"version":1}"`,
      )
      const after = await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8')
      expect(after).toMatchInlineSnapshot(`
        ".z_theme-1dre7461ulsxz8-theme {
          --z-t1dre7461ulsxz8-theme-color_2e_brand: #175;
        }

        .z-4lx6a318y1wl5-base0 {
          color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #175);
        }
        "
      `)
      await expect(
        notifications.next(() => Fs.rm(themePath)),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: example/card.ts:0: Missing source module: ./theme.js]`,
      )
      expect(await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8'))
        .toMatchInlineSnapshot(`
          ".z_theme-1dre7461ulsxz8-theme {
            --z-t1dre7461ulsxz8-theme-color_2e_brand: #175;
          }

          .z-4lx6a318y1wl5-base0 {
            color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #175);
          }
          "
        `)
      await notifications.next(() => Fs.writeFile(themePath, themeSource))
      expect(await Fs.readFile(Path.join(outDir, 'card.ts.css'), 'utf8'))
        .toMatchInlineSnapshot(`
          ".z_theme-1dre7461ulsxz8-theme {
            --z-t1dre7461ulsxz8-theme-color_2e_brand: #06c;
          }

          .z-4lx6a318y1wl5-base0 {
            color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #06c);
          }
          "
        `)
    } finally {
      await host.close()
      await Fs.rm(root, { recursive: true, force: true })
    }
  })

  test('local theme edits rebuild CSS while keeping scope identities stable', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-theme-host-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({ outDir, packageId: 'example', root })
    const source = `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); export const scope = theme.className; const { css } = theme; export const props = css({ color: theme.tokens.color.brand })();`
    try {
      await Fs.writeFile(Path.join(root, 'theme.ts'), source)
      await host.build()
      const before = await Fs.readFile(
        Path.join(outDir, 'theme.ts.css'),
        'utf8',
      )
      expect(before).toMatchInlineSnapshot(`
        ".z_theme-1dre7461ulsxz8-theme {
          --z-t1dre7461ulsxz8-theme-color_2e_brand: #000;
        }

        .z-1dre7461ulsxz8-base0 {
          color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #000);
        }
        "
      `)

      await Fs.writeFile(
        Path.join(root, 'theme.ts'),
        source.replace("'#000'", "'#fff'"),
      )
      const rebuilt = await host.build()
      expect(rebuilt.changed).toMatchInlineSnapshot(`
        [
          "theme.ts",
          "theme.ts.css",
          "theme.ts.css.map",
          "theme.ts.map",
        ]
      `)
      const after = await Fs.readFile(Path.join(outDir, 'theme.ts.css'), 'utf8')
      expect(after).toMatchInlineSnapshot(`
        ".z_theme-1dre7461ulsxz8-theme {
          --z-t1dre7461ulsxz8-theme-color_2e_brand: #fff;
        }

        .z-1dre7461ulsxz8-base0 {
          color: var(--z-t1dre7461ulsxz8-theme-color_2e_brand, #fff);
        }
        "
      `)
      expect(
        before.split('{')[0] === after.split('{')[0],
      ).toMatchInlineSnapshot('true')
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('file builds preserve working artifacts, cache unchanged inputs, and clean owned outputs', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-host-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({ outDir, packageId: 'example', root })

    try {
      await Fs.writeFile(Path.join(root, 'button.ts'), source)
      await Fs.writeFile(
        Path.join(root, 'button.test.ts'),
        'invalid ignored test source',
      )
      await Fs.writeFile(Path.join(outDir, 'keep.txt'), 'unrelated')
      await Fs.writeFile(
        Path.join(outDir, 'ignored.ts'),
        'invalid output source',
      )
      const result = await host.build()
      expect(result.files).toMatchInlineSnapshot(`
      [
        "button.ts",
        "button.ts.css",
        "button.ts.css.map",
        "button.ts.map",
      ]
    `)

      const expected = Transform.compile({
        moduleId: 'example/button.ts',
        source,
      })
      expect(await Fs.readFile(Path.join(outDir, 'button.ts'), 'utf8'))
        .toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
       export const button = __zyzzProps.create({className:"z-12ydhop55omeb-base0"});"
    `)
      expect(await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8'))
        .toMatchInlineSnapshot(`
        ".z-12ydhop55omeb-base0 {
          padding: 8px;
        }
        "
      `)
      expect(
        (await Fs.readFile(Path.join(outDir, 'button.ts.map'), 'utf8')) ===
          JSON.stringify(expected.map),
      ).toMatchInlineSnapshot('true')
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')

      const before = await Fs.readFile(
        Path.join(outDir, 'button.ts.css'),
        'utf8',
      )
      await Fs.writeFile(
        Path.join(root, 'button.ts'),
        `import { css } from 'zyzz'; css({ padding: unknown });`,
      )
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: example/button.ts:43: Expected a literal string or number; expressions are not evaluated.]`,
      )
      expect(await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8'))
        .toMatchInlineSnapshot(`
        ".z-12ydhop55omeb-base0 {
          padding: 8px;
        }
        "
      `)
      expect(
        (await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8')) ===
          before,
      ).toMatchInlineSnapshot('true')

      await Fs.writeFile(
        Path.join(root, 'button.ts'),
        source.replace('8px', '4px'),
      )
      await host.build()
      await Fs.rename(
        Path.join(root, 'button.ts'),
        Path.join(root, 'renamed.ts'),
      )
      expect((await host.build()).changed).toMatchInlineSnapshot(`
      [
        "button.ts",
        "button.ts.css",
        "button.ts.css.map",
        "button.ts.map",
        "renamed.ts",
        "renamed.ts.css",
        "renamed.ts.css.map",
        "renamed.ts.map",
      ]
    `)
      expect((await Fs.readdir(outDir)).sort()).toMatchInlineSnapshot(`
      [
        ".zyzz-lock",
        ".zyzz.json",
        "ignored.ts",
        "keep.txt",
        "renamed.ts",
        "renamed.ts.css",
        "renamed.ts.css.map",
        "renamed.ts.map",
      ]
    `)

      await Fs.rm(Path.join(root, 'renamed.ts'))
      expect((await host.build()).files).toMatchInlineSnapshot('[]')
      expect(
        await Fs.readFile(Path.join(outDir, 'keep.txt'), 'utf8'),
      ).toMatchInlineSnapshot('"unrelated"')
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('ownership survives reopening and refuses modified files and symlink outputs', async () => {
    const root = await Fs.mkdtemp(
      Path.join(project, '.fixture-host-ownership-'),
    )
    const outDir = Path.join(root, 'output')
    const options = { outDir, packageId: 'example', root }
    let host = await Host.create(options)

    try {
      const conflict = await Host.create(options).catch((error: unknown) => {
        if (error && typeof error === 'object' && 'code' in error)
          return error.code
        throw error
      })
      expect(conflict).toMatchInlineSnapshot('"EEXIST"')

      await Fs.writeFile(Path.join(root, 'button.ts'), source)
      await host.build()
      await host.close()
      host = await Host.create(options)
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')

      await Fs.writeFile(
        Path.join(outDir, 'button.ts.css'),
        'edited by consumer',
      )
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Refusing to replace an unowned or modified output: button.ts.css]`,
      )
      expect(
        await Fs.readFile(Path.join(outDir, 'button.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot('"edited by consumer"')

      await Fs.rm(Path.join(outDir, 'button.ts.css'))
      await Fs.symlink(
        Path.join(outDir, 'button.ts'),
        Path.join(outDir, 'button.ts.css'),
      )
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Output paths must be regular files and directories.]`,
      )
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('real recursive watching handles nested additions, failures, recovery, and disposal', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-host-watch-'))
    const outDir = Path.join(root, 'output')
    const host = await Host.create({ outDir, packageId: 'example', root })
    const events: Host.Event[] = []
    let notify: (() => void) | undefined

    async function next(
      predicate: (event: Host.Event) => boolean,
    ): Promise<Host.Event> {
      const deadline = Date.now() + 5000
      while (true) {
        const event = events.shift()
        if (event && predicate(event)) return event
        if (event) continue
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Watch event timed out.')),
            Math.max(0, deadline - Date.now()),
          )
          notify = () => {
            clearTimeout(timeout)
            resolve()
          }
        })
      }
    }

    try {
      host.watch({
        onResult(event) {
          events.push(event)
          notify?.()
          notify = undefined
        },
      })
      expect(await next((event) => 'result' in event)).toMatchInlineSnapshot(`
      {
        "result": {
          "changed": [],
          "files": [],
        },
      }
    `)

      await Fs.mkdir(Path.join(root, 'nested'))
      await Fs.writeFile(Path.join(root, 'nested/button.ts'), source)
      const added = await next(
        (event) =>
          'result' in event && event.result.files.includes('nested/button.ts'),
      )
      if (!('result' in added)) throw new Error('Expected build result.')
      expect(added.result.files).toMatchInlineSnapshot(`
      [
        "nested/button.ts",
        "nested/button.ts.css",
        "nested/button.ts.css.map",
        "nested/button.ts.map",
      ]
    `)

      await Fs.writeFile(
        Path.join(root, 'nested/button.ts'),
        `import { css } from 'zyzz'; css({ padding: unknown });`,
      )
      const failed = await next((event) => 'error' in event)
      if (
        !('error' in failed) ||
        !(failed.error instanceof Source.ExtractError)
      )
        throw new Error('Expected source error.')
      expect(failed.error.diagnostics).toMatchInlineSnapshot(`
      [
        {
          "code": "unsupported_syntax",
          "end": 50,
          "message": "Expected a literal string or number; expressions are not evaluated.",
          "source": "example/nested/button.ts",
          "start": 43,
        },
      ]
    `)

      await Fs.writeFile(
        Path.join(root, 'nested/button.ts'),
        source.replace('8px', '2px'),
      )
      await next(
        (event) =>
          'result' in event &&
          event.result.changed.includes('nested/button.ts.css'),
      )
      expect(
        await Fs.readFile(Path.join(outDir, 'nested/button.ts.css'), 'utf8'),
      ).toMatchInlineSnapshot(`
        ".z-1p8gvvx1u7xlwt-base0 {
          padding: 2px;
        }
        "
      `)

      await Fs.rm(Path.join(root, 'nested/button.ts'))
      await next(
        (event) => 'result' in event && event.result.files.length === 0,
      )
      await host.close()
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Host is closed.]`,
      )
      const reopened = await Host.create({ outDir, packageId: 'example', root })
      await reopened.close()
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  }, 15000)

  test('prefixed sources and case-only renames survive rebuilds and reopening', async () => {
    const root = await Fs.mkdtemp(Path.join(project, '.fixture-host-case-'))
    const outDir = Path.join(root, 'output')
    const options = { outDir, packageId: 'example', root }
    let host = await Host.create(options)

    try {
      await Fs.mkdir(Path.join(root, '.zyzz-components'))
      await Fs.writeFile(Path.join(root, '.zyzz.ts'), source)
      await Fs.writeFile(Path.join(root, '.zyzz-components/Button.ts'), source)
      await Fs.writeFile(Path.join(root, 'Plain.ts'), 'export const value = 1')
      await host.build()
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')

      await Fs.rename(
        Path.join(root, '.zyzz-components/Button.ts'),
        Path.join(root, '.zyzz-components/button.ts'),
      )
      await Fs.rename(Path.join(root, 'Plain.ts'), Path.join(root, 'plain.ts'))
      expect((await host.build()).files).toMatchInlineSnapshot(`
      [
        ".zyzz-components/button.ts",
        ".zyzz-components/button.ts.css",
        ".zyzz-components/button.ts.css.map",
        ".zyzz-components/button.ts.map",
        ".zyzz.ts",
        ".zyzz.ts.css",
        ".zyzz.ts.css.map",
        ".zyzz.ts.map",
        "plain.ts",
        "plain.ts.css",
        "plain.ts.css.map",
        "plain.ts.map",
      ]
    `)
      expect(
        await Fs.readFile(Path.join(outDir, 'plain.ts'), 'utf8'),
      ).toMatchInlineSnapshot('"export const value = 1"')
      expect(
        await Fs.readFile(
          Path.join(outDir, '.zyzz-components/button.ts.css'),
          'utf8',
        ),
      ).toMatchInlineSnapshot(`
        ".z-1wk3aow1vo00g4-base0 {
          padding: 8px;
        }
        "
      `)
      if (process.platform === 'darwin') {
        // This CI fixture must exercise a real case-insensitive volume.
        expect(
          await Fs.readFile(Path.join(outDir, 'PLAIN.ts'), 'utf8'),
        ).toMatchInlineSnapshot('"export const value = 1"')
      }

      await host.close()
      host = await Host.create(options)
      expect((await host.build()).changed).toMatchInlineSnapshot('[]')
      await Fs.writeFile(
        Path.join(outDir, '.zyzz-components/button.ts.css'),
        'consumer edit',
      )
      await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Refusing to replace an unowned or modified output: .zyzz-components/button.ts.css]`,
      )
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('benchmark notifications reject real watch errors and time out without an edit', async () => {
    const root = await Fs.mkdtemp(
      Path.join(project, '.fixture-host-notifications-'),
    )
    const host = await Host.create({
      outDir: Path.join(root, 'output'),
      packageId: 'example',
      root,
    })
    const notifications = Watch.create({
      path: 'cards.ts.css',
      timeoutMs: 1000,
    })

    try {
      await Fs.writeFile(Path.join(root, 'cards.ts'), source)
      const initial = notifications.next()
      host.watch({ onResult: notifications.onResult })
      await initial

      await expect(
        notifications.next(() =>
          Fs.writeFile(
            Path.join(root, 'cards.ts'),
            `import { css } from 'zyzz'; css({ padding: unknown });`,
          ),
        ),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: example/cards.ts:43: Expected a literal string or number; expressions are not evaluated.]`,
      )
      await notifications.next(() =>
        Fs.writeFile(Path.join(root, 'cards.ts'), source.replace('8px', '4px')),
      )
      await expect(
        notifications.next(),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Watch build timed out.]`,
      )
    } finally {
      await host.close()
      await Fs.rm(root, { force: true, recursive: true })
    }
  })
})
