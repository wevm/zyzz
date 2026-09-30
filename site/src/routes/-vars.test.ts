/** Exercises the variables route through HTTP and server-rendered output. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import LZString from 'lz-string'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'

const origin = 'http://localhost:3136'
let server: ChildProcess.ChildProcess

beforeAll(async () => {
  server = ChildProcess.spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'dev', '--port', '3136', '--strictPort'],
    {
      cwd: new URL('../..', import.meta.url),
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
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(output)
    try {
      if ((await fetch(`${origin}/vars`)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Variables site did not start. ${output}`)
}, 60000)

afterAll(() => {
  if (server?.pid && server.exitCode === null)
    process.kill(-server.pid, 'SIGTERM')
})

async function page(config?: unknown, compressed = false) {
  const url = new URL('/vars', origin)
  if (config !== undefined) {
    const json = JSON.stringify(config)
    url.searchParams.set(
      'v',
      compressed ? `lz:${LZString.compressToEncodedURIComponent(json)}` : json,
    )
  }
  const response = await fetch(url)
  expect(response.status).toMatchInlineSnapshot('200')
  return response.text()
}

describe('/vars', () => {
  test('renders defaults and the named compressed Tempo config', async () => {
    const defaults = await page()
    expect(defaults.includes('vars.fontSize.xs')).toMatchInlineSnapshot('true')

    const tempo = JSON.parse(
      Fs.readFileSync(
        new URL('../../../test/fixtures/vars/tempo.json', import.meta.url),
        'utf8',
      ),
    )
    const html = await page({ ...tempo, name: 'Tempo.xyz' }, true)
    expect(html.includes('Tempo.xyz')).toMatchInlineSnapshot('true')
    expect(html.includes('font-size:56px')).toMatchInlineSnapshot('true')
    expect(html.includes('repeat(12, 1fr)')).toMatchInlineSnapshot('true')
    expect(html.includes('Zyzz home')).toMatchInlineSnapshot('false')
    const unicode = await page(
      { name: 'Témṕo 🌍', vars: { color: { ink: '#000' } } },
      true,
    )
    expect(unicode.includes('Témṕo 🌍')).toMatchInlineSnapshot('true')
  })

  test('merges sibling media and container typography blocks', async () => {
    const html = await page({
      typography: {
        heading: {
          fontSize: '24px',
          fontFamily: 'sans-serif',
          lineHeight: '28px',
          '@media >=tablet': { fontSize: '40px' },
          '@container sidebar (min-width: 20rem)': { lineHeight: '48px' },
        },
      },
    })
    expect(
      html.includes('font-size:40px;font-family:sans-serif;line-height:28px'),
    ).toMatchInlineSnapshot('true')
    expect(
      html.includes('font-size:24px;font-family:sans-serif;line-height:48px'),
    ).toMatchInlineSnapshot('true')
    expect(
      html.includes('vars.typography.heading[&quot;@media'),
    ).toMatchInlineSnapshot('false')
  })

  test('retains scalar siblings and authored responsive token references', async () => {
    const html = await page({
      components: { button: { fontSize: '14px', padding: '8px' } },
      spacing: { sm: { default: '8px', '@media (min-width: 48rem)': '16px' } },
    })
    expect(
      html.includes('vars.components.button.padding'),
    ).toMatchInlineSnapshot('true')
    expect(html.includes('vars.spacing.sm.default')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.spacing.sm[&quot;@media')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.spacing.sm')).toMatchInlineSnapshot('true')
    expect(html.includes('16px')).toMatchInlineSnapshot('true')
  })

  test('accepts container metadata and raw vars categories without discarding siblings', async () => {
    const html = await page({
      containerNames: ['sidebar'],
      vars: { brand: 'red' },
      color: { ink: '#123456' },
    })
    expect(html.includes('Could not read variables')).toMatchInlineSnapshot(
      'false',
    )
    expect(html.includes('vars.vars.brand')).toMatchInlineSnapshot('true')
    expect(html.includes('#123456')).toMatchInlineSnapshot('true')
    expect(html.includes('vars.containerNames')).toMatchInlineSnapshot('false')
  })

  test('renders swatches in mixed groups and avoids comparing different units', async () => {
    const html = await page({
      semantic: { brand: '#0072f5', gap: '8px' },
      breakpoint: { sm: '768px', lg: '64rem' },
    })
    expect(html.includes('background-color:#0072f5')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('width:8.333')).toMatchInlineSnapshot('false')
    expect(html.includes('64rem')).toMatchInlineSnapshot('true')
  })

  test('uses mappings and preserves light/dark previews', async () => {
    const html = await page({
      vars: {
        paint: { brand: { light: '#fff', dark: '#000' } },
        corners: { sm: '6px' },
      },
      mappings: { paint: ['color'], corners: ['borderRadius'] },
    })
    expect(html.includes('light-dark(#fff, #000)')).toMatchInlineSnapshot(
      'true',
    )
    expect(html.includes('border-radius:6px')).toMatchInlineSnapshot('true')
  })

  test('rejects non-finite JSON numbers and renders finite numeric typography', async () => {
    const url = new URL('/vars', origin)
    url.searchParams.set(
      'v',
      `lz:${LZString.compressToEncodedURIComponent('{"weight":{"bad":1e309}}')}`,
    )
    const html = await (await fetch(url)).text()
    expect(
      html.includes('Variable numbers must be finite.'),
    ).toMatchInlineSnapshot('true')

    const valid = await page({
      typography: {
        body: {
          fontSize: 16,
          fontWeight: 'bold',
          lineHeight: 1.5,
          letterSpacing: 0,
        },
      },
    })
    expect(
      valid.includes(
        'font-size:16px;font-weight:bold;letter-spacing:0;line-height:1.5',
      ),
    ).toMatchInlineSnapshot('true')
    expect(
      valid.includes('vars.typography.body.fontWeight'),
    ).toMatchInlineSnapshot('true')
  })

  test('renders inherited category names and uses unique accessible IDs', async () => {
    const html = await page({
      toString: { small: '8px' },
      valueOf: { big: '16px' },
      'brand colors': { ink: '#123456' },
      'brand-colors': { ink: '#654321' },
      'brand colors-heading': { ink: '#abcdef' },
    })
    expect(html.includes('vars.toString.small')).toMatchInlineSnapshot('true')
    expect(html.includes('vars.valueOf.big')).toMatchInlineSnapshot('true')
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.some((id) => /\s/.test(id!))).toMatchInlineSnapshot('false')
    expect(new Set(ids).size === ids.length).toMatchInlineSnapshot('true')
    const labels = [...html.matchAll(/ aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(labels.length).toMatchInlineSnapshot('5')
    expect(labels.every((label) => ids.includes(label))).toMatchInlineSnapshot(
      'true',
    )
  })

  test('bounds mappings and renders large mapped and conditional groups', async () => {
    const invalid = await page(
      {
        vars: { space: { sm: '8px' } },
        mappings: { space: Array(257).fill('padding') },
      },
      true,
    )
    expect(
      invalid.includes('at most 256 properties each'),
    ).toMatchInlineSnapshot('true')

    const html = await page(
      {
        vars: {
          space: Object.fromEntries(
            Array.from({ length: 1000 }, (_, index) => [`s${index}`, '8px']),
          ),
          typography: {
            heading: {
              fontSize: '24px',
              ...Object.fromEntries(
                Array.from({ length: 1000 }, (_, index) => [
                  `@media (min-width: ${index}px)`,
                  { lineHeight: 1.5 },
                ]),
              ),
            },
          },
        },
        mappings: { space: ['padding', ...Array(255).fill('unknown')] },
      },
      true,
    )
    expect(html.includes('vars.space.s999')).toMatchInlineSnapshot('true')
    expect(html.includes('@media (min-width: 999px)')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      (html.match(/title="vars.typography.heading"/g) ?? []).length,
    ).toMatchInlineSnapshot('1001')
  })

  test('rejects invalid and oversized compressed configurations at the route', async () => {
    for (const config of [
      null,
      { vars: [] },
      { vars: {}, name: 42 },
      { spacing: ['8px'] },
    ]) {
      const html = await page(config)
      expect(html.includes('Could not read variables')).toMatchInlineSnapshot(
        'true',
      )
    }
    const html = await page({ text: 'x'.repeat(2000000) }, true)
    expect(
      html.includes('The decompressed configuration is too large.'),
    ).toMatchInlineSnapshot('true')
  })
})
