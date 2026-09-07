import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { build, createServer, type ViteDevServer } from 'vite'
import { typestyle } from './Vite.js'

const directories: string[] = []
const servers: ViteDevServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(
    directories
      .splice(0)
      .map((path) => Fs.rm(path, { recursive: true, force: true })),
  )
})

async function fixture() {
  const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-'))
  directories.push(root)
  await Fs.writeFile(
    Path.join(root, 'index.html'),
    '<script type="module" src="/main.ts"></script>',
  )
  await Fs.writeFile(
    Path.join(root, 'main.ts'),
    `import {css} from 'typestyle'; document.body.className = css({padding:4, color:'gray.1000'});`,
  )
  return root
}

describe('typestyle', () => {
  it('extracts real production CSS and removes the macro from JavaScript', async () => {
    const root = await fixture()
    const output = await build({
      root,
      configFile: false,
      plugins: [typestyle()],
      logLevel: 'silent',
      build: { write: false, minify: false },
    })
    const bundles = Array.isArray(output)
      ? output
      : 'output' in output
        ? [output]
        : []
    const items = bundles.flatMap((bundle) => bundle.output)
    const css = items.find(
      (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
    )
    expect(css?.type === 'asset' && css.source).toContain('padding:1rem')
    const javascript = items
      .filter((item) => item.type === 'chunk')
      .map((item) => item.code)
      .join('\n')
    expect(javascript).not.toContain('css() must be compiled')
    expect(javascript).not.toContain('typestyle')
    expect(javascript).toContain('cp_')
  })

  it.each([
    {
      label: 'updates CSS',
      code: `import {css} from 'typestyle'; document.body.className = css({padding:8});`,
      expected: 'padding:2rem',
    },
    {
      label: 'removes the final style',
      code: `document.body.className = '';`,
      expected: '',
    },
  ])(
    '$label through a real dev server',
    async ({ code, expected }) => {
      const root = await fixture()
      const server = await createServer({
        root,
        configFile: false,
        plugins: [typestyle()],
        logLevel: 'silent',
        server: { port: 0 },
        optimizeDeps: { noDiscovery: true },
      })
      servers.push(server)
      await server.listen()
      const initial = await server.transformRequest('/main.ts')
      const imported = initial?.code.match(
        /import\s+["']([^"']*virtual:typestyle:[^"']+)["']/,
      )?.[1]
      expect(imported).toBeDefined()
      const cssUrl = new URL(imported!, server.resolvedUrls!.local[0]!).href
      const readCss = async () => {
        const response = await fetch(cssUrl)
        if (!response.ok) throw new Error(await response.text())
        return response.text()
      }
      expect(await readCss()).toContain('padding:1rem')
      const event = new Promise<void>((resolve) => {
        server.watcher.once('change', () => resolve())
      })
      await Fs.writeFile(Path.join(root, 'main.ts'), code)
      await event
      await expect
        .poll(readCss, { timeout: 5000 })
        .not.toContain('padding:1rem')
      if (expected) expect(await readCss()).toContain(expected)
    },
    15000,
  )
})
