/** Exercises page metadata through server-rendered HTML for crawlers. @module */
import * as ChildProcess from 'node:child_process'
import LZString from 'lz-string'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:3171'
let server: ChildProcess.ChildProcess

beforeAll(async () => {
  server = ChildProcess.spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'dev', '--port', '3171', '--strictPort'],
    {
      cwd: new URL('..', import.meta.url),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  server.stdout?.on('data', (data) => {
    output += data
  })
  server.stderr?.on('data', (data) => {
    output += data
  })
  for (let attempt = 0; attempt < 480; attempt++) {
    if (server.exitCode !== null) throw new Error(output)
    try {
      if ((await fetch(origin)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Site did not start. ${output}`)
}, 150000)

afterAll(() => {
  if (server?.pid && server.exitCode === null)
    process.kill(-server.pid, 'SIGTERM')
})

/** Reads a page as Googlebot and returns the tags crawlers index. */
async function head(path: string) {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'user-agent': 'Googlebot/2.1' },
    redirect: 'manual',
  })
  const html = await response.text()
  const tags = html.slice(0, html.indexOf('</head>'))

  return {
    canonical: tags.match(/<link href="([^"]*)" rel="canonical"/)?.[1],
    description: tags.match(/<meta content="([^"]*)" name="description"/)?.[1],
    jsonLd: tags.match(/<script type="application\/ld\+json">([^<]*)/)?.[1],
    location: response.headers.get('location'),
    ogUrl: tags.match(/<meta content="([^"]*)" property="og:url"/)?.[1],
    status: response.status,
    title: tags.match(/<title>([^<]*)<\/title>/)?.[1],
  }
}

describe('page', () => {
  test('names the home page and its site', async () => {
    const page = await head('/')

    expect(page.status).toMatchInlineSnapshot('200')
    expect(page.title).toMatchInlineSnapshot(
      '"Zyzz · Type-safe styling for Web and React Native"',
    )
    expect(page.canonical).toMatchInlineSnapshot('"https://zyzz.style/"')
    expect(page.ogUrl).toMatchInlineSnapshot('"https://zyzz.style/"')
    expect(page.jsonLd).toMatchInlineSnapshot(
      `"{"@context":"https://schema.org","@type":"WebSite","name":"Zyzz","url":"https://zyzz.style/"}"`,
    )
  })

  test('serves documentation pages at one canonical address', async () => {
    const page = await head('/docs/api/react-native/defineConfig')
    const custom = await head('/docs/introduction/getting-started?mode=custom')
    const defaults = await head(
      '/docs/introduction/getting-started?mode=default',
    )

    expect(page.status).toMatchInlineSnapshot('200')
    expect(page.title).toMatchInlineSnapshot(
      '"defineConfig · React Native API · Zyzz"',
    )
    expect(page.canonical).toMatchInlineSnapshot(
      '"https://zyzz.style/docs/api/react-native/defineConfig"',
    )

    expect(custom.status).toMatchInlineSnapshot('200')
    expect(custom.canonical).toMatchInlineSnapshot(
      '"https://zyzz.style/docs/introduction/getting-started"',
    )

    expect(defaults.location).toMatchInlineSnapshot(
      '"/docs/introduction/getting-started"',
    )
  })

  test('points shared variable configurations at the default variables', async () => {
    // Shared links carry configurations compressed behind an `lz:` prefix.
    const page = await head(
      `/vars?v=lz:${LZString.compressToEncodedURIComponent('{}')}`,
    )

    expect(page.status).toMatchInlineSnapshot('200')
    expect(page.title).toMatchInlineSnapshot('"Variables · Zyzz"')
    expect(page.description).toMatchInlineSnapshot(
      '"Browse the Zyzz default theme variables, from colors and spacing to typography, shadows, and easing."',
    )
    expect(page.canonical).toMatchInlineSnapshot('"https://zyzz.style/vars"')
  })
})
