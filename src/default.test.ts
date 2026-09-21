/** Verifies the default configuration through an actual package archive and independent Vite consumer. @module */
import * as ChildProcess from 'node:child_process'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { beforeAll, describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

const exec = Util.promisify(ChildProcess.execFile)

describe('default', () => {
  beforeAll(async () => {
    // The integration command builds once before workers consume package artifacts.
    await Fs.access(Path.resolve('dist/default.js.zyzz.json'))
    await Fs.access(Path.resolve('dist/default.d.ts'))
  })

  test.each([{ conditions: [] }, { conditions: ['src'] }])(
    'renders packed defaults with conditions %j',
    async ({ conditions }) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-default-theme-'))
      try {
        const packed = await exec('npm', [
          'pack',
          '--ignore-scripts',
          '--offline',
          '--json',
          '--pack-destination',
          root,
        ])
        const archive = (
          JSON.parse(packed.stdout) as { filename: string }[]
        )[0]!
        const installed = Path.join(root, 'node_modules/zyzz')
        await Fs.mkdir(installed, { recursive: true })
        await exec('tar', [
          '-xf',
          Path.join(root, archive.filename),
          '-C',
          installed,
          '--strip-components=1',
        ])
        await Fs.access(Path.join(installed, 'dist/default.d.ts'))
        await Fs.writeFile(
          Path.join(root, 'package.json'),
          '{"private":true,"type":"module"}',
        )
        const initialization = await exec(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            "import { script } from 'zyzz/default'; process.stdout.write(script())",
          ],
          { cwd: root },
        )
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          `<head><script>${initialization.stdout}</script><script>document.documentElement.dataset.restoredScheme=document.documentElement.style.colorScheme</script></head><body><main><button>Button</button></main><script type="module" src="/app.ts"></script></body>`,
        )
        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          `import {appearance,variants,vars} from 'zyzz/default';
        namespace styles {
          export const button=variants({conditions:{wide:'@media >=md'},base:{typography:'button.14',color:'blue.500'},variants:{size:{sm:{padding:4},custom:(values:{padding:\`\${number}px\`})=>({padding:\`[\${values.padding}]\` as const})}},defaultVariants:{size:'sm'}});
        }
        document.querySelector('main')!.className=vars().className;
        const props=styles.button({conditions:{wide:{size:{custom:{padding:'24px'}}}}});
        const element=document.querySelector('button')!;
        element.className=props.className;
        element.onclick=()=>{
          appearance.set({colorScheme:'dark'});
          element.dataset.scheme=appearance.get().colorScheme;
        };
        for(const [key,value] of Object.entries(props)) {
          if(key.startsWith('data-')) element.setAttribute(key,String(value));
          if(key==='style') for(const [name,bound] of Object.entries(value!)) element.style.setProperty(name,String(bound));
        }`,
        )
        const types = Path.join(root, 'types.ts')
        await Fs.writeFile(
          types,
          `import {appearance,script,variants} from 'zyzz/default';
const initialization: string = script();
appearance.set({colorScheme:'dark'});
// @ts-expect-error The default config has no named theme catalog.
appearance.set({set:'other'});
const button=variants({base:{typography:'button.14'},variants:{size:{sm:{padding:4},custom:(values:{padding:\`\${number}px\`})=>({padding:\`[\${values.padding}]\` as const})}}});
button({size:{custom:{padding:'12px'}}});
// @ts-expect-error Dynamic choices require complete scoped payloads.
button({size:'custom'});
// @ts-expect-error Unknown bundled color.
variants({base:{color:'missing'}});`,
        )
        await exec(process.execPath, [
          Path.resolve('node_modules/typescript/bin/tsc'),
          '--ignoreConfig',
          '--module',
          'nodenext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          '--noEmit',
          types,
        ])
        await Fs.rm(types)

        const config: Vite.InlineConfig = {
          configFile: false,
          logLevel: 'silent',
          plugins: [zyzz()],
          root,
          resolve: { conditions },
          server: { host: '127.0.0.1', port: 0 },
        }
        const build = await Vite.build(config)
        if (Array.isArray(build) || !('output' in build))
          throw new Error('Expected a Vite build')
        const scripts = build.output
          .filter((entry) => entry.type === 'chunk')
          .map((entry) => entry.code)
          .join('\n')
        expect(scripts.includes('Vars.define')).toMatchInlineSnapshot('false')
        expect(scripts.includes('#99ceff')).toMatchInlineSnapshot('false')
        expect(scripts.includes('#0a4380')).toMatchInlineSnapshot('false')
        const server = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
        let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
        try {
          browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox'],
          })
          const page = await browser.newPage({
            viewport: { width: 500, height: 800 },
          })
          await page.goto(server.resolvedUrls!.local[0]!)
          await page.waitForFunction(
            "getComputedStyle(document.querySelector('button')).padding === '16px'",
          )
          expect(
            await page
              .locator('button')
              .evaluate((element) =>
                getComputedStyle(element).fontFamily.replace(
                  '"system-ui"',
                  'BlinkMacSystemFont',
                ),
              ),
          ).toMatchInlineSnapshot(
            `"Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji""`,
          )
          expect(
            await page
              .locator('button')
              .evaluate((element) => getComputedStyle(element).fontSize),
          ).toMatchInlineSnapshot(`"14px"`)
          expect(
            await page
              .locator('button')
              .evaluate((element) => getComputedStyle(element).lineHeight),
          ).toMatchInlineSnapshot(`"20px"`)
          expect(
            await page
              .locator('button')
              .evaluate((element) => getComputedStyle(element).fontWeight),
          ).toMatchInlineSnapshot(`"500"`)
          expect(
            await page
              .locator('button')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot(`"rgb(153, 206, 255)"`)
          await page.locator('button').click()
          expect(
            await page.locator('button').getAttribute('data-scheme'),
          ).toMatchInlineSnapshot(`"dark"`)
          expect(
            await page
              .locator('button')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot(`"rgb(10, 67, 128)"`)
          await page.reload()
          await page.waitForFunction(
            "getComputedStyle(document.querySelector('button')).color === 'rgb(10, 67, 128)'",
          )
          expect(
            await page.locator('html').getAttribute('data-restored-scheme'),
          ).toMatchInlineSnapshot(`"dark"`)
          await page.setViewportSize({ width: 900, height: 800 })
          await page.waitForFunction(
            "getComputedStyle(document.querySelector('button')).padding === '24px'",
          )
        } finally {
          await browser?.close()
          await new Promise<void>((resolve, reject) =>
            server.httpServer.close((error) =>
              error ? reject(error) : resolve(),
            ),
          )
        }

        const bundled = await Esbuild.build({
          stdin: {
            contents: "export {variants} from 'zyzz'",
            resolveDir: root,
          },
          bundle: true,
          write: false,
          metafile: true,
        })
        expect(
          Object.keys(bundled.metafile!.inputs).some((name) =>
            /(?:^|[/\\])(?:src|dist)[/\\]default\.[cm]?[jt]s$/.test(name),
          ),
        ).toMatchInlineSnapshot('false')
        expect(
          JSON.parse(
            await Fs.readFile(
              Path.join(installed, 'dist/default.js.zyzz.json'),
              'utf8',
            ),
          ).version,
        ).toMatchInlineSnapshot('26')
        expect(
          (
            await Fs.readFile(
              Path.join(installed, 'dist/themes/LICENSE.tailwind'),
              'utf8',
            )
          ).includes('MIT'),
        ).toMatchInlineSnapshot('true')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    120_000,
  )
})
