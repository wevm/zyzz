/** Exercises Metro bundling and imported style edits through the published Expo adapter. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Net from 'node:net'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Util from 'node:util'
import * as Vm from 'node:vm'
import * as Ds from '../../test/fixtures/native/Ds.js'
import { Graph } from 'zyzz/compiler'
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

  test('bundles shared packages and recompiles imported styles after edits and errors', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-metro-'))
    const root = Path.join(directory, 'app')
    const packages = Path.join(directory, 'packages/node_modules')
    const library = Path.join(packages, '@fixture/shared')
    let child: ChildProcess.ChildProcess | undefined
    let logs = ''
    try {
      await Fs.mkdir(root)
      await Fs.mkdir(library, { recursive: true })
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
          expo: {
            name: 'Metro fixture',
            platforms: ['ios', 'android'],
            slug: 'metro-fixture',
          },
        }),
      )
      const configuration = (px: number) =>
        `import * as Path from 'node:path';import { getDefaultConfig } from 'expo/metro-config.js';import { zyzz } from 'zyzz/metro';
        const config=getDefaultConfig(import.meta.dirname);config.watchFolders.push(Path.resolve(import.meta.dirname,'../packages'));config.resolver.nodeModulesPaths.push(Path.resolve(import.meta.dirname,'node_modules'),Path.resolve(import.meta.dirname,'../packages/node_modules'));
        config.resolver.resolveRequest=(context,name,platform)=>context.resolveRequest(context,name==='@shared-theme'?(context.customResolverOptions.alternate?'@fixture/shared/alternate':'@fixture/shared/theme'):name,platform);
        export default zyzz(config, { fonts: {'Pilat, Arial, sans-serif':'Pilat'}, units: { px: ${px}, rem:16 } });`
      await Fs.writeFile(Path.join(root, 'metro.config.ts'), configuration(1))
      await Fs.writeFile(
        Path.join(root, 'index.ts'),
        `import {NativeContext} from 'zyzz/runtime';import {box} from './Style';import {surface} from './DsStyles';import {card} from '@fixture/packed/card';import {platformStyle} from './Theme';import {nested} from '@fixture/shared/nested';console.log(...[box(),surface(),card(),platformStyle(),nested()].map(props=>NativeContext.resolve(props.style,{colorScheme:'light'})));`,
      )
      const source = (width: number) =>
        `import {style} from './Theme';export const box=style({color:'ink',width:'${width}px'});`
      const theme = (color: string) =>
        `import {Config} from 'zyzz';export {platformStyle} from './Opacity';export const {style}=Config.create({vars:{base:{color:{ink:{light:'${color}',dark:'#abcdef'}}},alternate:{color:{ink:{light:'#123abc',dark:'#456def'}}}},defaultVars:'base'});`
      await Fs.writeFile(
        Path.join(library, 'package.json'),
        JSON.stringify({
          name: '@fixture/shared',
          exports: {
            './alternate': './Alternate.ts',
            './nested': './Style.ts',
            './theme': './index.ts',
          },
          peerDependencies: { zyzz: '*' },
        }),
      )
      await Fs.writeFile(
        Path.join(library, 'Opacity.ios.ts'),
        `import {style} from 'zyzz';export const platformStyle=style({opacity:0.123});`,
      )
      await Fs.writeFile(
        Path.join(library, 'Opacity.android.ts'),
        `import {style} from 'zyzz';export const platformStyle=style({opacity:0.456});`,
      )
      await Fs.writeFile(
        Path.join(library, 'Opacity.native.ts'),
        `import {style} from 'zyzz';export const platformStyle=style({opacity:0.789});`,
      )
      await Fs.writeFile(Path.join(library, 'Theme.ts'), theme('#112233'))
      await Fs.writeFile(Path.join(library, 'Alternate.ts'), theme('#fedcba'))
      await Fs.writeFile(
        Path.join(library, 'Style.ts'),
        `import {style} from '@fixture/shared/theme';export const nested=style({width:'19px'});`,
      )
      await Fs.writeFile(
        Path.join(library, 'index.ts'),
        `export {platformStyle,style} from './Theme.js';`,
      )
      await Fs.writeFile(
        Path.join(root, 'Theme.ts'),
        `export {platformStyle,style} from '@shared-theme';`,
      )
      await Fs.writeFile(Path.join(root, 'Style.ts'), source(123))

      const ds = Path.join(packages, '@fixture/ds')
      for (const [name, content] of Object.entries(await Ds.read())) {
        await Fs.mkdir(Path.dirname(Path.join(ds, name)), { recursive: true })
        await Fs.writeFile(Path.join(ds, name), content)
      }
      await Fs.writeFile(
        Path.join(ds, 'package.json'),
        JSON.stringify({
          name: '@fixture/ds',
          exports: { './config': './platform/zyzz.config.ts' },
          devDependencies: { zyzz: '0.0.21' },
        }),
      )
      await Fs.writeFile(
        Path.join(root, 'DsStyles.ts'),
        `import {style} from '@fixture/ds/config';export const surface=style({backgroundColor:'background.primary',padding:'24',borderRadius:'full',typography:'body.b2'});`,
      )

      const publisher = Path.join(directory, 'publisher')
      await Fs.mkdir(Path.join(publisher, 'dist'), { recursive: true })
      const published = Graph.compile({
        modules: {
          'base.ts': `import {Config} from 'zyzz';export const {style}=Config.create({vars:{spacing:{cell:'77px'}}});`,
          'index.ts': `import {style} from './base.js';export const card=style({width:'cell'});`,
        },
      })
      const javascript = await Esbuild.transform(
        published.modules['index.ts']!.code,
        { loader: 'ts', format: 'esm' },
      )
      await Fs.writeFile(Path.join(publisher, 'dist/index.js'), javascript.code)
      await Fs.writeFile(
        Path.join(publisher, 'dist/index.js.zyzz.json'),
        published.contracts['index.ts']!,
      )
      const base = await Esbuild.transform(published.modules['base.ts']!.code, {
        loader: 'ts',
        format: 'esm',
      })
      await Fs.writeFile(Path.join(publisher, 'dist/base.js'), base.code)
      await Fs.writeFile(
        Path.join(publisher, 'dist/base.js.zyzz.json'),
        published.contracts['base.ts']!,
      )

      await Fs.writeFile(
        Path.join(publisher, 'package.json'),
        JSON.stringify({
          name: '@fixture/packed',
          version: '1.0.0',
          type: 'module',
          files: ['dist'],
          exports: { './card': './dist/index.js' },
        }),
      )
      const { stdout } = await Util.promisify(ChildProcess.execFile)(
        'npm',
        ['pack', '--ignore-scripts', '--json'],
        { cwd: publisher },
      )
      const archive = (JSON.parse(stdout) as { filename: string }[])[0]!
        .filename
      const installed = Path.join(packages, '@fixture/packed')
      await Fs.mkdir(installed, { recursive: true })
      await Util.promisify(ChildProcess.execFile)('tar', [
        '-xzf',
        Path.join(publisher, archive),
        '--strip-components=1',
        '-C',
        installed,
      ])

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
      const alternateResponse = await fetch(
        `http://localhost:${port}/index.bundle?platform=ios&dev=true&minify=false&resolver.alternate=true`,
      )
      const alternateBundle = await alternateResponse.text()
      if (!alternateResponse.ok) throw new Error(alternateBundle)
      expect(execute(alternateBundle)[0]).toMatchInlineSnapshot(`
        {
          "color": "#fedcba",
          "width": 123,
        }
      `)

      const [ios, android] = await Promise.all([
        bundle('ios'),
        bundle('android'),
      ])
      if (!ios.ok || !android.ok)
        throw new Error(`${ios.text}\n${android.text}`)
      function execute(bundle: string) {
        let values: readonly unknown[] = []
        const context = Vm.createContext({
          console: {
            ...console,
            log: (...args: readonly unknown[]) => {
              values = args
            },
          },
        })
        Vm.runInContext('globalThis.global=globalThis', context)
        Vm.runInContext(bundle, context)
        return values
      }
      expect(execute(ios.text)).toMatchInlineSnapshot(`
        [
          {
            "color": "#112233",
            "width": 123,
          },
          {
            "backgroundColor": "#f5f5f5ff",
            "borderBottomLeftRadius": 999,
            "borderBottomRightRadius": 999,
            "borderTopLeftRadius": 999,
            "borderTopRightRadius": 999,
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
            "paddingBottom": 24,
            "paddingLeft": 24,
            "paddingRight": 24,
            "paddingTop": 24,
          },
          {
            "width": 77,
          },
          {
            "opacity": 0.123,
          },
          {
            "width": 19,
          },
        ]
      `)
      expect(execute(android.text)[3]).toMatchInlineSnapshot(`
        {
          "opacity": 0.456,
        }
      `)
      expect(ios.text.includes('"width": 123')).toMatchInlineSnapshot(`true`)
      expect(ios.text.includes('"opacity": 0.123')).toMatchInlineSnapshot(
        `true`,
      )
      expect(android.text.includes('"opacity": 0.456')).toMatchInlineSnapshot(
        `true`,
      )
      expect(ios.text.includes('"paddingTop": 24')).toMatchInlineSnapshot(
        `true`,
      )
      expect(ios.text.includes('"fontFamily": "Pilat"')).toMatchInlineSnapshot(
        `true`,
      )
      expect(ios.text.includes('"width": 77')).toMatchInlineSnapshot(`true`)

      const contract = Path.join(installed, 'dist/index.js.zyzz.json')
      const changedContract = Graph.compile({
        modules: {
          'index.ts': `import {style} from 'zyzz';export const card=style({width:'88px'});`,
        },
      })
      await Fs.writeFile(contract, changedContract.contracts['index.ts']!)
      const repacked = await bundle('ios', (result) =>
        result.text.includes('"width": 88'),
      )
      expect(repacked.ok).toMatchInlineSnapshot(`true`)
      expect(execute(repacked.text)[2]).toMatchInlineSnapshot(`
        {
          "width": 88,
        }
      `)

      const tokens = Path.join(ds, 'core/vars.ts')
      const original = await Fs.readFile(tokens, 'utf8')
      await Fs.writeFile(tokens, original.replace("'24': 24,", "'24': 26,"))
      const updated = await bundle('ios', (result) =>
        result.text.includes('"paddingTop": 26'),
      )
      expect(updated.ok).toMatchInlineSnapshot(`true`)
      expect(updated.text.includes('"paddingTop": 26')).toMatchInlineSnapshot(
        `true`,
      )
      expect(updated.text.includes('"paddingTop": 24')).toMatchInlineSnapshot(
        `false`,
      )

      await Fs.writeFile(tokens, original)
      const restored = await bundle('ios', (result) =>
        result.text.includes('"paddingTop": 24'),
      )
      expect(restored.ok).toMatchInlineSnapshot(`true`)
      expect(restored.text.includes('"paddingTop": 24')).toMatchInlineSnapshot(
        `true`,
      )

      expect(ios.text.includes('#112233')).toBe(true)
      expect(ios.text.includes('#456def')).toBe(true)
      await Fs.writeFile(Path.join(library, 'Theme.ts'), theme('#332211'))
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
      await Fs.writeFile(Path.join(root, 'metro.config.ts'), configuration(2))
      child = await start()
      const reconfigured = await bundle('ios')
      expect(reconfigured.ok).toMatchInlineSnapshot(`true`)
      expect(reconfigured.text.includes('"width": 912')).toMatchInlineSnapshot(
        `true`,
      )
      expect(reconfigured.text.includes('"width": 456')).toMatchInlineSnapshot(
        `false`,
      )

      child.kill('SIGTERM')
      await new Promise<void>((resolve) => child!.once('exit', () => resolve()))
      child = undefined
      await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          expo,
          'export',
          '--platform',
          'all',
          '--no-minify',
          '--no-bytecode',
          '--max-workers',
          '1',
          '--output-dir',
          'output',
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            CI: '1',
            EXPO_NO_TELEMETRY: '1',
            EXPO_OFFLINE: '1',
            NODE_ENV: 'production',
          },
          timeout: 60_000,
        },
      )
      const files = await Fs.readdir(Path.join(root, 'output'), {
        recursive: true,
      })
      for (const platform of ['ios', 'android']) {
        const file = files.find(
          (file) =>
            file.includes(`${Path.sep}${platform}${Path.sep}`) &&
            file.endsWith('.js'),
        )!
        const exported = await Fs.readFile(
          Path.join(root, 'output', file),
          'utf8',
        )
        expect(exported.includes('"width": 912')).toMatchInlineSnapshot(`true`)
        expect(exported.includes('"paddingTop": 48')).toMatchInlineSnapshot(
          `true`,
        )
        expect(
          exported.includes('"fontFamily": "Pilat"'),
        ).toMatchInlineSnapshot(`true`)
      }
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        await new Promise<void>((resolve) =>
          child!.once('exit', () => resolve()),
        )
      }
      await Fs.rm(directory, { force: true, recursive: true })
    }
  }, 180_000)
})
