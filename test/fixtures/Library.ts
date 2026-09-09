/**
 * Builds and packs a theme library before installing it into a separate consumer.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Ts from 'typescript'
import { Graph } from 'zyzz/compiler'

/** Packs compiled JavaScript, generated declarations, CSS, and authoring metadata. */
export async function create(root: string, options: create.Options = {}) {
  const directory = Path.join(root, 'publisher')
  const consumer = Path.join(root, 'consumer')
  await Fs.mkdir(directory, { recursive: true })
  await Fs.mkdir(consumer, { recursive: true })
  const compiled = Graph.compile({
    modules: {
      '@acme/theme/index.ts': options.configuration
        ? `import { Config } from 'zyzz';
export const zyzz = Config.create({defaultTheme:'base',layers:['components'],themes:{base:{color:{brand:{light:'#06c',dark:'#9cf'}},spacing:{md:'8px'}},mint:{color:{brand:{light:'#175',dark:'#afa'}},spacing:{md:'8px'}}}});
export const design = zyzz;
export const theme = zyzz.themes.base;
export const reusable = Config.create({theme});
export const css = zyzz.css;
export const props = zyzz.css({color:'brand',padding:'md'})();`
        : `import { Theme } from 'zyzz';
export const theme = Theme.define({color:{brand:{light:'#06c',dark:'#9cf'}},spacing:{md:'8px'}});
export const mint = Theme.extend(theme,{color:{brand:{light:'#175',dark:'#afa'}}});
export const css = theme.css;
export const props = css({color:'brand',padding:'md'})();`,
    },
  })
  const output = compiled.modules['@acme/theme/index.ts']!
  await Fs.writeFile(Path.join(directory, 'index.ts'), output.code)
  const declaration = Ts.transpileDeclaration(output.code, {
    fileName: 'index.ts',
    reportDiagnostics: true,
  })
  if (declaration.diagnostics?.length)
    throw new Error('Library declarations failed to emit.')
  await Fs.writeFile(Path.join(directory, 'index.d.ts'), declaration.outputText)
  const exec = Util.promisify(ChildProcess.execFile)
  await Fs.writeFile(
    Path.join(directory, 'index.js'),
    (await Esbuild.transform(output.code, { format: 'esm', loader: 'ts' }))
      .code,
  )
  await Fs.writeFile(
    Path.join(directory, 'index.js.zyzz.json'),
    compiled.contracts['@acme/theme/index.ts']!,
  )
  await Fs.writeFile(Path.join(directory, 'style.css'), output.css)
  await Fs.writeFile(
    Path.join(directory, 'package.json'),
    JSON.stringify({
      exports: {
        '.': { types: './index.d.ts', default: './index.js' },
        './style.css': './style.css',
      },
      files: ['index.js', 'index.js.zyzz.json', 'index.d.ts', 'style.css'],
      name: '@acme/theme',
      sideEffects: ['*.css'],
      type: 'module',
      version: '1.0.0',
    }),
  )
  const packed = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--offline', '--json'],
    { cwd: directory },
  )
  const [pack] = JSON.parse(packed.stdout) as { filename: string }[]
  await Fs.writeFile(
    Path.join(consumer, 'package.json'),
    '{"private":true,"type":"module"}',
  )
  await exec(
    'npm',
    [
      'install',
      Path.join(directory, pack!.filename),
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
    ],
    { cwd: consumer },
  )
  await Fs.symlink(
    Path.resolve('.'),
    Path.join(consumer, 'node_modules/zyzz'),
    'dir',
  )
  return consumer
}

/** Packed-library fixture inputs. */
export declare namespace create {
  /** Selects the configured instance fixture while retaining the standalone theme lane. */
  type Options = {
    /** Whether the library exports a named Config.create instance. */
    readonly configuration?: boolean | undefined
  }
}
