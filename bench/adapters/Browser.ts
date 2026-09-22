/** Measures time to computed styles, with document and input state retained. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Net from 'node:net'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { zyzz } from 'zyzz/vite'
const { create, pack } = (await import(
  new URL('./Corpus.ts', import.meta.url).href
)) as typeof import('./Corpus.js')

const adapter = process.argv[2]!
const count = Number(process.env.ADAPTER_COMPONENTS ?? 96)
const root = await Fs.mkdtemp(Path.resolve('.fixture-adapter-browser-'))
const files = create(count)
const require = createRequire(import.meta.url)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('response', (response) => {
  if (response.status() >= 400)
    errors.push(response.status() + ' ' + response.url())
})
let close: (() => Promise<unknown>) | undefined
let log = ''
const timings: Record<string, number> = {}
async function write(name: string, source: string) {
  await Fs.writeFile(Path.join(root, name + '.tmp'), source)
  await Fs.rename(Path.join(root, name + '.tmp'), Path.join(root, name))
}
try {
  await Fs.mkdir(Path.join(root, 'node_modules'))
  await Fs.symlink(
    Path.resolve('.'),
    Path.join(root, 'node_modules/zyzz'),
    'dir',
  )
  for (const name of ['next', 'react', 'react-dom'])
    await Fs.symlink(
      Path.dirname(require.resolve(name + '/package.json')),
      Path.join(root, 'node_modules', name),
      'dir',
    )
  await pack(root)
  for (const [name, source] of Object.entries(files))
    await Fs.writeFile(Path.join(root, name), source)
  await Fs.writeFile(
    Path.join(root, 'package.json'),
    JSON.stringify({ type: 'module', private: true }),
  )
  let url: string
  const started = performance.now()
  if (adapter === 'vite') {
    await Fs.writeFile(
      Path.join(root, 'index.html'),
      '<input id="state"><main id="scope"><div id="cards"></div></main><script type="module" src="/main.mjs"></script>',
    )
    await Fs.writeFile(
      Path.join(root, 'main.mjs'),
      `import {render} from './entry.mjs';import {vars} from './config.mjs';function draw(){document.querySelector('#scope').className=vars().className;document.querySelector('#cards').innerHTML=render().map((x,i)=>'<div id="card'+i+'" class="'+x.container.className+'">'+x.label+'</div>').join('')}draw();if(import.meta.hot)import.meta.hot.accept(()=>draw())`,
    )
    const server = await createServer({
      configFile: false,
      root,
      logLevel: 'error',
      plugins: [zyzz()],
      server: { host: '127.0.0.1', port: 0 },
    })
    close = () => server.close()
    await server.listen()
    url = server.resolvedUrls!.local[0]!
  } else {
    await Fs.mkdir(Path.join(root, 'app'))
    await Fs.writeFile(
      Path.join(root, 'app/layout.js'),
      `import {createElement as h} from 'react';export default function Layout({children}){return h('html',null,h('body',null,children))}`,
    )
    await Fs.writeFile(
      Path.join(root, 'app/page.js'),
      `import {createElement as h} from 'react';import {render} from '../entry.mjs';import {vars} from '../config.mjs';export default function Page(){return h('main',vars(),h('input',{id:'state'}),...render().map((x,i)=>h('div',{...x.container,id:'card'+i,key:i},x.label)))}`,
    )
    await Fs.writeFile(
      Path.join(root, 'next.config.mjs'),
      `import {zyzz} from 'zyzz/next';export default zyzz({turbopack:{root:${JSON.stringify(Path.resolve('.'))}},experimental:{cpus:2}})`,
    )
    const socket = Net.createServer()
    await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve))
    const port = (socket.address() as Net.AddressInfo).port
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => (error ? reject(error) : resolve())),
    )
    const child = spawn(
      process.execPath,
      [
        require.resolve('next/dist/bin/next'),
        'dev',
        ...(adapter === 'next-webpack' ? ['--webpack'] : []),
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    child.stdout.on('data', (data) => (log += data))
    child.stderr.on('data', (data) => (log += data))
    close = async () => {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) =>
        child.exitCode !== null
          ? resolve()
          : child.once('exit', () => resolve()),
      )
    }
    await wait(() => log.includes('Ready in'), 30_000)
    url = `http://127.0.0.1:${port}`
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.locator('#card0').waitFor({ timeout: 30_000 })
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('#card0')!).color ===
      'rgb(255, 0, 0)',
  )
  if (
    (await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).outlineWidth)) !== '7px'
  )
    throw Error('Missing packed library styles')
  timings.cold = performance.now() - started
  await page.waitForLoadState('networkidle')
  await page.locator('#state').fill('preserved')
  await page.evaluate(() => Object.assign(window, { __workloadSentinel: true }))
  for (const [name, file, source, property, value] of [
    [
      'style',
      'component0.mjs',
      files['component0.mjs']!.replace('opacity:1', 'opacity:0.5'),
      'opacity',
      '0.5',
    ],
    [
      'token',
      'tokens.mjs',
      files['tokens.mjs']!.replace("'red'", "'blue'"),
      'color',
      'rgb(0, 0, 255)',
    ],
  ] as const) {
    const start = performance.now()
    await write(file, source)
    await page.waitForFunction(
      ({ property, value }) =>
        getComputedStyle(document.querySelector('#card0')!).getPropertyValue(
          property,
        ) === value,
      { property, value },
      { timeout: 60_000 },
    )
    timings[name] = performance.now() - start
    if (
      !(await page.evaluate(() => Reflect.get(window, '__workloadSentinel'))) ||
      (await page.locator('#state').inputValue()) !== 'preserved'
    )
      throw Error(`${adapter} reloaded or lost state`)
  }
  if (errors.length) throw Error(errors.join('\n'))
  process.stdout.write(JSON.stringify({ adapter, count, timings }))
} catch (error) {
  process.stderr.write(log + JSON.stringify(errors) + (await page.content()))
  throw error
} finally {
  await browser.close()
  await close?.()
  await Fs.rm(root, { recursive: true, force: true })
}
async function wait(condition: () => boolean, timeout: number) {
  const start = performance.now()
  while (!condition()) {
    if (performance.now() - start > timeout)
      throw Error('Server readiness timeout')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
