/** Checks packed native exports and autolinking with real consumer tools. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Os from 'node:os'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'

describe('native exports', () => {
  test('resolves packed declarations and autolinks the installed native adapter', async () => {
    const directory = await Fs.realpath(
      await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-native-exports-')),
    )
    const exec = Util.promisify(ChildProcess.execFile)
    const require = Module.createRequire(
      Path.resolve('examples/react-native/package.json'),
    )

    try {
      await exec('pnpm', ['pack', '--pack-destination', directory], {
        timeout: 30000,
      })
      const archive = (await Fs.readdir(directory)).find((file) =>
        file.endsWith('.tgz'),
      )!
      const installed = Path.join(directory, 'node_modules/zyzz')
      await Fs.mkdir(installed, { recursive: true })
      await exec('tar', [
        '-xzf',
        Path.join(directory, archive),
        '--strip-components=1',
        '-C',
        installed,
      ])

      type Package = { dependencies: Record<string, string> }
      const pkg = JSON.parse(
        await Fs.readFile(Path.join(installed, 'package.json'), 'utf8'),
      ) as Package

      for (const name of [
        ...Object.keys(pkg.dependencies),
        '@types/react',
        'expo',
        'react',
        'react-native',
      ]) {
        const target = Path.join(directory, 'node_modules', name)
        await Fs.mkdir(Path.dirname(target), { recursive: true })
        await Fs.symlink(
          await Fs.realpath(
            Path.resolve(
              ['expo', 'react', 'react-native'].includes(name)
                ? 'examples/react-native/node_modules'
                : 'node_modules',
              name,
            ),
          ),
          target,
          'dir',
        )
      }

      await Fs.writeFile(
        Path.join(directory, 'package.json'),
        JSON.stringify({
          dependencies: {
            expo: '*',
            react: '*',
            'react-native': '*',
            zyzz: `file:${archive}`,
          },
          name: 'native-exports-consumer',
          private: true,
          type: 'module',
        }),
      )

      const file = Path.join(directory, 'consumer.ts')
      await Fs.writeFile(
        file,
        `import {defineConfig,Host,StyleSheet,useStyles,useVars,withStyles} from 'zyzz/react-native';
const {Provider,vars}=defineConfig({defaultVars:'base',vars:{base:{spacing:{gap:'4px'}},alternate:{spacing:{gap:'8px'}}}});
const gap:number=useVars(vars).spacing.gap;
Provider({colorScheme:'light',vars:'alternate'});
// @ts-expect-error The native condition retains the configuration's names.
Provider({colorScheme:'light',vars:'missing'});
// @ts-expect-error Native lengths remain numbers.
const invalid:string=useVars(vars).spacing.gap;
void [gap,invalid,Host,StyleSheet,useStyles,withStyles];`,
      )
      const result = await exec(
        process.execPath,
        [
          Path.resolve('node_modules/typescript/bin/tsc'),
          '--ignoreConfig',
          '--noEmit',
          '--module',
          'nodenext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          '--customConditions',
          'react-native',
          file,
        ],
        { timeout: 30000 },
      )
      expect(result.stdout).toMatchInlineSnapshot(`""`)

      type Config = {
        dependencies: {
          zyzz: {
            platforms: {
              android: unknown
              ios: { podspecPath: string }
            }
          }
        }
      }
      for (const platform of ['ios', 'android']) {
        const result = await exec(
          process.execPath,
          [
            require.resolve('expo-modules-autolinking/bin/expo-modules-autolinking.js'),
            'react-native-config',
            '--platform',
            platform,
            '--project-root',
            directory,
            '--json',
          ],
          { timeout: 30000 },
        )
        const config = JSON.parse(result.stdout) as Config
        if (platform === 'ios')
          expect(
            config.dependencies.zyzz.platforms.ios.podspecPath.replace(
              installed,
              '<zyzz>',
            ),
          ).toMatchInlineSnapshot(`"<zyzz>/Zyzz.podspec"`)
        else
          expect(
            JSON.parse(
              JSON.stringify(
                config.dependencies.zyzz.platforms.android,
              ).replaceAll(installed, '<zyzz>'),
            ),
          ).toMatchInlineSnapshot(`
            {
              "buildTypes": [],
              "cmakeListsPath": null,
              "componentDescriptors": [],
              "cxxModuleCMakeListsModuleName": "react_codegen_ZyzzSpec",
              "cxxModuleCMakeListsPath": "<zyzz>/native/android/CMakeLists.txt",
              "cxxModuleHeaderName": "NativeZyzz",
              "isPureCxxDependency": true,
              "libraryName": "ZyzzSpec",
              "packageImportPath": null,
              "packageInstance": null,
              "sourceDir": "<zyzz>/native/android",
            }
          `)
      }
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  }, 90000)
})
