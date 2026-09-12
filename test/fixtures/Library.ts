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

/** Packs the library, installs the tarball into a fresh consumer, and links the repository as `zyzz`. */
export async function create(root: string, options: pack.Options = {}) {
  const consumer = Path.join(root, 'consumer')

  await Fs.mkdir(consumer, { recursive: true })

  const tarball = await pack(Path.join(root, 'publisher'), options)
  const exec = Util.promisify(ChildProcess.execFile)

  await Fs.writeFile(
    Path.join(consumer, 'package.json'),
    '{"private":true,"type":"module"}',
  )
  await exec(
    'npm',
    [
      'install',
      tarball,
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

/**
 * Packs compiled JavaScript, generated declarations, CSS, and authoring metadata.
 * @returns The absolute tarball path for `npm install`.
 */
export async function pack(directory: string, options: pack.Options = {}) {
  await Fs.mkdir(directory, { recursive: true })

  const compiled = Graph.compile({
    modules: {
      '@acme/theme/index.ts': (() => {
        // Member exports keep declaration emit isolated; exported binding elements are rejected.
        if (options.output === 'html')
          return `import { Config } from 'zyzz';
export const config = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });
export const css = config.css;
export const theme = config.theme;
export const props = css({ color: 'text', padding: '8px' })();`

        if (options.configuration)
          return `import { Config } from 'zyzz';
export const zyzz = Config.create({defaultTheme:'base',layers:['components'],themes:{base:{color:{brand:{light:'#06c',dark:'#9cf'}},spacing:{md:'8px'}},mint:{color:{brand:{light:'#175',dark:'#afa'}},spacing:{md:'8px'}}}});
export const design = zyzz;
export const theme = zyzz.themes.base;
export const reusable = Config.create({theme});
export const css = zyzz.css;
export const props = zyzz.css({color:'brand',padding:'md'})();`

        return `import { Theme } from 'zyzz';
export const theme = Theme.define({color:{brand:{light:'#06c',dark:'#9cf'}},spacing:{md:'8px'}});
export const mint = Theme.extend(theme,{color:{brand:{light:'#175',dark:'#afa'}}});
export const css = theme.css;
export const props = css({color:'brand',padding:'md'})();`
      })(),
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

  const [result] = JSON.parse(packed.stdout) as { filename: string }[]

  return Path.join(directory, result!.filename)
}

/** Packed-library fixture inputs. */
export declare namespace pack {
  /** Selects which library source is compiled and packed. */
  type Options = {
    /** Whether the library exports a named Config.create instance instead of standalone themes. */
    readonly configuration?: boolean | undefined
    /** Selects the HTML-output configuration library with a light/dark text token. */
    readonly output?: 'html' | undefined
  }
}
