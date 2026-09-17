/** Packs shared authoring into independent web and native package entries. @module */
import * as ChildProcess from 'node:child_process'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { Graph } from 'zyzz/compiler'

/** Static shared authoring used by source, packed, and benchmark consumers. */
export const modules = {
  'button.ts': `import {variants} from './config.js';export const button=variants({base:{color:'ink'},variants:{size:{small:{fontSize:'12px'},large:{fontSize:'20px'}},active:{true:{opacity:1},false:{opacity:0.5}}},defaultVariants:{size:'small',active:false},compoundVariants:[{when:{size:'large',active:true},style:{targets:{web:{opacity:0.8},native:{opacity:0.8}}}}]});`,
  'config.ts': `import {Config} from 'zyzz';export const {variants}=Config.create({theme:{color:{ink:{light:'#123456',dark:'#abcdef'}}}});`,
  'index.ts': `export {button} from './button.js';`,
} as const

/** Builds declarations and installs a source-free archive with both target entries. */
export async function create(root: string) {
  const exec = Util.promisify(ChildProcess.execFile)
  const installed = Path.join(root, 'node_modules/@acme/universal')
  const publisher = Path.join(root, 'publisher')

  await Fs.mkdir(publisher, { recursive: true })

  const packedRuntime = await exec(
    'npm',
    [
      'pack',
      '--ignore-scripts',
      '--offline',
      '--json',
      '--pack-destination',
      root,
    ],
    { cwd: process.cwd() },
  )
  const runtimeArchive = (
    JSON.parse(packedRuntime.stdout) as { filename: string }[]
  )[0]!

  await Fs.writeFile(
    Path.join(publisher, 'package.json'),
    JSON.stringify({
      name: '@acme/universal',
      version: '1.0.0',
      type: 'module',
      sideEffects: ['*.css'],
      files: ['web', 'native'],
      dependencies: {
        zyzz: `file:${Path.join(root, runtimeArchive.filename)}`,
      },
      exports: {
        '.': { types: './web/index.d.ts', default: './web/index.js' },
        './native': {
          types: './native/index.d.ts',
          default: './native/index.js',
        },
        './style.css': './web/style.css',
      },
    }),
  )

  const installOptions = [
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
  ]
  await exec('npm', ['install', ...installOptions], { cwd: publisher })

  for (const target of ['web', 'native'] as const) {
    const output = Graph.compile({
      modules,
      ...(target === 'native'
        ? {
            native: { colorScheme: 'light' as const, platform: 'ios' as const },
          }
        : {}),
    })
    const directory = Path.join(publisher, target)
    await Fs.mkdir(directory)

    for (const [name, module] of Object.entries(output.modules)) {
      await Fs.writeFile(Path.join(directory, name), module.code)
      const js = await Esbuild.transform(module.code, {
        loader: 'ts',
        format: 'esm',
      })
      await Fs.writeFile(
        Path.join(directory, name.replace('.ts', '.js')),
        js.code,
      )
      if (output.contracts[name])
        await Fs.writeFile(
          Path.join(directory, name.replace('.ts', '.js.zyzz.json')),
          output.contracts[name]!,
        )
    }

    await exec(process.execPath, [
      Path.resolve('node_modules/typescript/bin/tsc'),
      '--module',
      'nodenext',
      '--target',
      'esnext',
      '--strict',
      '--skipLibCheck',
      '--declaration',
      '--emitDeclarationOnly',
      ...Object.keys(modules).map((name) => Path.join(directory, name)),
    ]).catch((error) => {
      throw new Error(error.stdout || error.message)
    })

    for (const name of Object.keys(modules))
      await Fs.rm(Path.join(directory, name))
    if (target === 'web')
      await Fs.writeFile(
        Path.join(directory, 'style.css'),
        Object.values(output.modules)
          .map((module) => module.css)
          .join('\n'),
      )
  }

  const pack = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--offline', '--json'],
    { cwd: publisher },
  )
  const archive = (JSON.parse(pack.stdout) as { filename: string }[])[0]!
  await Fs.writeFile(
    Path.join(root, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  await exec(
    'npm',
    ['install', Path.join(publisher, archive.filename), ...installOptions],
    { cwd: root },
  )

  return { installed }
}
