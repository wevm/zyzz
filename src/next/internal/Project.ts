/** Retains filesystem snapshots and an incremental graph within a Next.js loader worker. @module */
import * as Contract from '../../compiler/internal/Contract.js'
import * as Fs from 'node:fs/promises'
import * as Graph from '../../compiler/Graph.js'
import type * as NativeFs from 'node:fs'
import * as Path from 'node:path'
import * as Reset from '../../node/Reset.js'
import * as Syntax from '../../compiler/internal/Syntax.js'

/** Resolution and dependency notifications supplied by the active loader invocation. */
export type Context = {
  /** Track graph membership changes. */
  addContextDependency(directory: string): void
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
  const directories = new Map<
    string,
    { items: NativeFs.Dirent[]; track: boolean; version: string }
  >()
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
    compile(context: Context, source?: string) {
      // Loader calls may overlap, but only one immutable snapshot updates the compiler at a time.
      const result = pending.then(async () => {
        try {
          return await compile(context, source)
        } catch (error) {
          // Failed discovery or extraction may leave a partial filesystem snapshot.
          compiler = Graph.create()
          directories.clear()
          files.clear()
          libraries.clear()
          syntax.clear()
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

  async function compile(context: Context, source?: string) {
    const root = options.root
    const tracked = new Set<string>()
    function track(file: string) {
      if (tracked.has(file)) return
      tracked.add(file)
      context.addDependency(file)
    }
    const programs = new Map<string, ReturnType<typeof Syntax.parse>>()
    const seenDirectories = new Set<string>()
    const seenFiles = new Set<string>()
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
      seenFiles.add(file)
      const version = await stamp(file)
      let entry = files.get(file)
      if (entry?.version !== version) {
        entry = { source: await Fs.readFile(file, 'utf8'), version }
        files.set(file, entry)
      }
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

    async function visit(file: string, text?: string): Promise<void> {
      const name = id(file)
      if (Object.hasOwn(modules, name)) return

      track(file)
      seenFiles.add(file)
      modules[name] = text ?? (await read(file))
      const links: Record<string, string | null> = Object.create(null)
      imports[name] = links
      let entry = syntax.get(name)
      if (entry?.source !== modules[name]) {
        entry = {
          source: modules[name]!,
          parsed: Syntax.parse({ moduleId: name, source: modules[name]! }),
        }
        syntax.set(name, entry)
      }
      programs.set(name, entry.parsed)
      const parsed = entry.parsed

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
          return { specifier, resolved }
        }),
      )
      for (const resolution of resolutions) {
        if (!resolution) continue
        const { specifier, resolved } = resolution
        if (!resolved || !/\.[cm]?[jt]sx?$/.test(resolved)) continue
        if (eligible(resolved)) {
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

    async function discover(directory: string): Promise<void> {
      const version = await stamp(directory)
      let cached = directories.get(directory)
      if (cached?.version !== version) {
        const items = await Fs.readdir(directory, { withFileTypes: true })
        cached = {
          items,
          track:
            !items.some((item) => item.name === 'node_modules') ||
            !(await loops(directory)),
          version,
        }
        directories.set(directory, cached)
      }
      seenDirectories.add(directory)
      const items = cached.items

      // Linked package roots are tracked through children to avoid recursive dependency loops.
      if (cached.track) context.addContextDependency(directory)

      for (const item of items) {
        if (
          item.name.startsWith('.') ||
          [
            'node_modules',
            'dist',
            'build',
            'coverage',
            'test',
            'tests',
            '__tests__',
          ].includes(item.name)
        )
          continue
        const file = Path.join(directory, item.name)
        if (item.isDirectory()) await discover(file)
        else if (item.isFile() && eligible(file)) await visit(file)
      }
    }

    if (source !== undefined) await visit(context.resourcePath, source)
    await discover(root)
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
      contracts,
      imports,
      modules,
      reset,
    })

    for (const file of files.keys())
      if (!seenFiles.has(file)) files.delete(file)
    for (const file of directories.keys())
      if (!seenDirectories.has(file)) directories.delete(file)
    for (const file of libraries.keys())
      if (!Object.hasOwn(contracts, file)) libraries.delete(file)
    for (const name of syntax.keys())
      if (!programs.has(name)) syntax.delete(name)

    return graph
  }
}

/** Project cache settings. */
export declare namespace create {
  /** Isolates source discovery and shared stylesheet options. */
  type Options = {
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

/** Whether an installed dependency links back to the directory or one of its ancestors. */
async function loops(directory: string): Promise<boolean> {
  const installed = Path.join(directory, 'node_modules')
  const entries = await Fs.readdir(installed, { withFileTypes: true }).catch(
    () => [],
  )
  const candidates = (
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.name.startsWith('@'))
          return [Path.join(installed, entry.name)]

        const scoped = Path.join(installed, entry.name)

        return (await Fs.readdir(scoped).catch(() => [])).map((name) =>
          Path.join(scoped, name),
        )
      }),
    )
  ).flat()

  for (const candidate of candidates) {
    const stat = await Fs.lstat(candidate).catch(() => undefined)
    if (!stat?.isSymbolicLink()) continue

    const target = await Fs.realpath(candidate).catch(() => undefined)
    if (target === undefined) continue

    const relative = Path.relative(target, directory)
    if (!relative.startsWith('..') && !Path.isAbsolute(relative)) return true
  }

  return false
}
