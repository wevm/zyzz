import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as ts from 'typescript'
import * as Compiler from './Compiler.js'

/** Compiles a source directory into ESM, declarations, and styles.css.
 * Imports between modules must use ESM .js specifiers. The source package must
 * have its dependencies installed. This adapter does not bundle dependencies.
 * A manifest tracks owned output so rebuilds can remove stale generated files.
 * @throws BuildError if directories overlap or TypeScript reports an error.
 * @throws Compiler.CompileError if styles are not statically expressible.
 */
export async function build(options: build.Options): Promise<build.ReturnType> {
  const sourceDir = await Fs.realpath(Path.resolve(options.sourceDir))
  const outDir = Path.resolve(options.outDir)
  const inside = (parent: string, child: string) => {
    const relative = Path.relative(parent, child)
    return (
      relative === '' ||
      (!relative.startsWith('..') && !Path.isAbsolute(relative))
    )
  }
  if (inside(sourceDir, outDir) || inside(outDir, sourceDir))
    throw new BuildError('Source and output directories must not overlap.')
  const manifest = Path.join(outDir, '.typestyle-manifest.json')
  const previous = await (async (): Promise<readonly string[]> => {
    try {
      const value: unknown = JSON.parse(await Fs.readFile(manifest, 'utf8'))
      if (
        !Array.isArray(value) ||
        !value.every(
          (name: unknown) =>
            typeof name === 'string' &&
            name !== '' &&
            !Path.isAbsolute(name) &&
            !name.split(/[\\/]/).includes('..'),
        )
      )
        throw new BuildError('Invalid output manifest.')
      return value as string[]
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error
      return []
    }
  })()
  const files: string[] = []
  async function visit(directory: string) {
    for (const entry of (
      await Fs.readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = Path.join(directory, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules')
        await visit(path)
      else if (
        entry.isFile() &&
        /\.[jt]sx?$/.test(entry.name) &&
        !/\.(test|spec)\.[jt]sx?$/.test(entry.name)
      )
        files.push(path)
    }
  }
  await visit(sourceDir)
  if (!files.length)
    throw new BuildError('Source directory contains no supported modules.')
  const writes = new Map<string, string>()
  const sheets = new Set<string>()
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    declaration: true,
    emitDeclarationOnly: true,
    rootDir: sourceDir,
    outDir,
  }
  const host = ts.createCompilerHost(compilerOptions)
  host.writeFile = (name, text) => {
    writes.set(name, text)
  }
  const program = ts.createProgram(files, compilerOptions, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (
    diagnostics.some(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    )
  )
    throw new BuildError(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => sourceDir,
        getNewLine: () => '\n',
      }),
    )
  const emission = program.emit()
  if (emission.emitSkipped)
    throw new BuildError('TypeScript declaration emission failed.')
  for (const file of files) {
    if (/\.d\.ts$/.test(file)) {
      writes.set(
        Path.join(outDir, Path.relative(sourceDir, file)),
        await Fs.readFile(file, 'utf8'),
      )
      continue
    }
    const result = Compiler.compile({
      code: await Fs.readFile(file, 'utf8'),
      id: file,
    })
    if (result.css) sheets.add(result.css)
    const relative = Path.relative(sourceDir, file).replace(/\.[jt]sx?$/, '.js')
    const output = ts.transpileModule(result.code, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    writes.set(Path.join(outDir, relative), output.outputText)
  }
  const css = [...sheets].sort().join('\n')
  writes.set(Path.join(outDir, 'styles.css'), css)
  for (const file of writes.keys()) {
    const relative = Path.relative(outDir, file)
    if (!inside(outDir, file))
      throw new BuildError('Generated output is outside the output directory.')
    if (!previous.includes(relative)) {
      try {
        await Fs.access(file)
        throw new BuildError(`Refusing to overwrite an unowned output: ${file}`)
      } catch (error) {
        if (!(
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ))
          throw error
      }
    }
  }
  // All compilation and ownership checks complete before any output is written.
  for (const [file, text] of writes) {
    await Fs.mkdir(Path.dirname(file), { recursive: true })
    await Fs.writeFile(file, text)
  }
  for (const relative of previous) {
    const file = Path.join(outDir, relative)
    if (!writes.has(file)) await Fs.rm(file, { force: true })
  }
  await Fs.writeFile(
    manifest,
    JSON.stringify(
      [...writes.keys()].map((file) => Path.relative(outDir, file)),
      null,
      2,
    ) + '\n',
  )
  return { files: [...writes.keys()], css }
}

export declare namespace build {
  /** Standalone build inputs. */
  type Options = {
    /** Directory containing only library source modules. */ readonly sourceDir: string
    /** Nonoverlapping output directory; only manifest-owned files may be replaced. */ readonly outDir: string
  }
  /** Emitted files and aggregate stylesheet. */
  type ReturnType = {
    /** Absolute paths of generated modules, declarations, and CSS. */ readonly files: readonly string[]
    /** Aggregate static CSS; import styles.css once in the consuming app. */ readonly css: string
  }
}

/** Invalid standalone build inputs or TypeScript diagnostics. */
export class BuildError extends Error {
  override name = 'Build.BuildError'
}
