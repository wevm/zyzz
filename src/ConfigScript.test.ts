/** Exercises compiled appearance scripts through package linking and a real browser origin. @module */
import * as Crypto from 'node:crypto'
import * as Esbuild from 'esbuild'
import * as Http from 'node:http'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import * as React from 'react'
import * as ReactDom from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('create', () => {
  test('rejects script destructuring from legacy and selection contracts', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({defaultTheme:'base',themes:{base:{}}});export const select=config.themes;`,
      },
    })
    const data = JSON.parse(library.contracts['config.ts']!)
    delete data.exports.config.script
    const errors = [
      `import {config} from 'lib';const {script}=config;script()`,
      `import {select} from 'lib';const {script}=select;script()`,
    ].map((source) => {
      try {
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(data) },
          imports: { 'app.js': { lib: 'lib.js' } },
          modules: { 'app.js': source },
        })
        return 'accepted'
      } catch (error) {
        return error
      }
    })
    expect(errors).toMatchInlineSnapshot(`
      [
        [Source.ExtractError: app.js:34: This configuration helper is not available on the linked contract.],
        [Source.ExtractError: app.js:34: This configuration helper is not available on the linked contract.],
      ]
    `)
  })
  test('omits unavailable script methods from legacy alias declarations', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({theme:{color:{ink:'red'}}});`,
      },
    })
    const data = JSON.parse(library.contracts['config.ts']!)
    data.version = 2
    delete data.exports.config.script
    const app = Graph.compile({
      contracts: { 'lib.js': JSON.stringify(data) },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {config} from 'lib';export const alias=config;`,
      },
    })
    expect(
      app.modules['app.ts']!.code.includes("key extends 'script'"),
    ).toMatchInlineSnapshot('true')
  })
  test('keeps css-only packed exports compatible with earlier contract readers', () => {
    const graph = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {css}=Config.create({});`,
      },
    })
    const contract = JSON.parse(graph.contracts['config.ts']!)
    expect(contract.version).toMatchInlineSnapshot('2')
    expect(Object.hasOwn(contract.exports.css, 'script')).toMatchInlineSnapshot(
      'false',
    )
  })
  test('omits initialization from static configured styles', () => {
    for (const options of [
      '{}',
      "{theme:{color:{ink:'#123456'}}}",
      "{defaultTheme:'base',themes:{base:{color:{ink:'#123456'}}}}",
    ]) {
      const graph = Graph.compile({
        modules: {
          'app.ts': `import {Config} from 'zyzz';const {css}=Config.create(${options});export const styles={card:css({width:'10px'})};`,
        },
      })
      expect(
        graph.modules['app.ts']!.code.includes('Appearance'),
      ).toMatchInlineSnapshot('false')
      expect(
        graph.modules['app.ts']!.code.includes('script:'),
      ).toMatchInlineSnapshot('false')
    }
  })
  test('rejects script calls on old packed configurations', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({});`,
      },
    })
    const old = JSON.parse(library.contracts['config.ts']!)
    old.version = 3
    delete old.exports.config.script
    expect(() =>
      Graph.compile({
        contracts: { 'library/index.js': JSON.stringify(old) },
        imports: { 'app.ts': { library: 'library/index.js' } },
        modules: {
          'app.ts': `import {config} from 'library';export const source=config.script();`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:51: This packed configuration does not provide script(); rebuild its library with initialization support.]`,
    )
    const current = Graph.compile({
      contracts: { 'library/index.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { library: 'library/index.js' } },
      modules: {
        'app.ts': `import {config} from 'library';export const source=config.script();`,
      },
    })
    expect(
      current.modules['app.ts']!.code.includes('config.script()'),
    ).toMatchInlineSnapshot('true')
  })
  for (const config of [
    '{}',
    "{theme:{color:{ink:'#123456'}}}",
    "{defaultTheme:'base',themes:{base:{color:{ink:'#123456'}},constructor:{color:{ink:'#008844'}}}}",
  ]) {
    test(`exports a server-safe packed script for ${config}`, async () => {
      const library = Graph.compile({
        modules: {
          'config.ts': `import {Config} from 'zyzz'; export const {script}=Config.create(${config});`,
          'index.ts': `export {script as restore} from './config.js';`,
        },
      })
      const app = Graph.compile({
        contracts: { 'library/index.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { library: 'library/index.js' } },
        modules: {
          'app.ts': `import {restore} from 'library';export const source=restore({storageKey:'</script><script>bad()</script>\\u2028'});`,
        },
      })
      const bundle = await Esbuild.build({
        entryPoints: ['app.ts'],
        bundle: true,
        format: 'iife',
        globalName: 'Fixture',
        write: false,
        alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
        plugins: [
          {
            name: 'compiled',
            setup(build) {
              build.onResolve(
                { filter: /^(app\.ts|library|\.\/config\.js)$/ },
                (args) => ({
                  path:
                    args.path === 'library'
                      ? 'index.ts'
                      : args.path === './config.js'
                        ? 'config.ts'
                        : args.path,
                  namespace: 'compiled',
                }),
              )
              build.onLoad({ filter: /.*/, namespace: 'compiled' }, (args) => ({
                contents: (app.modules[args.path] ??
                  library.modules[args.path])!.code,
                loader: 'ts',
                resolveDir: process.cwd(),
              }))
            },
          },
        ],
      })
      const source = (
        Vm.runInNewContext(`${bundle.outputFiles[0]!.text};Fixture;`) as {
          source: string
        }
      ).source
      expect(source.includes('</script>')).toMatchInlineSnapshot('false')
      expect(source.includes('\\u003c/script\\u003e')).toMatchInlineSnapshot(
        'true',
      )
      expect(source.includes('\u2028')).toMatchInlineSnapshot('false')
      expect(source.includes('#123456')).toMatchInlineSnapshot('false')
      expect(source.includes('localStorage.setItem')).toMatchInlineSnapshot(
        'false',
      )
      expect(typeof new Vm.Script(source)).toMatchInlineSnapshot('"object"')
    })
  }
  test('restores each valid field before body parsing under CSP and preserves server defaults', async () => {
    const graph = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {script,themes}=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'#123456'}},constructor:{color:{ink:'#008844'}}}});export const initial=themes({theme:'base'});export const saved=themes({theme:'constructor'});`,
      },
    })
    const bundle = await Esbuild.build({
      stdin: {
        contents: graph.modules['config.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })
    const compiled = Vm.runInNewContext(
      `${bundle.outputFiles[0]!.text};Fixture;`,
    ) as {
      script: () => string
      initial: { className: string }
      saved: { className: string }
    }
    const script = compiled.script()
    const hash = Crypto.createHash('sha256').update(script).digest('base64')
    const markup = `<!doctype html><html class="external ${compiled.initial.className}" style="color-scheme:light;--external:keep"><head><script>${script}</script><script nonce="fixture">document.documentElement.dataset.beforeBody=document.body===null?'yes':'no'</script></head><body><button id="control">Appearance</button></body></html>`
    const server = Http.createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html')
      if (request.url === '/app')
        response.setHeader(
          'Content-Security-Policy',
          `script-src 'sha256-${hash}' 'nonce-fixture'`,
        )
      response.end(
        request.url === '/app' ? markup : '<!doctype html><body>setup</body>',
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${address.port}/setup`)
      for (const [saved, theme, scheme] of [
        [
          JSON.stringify({ theme: 'constructor', colorScheme: 'dark' }),
          compiled.saved.className,
          'dark',
        ],
        [
          JSON.stringify({ theme: 'missing', colorScheme: 'dark' }),
          compiled.initial.className,
          'dark',
        ],
        [
          JSON.stringify({ theme: 'constructor', colorScheme: 'invalid' }),
          compiled.saved.className,
          'light',
        ],
        ['null', compiled.initial.className, 'light'],
        ['[]', compiled.initial.className, 'light'],
        ['{', compiled.initial.className, 'light'],
      ]) {
        await page.evaluate(
          (value) => localStorage.setItem('zyzz', value!),
          saved,
        )
        await page.goto(`http://127.0.0.1:${address.port}/app`)
        expect(
          (await page.locator('html').getAttribute('class')) ===
            `external ${theme}`,
        ).toMatchInlineSnapshot('true')
        expect(
          (await page.evaluate(
            () => document.documentElement.style.colorScheme,
          )) === scheme,
        ).toMatchInlineSnapshot('true')
        expect(
          await page.locator('html').getAttribute('data-before-body'),
        ).toMatchInlineSnapshot('"yes"')
        expect(
          await page.evaluate(() =>
            document.documentElement.style.getPropertyValue('--external'),
          ),
        ).toMatchInlineSnapshot('"keep"')
      }
      await page.goto(`data:text/html,${encodeURIComponent(markup)}`)
      expect(
        await page.evaluate(() => document.documentElement.style.colorScheme),
      ).toMatchInlineSnapshot('"light"')
    } finally {
      await browser?.close()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  }, 15000)
  test('hydrates server markup after synchronous restoration without replacing nodes', async () => {
    const graph = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {script}=Config.create();`,
      },
    })
    const compiled = await Esbuild.build({
      stdin: {
        contents: graph.modules['config.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })
    const script = (
      Vm.runInNewContext(`${compiled.outputFiles[0]!.text};Fixture;`) as {
        script: () => string
      }
    ).script()
    const client = await Esbuild.build({
      stdin: {
        contents: `import {createElement,useEffect} from 'react';import {hydrateRoot} from 'react-dom/client';function App(){useEffect(()=>{window.restored=document.documentElement.style.colorScheme;window.ready=true},[]);return createElement('button',{id:'control',onClick:()=>document.documentElement.style.colorScheme='light'},'Appearance')}window.errors=[];hydrateRoot(document.getElementById('app'),createElement(App),{onRecoverableError:error=>window.errors.push(error.message)});`,
        loader: 'js',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'iife',
      write: false,
    })
    const body = ReactDom.renderToString(
      React.createElement('button', { id: 'control' }, 'Appearance'),
    )
    const markup = `<!doctype html><html style="color-scheme:light"><head><script>${script}</script></head><body><div id="app">${body}</div><script>window.original=document.getElementById('control')</script><script defer src="/client.js"></script></body></html>`
    const server = Http.createServer((request, response) => {
      response.setHeader(
        'Content-Type',
        request.url === '/client.js' ? 'text/javascript' : 'text/html',
      )
      response.end(
        request.url === '/client.js'
          ? client.outputFiles[0]!.text
          : request.url === '/app'
            ? markup
            : '<!doctype html><body>setup</body>',
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`http://127.0.0.1:${address.port}/setup`)
      await page.evaluate(() =>
        localStorage.setItem('zyzz', JSON.stringify({ colorScheme: 'dark' })),
      )
      await page.goto(`http://127.0.0.1:${address.port}/app`)
      await page.waitForFunction('window.ready === true', undefined, {
        timeout: 5000,
      })
      expect(await page.evaluate('window.restored')).toMatchInlineSnapshot(
        '"dark"',
      )
      expect(
        await page.evaluate(
          'window.original === document.getElementById("control")',
        ),
      ).toMatchInlineSnapshot('true')
      expect(await page.evaluate('window.errors')).toMatchInlineSnapshot('[]')
      await page.locator('#control').click()
      expect(
        await page.evaluate(() => document.documentElement.style.colorScheme),
      ).toMatchInlineSnapshot('"light"')
    } finally {
      await browser?.close()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  }, 15000)
})
