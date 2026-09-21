/** Exercises Metro bundling and imported style edits through the published Expo adapter. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Net from 'node:net'
import * as Path from 'node:path'
import * as Url from 'node:url'
import { describe, expect, test } from 'vite-plus/test'

const require = Module.createRequire(
  Path.resolve('examples/react-native/package.json'),
)
const expo = require.resolve('expo/bin/cli')

describe('zyzz', () => {
  test('invalidates source-mode caches when compiler implementation changes', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-metro-cache-'))
    try {
      const library = Path.join(root, 'library')
      const app = Path.join(root, 'app')
      await Fs.mkdir(app)
      await Fs.cp(Path.resolve('src'), library, { recursive: true })
      const entry = Path.join(library, 'metro/transformer.mjs')
      await Esbuild.build({
        bundle: true,
        entryPoints: ['src/metro/transformer.ts'],
        format: 'esm',
        outfile: entry,
        packages: 'external',
        platform: 'node',
      })
      const { create } = await import(Url.pathToFileURL(entry).href)
      const transformer = create(
        require.resolve('@expo/metro-config/babel-transformer'),
        {
          root: app,
        },
      )
      const before = transformer.getCacheKey()
      expect(transformer.getCacheKey() === before).toMatchInlineSnapshot(`true`)

      await Fs.appendFile(
        Path.join(library, 'compiler/Native.test.ts'),
        '\n// Test-only edit.\n',
      )
      expect(transformer.getCacheKey() === before).toMatchInlineSnapshot(`true`)

      await Fs.appendFile(
        Path.join(library, 'compiler/Native.ts'),
        '\n// Compiler implementation edit.\n',
      )
      expect(transformer.getCacheKey() === before).toMatchInlineSnapshot(
        `false`,
      )
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('bundles each platform and recompiles imported styles after edits and errors', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-metro-'))
    let child: ChildProcess.ChildProcess | undefined
    let logs = ''
    try {
      await Fs.symlink(
        Path.resolve('examples/react-native/node_modules'),
        Path.join(root, 'node_modules'),
        'dir',
      )
      await Fs.writeFile(
        Path.join(root, 'package.json'),
        JSON.stringify({
          name: 'metro-fixture',
          private: true,
          type: 'module',
          main: 'index.ts',
        }),
      )
      await Fs.writeFile(
        Path.join(root, 'app.json'),
        JSON.stringify({
          expo: { name: 'Metro fixture', slug: 'metro-fixture' },
        }),
      )
      await Fs.writeFile(
        Path.join(root, 'metro.config.ts'),
        `import { getDefaultConfig } from 'expo/metro-config.js'; import { zyzz } from 'zyzz/metro'; export default zyzz(getDefaultConfig(import.meta.dirname), { units: { px: 1 } });`,
      )
      await Fs.writeFile(
        Path.join(root, 'index.ts'),
        `import { box } from './Style'; console.log(box());`,
      )
      const source = (width: number) =>
        `import { style } from './Theme'; export const box = style({ color: 'ink', width: '${width}px', targets: { ios: { opacity: 0.123 }, android: { opacity: 0.456 } } });`
      const theme = (color: string) =>
        `import {Config} from 'zyzz'; export const {style} = Config.create({vars:{base:{color:{ink:{light:'${color}',dark:'#abcdef'}}},alternate:{color:{ink:{light:'#123abc',dark:'#456def'}}}},defaultVars:'base'});`
      await Fs.writeFile(Path.join(root, 'Theme.ts'), theme('#112233'))
      await Fs.writeFile(Path.join(root, 'Style.ts'), source(123))

      const socket = Net.createServer()
      socket.listen(0, '127.0.0.1')
      await new Promise<void>((resolve) => socket.once('listening', resolve))
      const address = socket.address()
      if (!address || typeof address === 'string')
        throw new Error('No fixture port.')
      const port = address.port
      await new Promise<void>((resolve, reject) =>
        socket.close((error) => (error ? reject(error) : resolve())),
      )
      async function start() {
        logs = ''
        const server = ChildProcess.spawn(
          process.execPath,
          [
            expo,
            'start',
            '--localhost',
            '--port',
            String(port),
            '--max-workers',
            '1',
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              CI: 'false',
              EXPO_NO_TELEMETRY: '1',
              NODE_ENV: 'development',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        )
        child = server
        server.stdout!.on('data', (data) => {
          logs += data.toString()
        })
        server.stderr!.on('data', (data) => {
          logs += data.toString()
        })
        const deadline = Date.now() + 60_000
        while (true) {
          const ready = await fetch(`http://localhost:${port}/status`).then(
            (response) => response.ok,
            () => false,
          )
          if (ready) break
          if (server.exitCode !== null || Date.now() > deadline)
            throw new Error(logs)
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        return server
      }
      child = await start()

      async function bundle(
        platform: string,
        expected?: (result: { ok: boolean; text: string }) => boolean,
      ) {
        const deadline = Date.now() + 15_000
        while (true) {
          const response = await fetch(
            `http://localhost:${port}/index.bundle?platform=${platform}&dev=true&minify=false`,
            { signal: AbortSignal.timeout(60_000) },
          )
          const result = { ok: response.ok, text: await response.text() }
          if (!expected || expected(result) || Date.now() > deadline)
            return result
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      const [ios, android] = await Promise.all([
        bundle('ios'),
        bundle('android'),
      ])
      if (!ios.ok || !android.ok)
        throw new Error(`${ios.text}\n${android.text}`)
      expect(ios.text.includes('"width": 123')).toMatchInlineSnapshot(`true`)
      expect(ios.text.includes('"opacity": 0.123')).toMatchInlineSnapshot(
        `true`,
      )
      expect(android.text.includes('"opacity": 0.456')).toMatchInlineSnapshot(
        `true`,
      )

      expect(ios.text.includes('#112233')).toBe(true)
      expect(ios.text.includes('#456def')).toBe(true)
      await Fs.writeFile(Path.join(root, 'Theme.ts'), theme('#332211'))
      const themed = await bundle('ios', (result) =>
        result.text.includes('"color": "#332211"'),
      )
      expect(themed.ok).toBe(true)
      expect(themed.text.includes('"color": "#332211"')).toBe(true)
      expect(themed.text.includes('"color": "#112233"')).toBe(false)
      await Fs.writeFile(Path.join(root, 'Style.ts'), source(321))
      const changed = await bundle('ios', (result) =>
        result.text.includes('"width": 321'),
      )
      expect(changed.ok).toMatchInlineSnapshot(`true`)
      expect(changed.text.includes('"width": 321')).toMatchInlineSnapshot(
        `true`,
      )
      expect(changed.text.includes('"width": 123')).toMatchInlineSnapshot(
        `false`,
      )

      await Fs.writeFile(
        Path.join(root, 'Style.ts'),
        `import { style } from 'zyzz'; export const box = style({ selectors: { '&:hover': { opacity: 0.5 } } });`,
      )
      const invalid = await bundle('ios', (result) => !result.ok)
      expect(invalid.ok).toMatchInlineSnapshot(`false`)
      expect(
        invalid.text.includes(
          'Selectors, queries, and nested rules are not supported on native.',
        ),
      ).toMatchInlineSnapshot(`true`)

      await Fs.writeFile(Path.join(root, 'Style.ts'), source(456))
      const recovered = await bundle('ios', (result) =>
        result.text.includes('"width": 456'),
      )
      expect(recovered.ok).toMatchInlineSnapshot(`true`)
      expect(recovered.text.includes('"width": 456')).toMatchInlineSnapshot(
        `true`,
      )

      child.kill('SIGTERM')
      await new Promise<void>((resolve) => child!.once('exit', () => resolve()))
      await Fs.writeFile(
        Path.join(root, 'metro.config.ts'),
        `import { getDefaultConfig } from 'expo/metro-config.js'; import { zyzz } from 'zyzz/metro'; export default zyzz(getDefaultConfig(import.meta.dirname), { units: { px: 2 } });`,
      )
      child = await start()
      const reconfigured = await bundle('ios')
      expect(reconfigured.ok).toMatchInlineSnapshot(`true`)
      expect(reconfigured.text.includes('"width": 912')).toMatchInlineSnapshot(
        `true`,
      )
      expect(reconfigured.text.includes('"width": 456')).toMatchInlineSnapshot(
        `false`,
      )
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        await new Promise<void>((resolve) =>
          child!.once('exit', () => resolve()),
        )
      }
      await Fs.rm(root, { force: true, recursive: true })
    }
  }, 180_000)
})
