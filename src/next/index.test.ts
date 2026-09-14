/** Exercises packed Next.js applications through both production bundlers and real browser updates. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Net from 'node:net'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import { beforeAll, describe, expect, test, vi } from 'vite-plus/test'
import * as Font from '../../test/fixtures/AtRuleFont.js'
import * as Library from '../../test/fixtures/Library.js'
import * as VariantLibrary from '../../test/fixtures/VariantLibrary.js'

const exec = Util.promisify(ChildProcess.execFile)

describe('zyzz', () => {
  beforeAll(async () => {
    // The integration command builds once before workers consume package artifacts.
    await Fs.access(Path.resolve('dist/themes/default.js.zyzz.json'))
  })

  for (const cssOutput of ['atomic', 'grouped'] as const)
    for (const bundler of ['webpack', 'turbopack']) {
      test(`builds and updates a packed Next.js ${bundler} ${cssOutput} application`, async () => {
        const root = await Fs.mkdtemp(Path.resolve('.fixture-next-'))
        const children: ChildProcess.ChildProcess[] = []
        const logs: string[] = []
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        const browser = await chromium.launch(
          executablePath ? { executablePath } : {},
        )
        try {
          const app = await Library.create(root)
          const pack = await exec(
            'npm',
            [
              'pack',
              '--ignore-scripts',
              '--offline',
              '--json',
              '--pack-destination',
              root,
            ],
            { timeout: 30_000 },
          )
          const [tarball] = JSON.parse(pack.stdout) as { filename: string }[]
          await exec(
            'npm',
            [
              'install',
              '--ignore-scripts',
              '--no-audit',
              '--no-fund',
              '--package-lock=false',
              Path.join(root, tarball!.filename),
              'next@16.3.5',
              'react@19.2.4',
              'react-dom@19.2.4',
              'typescript@5.9.3',
              '@types/react@19.2.18',
              '@types/react-dom@19.2.7',
            ],
            { cwd: app, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
          )

          await VariantLibrary.create(app, {
            output: 'react',
            cssOutput: cssOutput === 'atomic' ? 'grouped' : 'atomic',
          })

          await Fs.mkdir(Path.join(app, 'app/other'), { recursive: true })
          await Fs.mkdir(Path.join(app, 'app/stream'), { recursive: true })
          await Fs.writeFile(
            Path.join(app, 'app/probe.ttf'),
            Buffer.from(Font.url.split(',')[1]!, 'base64'),
          )
          const config = `import {Config} from 'zyzz';import {theme as library} from '@acme/theme';export const {css,theme}=Config.create({cssOutput:'${cssOutput}',theme:library});`
          const files = {
            'app/fonts.ts': `import {fontFace} from 'zyzz/web';fontFace({fontFamily:'NextEvidence',src:'url(./probe.ttf)'});`,
            'app/client.tsx': `'use client';import {useEffect,useState} from 'react';import {css} from '@config';import {variant,packedTheme} from './variants';namespace styles{export const button=css((values:{opacity:number})=>({color:'brand',opacity:values.opacity}))}export default function Client(){const [active,setActive]=useState(false);const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <><div className={packedTheme.className}><div id="packed" {...variant(active)}>Packed</div></div><button data-ready={ready} {...styles.button({opacity:active?0.5:1})} onClick={()=>setActive(!active)}>Toggle</button></>}`,
            'app/variants.ts': `import {cx} from 'zyzz';import {controls} from '@acme/variants';import '@acme/variants/style.css';export {theme as packedTheme} from '@acme/variants';export function variant(active:boolean){return cx(controls.button({size:active?{custom:{padding:'20px'}}:undefined,active,conditions:{wide:{size:'lg'}}}),controls.override())}`,
            'app/config.ts': config,
            'app/layout.tsx': `import {theme} from '@config';export default function Layout({children}:{children:React.ReactNode}){return <html className={theme.className}><body>{children}</body></html>}`,
            'app/navigation.tsx': `'use client';import Link from 'next/link';import {useEffect,useState} from 'react';export default function Navigation({href,children}:{href:string;children:React.ReactNode}){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <Link data-link-ready={ready} href={href}>{children}</Link>}`,
            'app/other/page.tsx': `import Navigation from '../navigation';export default function Other(){return <Navigation href="/">Back</Navigation>}`,
            'app/page.tsx': `import Navigation from './navigation';import {css} from '@config';import Client from './client';import {variants,theme as defaults} from 'zyzz/themes/default';namespace styles{export const heading=css({color:'brand',padding:'md'});export const bundled=variants({variants:{size:{sm:{padding:4,fontFamily:'sans'}}},defaultVariants:{size:'sm'}})}export default function Page(){return <main><aside id="default-theme" className={defaults.className}><p {...styles.bundled()}>Default</p></aside><h1 {...styles.heading()}>Server</h1><Client/><Navigation href="/other">Other</Navigation></main>}`,
            'app/stream/page.tsx': `import {Suspense} from 'react';import {css} from '@config';export const dynamic='force-dynamic';namespace styles{export const message=css({color:'brand',padding:'md'})}async function Delayed(){await new Promise(resolve=>setTimeout(resolve,500));return <p data-stream="complete" {...styles.message()}>Complete</p>}export default function Page(){return <Suspense fallback={<p data-stream="pending" {...styles.message()}>Pending</p>}><Delayed/></Suspense>}`,
            'next.config.ts': `import {zyzz} from 'zyzz/next';import * as Path from 'node:path';export default zyzz(async()=>({productionBrowserSourceMaps:true,experimental:{cpus:2},turbopack:{root:process.cwd(),resolveAlias:{'@config':'./app/config.ts'}},webpack(config){config.resolve.alias['@config']=Path.resolve('app/config.ts');return config}}));`,
            'tsconfig.json': JSON.stringify({
              compilerOptions: {
                exactOptionalPropertyTypes: true,
                jsx: 'react-jsx',
                module: 'esnext',
                moduleResolution: 'bundler',
                noEmit: true,
                skipLibCheck: true,
                strict: true,
                target: 'esnext',
                paths: { '@config': ['./app/config.ts'] },
              },
              include: ['**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
              exclude: ['node_modules'],
            }),
          }
          for (const [file, content] of Object.entries(files))
            await Fs.writeFile(Path.join(app, file), content)

          const next = Path.join(app, 'node_modules/next/dist/bin/next')
          const started = performance.now()
          const build = await exec(
            process.execPath,
            [next, 'build', `--${bundler}`],
            {
              cwd: app,
              env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
              timeout: 120_000,
              maxBuffer: 4 * 1024 * 1024,
            },
          ).catch((error) => {
            throw new Error(error.stdout + '\n' + error.stderr)
          })
          expect(
            build.stdout.includes('Compiled successfully'),
          ).toMatchInlineSnapshot('true')

          const maps = (
            await Fs.readdir(Path.join(app, '.next/static'), {
              recursive: true,
            })
          ).filter((file) => file.endsWith('.js.map'))
          const contents = await Promise.all(
            maps.map((file) =>
              Fs.readFile(Path.join(app, '.next/static', file), 'utf8'),
            ),
          )
          const traced = contents.some((content) => {
            const map = new Trace.TraceMap(JSON.parse(content))
            let found = false
            Trace.eachMapping(map, (mapping) => {
              if (!mapping.source || mapping.originalColumn === null) return
              const source = Trace.sourceContentFor(map, mapping.source)
              const start = source?.indexOf('cx(controls.button') ?? -1
              if (
                start >= 0 &&
                mapping.originalLine === 1 &&
                mapping.originalColumn >= start &&
                mapping.originalColumn <= start + 3
              )
                found = true
            })
            return found
          })
          expect(traced).toMatchInlineSnapshot('true')

          const candidate = {
            milliseconds: performance.now() - started,
            ...(await sizes(Path.join(app, '.next/static'))),
          }

          async function start(mode: 'dev' | 'start') {
            const reservation = Net.createServer()
            await new Promise<void>((resolve) =>
              reservation.listen(0, '127.0.0.1', resolve),
            )
            const port = (reservation.address() as Net.AddressInfo).port
            await new Promise<void>((resolve, reject) =>
              reservation.close((error) => (error ? reject(error) : resolve())),
            )
            const child = ChildProcess.spawn(
              process.execPath,
              [
                next,
                mode,
                ...(mode === 'dev' ? [`--${bundler}`] : []),
                '--hostname',
                '127.0.0.1',
                '--port',
                String(port),
              ],
              {
                cwd: app,
                env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
                stdio: ['ignore', 'pipe', 'pipe'],
              },
            )
            children.push(child)
            let log = ''
            child.stdout!.on('data', (chunk: Buffer) => {
              log += chunk.toString()
              logs.push(chunk.toString())
            })
            child.stderr!.on('data', (chunk: Buffer) => {
              log += chunk.toString()
              logs.push(chunk.toString())
            })
            await vi.waitFor(
              () => {
                if (!log.includes('Ready in'))
                  throw new Error(log || 'Waiting for Next.js')
              },
              { timeout: 30_000 },
            )
            return { child, log: () => log, url: `http://127.0.0.1:${port}` }
          }

          const production = await start('start')
          const page = await browser.newPage()
          let resume!: () => void
          const scripts = new Promise<void>((resolve) => {
            resume = resolve
          })
          await page.route('**/*.js', async (route) => {
            await scripts
            await route.continue()
          })
          const navigation = page.goto(production.url)
          await page.locator('button[data-ready=false]').waitFor()
          const serverNode = await page
            .locator('button[data-ready]')
            .elementHandle()
          resume()
          const response = await navigation
          await page.locator('button[data-ready=true]').waitFor()
          expect(
            await serverNode!.evaluate(
              (element) =>
                element === document.querySelector('button[data-ready]'),
            ),
          ).toMatchInlineSnapshot('true')
          await page.unroute('**/*.js')
          expect(response?.status()).toMatchInlineSnapshot('200')
          await Fs.mkdir('test-results', { recursive: true })
          await Fs.writeFile(
            `test-results/next-${bundler}-styles.json`,
            JSON.stringify(
              await page.evaluate(() => ({
                html: document.documentElement.outerHTML,
                sheets: [...document.styleSheets].map((sheet) => ({
                  href: sheet.href,
                  css: [...sheet.cssRules].map((rule) => rule.cssText),
                })),
              })),
              null,
              2,
            ),
          )
          expect(
            (await response!.text()).includes('class="z-'),
          ).toMatchInlineSnapshot('true')
          await page.waitForFunction(
            () => {
              const element = document.querySelector('h1')
              return (
                element !== null &&
                getComputedStyle(element).color === 'rgb(0, 102, 204)'
              )
            },
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).padding),
          ).toMatchInlineSnapshot('"8px"')
          expect(
            await page.locator('#default-theme p').evaluate((element) => ({
              padding: getComputedStyle(element).padding,
              font: getComputedStyle(element).fontFamily,
            })),
          ).toEqual({
            padding: '16px',
            font: 'Geist, ui-sans-serif, system-ui, sans-serif',
          })
          expect(
            await page.evaluate(
              async () =>
                (await document.fonts.load('16px NextEvidence')).length,
            ),
          ).toMatchInlineSnapshot('1')
          await page.evaluate(() => {
            document.documentElement.style.colorScheme = 'dark'
          })
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(153, 204, 255)"')
          await page.evaluate(() => {
            document.documentElement.style.removeProperty('color-scheme')
          })
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')

          const stream = await fetch(`${production.url}/stream`)
          const reader = stream.body!.getReader()
          let streamed = ''
          let pendingBeforeComplete = false
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) break
            streamed += new TextDecoder().decode(chunk.value)
            if (
              streamed.includes('data-stream="pending"') &&
              !streamed.includes('data-stream="complete"')
            )
              pendingBeforeComplete = true
          }
          expect(pendingBeforeComplete).toMatchInlineSnapshot('true')
          expect(
            streamed.includes('data-stream="complete"'),
          ).toMatchInlineSnapshot('true')
          const streamedPage = await browser.newPage()
          await streamedPage.goto(`${production.url}/stream`)
          await streamedPage.locator('[data-stream=complete]').waitFor()
          expect(
            await streamedPage
              .locator('[data-stream=complete]')
              .evaluate((element) => ({
                color: getComputedStyle(element).color,
                padding: getComputedStyle(element).padding,
              })),
          ).toMatchInlineSnapshot(`
          {
            "color": "rgb(0, 102, 204)",
            "padding": "8px",
          }
        `)
          await streamedPage.close()

          await page.setViewportSize({ width: 450, height: 700 })
          expect(
            await page
              .locator('#packed')
              .evaluate((element) => getComputedStyle(element).paddingRight),
          ).toMatchInlineSnapshot('"4px"')
          await page.evaluate(
            'window.packedNode=document.querySelector("#packed")',
          )
          const classes = await page
            .locator('button[data-ready]')
            .getAttribute('class')
          await page.locator('button[data-ready=true]').click()
          await page.waitForFunction(
            () => {
              const element = document.querySelector('button[data-ready]')
              return (
                element !== null && getComputedStyle(element).opacity === '0.5'
              )
            },
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('button[data-ready]')
              .evaluate((element) => getComputedStyle(element).opacity),
          ).toMatchInlineSnapshot('"0.5"')
          expect(
            (await page.locator('button[data-ready]').getAttribute('class')) ===
              classes,
          ).toMatchInlineSnapshot('true')
          expect(
            await page
              .locator('#packed')
              .evaluate((element) => getComputedStyle(element).paddingRight),
          ).toMatchInlineSnapshot('"20px"')
          expect(
            await page.evaluate(
              'window.packedNode===document.querySelector("#packed")',
            ),
          ).toMatchInlineSnapshot('true')
          await page.setViewportSize({ width: 900, height: 700 })
          expect(
            await page
              .locator('#packed')
              .evaluate((element) => getComputedStyle(element).paddingRight),
          ).toMatchInlineSnapshot('"12px"')
          await page.setViewportSize({ width: 450, height: 700 })
          await page.locator('a[data-link-ready=true][href="/other"]').click()
          await page.waitForURL(`${production.url}/other`)
          await page.locator('a[data-link-ready=true][href="/"]').click()
          await page.waitForURL(`${production.url}/`)
          await page.waitForFunction(
            () => {
              const element = document.querySelector('h1')
              return (
                element !== null &&
                getComputedStyle(element).color === 'rgb(0, 102, 204)'
              )
            },
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
          production.child.kill('SIGTERM')
          await new Promise<void>((resolve) =>
            production.child.once('exit', () => resolve()),
          )

          const development = await start('dev')
          await page.goto(development.url)
          await page.locator('button[data-ready=true]').click()
          await page.waitForFunction(
            () => {
              const element = document.querySelector('button[data-ready]')
              return (
                element !== null && getComputedStyle(element).opacity === '0.5'
              )
            },
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('button[data-ready]')
              .evaluate((element) => getComputedStyle(element).opacity),
          ).toMatchInlineSnapshot('"0.5"')
          await Fs.writeFile(
            Path.join(app, 'app/page.tsx'),
            files['app/page.tsx'].replace(
              "padding:'md'",
              "padding:'md',backgroundColor:'red'",
            ),
          )
          await page.waitForFunction(
            () => {
              const element = document.querySelector('h1')
              return (
                element !== null &&
                getComputedStyle(element).backgroundColor === 'rgb(255, 0, 0)'
              )
            },
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).backgroundColor),
          ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
          expect(
            await page
              .locator('button[data-ready]')
              .evaluate((element) => getComputedStyle(element).opacity),
          ).toMatchInlineSnapshot('"0.5"')
          const changedConfig = (color: string) =>
            `import {Config,Theme} from 'zyzz';import {theme as library} from '@acme/theme';const changed=Theme.extend(library,{color:{brand:{light:${JSON.stringify(color)},dark:'#9cf'}}});export const {css,theme}=Config.create({cssOutput:'${cssOutput}',theme:changed});`
          await Fs.writeFile(
            Path.join(app, 'app/config.ts'),
            changedConfig('#c00'),
          )
          await page
            .waitForFunction(
              () =>
                getComputedStyle(document.querySelector('main > h1')!).color ===
                'rgb(204, 0, 0)',
              undefined,
              { timeout: 30_000 },
            )
            .catch((error) => {
              throw new Error(error.message + '\n' + development.log())
            })
          expect(
            await page
              .locator('main > h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(204, 0, 0)"')
          await Fs.writeFile(
            Path.join(app, 'app/broken.ts'),
            `import {global} from 'zyzz/web';declare function unknownColor(): 'red';global({body:{color:unknownColor()}});`,
          )
          await vi.waitFor(
            () => {
              if (!development.log().includes('broken.ts'))
                throw new Error('Waiting for source diagnostic')
            },
            { timeout: 30_000 },
          )
          expect(development.log().includes('broken.ts')).toMatchInlineSnapshot(
            'true',
          )
          await Fs.rm(Path.join(app, 'app/broken.ts'))
          await Fs.writeFile(
            Path.join(app, 'app/config.ts'),
            changedConfig('#0a0'),
          )
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector('main > h1')!).color ===
              'rgb(0, 170, 0)',
            undefined,
            { timeout: 30_000 },
          )
          expect(
            await page
              .locator('main > h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 170, 0)"')

          development.child.kill('SIGTERM')
          await new Promise<void>((resolve) =>
            development.child.once('exit', () => resolve()),
          )

          if (cssOutput === 'atomic') return

          await Fs.writeFile(
            Path.join(app, 'next.config.ts'),
            `export default {experimental:{cpus:2,lightningCssFeatures:{exclude:['light-dark']}},turbopack:{root:process.cwd()}};`,
          )
          await Fs.writeFile(
            Path.join(app, 'app/layout.tsx'),
            `import './native.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}`,
          )
          await Fs.writeFile(
            Path.join(app, 'app/native.css'),
            `@font-face{font-family:NextEvidence;src:url(./probe.ttf)}:root{--brand:light-dark(#06c,#9cf);--space:8px}.heading{color:var(--brand);padding:var(--space)}.button{color:var(--brand);opacity:var(--opacity)}.packed{color:var(--brand);padding:2px;opacity:.5}.packed[data-size=sm]{padding:4px}.packed[data-size=custom]{padding:var(--padding)}.packed[data-active=true]{opacity:1;border:3px solid}@media(min-width:600px){.packed{padding:12px}}.packed{padding-left:3px}`,
          )
          await Fs.writeFile(
            Path.join(app, 'app/page.tsx'),
            `import Navigation from './navigation';import Client from './client';export default function Page(){return <main><h1 className="heading">Server</h1><Client/><Navigation href="/other">Other</Navigation></main>}`,
          )
          await Fs.writeFile(
            Path.join(app, 'app/client.tsx'),
            `'use client';import {useEffect,useState} from 'react';export default function Client(){const [active,setActive]=useState(false);const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <><div id="packed" className="packed" data-size={active?'custom':'sm'} data-active={active} style={active?{'--padding':'20px'} as React.CSSProperties:undefined}>Packed</div><button data-ready={ready} className="button" style={{'--opacity':active?0.5:1} as React.CSSProperties} onClick={()=>setActive(!active)}>Toggle</button></>}`,
          )
          await Fs.writeFile(
            Path.join(app, 'app/stream/page.tsx'),
            `import {Suspense} from 'react';export const dynamic='force-dynamic';async function Delayed(){await new Promise(resolve=>setTimeout(resolve,500));return <p data-stream="complete" className="heading">Complete</p>}export default function Page(){return <Suspense fallback={<p data-stream="pending" className="heading">Pending</p>}><Delayed/></Suspense>}`,
          )
          await Fs.rm(Path.join(app, '.next'), { recursive: true, force: true })
          await Fs.rm(Path.join(app, 'tsconfig.tsbuildinfo'), { force: true })
          expect(
            await Fs.access(Path.join(app, 'app/broken.ts')).then(
              () => true,
              () => false,
            ),
          ).toMatchInlineSnapshot('false')
          const nativeStarted = performance.now()
          await exec(process.execPath, [next, 'build', `--${bundler}`], {
            cwd: app,
            env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
            timeout: 120_000,
            maxBuffer: 4 * 1024 * 1024,
          }).catch((error) => {
            throw new Error(error.stdout + '\n' + error.stderr)
          })
          const native = {
            milliseconds: performance.now() - nativeStarted,
            ...(await sizes(Path.join(app, '.next/static'))),
          }
          const control = await start('start')
          await page.goto(control.url)
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
          expect(
            await page
              .locator('h1')
              .evaluate((element) => getComputedStyle(element).padding),
          ).toMatchInlineSnapshot('"8px"')
          expect(
            await page.evaluate(
              async () =>
                (await document.fonts.load('16px NextEvidence')).length,
            ),
          ).toMatchInlineSnapshot('1')
          await page.locator('button[data-ready=true]').click()
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector('button[data-ready]')!)
                .opacity === '0.5',
          )
          expect(
            await page
              .locator('button[data-ready]')
              .evaluate((element) => getComputedStyle(element).opacity),
          ).toMatchInlineSnapshot('"0.5"')
          await Fs.mkdir('bench/results', { recursive: true })
          await Fs.writeFile(
            `bench/results/next-${bundler}-${cssOutput}.json`,
            JSON.stringify(
              {
                candidate,
                cssOutput,
                native,
                next: '16.3.5',
                node: process.version,
                scope:
                  'One cold build per implementation on the same runner; all route CSS/JavaScript files, compressed separately. Browser correctness is outside timing. Timing is informational.',
              },
              null,
              2,
            ),
          )
        } catch (error) {
          await Fs.mkdir('test-results', { recursive: true })
          const pages = await Promise.allSettled(
            browser
              .contexts()
              .flatMap((context) => context.pages())
              .map(async (page) => ({
                html: await page.content(),
                url: page.url(),
              })),
          )
          await Fs.writeFile(
            `test-results/next-${bundler}-${cssOutput}-failure.json`,
            JSON.stringify({ error: String(error), logs, pages }, null, 2),
          )
          throw error
        } finally {
          for (const child of children) {
            if (child.exitCode === null && child.signalCode === null) {
              child.kill('SIGTERM')
              await new Promise<void>((resolve) =>
                child.once('exit', () => resolve()),
              )
            }
          }
          await browser.close()
          await Fs.rm(root, { recursive: true, force: true })
        }
      }, 300_000)
    }
})

async function sizes(directory: string) {
  const result = { brotli: 0, css: 0, gzip: 0, javascript: 0 }
  for (const entry of await Fs.readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !/\.(css|js)$/.test(entry.name)) continue
    const content = await Fs.readFile(Path.join(entry.parentPath, entry.name))
    result[entry.name.endsWith('.css') ? 'css' : 'javascript'] += content.length
    result.brotli += Zlib.brotliCompressSync(content).length
    result.gzip += Zlib.gzipSync(content).length
  }
  return result
}
