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

  test.each(['cjs', 'esm'] as const)(
    'bundles %s shared packages and recompiles imported styles after edits and errors',
    async (format) => {
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
          `import * as Fs from 'node:fs';import * as Path from 'node:path';import { getDefaultConfig } from 'expo/metro-config.js';import { zyzz } from 'zyzz/metro';
        const config=getDefaultConfig(import.meta.dirname);config.watchFolders.push(Path.resolve(import.meta.dirname,'../packages'));config.resolver.nodeModulesPaths.push(Path.resolve(import.meta.dirname,'node_modules'),Path.resolve(import.meta.dirname,'../packages/node_modules'));
        config.resolver.resolveRequest=(context,name,platform)=>{const resolved=context.resolveRequest(context,name==='@/tokens'?Path.resolve(import.meta.dirname,'Tokens.ts'):name==='@shared-theme'?(context.customResolverOptions.alternate?'@fixture/shared/alternate':'@fixture/shared/theme'):name,platform);if(name==='@fixture/packed/base')Fs.appendFileSync(Path.join(import.meta.dirname,'resolved.txt'),Path.basename(resolved.filePath)+'\\n');return resolved};
        export default zyzz(config, { fonts: {'Pilat, Arial, sans-serif':'Pilat'}, units: { px: ${px}, rem:16 } });`
        await Fs.writeFile(Path.join(root, 'metro.config.ts'), configuration(1))
        await Fs.writeFile(
          Path.join(root, 'index.ts'),
          `import {NativeContext} from 'zyzz/runtime';import {box} from './Style';import {surface} from './DsStyles';import {card,value} from '@fixture/packed/card';import {platformStyle} from './Theme';import {nested} from '@fixture/shared/nested';import {late} from '@fixture/late';console.log(...[box(),surface(),card(),platformStyle(),nested(),late()].map(props=>NativeContext.resolve(props.style,{colorScheme:'light'})),value);`,
        )
        const source = (width: number) =>
          `import {style} from './Theme';import {spacing} from '@/tokens';export const box=style({color:'ink',paddingTop:spacing.md,width:'${width}px'});`
        const theme = (color: string) =>
          `import {Config} from 'zyzz';export {platformStyle} from './Opacity';export const {style}=Config.create({vars:{base:{color:{ink:{light:'${color}',dark:'#abcdef'}}},alternate:{color:{ink:{light:'#123abc',dark:'#456def'}}}},defaultVars:'base'});`
        await Fs.writeFile(
          Path.join(library, 'package.json'),
          JSON.stringify({
            name: '@fixture/shared',
            exports: {
              './alternate': './Alternate.ts',
              './authoring': './Authoring.ts',
              './nested': './Style.ts',
              './theme': './index.ts',
            },
            optionalDependencies: { zyzz: '*' },
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
          Path.join(library, 'Authoring.ts'),
          `import {Config} from 'zyzz';export const {style}=Config.create({id:'late-authoring'});`,
        )
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
        const palette = (color: string) =>
          `import {defineConfig} from 'zyzz/react-native';export const {vars}=defineConfig({defaultVars:'base',vars:{base:{color:{accent:{light:'${color}',dark:'#0f0e0d'}}},night:{color:{accent:{light:'#0d0e0f',dark:'#0e0f0d'}}}}});`
        await Fs.writeFile(Path.join(root, 'Palette.ts'), palette('#a1b2c3'))
        for (const name of ['First', 'Second'])
          await Fs.writeFile(
            Path.join(root, `${name}.ts`),
            `import {useVars} from 'zyzz/react-native';import {vars} from './Palette';export function read(){return useVars(vars)}`,
          )
        await Fs.writeFile(
          Path.join(root, 'Readers.ts'),
          `export {read as first} from './First';export {read as second} from './Second';`,
        )
        const outside = Path.join(directory, 'packages/palette')
        await Fs.mkdir(outside)
        await Fs.writeFile(
          Path.join(outside, 'package.json'),
          JSON.stringify({ name: 'palette', private: true }),
        )
        await Fs.writeFile(
          Path.join(outside, 'Palette.ts'),
          `import {defineConfig} from 'zyzz/react-native';export const {vars}=defineConfig({vars:{color:{accent:{light:'#5e6f70',dark:'#706f5e'}}}});`,
        )
        await Fs.writeFile(
          Path.join(root, 'Outside.ts'),
          `import {useVars} from 'zyzz/react-native';import {vars} from '../packages/palette/Palette';export function read(){return useVars(vars)}`,
        )

        await Fs.writeFile(
          Path.join(root, 'Tokens.ts'),
          `export const spacing={md:'7px'} as const;`,
        )
        const late = Path.join(packages, '@fixture/late')
        await Fs.mkdir(late, { recursive: true })
        await Fs.writeFile(
          Path.join(late, 'package.json'),
          JSON.stringify({
            exports: './index.js',
            name: '@fixture/late',
            type: 'module',
          }),
        )
        await Fs.writeFile(
          Path.join(late, 'index.js'),
          `export {late} from './Late.js';`,
        )
        const lateSource = `import {style} from '@fixture/shared/authoring';export const late=style({width:'29px'});`
        await Fs.writeFile(Path.join(late, 'Late.js'), lateSource)

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
          imports: {
            'base.ts': { zyzz: null },
            'index.ts': { '@fixture/packed/base': 'base.ts' },
          },
          modules: {
            'base.ts': `import {Config} from 'zyzz';export const {style}=Config.create({vars:{spacing:{cell:'77px'}}});export const value=77;`,
            'index.ts': `import {style} from '@fixture/packed/base';export {value} from '@fixture/packed/base';export const card=style({width:'cell'});`,
          },
        })
        const javascript = await Esbuild.transform(
          published.modules['index.ts']!.code,
          { loader: 'ts', format },
        )
        await Fs.writeFile(
          Path.join(publisher, 'dist/index.js'),
          javascript.code,
        )
        await Fs.writeFile(
          Path.join(publisher, 'dist/index.js.zyzz.json'),
          published.contracts['index.ts']!,
        )
        const alternate = Graph.compile({
          modules: {
            'base.ts': `import {Config} from 'zyzz';export const {style}=Config.create({vars:{spacing:{cell:'91px'}}});export const value=91;`,
          },
        })
        for (const condition of ['cjs', 'esm'] as const) {
          const selected = condition === format ? published : alternate
          const base = await Esbuild.transform(
            selected.modules['base.ts']!.code,
            { format: condition, loader: 'ts' },
          )
          const file = `base.${condition === 'cjs' ? 'cjs' : 'mjs'}`
          await Fs.writeFile(Path.join(publisher, 'dist', file), base.code)
          await Fs.writeFile(
            Path.join(publisher, 'dist', `${file}.zyzz.json`),
            selected.contracts['base.ts']!,
          )
        }

        await Fs.writeFile(
          Path.join(publisher, 'package.json'),
          JSON.stringify({
            name: '@fixture/packed',
            version: '1.0.0',
            type: format === 'cjs' ? 'commonjs' : 'module',
            files: ['dist'],
            exports: {
              './base': {
                import: './dist/base.mjs',
                require: './dist/base.cjs',
              },
              './card': './dist/index.js',
            },
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
          entry = 'index',
        ) {
          const deadline = Date.now() + 15_000
          while (true) {
            const response = await fetch(
              `http://localhost:${port}/${entry}.bundle?platform=${platform}&dev=true&minify=false`,
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
          "paddingTop": 7,
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
            "paddingTop": 7,
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
          undefined,
          77,
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
        expect(
          ios.text.includes('"fontFamily": "Pilat"'),
        ).toMatchInlineSnapshot(`true`)
        expect(ios.text.includes('"width": 77')).toMatchInlineSnapshot(`true`)

        const resolved = [
          ...new Set(
            (await Fs.readFile(Path.join(root, 'resolved.txt'), 'utf8'))
              .trim()
              .split('\n'),
          ),
        ].sort()
        if (format === 'cjs')
          expect(resolved).toMatchInlineSnapshot(`
            [
              "base.cjs",
            ]
          `)
        else
          expect(resolved).toMatchInlineSnapshot(`
            [
              "base.mjs",
            ]
          `)

        const readers = await bundle('ios', undefined, 'Readers')
        if (!readers.ok) throw new Error(readers.text)
        const profiles = new Set(readers.text.match(/__zyzzProfile\w+/g))
        expect(profiles.size).toMatchInlineSnapshot(`1`)
        expect(
          readers.text.split('\\"#a1b2c3\\"').length - 1,
        ).toMatchInlineSnapshot(`1`)

        const outsider = await bundle('ios', undefined, 'Outside')
        if (!outsider.ok) throw new Error(outsider.text)
        expect(
          new Set(outsider.text.match(/__zyzzProfile\w+/g)).size,
        ).toMatchInlineSnapshot(`1`)
        expect(
          outsider.text.split('\\"#5e6f70\\"').length - 1,
        ).toMatchInlineSnapshot(`1`)

        await Fs.writeFile(Path.join(root, 'Palette.ts'), palette('#d4e5f6'))
        const repainted = await bundle(
          'ios',
          (result) => result.text.includes('\\"#d4e5f6\\"'),
          'Readers',
        )
        const repaintedProfiles = new Set(
          repainted.text.match(/__zyzzProfile\w+/g),
        )
        expect(repaintedProfiles.size).toMatchInlineSnapshot(`1`)
        expect(
          repaintedProfiles.isDisjointFrom(profiles),
        ).toMatchInlineSnapshot(`true`)
        expect(
          repainted.text.split('\\"#d4e5f6\\"').length - 1,
        ).toMatchInlineSnapshot(`1`)
        expect(repainted.text.includes('#a1b2c3')).toMatchInlineSnapshot(
          `false`,
        )

        await Fs.writeFile(
          Path.join(root, 'Tokens.ts'),
          `export const spacing={md:'9px'} as const;`,
        )
        const aliased = await bundle('ios', (result) =>
          result.text.includes('"paddingTop": 9'),
        )
        expect(aliased.ok).toMatchInlineSnapshot(`true`)
        expect(execute(aliased.text)[0]).toMatchInlineSnapshot(`
          {
            "color": "#112233",
            "paddingTop": 9,
            "width": 123,
          }
        `)

        const lateContract = Graph.compile({
          imports: {
            'Authoring.ts': { zyzz: null },
            'Late.js': { '@fixture/shared/authoring': 'Authoring.ts' },
          },
          modules: {
            'Authoring.ts': `import {Config} from 'zyzz';export const {style}=Config.create({id:'late-authoring'});`,
            'Late.js': lateSource,
          },
        })
        await Fs.writeFile(
          Path.join(late, 'Late.js.zyzz.json'),
          lateContract.contracts['Late.js']!,
        )
        const activated = await bundle('ios', (result) =>
          result.text.includes('"width": 29'),
        )
        expect(activated.ok).toMatchInlineSnapshot(`true`)
        expect(execute(activated.text)[5]).toMatchInlineSnapshot(`
          {
            "width": 29,
          }
        `)

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
        expect(
          restored.text.includes('"paddingTop": 24'),
        ).toMatchInlineSnapshot(`true`)

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
        await new Promise<void>((resolve) =>
          child!.once('exit', () => resolve()),
        )
        await Fs.writeFile(Path.join(root, 'metro.config.ts'), configuration(2))
        child = await start()
        const reconfigured = await bundle('ios')
        expect(reconfigured.ok).toMatchInlineSnapshot(`true`)
        expect(
          reconfigured.text.includes('"width": 912'),
        ).toMatchInlineSnapshot(`true`)
        expect(
          reconfigured.text.includes('"width": 456'),
        ).toMatchInlineSnapshot(`false`)

        child.kill('SIGTERM')
        await new Promise<void>((resolve) =>
          child!.once('exit', () => resolve()),
        )
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
          expect(exported.includes('"width": 912')).toMatchInlineSnapshot(
            `true`,
          )
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
    },
    180_000,
  )
})
