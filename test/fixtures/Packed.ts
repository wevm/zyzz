/** Bundles compiled integration fixtures through real package resolution. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/** Writes compiled modules and packages, bundles their public imports, then cleans up. */
export async function bundle(options: bundle.Options): Promise<string> {
  const root = await Fs.mkdtemp(Path.resolve('.fixture-compiled-package-'))

  async function write(
    directory: string,
    modules: Readonly<Record<string, string>>,
  ) {
    for (const [name, source] of Object.entries(modules)) {
      const path = Path.join(directory, name.replace(/\.tsx?$/, '.js'))

      await Fs.mkdir(Path.dirname(path), { recursive: true })

      const result = await Esbuild.transform(source, {
        loader: 'ts',
        format: 'esm',
      })

      await Fs.writeFile(path, result.code)
    }
  }

  try {
    await Fs.mkdir(Path.join(root, 'node_modules'), { recursive: true })
    await Fs.symlink(process.cwd(), Path.join(root, 'node_modules/zyzz'), 'dir')
    await write(root, options.modules)

    for (const [name, modules] of Object.entries(options.packages ?? {})) {
      const directory = Path.join(root, 'node_modules', name)

      await Fs.mkdir(directory, { recursive: true })
      await Fs.writeFile(
        Path.join(directory, 'package.json'),
        JSON.stringify({ name, type: 'module', exports: './index.js' }),
      )
      await write(directory, modules)
    }

    const result = await Esbuild.build({
      entryPoints: [Path.join(root, options.entry.replace(/\.tsx?$/, '.js'))],
      bundle: true,
      conditions: ['src'],
      format: 'iife',
      globalName: 'Fixture',
      write: false,
    })

    return result.outputFiles[0]!.text
  } finally {
    await Fs.rm(root, { recursive: true, force: true })
  }
}

export declare namespace bundle {
  type Options = {
    entry: string
    modules: Readonly<Record<string, string>>
    packages?:
      | Readonly<Record<string, Readonly<Record<string, string>>>>
      | undefined
  }
}
