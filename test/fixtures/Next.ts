/** Exercises packed Next.js applications and optional native build comparisons. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Net from 'node:net'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import { expect, vi } from 'vite-plus/test'
import * as Font from './AtRuleFont.js'
import * as Library from './Library.js'
import * as VariantLibrary from './VariantLibrary.js'
import * as Watch from './Watch.js'

const exec = Util.promisify(ChildProcess.execFile)

/** Verifies production and development behavior; comparison runs also measure native CSS builds. */
export async function verify(options: verify.Options) {
  const { bundler, cssOutput } = options

  await Fs.access(Path.resolve('dist/default.js.zyzz.json'))

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
      'pnpm',
      ['pack', '--json', '--pack-destination', root],
      { timeout: 30_000 },
    )
    const tarball = JSON.parse(pack.stdout) as { filename: string }
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        tarball.filename,
        'next@16.3.5',
        '@next/mdx@16.3.5',
        '@mdx-js/loader@3.1.1',
        '@mdx-js/react@3.1.1',
        '@types/mdx@2.0.14',
        'react@19.2.4',
        'react-dom@19.2.4',
        'typescript@7.0.2',
        '@types/react@19.2.18',
        '@types/react-dom@19.2.7',
      ],
      { cwd: app, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
    )

    // A dependency symlink back to an ancestor, as a package linked from its
    // own repository, must not break root discovery; the Webpack scenarios
    // keep the plain root so both tracking paths stay covered.
    if (bundler === 'turbopack')
      await Fs.symlink(app, Path.join(app, 'node_modules', 'ancestor'))

    await VariantLibrary.create(app, {
      cssOutput: cssOutput === 'atomic' ? 'grouped' : 'atomic',
      output: 'react',
    })

    await Fs.mkdir(Path.join(app, 'app/other'), { recursive: true })
    await Fs.mkdir(Path.join(app, 'app/stream'), { recursive: true })
    await Fs.writeFile(
      Path.join(app, 'app/probe.ttf'),
      Buffer.from(Font.url.split(',')[1]!, 'base64'),
    )
    const config = `import {Config} from 'zyzz';import {theme as library} from '@acme/theme';export const {style,vars}=Config.create({cssOutput:'${cssOutput}',vars:library});`
    const files = {
      'app/fonts.ts': `import {fontFace,global,layers} from 'zyzz/web';layers(['reset','base']);fontFace({fontFamily:'NextEvidence',src:'url(./probe.ttf)'},{within:['@layer base']});global({'@layer base':{body:{position:'relative'}}});`,
      'app/client.tsx': `'use client';import {useEffect,useState} from 'react';import {style} from '@config';import {variant,packedTheme} from './variants';namespace styles{export const button=style((values:{opacity:number})=>({color:'brand',opacity:values.opacity}))}export default function Client(){const [active,setActive]=useState(false);const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <><div className={packedTheme().className}><div id="packed" {...variant(active)}>Packed</div></div><button data-ready={ready} {...styles.button({opacity:active?0.5:1})} onClick={()=>setActive(!active)}>Toggle</button></>}`,
      'app/variants.ts': `import {cx} from 'zyzz';import {controls} from '@acme/variants';import '@acme/variants/style.css';export {vars as packedTheme} from '@acme/variants';export function variant(active:boolean){return cx(controls.button({size:active?{custom:{padding:'20px'}}:undefined,active,conditions:{wide:{size:'lg'}}}),controls.override())}`,
      'app/config.ts': config,
      'app/content.mdx': `import Content from './mdx-content'\n\n<Content>MDX</Content>\n`,
      'app/mdx-content.tsx': `import {style} from '@config';const content=style({color:'brand'});export default function Content({children}:{children:React.ReactNode}){return <p id="mdx" {...content()}>{children}</p>}`,
      'app/layout.tsx': `import 'next/root-params';import {cx} from 'zyzz';import {style,vars} from '@config';const root=style({color:'brand'});export default function Layout({children}:{children:React.ReactNode}){return <html {...cx(vars({colorScheme:'light'}),root())}><body>{children}</body></html>}`,
      'app/navigation.tsx': `'use client';import Link from 'next/link';import {useEffect,useState} from 'react';export default function Navigation({href,children}:{href:string;children:React.ReactNode}){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <Link data-link-ready={ready} href={href}>{children}</Link>}`,
      'app/other/page.tsx': `import Navigation from '../navigation';export default function Other(){return <Navigation href="/">Back</Navigation>}`,
      'app/page.tsx': `import Content from './content.mdx';import Navigation from './navigation';import {style} from '@config';import Client from './client';import {variants,vars as defaults} from 'zyzz/default';namespace styles{export const heading=style({color:'brand',padding:'md'});export const bundled=variants({variants:{size:{sm:{padding:4,fontFamily:'sans'}}},defaultVariants:{size:'sm'}})}export default function Page(){return <main><Content/><aside id="default-theme" className={defaults().className}><p {...styles.bundled()}>Default</p></aside><h1 {...styles.heading()}>Server</h1><Client/><Navigation href="/other">Other</Navigation></main>}`,
      'app/stream/page.tsx': `import {Suspense} from 'react';import {style} from '@config';export const dynamic='force-dynamic';namespace styles{export const message=style({color:'brand',padding:'md'})}async function Delayed(){await new Promise(resolve=>setTimeout(resolve,500));return <p data-stream="complete" {...styles.message()}>Complete</p>}export default function Page(){return <Suspense fallback={<p data-stream="pending" {...styles.message()}>Pending</p>}><Delayed/></Suspense>}`,
      'instrumentation-client.ts': `performance.mark('client-instrumentation');`,
      'next.config.ts': `import createMDX from '@next/mdx';import {zyzz} from 'zyzz/next';import * as Path from 'node:path';const withMDX=createMDX({});export default zyzz(async()=>withMDX({pageExtensions:['ts','tsx','mdx'],productionBrowserSourceMaps:true,experimental:{cpus:2},turbopack:{root:process.cwd(),resolveAlias:{'@config':'./app/config.ts'}},webpack(config){config.resolve.alias['@config']=Path.resolve('app/config.ts');return config}}), {reset:true});`,
      'mdx-components.tsx': `export function useMDXComponents(){return {}}`,
      'mdx.d.ts': `declare module '*.mdx' {const Content: import('react').ComponentType;export default Content}`,
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
    const started = options.compare ? performance.now() : 0
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

    const candidate = options.compare
      ? {
          milliseconds: performance.now() - started,
          ...(await sizes(Path.join(app, '.next/static'))),
        }
      : undefined

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
    page.on('pageerror', (error) =>
      logs.push(`Browser error: ${error.message}`),
    )
    page.on('console', (message) => {
      if (message.type() === 'error')
        logs.push(`Browser console: ${message.text()}`)
    })
    page.on('requestfailed', (request) =>
      logs.push(
        `Request failed: ${request.url()} ${request.failure()?.errorText}`,
      ),
    )
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
    const serverNode = await page.locator('button[data-ready]').elementHandle()
    resume()
    const response = await navigation
    await page.locator('button[data-ready=true]').waitFor()
    expect(
      await serverNode!.evaluate(
        (element) => element === document.querySelector('button[data-ready]'),
      ),
    ).toMatchInlineSnapshot('true')
    await page.unroute('**/*.js')
    expect(response?.status()).toMatchInlineSnapshot('200')
    expect(
      await page
        .locator('html')
        .evaluate((node) => getComputedStyle(node).color),
    ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
    expect(
      await page
        .locator('html')
        .evaluate((node) => getComputedStyle(node).colorScheme),
    ).toMatchInlineSnapshot('"light"')
    expect(
      await page
        .locator('#mdx')
        .evaluate((node) => getComputedStyle(node).color),
    ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
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
    expect(
      await page
        .locator('body')
        .evaluate((node) => getComputedStyle(node).margin),
    ).toMatchInlineSnapshot('"0px"')
    expect(
      await page
        .locator('body')
        .evaluate((node) => getComputedStyle(node).position),
    ).toMatchInlineSnapshot('"relative"')
    expect(
      await page.evaluate(
        () => performance.getEntriesByName('client-instrumentation').length,
      ),
    ).toMatchInlineSnapshot('1')
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
      await page
        .locator('#default-theme p')
        .evaluate((element) => getComputedStyle(element).padding),
    ).toMatchInlineSnapshot('"16px"')
    expect(
      await page.locator('#default-theme p').evaluate((element) => {
        const control = document.createElement('span')
        control.style.fontFamily =
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
        document.body.append(control)
        const matches =
          getComputedStyle(element).fontFamily ===
          getComputedStyle(control).fontFamily
        control.remove()
        return matches
      }),
    ).toMatchInlineSnapshot('true')
    expect(
      await page.evaluate(
        async () => (await document.fonts.load('16px NextEvidence')).length,
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
    expect(streamed.includes('data-stream="complete"')).toMatchInlineSnapshot(
      'true',
    )
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
    await page.evaluate('window.packedNode=document.querySelector("#packed")')
    const classes = await page
      .locator('button[data-ready]')
      .getAttribute('class')
    await page.locator('button[data-ready=true]').click()
    await page.waitForFunction(
      () => {
        const element = document.querySelector('button[data-ready]')
        return element !== null && getComputedStyle(element).opacity === '0.5'
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
    await Fs.writeFile(
      Path.join(app, 'app/content.mdx'),
      files['app/content.mdx'].replace('>MDX<', '>Updated MDX<'),
    )
    await page.waitForFunction(
      () => document.querySelector('#mdx')?.textContent === 'Updated MDX',
      undefined,
      { timeout: 30_000 },
    )
    expect(await page.locator('#mdx').textContent()).toMatchInlineSnapshot(
      '"Updated MDX"',
    )
    expect(
      await page
        .locator('#mdx')
        .evaluate((node) => getComputedStyle(node).color),
    ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
    await page.locator('button[data-ready=true]').click()
    await page.waitForFunction(
      () => {
        const element = document.querySelector('button[data-ready]')
        return element !== null && getComputedStyle(element).opacity === '0.5'
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
        "padding:'md',backgroundColor:'[red]'",
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
    const changedConfig = (color: string, mode = cssOutput) =>
      `import {Config,Vars} from 'zyzz';import {theme as library} from '@acme/theme';const changed=Vars.extend(library,{color:{brand:{light:${JSON.stringify(color)},dark:'#9cf'}}});export const {style,vars}=Config.create({cssOutput:'${mode}',vars:changed});`
    await Fs.writeFile(Path.join(app, 'app/config.ts'), changedConfig('#c00'))
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
    for (const mode of [
      cssOutput === 'atomic' ? 'grouped' : 'atomic',
      cssOutput,
    ] as const) {
      await Watch.write({
        path: Path.join(app, 'app/config.ts'),
        source: changedConfig('#c00', mode),
      })
      await page.waitForFunction(
        (grouped) => {
          const heading = document.querySelector('main > h1')
          if (!heading) return false
          const rules = [...document.styleSheets]
            .flatMap((sheet) => [...sheet.cssRules])
            .filter(
              (rule): rule is CSSStyleRule =>
                rule instanceof CSSStyleRule &&
                heading.matches(rule.selectorText) &&
                Boolean(rule.style.padding),
            )
          return (
            rules.length > 0 &&
            rules.every((rule) => Boolean(rule.style.color) === grouped)
          )
        },
        mode === 'grouped',
        { timeout: 30_000 },
      )
      expect(
        await page
          .locator('main > h1')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(204, 0, 0)"')
      expect(
        await page
          .locator('button[data-ready]')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot('"0.5"')
    }

    const relocated = Path.join(app, 'app/relocated.ts')
    await Watch.write({ path: relocated, source: changedConfig('#609') })
    await Watch.write({
      path: Path.join(app, 'app/config.ts'),
      source: "export * from './relocated'",
    })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('main > h1')!).color ===
        'rgb(102, 0, 153)',
      undefined,
      { timeout: 30_000 },
    )
    expect(
      await page
        .locator('button[data-ready]')
        .evaluate((element) => getComputedStyle(element).opacity),
    ).toMatchInlineSnapshot('"0.5"')
    await Watch.write({
      path: Path.join(app, 'app/config.ts'),
      source: changedConfig('#c00'),
    })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('main > h1')!).color ===
        'rgb(204, 0, 0)',
      undefined,
      { timeout: 30_000 },
    )
    await Fs.rm(relocated)

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
    await Watch.write({
      path: Path.join(app, 'app/config.ts'),
      source: changedConfig('#0a0'),
    })
    await page
      .waitForFunction(
        () =>
          getComputedStyle(document.querySelector('main > h1')!).color ===
          'rgb(0, 170, 0)',
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
    ).toMatchInlineSnapshot('"rgb(0, 170, 0)"')

    const added = Path.join(app, 'app/cache-added')
    await Fs.mkdir(added)
    await Watch.write({
      path: Path.join(added, 'global.ts'),
      source:
        "import {global} from 'zyzz/web';global({':root':{'--cache-probe':'first'}})",
    })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--cache-probe',
        ) === 'first',
      undefined,
      { timeout: 30_000 },
    )
    await Watch.write({
      path: Path.join(added, 'global.ts'),
      source:
        "import {global} from 'zyzz/web';global({':root':{'--cache-probe':'other'}})",
    })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--cache-probe',
        ) === 'other',
      undefined,
      { timeout: 30_000 },
    )
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--cache-probe',
        ),
      ),
    ).toMatchInlineSnapshot('"other"')
    await Fs.rm(added, { recursive: true })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--cache-probe',
        ) === '',
      undefined,
      { timeout: 30_000 },
    )
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--cache-probe',
        ),
      ),
    ).toMatchInlineSnapshot('""')

    development.child.kill('SIGTERM')
    await new Promise<void>((resolve) =>
      development.child.once('exit', () => resolve()),
    )

    if (!options.compare) return

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
        async () => (await document.fonts.load('16px NextEvidence')).length,
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
}

export declare namespace verify {
  /** Selects the real bundler, CSS emitter, and optional build comparison. */
  type Options = {
    /** Next.js production and development bundler. */
    bundler: 'turbopack' | 'webpack'
    /** Runs a native CSS comparison build and writes benchmark results. */
    compare?: boolean
    /** CSS emitter used by the application and packed library. */
    cssOutput: 'atomic' | 'grouped'
  }
}

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
