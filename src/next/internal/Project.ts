/** Retains filesystem snapshots and an incremental graph within a Next.js loader worker. @module */
import * as Contract from '../../compiler/internal/Contract.js'
import * as Fs from 'node:fs/promises'
import * as Graph from '../../compiler/Graph.js'
import * as Path from 'node:path'
import * as Reset from '../../node/Reset.js'
import * as Stylesheets from '../../compiler/internal/Stylesheets.js'
import * as Syntax from '../../compiler/internal/Syntax.js'

/** Resolution and dependency notifications supplied by the active loader invocation. */
export type Context = {
  /** Track source and contract edits. */
  addDependency(file: string): void
  /** Resolve with the active bundler's aliases and conditions. */
  getResolve(
    options: object,
  ): (
    directory: string,
    specifier: string,
    callback: (error: Error | null, file?: string | false) => void,
  ) => void
  /** Physical loader resource. */
  resourcePath: string
}

/** Creates project state owned by a loader configuration in one worker process. */
export function create(options: create.Options) {
  let compiler = Graph.create()
  const files = new Map<string, { source: string; version: string }>()
  const libraries = new Map<
    string,
    { dependencies: readonly (readonly string[])[]; source: string }
  >()
  const reset = options.reset ? Reset.read() : undefined
  const syntax = new Map<
    string,
    { parsed: ReturnType<typeof Syntax.parse>; source: string }
  >()
  let pending = Promise.resolve()

  return {
    /** Compiles a fresh snapshot while retaining unchanged syntax and graph results. */
    compile(context: Context, source: string) {
      // Loader calls may overlap, but only one immutable snapshot updates the compiler at a time.
      const result = pending.then(async () => {
        const tracked = new Set<string>()
        try {
          return await compile(context, source, tracked)
        } catch (error) {
          // Failed resolution or extraction may leave a partial filesystem snapshot.
          compiler = Graph.create()
          files.clear()
          libraries.clear()
          syntax.clear()
          for (const file of tracked) context.addDependency(file)
          throw error
        }
      })

      // A failed generation must not prevent recovery after the source is corrected.
      pending = result.then(
        () => {},
        () => {},
      )

      return result
    },
  }

  async function compile(
    context: Context,
    source: string,
    tracked: Set<string>,
  ) {
    const root = options.root
    const runtime = new Set<string>()
    function track(file: string) {
      if (tracked.has(file)) return
      tracked.add(file)
    }
    const programs = new Map<string, ReturnType<typeof Syntax.parse>>()
    const reads = new Map<string, Promise<string>>()
    function read(file: string) {
      let pending = reads.get(file)
      if (!pending) {
        pending = load(file)
        reads.set(file, pending)
      }
      return pending
    }

    async function load(file: string) {
      const version = await stamp(file)
      let entry = files.get(file)
      if (entry?.version !== version) {
        entry = { source: await Fs.readFile(file, 'utf8'), version }
      }
      files.delete(file)
      files.set(file, entry)
      if (files.size > 256) files.delete(files.keys().next().value!)
      return entry.source
    }

    const modules: Record<string, string> = Object.create(null)
    const imports: Record<
      string,
      Record<string, string | null>
    > = Object.create(null)
    const contracts: Record<string, string> = Object.create(null)
    const resolver = context.getResolve({})
    const resolutions = new Map<string, Promise<string | false | undefined>>()
    function resolve(directory: string, specifier: string) {
      const key = JSON.stringify([directory, specifier])
      let pending = resolutions.get(key)
      if (!pending) {
        pending = new Promise<string | false | undefined>((accept, reject) => {
          resolver(directory, specifier, (error, value) =>
            error ? reject(error) : accept(value),
          )
        })
        resolutions.set(key, pending)
      }
      return pending
    }
    const id = (file: string) =>
      `app/${Path.relative(root, file).split(Path.sep).join('/')}`
    const eligible = (file: string) =>
      /\.[cm]?[jt]sx?$/.test(file) &&
      !/\.(?:d|test|test-d|bench|bench-d)\.[cm]?[jt]sx?$/.test(file) &&
      !Path.relative(root, file)
        .split(Path.sep)
        .some(
          (part) =>
            part === '..' || part === 'node_modules' || part.startsWith('.'),
        )

    function parse(name: string, source: string) {
      let entry = syntax.get(name)
      if (entry?.source !== source)
        entry = { source, parsed: Syntax.parse({ moduleId: name, source }) }
      syntax.delete(name)
      syntax.set(name, entry)
      if (syntax.size > 256) syntax.delete(syntax.keys().next().value!)
      return entry.parsed
    }

    async function visit(file: string, text?: string): Promise<void> {
      const name = id(file)
      if (Object.hasOwn(modules, name)) return

      track(file)
      modules[name] = text ?? (await read(file))
      const links: Record<string, string | null> = Object.create(null)
      imports[name] = links
      const parsed = parse(name, modules[name]!)
      programs.set(name, parsed)

      const resolutions = await Promise.all(
        parsed.program.body.map(async (node) => {
          if (
            (node.type !== 'ImportDeclaration' &&
              node.type !== 'ExportNamedDeclaration' &&
              node.type !== 'ExportAllDeclaration') ||
            !node.source
          )
            return undefined
          if (
            node.type === 'ImportDeclaration'
              ? node.importKind === 'type'
              : node.exportKind === 'type'
          )
            return undefined

          const specifier = node.source.value
          links[specifier] = null
          // Next owns this virtual module, which has no physical stylesheet contract.
          if (specifier === 'next/root-params') return undefined
          if (
            specifier === 'zyzz' ||
            (specifier.startsWith('zyzz/') && specifier !== 'zyzz/default') ||
            specifier.startsWith('node:')
          )
            return undefined

          const resolved = await resolve(Path.dirname(file), specifier)
          return { node, specifier, resolved }
        }),
      )
      for (const resolution of resolutions) {
        if (!resolution) continue
        const { node, specifier, resolved } = resolution
        if (!resolved || !/\.[cm]?[jt]sx?$/.test(resolved)) continue
        if (eligible(resolved)) {
          if (node.type === 'ImportDeclaration' && node.specifiers.length) {
            track(resolved)
            const parsed = parse(id(resolved), await read(resolved))
            const functions = new Set<string>()
            let defaultBinding: string | undefined
            for (const statement of parsed.program.body) {
              if (
                statement.type === 'ExportDefaultDeclaration' &&
                [
                  'FunctionDeclaration',
                  'ClassDeclaration',
                  'ArrowFunctionExpression',
                  'FunctionExpression',
                ].includes(statement.declaration.type)
              ) {
                functions.add('default')
                if (
                  statement.declaration.type === 'FunctionDeclaration' ||
                  statement.declaration.type === 'ClassDeclaration'
                )
                  defaultBinding = statement.declaration.id?.name
              }
              if (statement.type !== 'ExportNamedDeclaration') continue
              const declaration = statement.declaration
              if (
                (declaration?.type === 'FunctionDeclaration' ||
                  declaration?.type === 'ClassDeclaration') &&
                declaration.id
              )
                functions.add(declaration.id.name)
              if (declaration?.type === 'VariableDeclaration')
                for (const item of declaration.declarations) {
                  if (
                    item.id.type === 'Identifier' &&
                    item.init &&
                    [
                      'ArrowFunctionExpression',
                      'FunctionExpression',
                      'ClassExpression',
                    ].includes(item.init.type)
                  )
                    functions.add(item.id.name)
                }
            }
            for (const statement of parsed.program.body) {
              const declaration =
                statement.type === 'ExportNamedDeclaration'
                  ? statement.declaration
                  : statement
              if (
                declaration?.type === 'TSModuleDeclaration' &&
                declaration.id.type === 'Identifier'
              ) {
                functions.delete(declaration.id.name)
                if (declaration.id.name === defaultBinding)
                  functions.delete('default')
              }
            }
            if (
              !parsed.errors.length &&
              node.specifiers.every((specifier) =>
                specifier.type === 'ImportDefaultSpecifier'
                  ? functions.has('default')
                  : specifier.type === 'ImportSpecifier' &&
                    (specifier.importKind === 'type' ||
                      functions.has(
                        specifier.imported.type === 'Identifier'
                          ? specifier.imported.name
                          : specifier.imported.value,
                      )),
              )
            ) {
              runtime.add(resolved)
              track(resolved)
              continue
            }
          }
          links[specifier] = id(resolved)
          await visit(resolved)
          continue
        }
        const sidecar = `${resolved}.zyzz.json`
        try {
          contracts[resolved] = await read(sidecar)
          track(sidecar)
          links[specifier] = resolved
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
    }

    await visit(context.resourcePath, source)
    const loaded = new Set<string>()
    async function dependencies(file: string): Promise<void> {
      if (loaded.has(file)) return
      loaded.add(file)

      let library = libraries.get(file)
      if (!library || library.source !== contracts[file]) {
        library = {
          source: contracts[file]!,
          dependencies: Contract.read(
            contracts[file]!,
            new Map(),
            file,
          ).stylesheets.map((section) => section.dependency ?? []),
        }
        libraries.set(file, library)
      }
      for (const dependency of library.dependencies) {
        let owner = file
        for (const specifier of dependency) {
          const target = await resolve(Path.dirname(owner), specifier)
          if (!target || !Path.isAbsolute(target))
            throw new Error('Unable to resolve packed stylesheet dependency.')

          const links = (imports[owner] ??= Object.create(null))
          links[specifier] = target
          if (!Object.hasOwn(contracts, target)) {
            const sidecar = `${target}.zyzz.json`
            contracts[target] = await read(sidecar)
            track(sidecar)
          }
          await dependencies(target)
          owner = target
        }
      }
    }
    for (const file of Object.keys(contracts)) await dependencies(file)

    const graph = compiler.compile({
      [Syntax.cache]: programs,
      [Stylesheets.entry]: id(context.resourcePath),
      contracts,
      development: options.development,
      imports,
      modules,
      reset,
    })

    const entry = id(context.resourcePath)
    const output = graph.modules[entry]!
    // Unchanged runtime modules rely on Next's import graph, not transitive style inputs.
    if (output.code === source && !output.css) {
      context.addDependency(context.resourcePath)
      for (const file of runtime) context.addDependency(file)
      for (const file of tracked)
        if (file.endsWith('.zyzz.json')) context.addDependency(file)
      for (const target of Object.values(imports[entry] ?? {})) {
        if (!target) continue
        context.addDependency(
          target.startsWith('app/')
            ? Path.join(root, target.slice(4))
            : `${target}.zyzz.json`,
        )
      }
    } else {
      for (const file of tracked) context.addDependency(file)
    }

    for (const file of libraries.keys())
      if (!Object.hasOwn(contracts, file)) libraries.delete(file)

    return graph
  }
}

/** Project cache settings. */
export declare namespace create {
  /** Isolates imported source graphs and shared stylesheet options. */
  type Options = {
    /** Keep development class names stable across value edits. */
    readonly development?: boolean | undefined
    /** Include the packaged reset in shared CSS. */
    readonly reset?: boolean | undefined
    /** Absolute application directory. */
    readonly root: string
  }
}

async function stamp(file: string) {
  const stat = await Fs.stat(file, { bigint: true })
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`
}
