/**
 * Processes standalone CSS and publishes incremental file builds with watch recovery.
 * @module
 */
import * as Mapping from '@jridgewell/gen-mapping'
import type * as LightningCss from 'lightningcss'
import * as Crypto from 'node:crypto'
import * as NativeFs from 'node:fs'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { ResolverFactory } from 'oxc-resolver'
import * as Graph from '../compiler/Graph.js'
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Catalogs from '../compiler/internal/Catalogs.js'
import * as Relative from '../compiler/internal/Relative.js'
import * as Syntax from '../compiler/internal/Syntax.js'
import * as Source from '../compiler/Source.js'
import * as Transform from '../compiler/Transform.js'

/** A successful publication; paths are relative to the output directory. */
export type Build = {
  /** Written or removed artifacts, excluding the ownership manifest. */
  readonly changed: readonly string[]
  /** Complete live artifact list, excluding the ownership manifest. */
  readonly files: readonly string[]
}

/**
 * Opens an exclusively owned output lifecycle around the literal source transform.
 * Source modules remain TypeScript/JSX; transpilation belongs to the consumer.
 * Besides per-module stylesheets, every build publishes `zyzz.css`: shared
 * contributions followed by module stylesheets with dependencies before their
 * consumers, so an application loads one file. Configurations also publish
 * `zyzz.js`, the initialization that restores a saved theme and scheme, at
 * the configurable script path.
 * Lightning CSS processes stylesheets and composes maps before publication by default.
 * @param options - Source directory, separate output directory, and portable package identity.
 * @returns Explicit build, watch, and close operations. Close releases the output lock.
 */
export async function create(options: create.Options): Promise<Runtime> {
  type Stylesheet = { code: string; map: string }

  const css =
    options.css === false
      ? false
      : {
          minify: options.css?.minify ?? false,
          targets: { ...options.css?.targets },
        }

  const native = options.native
    ? Object.freeze({
        ...options.native,
        fonts:
          options.native.fonts && Object.freeze({ ...options.native.fonts }),
        // Theme definitions are immutable. Only the caller-owned catalog needs copying.
        vars: options.native.vars && Object.freeze({ ...options.native.vars }),
        units:
          options.native.units && Object.freeze({ ...options.native.units }),
      })
    : undefined

  if (native && (options.compiler === false || options.modules === false))
    throw new Error('Native builds require rewritten module output.')

  const outDir = Path.resolve(options.outDir ?? 'dist')
  const root = await Fs.realpath(options.root)

  if (inside(outDir, root))
    throw new Error('Output must not contain the source directory.')

  // A script inside the output is an owned artifact; elsewhere it is rewritten
  // in place so a bundler's public directory can serve it verbatim.
  const script = (() => {
    if (native || options.script === false) return undefined

    const path = Path.resolve(options.script ?? Path.join(outDir, 'zyzz.js'))

    if (path !== outDir && inside(outDir, path))
      return { owned: Path.relative(outDir, path).split(Path.sep).join('/') }
    if (inside(root, path))
      throw new Error(
        'The script path must not be inside the source directory.',
      )

    return { external: path }
  })()

  Transform.compile({
    moduleId: `${options.packageId}/identity.ts`,
    source: '',
  })

  await Fs.mkdir(outDir, { recursive: true })

  if ((await Fs.realpath(outDir)) !== outDir)
    throw new Error('Output paths must not contain symbolic links.')

  const lockPath = Path.join(outDir, '.zyzz-lock')
  const lock = await Fs.open(lockPath, 'wx')

  // Probe the actual output filesystem using the already exclusively owned lock.
  const insensitive = await (async () => {
    try {
      const alternate = await Fs.stat(Path.join(outDir, '.ZYZZ-LOCK'))
      const original = await lock.stat()

      return alternate.dev === original.dev && alternate.ino === original.ino
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return false

      await lock.close()
      await Fs.rm(lockPath)
      throw error
    }
  })()

  const manifestPath = Path.join(outDir, '.zyzz.json')

  const compiler = Graph.create()
  const stylesheets = new WeakMap<Transform.compile.ReturnType, Stylesheet>()
  let closed = false
  let closing: Promise<void> | undefined
  let tail: Promise<void> = Promise.resolve()
  const watchers = new Map<
    string,
    { inode: number; watcher: NativeFs.FSWatcher }
  >()
  let watching = false

  type Dependency = {
    inode?: number | undefined
    listener: (current: NativeFs.Stats, previous: NativeFs.Stats) => void
    watcher?: NativeFs.FSWatcher | undefined
  }
  const dependencies = new Map<string, Dependency>()
  let invalidate: (() => void) | undefined
  let previousContracts = new Set<string>()
  let previousImports: Record<string, Record<string, string | null>> = {}
  let report: ((error: unknown) => void) | undefined

  async function perform(): Promise<Build> {
    const observed = new Set<string>()

    function observe(path: string, directory = false) {
      observed.add(path)
      if (!watching || closed) return

      let dependency = dependencies.get(path)
      if (!dependency) {
        const listener = (
          current: NativeFs.Stats,
          previous: NativeFs.Stats,
        ) => {
          if (
            current.ino !== previous.ino ||
            current.dev !== previous.dev ||
            current.mtimeMs !== previous.mtimeMs ||
            current.ctimeMs !== previous.ctimeMs
          )
            invalidate?.()
        }
        dependency = { listener }
        dependencies.set(path, dependency)
        // Path polling survives removal, atomic replacement, and symlink retargeting.
        NativeFs.watchFile(path, { interval: 250, persistent: false }, listener)
      }
      if (!directory) return

      const status = NativeFs.statSync(path, { throwIfNoEntry: false })
      if (status?.ino === dependency.inode) return

      dependency.watcher?.close()
      dependency.watcher = undefined
      dependency.inode = status?.ino
      if (!status?.isDirectory()) return

      const real = NativeFs.realpathSync(path)
      dependency.watcher = NativeFs.watch(
        path,
        { recursive: true },
        (_event, filename) => {
          if (filename && inside(outDir, Path.join(real, filename.toString())))
            return
          if (
            filename &&
            /(?:^|[/\\])(?:node_modules|\.git)(?:[/\\]|$)/.test(
              filename.toString(),
            )
          )
            return
          invalidate?.()
        },
      )
      dependency.watcher.on('error', (error) => {
        dependency.inode = undefined
        report?.(error)
      })
    }

    const inputs: string[] = []

    async function scan(directory: string) {
      for (const entry of await Fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const path = Path.join(directory, entry.name)
        if (
          inside(outDir, path) ||
          entry.name === '.git' ||
          [
            'node_modules',
            'test',
            'tests',
            '__tests__',
            'fixtures',
            '__fixtures__',
          ].includes(entry.name)
        )
          continue

        if (entry.isDirectory()) await scan(path)
        else if (
          entry.isFile() &&
          /\.[cm]?[jt]sx?$/.test(entry.name) &&
          !/\.(?:d|test|test-d|bench)\.[cm]?[jt]sx?$/.test(entry.name)
        )
          inputs.push(path)
      }
    }

    await scan(root)
    inputs.sort()

    const artifacts = new Map<string, string | Uint8Array>()
    const sources: Record<string, string> = Object.create(null)

    for (const input of inputs) {
      const name = Path.relative(root, input).split(Path.sep).join('/')
      if (
        ['.zyzz-lock', '.zyzz.json'].includes(name.split('/')[0]!.toLowerCase())
      )
        throw new Error(
          `Source path conflicts with host control files: ${name}`,
        )

      sources[name] = await Fs.readFile(input, 'utf8')
    }

    const modules = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [
        `${options.packageId}/${name}`,
        source,
      ]),
    )
    const contracts: Record<string, string> = Object.create(null)
    const imports: Record<
      string,
      Record<string, string | null>
    > = Object.create(null)
    // A build gets fresh package metadata, including changed export maps.
    const resolver = new ResolverFactory({
      builtinModules: true,
      conditionNames: ['node', 'import'],
      nodePath: false,
    })

    function resolve(specifier: string, importer: string): string | undefined {
      const packageName = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]!
      for (let directory = Path.dirname(importer); ; ) {
        observe(Path.join(directory, 'package.json'))
        observe(Path.join(directory, 'node_modules'))
        if (
          !specifier.startsWith('.') &&
          !specifier.startsWith('#') &&
          !Path.isAbsolute(specifier)
        )
          observe(Path.join(directory, 'node_modules', packageName), true)
        const parent = Path.dirname(directory)
        if (parent === directory) break
        directory = parent
      }
      const resolved = resolver.sync(Path.dirname(importer), specifier)

      if (resolved.builtin) return undefined
      if (!resolved.path)
        throw new Error(
          `Unable to resolve ${JSON.stringify(specifier)} from ${importer}: ${resolved.error}`,
        )

      observe(resolved.path)
      if (resolved.packageJsonPath) observe(resolved.packageJsonPath)
      return resolved.path
    }

    async function contract(file: string, required = false): Promise<boolean> {
      if (Object.hasOwn(contracts, file)) return true

      observe(`${file}.zyzz.json`)
      try {
        contracts[file] = await Fs.readFile(`${file}.zyzz.json`, 'utf8')
      } catch (error) {
        if (
          !required &&
          !previousContracts.has(file) &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        )
          return false
        throw error
      }

      const metadata = (() => {
        try {
          return JSON.parse(contracts[file]!) as {
            stylesheets?: { dependency?: string[] }[]
          }
        } catch (error) {
          Graph.compile({
            modules: {},
            contracts: { [file]: contracts[file]! },
          })
          throw error
        }
      })()

      if (!Array.isArray(metadata?.stylesheets)) return true

      for (const section of metadata.stylesheets) {
        if (!Array.isArray(section?.dependency)) continue

        let owner = file
        for (const specifier of section.dependency) {
          if (
            typeof specifier !== 'string' ||
            !specifier ||
            specifier.includes('\0')
          )
            throw new Error('Invalid packed stylesheet dependency.')

          const target = resolve(specifier, owner)
          if (!target)
            throw new Error('Unable to resolve packed stylesheet dependency.')

          ;(imports[owner] ??= Object.create(null))[specifier] = target
          await contract(target, true)
          owner = target
        }
      }

      return true
    }

    for (const [name, source] of Object.entries(sources)) {
      const moduleId = `${options.packageId}/${name}`
      const file = Path.join(root, name)
      const resolutions = (imports[moduleId] = Object.create(null))

      for (const node of Syntax.parse({ moduleId, source }).program.body) {
        if (
          (node.type !== 'ImportDeclaration' &&
            node.type !== 'ExportNamedDeclaration' &&
            node.type !== 'ExportAllDeclaration') ||
          !node.source
        )
          continue

        const specifier = node.source.value
        resolutions[specifier] = null
        if (
          node.type === 'ImportDeclaration'
            ? node.importKind === 'type'
            : node.exportKind === 'type'
        )
          continue
        if (
          'specifiers' in node &&
          node.specifiers.length &&
          node.specifiers.every((specifier) =>
            specifier.type === 'ImportSpecifier'
              ? specifier.importKind === 'type'
              : specifier.type === 'ExportSpecifier' &&
                specifier.exportKind === 'type',
          )
        )
          continue
        if (
          specifier === 'zyzz' ||
          (specifier.startsWith('zyzz/') && specifier !== 'zyzz/default')
        )
          continue
        if (
          /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(specifier) ||
          specifier.includes('?') ||
          (!specifier.startsWith('#') && specifier.includes('#'))
        )
          continue
        try {
          if (specifier.startsWith('.')) {
            const target = Relative.resolve({ moduleId, modules, specifier })
            if (target) resolutions[specifier] = target
            continue
          }

          const target = resolve(specifier, file)
          if (!target) continue
          const relative = Path.relative(root, target).split(Path.sep).join('/')
          if (Object.hasOwn(sources, relative))
            resolutions[specifier] = `${options.packageId}/${relative}`
          else if (/\.[cm]?[jt]sx?$/.test(target)) {
            const previous = previousImports[moduleId]?.[specifier]
            if (
              await contract(
                target,
                !!previous && previousContracts.has(previous),
              )
            )
              resolutions[specifier] = target
          }
        } catch (error) {
          throw new Source.ExtractError([
            {
              code: 'unsupported_syntax',
              source: moduleId,
              start: node.start,
              end: node.end,
              message: (error as Error).message,
            },
          ])
        }
      }
    }

    const graph = compiler.compile({
      compiler: options.compiler,
      native,
      modules,
      contracts,
      imports,
    })

    const artifactNames = [
      'zyzz.css',
      'zyzz.css.map',
      'zyzz.shared.css',
      'zyzz.shared.css.map',
      '.zyzz.json',
      '.zyzz-lock',
      ...Object.keys(sources).flatMap((name) => [
        name,
        `${name}.map`,
        `${name}.css`,
        `${name}.css.map`,
        `${name}.zyzz.json`,
      ]),
    ].map((name) => (insensitive ? name.toLowerCase() : name))

    // The script is one more owned artifact, so it must not replace another.
    if (
      script?.owned &&
      artifactNames.includes(
        insensitive ? script.owned.toLowerCase() : script.owned,
      )
    )
      throw new Error(
        `The script path collides with the artifact ${script.owned}.`,
      )

    const generated = new Set([
      ...(script?.owned ? [script.owned] : []),
      ...artifactNames,
    ])

    let shared: Stylesheet | undefined

    if (graph.sharedCss) {
      const assets = new Map<string, string>()
      function relocate(
        url: LightningCss.Url,
        target = graph.sharedAssets?.[url.url],
      ) {
        if (!target) return
        if (!target.startsWith(`${options.packageId}/`))
          throw new Error('Asset path escapes the package root.')
        const relative = target.slice(options.packageId.length + 1)
        const decoded = decodeURIComponent(relative.split(/[?#]/)[0]!)
        const filename = Path.posix.normalize(decoded)
        if (
          filename === '..' ||
          filename.startsWith('../') ||
          filename.startsWith('/') ||
          filename.includes('\\') ||
          filename.includes('\0') ||
          filename.includes(':')
        )
          throw new Error('Asset path escapes the package root.')
        if (
          filename.split('/').some((_, index, parts) => {
            const ancestor = parts.slice(0, index + 1).join('/')
            return generated.has(
              insensitive ? ancestor.toLowerCase() : ancestor,
            )
          })
        )
          throw new Error('Asset path conflicts with generated output.')
        if (
          filename
            .split('/')
            .some((part) =>
              ['.zyzz.json', '.zyzz-lock'].includes(part.toLowerCase()),
            )
        )
          throw new Error('Asset path conflicts with host control files.')
        assets.set(filename, Path.join(root, filename))
        return {
          ...url,
          url:
            filename.split('/').map(encodeURIComponent).join('/') +
            relative.slice(relative.split(/[?#]/)[0]!.length),
        }
      }

      const processed =
        css === false && !Object.keys(graph.sharedAssets ?? {}).length
          ? {
              code: Buffer.from(graph.sharedCss),
              map: Buffer.from(JSON.stringify(graph.sharedCssMap)),
            }
          : AtRules.transform({
              filename: 'zyzz.shared.css',
              code: Buffer.from(graph.sharedCss),
              sourceMap: true,
              inputSourceMap: JSON.stringify(graph.sharedCssMap),
              minify: css === false ? false : css.minify,
              ...(css === false ? {} : { targets: css.targets }),
              visitor: {
                Rule(rule) {
                  if (rule.type !== 'import') return
                  const url = relocate({
                    url: rule.value.url,
                    loc: rule.value.loc,
                  })
                  if (url) return AtRules.relocateImport(rule.value, url.url)
                },
                Url: relocate,
              },
            })

      for (const [name, file] of assets) {
        const real = await Fs.realpath(file)
        if (!inside(root, real))
          throw new Error('Asset path escapes the package root.')
        const content = await Fs.readFile(real)
        if (name.endsWith('.css')) {
          function discover(url: string) {
            if (!url || /^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i.test(url)) return
            const target = `${options.packageId}/${Path.posix.join(Path.posix.dirname(name), url)}`
            relocate({ url, loc: { line: 1, column: 1 } }, target)
          }
          AtRules.transform({
            filename: name,
            code: content,
            visitor: {
              Rule(rule) {
                if (rule.type === 'import') discover(rule.value.url)
              },
              Url(url) {
                discover(url.url)
              },
            },
          })
        }
        artifacts.set(name, content)
      }

      shared = {
        code: Buffer.from(processed.code).toString(),
        map: Buffer.from(processed.map!).toString(),
      }

      artifacts.set('zyzz.shared.css', shared.code)
      artifacts.set('zyzz.shared.css.map', shared.map)
    }

    const moduleStylesheets = new Map<string, Stylesheet>()

    for (const name of Object.keys(sources)) {
      const output = graph.modules[`${options.packageId}/${name}`]!

      const contract = graph.contracts[`${options.packageId}/${name}`]

      if (options.modules !== false) {
        if (contract) artifacts.set(`${name}.zyzz.json`, contract)
        artifacts.set(name, output.code)
        artifacts.set(`${name}.map`, JSON.stringify(output.map))
      }

      if (native) continue

      let stylesheet = stylesheets.get(output)

      if (!stylesheet) {
        if (css === false)
          stylesheet = { code: output.css, map: JSON.stringify(output.cssMap) }
        else {
          const result = AtRules.transform({
            code: Buffer.from(output.css),
            filename: `${options.packageId}/${name}.css`,
            inputSourceMap: JSON.stringify(output.cssMap),
            minify: css.minify,
            sourceMap: true,
            targets: css.targets,
          })

          stylesheet = {
            code: Buffer.from(result.code).toString(),
            map: Buffer.from(result.map!).toString(),
          }
        }

        stylesheets.set(output, stylesheet)
      }

      artifacts.set(`${name}.css`, stylesheet.code)
      artifacts.set(`${name}.css.map`, stylesheet.map)
      // Module URLs resolve beside the module file; the complete stylesheet at
      // the output root carries a copy with those URLs rebased.
      moduleStylesheets.set(
        `${options.packageId}/${name}`,
        rebase(stylesheet, name, css === false ? false : css.minify),
      )
    }

    // The complete stylesheet follows the module graph so a consumer's rules
    // cascade over the rules of the modules it imports.
    if (shared || moduleStylesheets.size) {
      const complete = concatenate([
        ...(shared ? [shared] : []),
        ...order(graph.dependencies, [...moduleStylesheets.keys()]).map(
          (id) => moduleStylesheets.get(id)!,
        ),
      ])

      artifacts.set('zyzz.css', complete.code)
      artifacts.set('zyzz.css.map', complete.map)
    }

    // Every configuration in the tree restores its saved selection from one script.
    const initialization = Catalogs.scripts(
      Object.values({ ...contracts, ...graph.contracts }).flatMap(
        Catalogs.read,
      ),
    ).join('\n')

    const content = initialization ? `${banner}${initialization}\n` : undefined

    if (script?.owned && content) artifacts.set(script.owned, content)

    // An external script has no ownership record. Its leading banner marks
    // output this host may replace or remove; any other file there is foreign.
    const external = await (async () => {
      if (!script?.external) return undefined

      const current = await read(script.external)

      if (current !== undefined && !current.startsWith(banner))
        throw new Error(
          `Refusing to replace a foreign script: ${script.external}`,
        )

      return { current, next: content, path: script.external }
    })()

    await regular(manifestPath, outDir)

    const previous = await read(manifestPath)
    const owned =
      previous === undefined ? {} : manifest(previous, options.packageId)
    const key = (name: string) => (insensitive ? name.toLowerCase() : name)
    const ownedNames = new Map(
      Object.keys(owned).map((name) => [key(name), name]),
    )
    const liveNames = new Map<string, string>()

    for (const name of artifacts.keys()) {
      if (liveNames.has(key(name)))
        throw new Error(`Output paths differ only in case: ${name}`)

      liveNames.set(key(name), name)
    }

    const hashes: Record<string, string> = Object.create(null)
    const before = new Map<string, string | Uint8Array | undefined>()
    const changed: string[] = []

    for (const name of new Set([...Object.keys(owned), ...artifacts.keys()])) {
      // A case-only rename still owns the same physical file. Do not delete its old alias.
      if (!artifacts.has(name) && liveNames.has(key(name))) continue

      const owner = ownedNames.get(key(name))
      const path = Path.join(outDir, name)

      await regular(path, outDir)

      const content = await read(path, true)
      const expected = owner === undefined ? undefined : owned[owner]
      if (
        content !== undefined &&
        (expected === undefined || hash(content) !== expected)
      )
        throw new Error(
          `Refusing to replace an unowned or modified output: ${name}`,
        )

      const next = artifacts.get(name)

      if (next !== undefined) hashes[name] = hash(next)

      if (
        (content === undefined || next === undefined
          ? content !== next
          : hash(content) !== hash(next)) ||
        (owner !== undefined && owner !== name)
      ) {
        before.set(name, content)
        changed.push(name)
      }
    }

    const nextManifest = JSON.stringify({
      files: hashes,
      packageId: options.packageId,
      version: 1,
    })

    if (nextManifest !== previous) before.set('.zyzz.json', previous)

    // Compile and verify ownership before publishing. Restore applied writes if publication fails.
    const applied: string[] = []
    let externalApplied = false

    async function place(
      path: string,
      content: string | Uint8Array | undefined,
    ) {
      if (content === undefined) await Fs.rm(path, { force: true })
      else await write(path, content)
    }

    try {
      for (const [name] of before) {
        const content =
          name === '.zyzz.json' ? nextManifest : artifacts.get(name)

        applied.push(name)
        await place(Path.join(outDir, name), content)
      }

      // The external script joins the transaction so a rejected build leaves it untouched.
      if (external && external.next !== external.current) {
        externalApplied = true
        await place(external.path, external.next)
      }
    } catch (error) {
      // The external path may stay unwritable, which must not skip the owned rollback.
      if (externalApplied)
        await place(external!.path, external!.current).catch(() => {})

      for (const name of applied.reverse())
        await place(Path.join(outDir, name), before.get(name))

      throw error
    }

    previousContracts = new Set(Object.keys(contracts))
    previousImports = imports
    for (const [path, dependency] of dependencies) {
      if (observed.has(path)) continue
      NativeFs.unwatchFile(path, dependency.listener)
      dependency.watcher?.close()
      dependencies.delete(path)
    }

    return { changed: changed.sort(), files: [...artifacts.keys()].sort() }
  }

  function build(): Promise<Build> {
    if (closed) return Promise.reject(new Error('Host is closed.'))

    const pending = tail.then(perform)

    tail = pending.then(
      () => {},
      () => {},
    )

    return pending
  }

  function close(): Promise<void> {
    if (closing) return closing

    closed = true
    for (const { watcher } of watchers.values()) watcher.close()
    watchers.clear()
    for (const [path, dependency] of dependencies) {
      NativeFs.unwatchFile(path, dependency.listener)
      dependency.watcher?.close()
    }
    dependencies.clear()

    closing = (async () => {
      await tail
      await lock.close()
      await Fs.rm(lockPath)
    })()

    return closing
  }

  function watch(watchOptions: watch.Options) {
    if (closed) throw new Error('Host is closed.')
    if (watching) throw new Error('Host is already watching.')
    watching = true
    report = (error) => {
      if (!closed) watchOptions.onResult({ error })
    }

    let dirty = false
    let running = false
    invalidate = () => {
      dirty = true
      void flush()
    }

    async function flush() {
      if (running) return

      running = true

      try {
        while (dirty && !closed) {
          dirty = false

          const seen = new Set<string>()
          const event: Event = await directories(root, seen)
            .then(() => {
              for (const [directory, { watcher }] of watchers)
                if (!seen.has(directory)) {
                  watcher.close()
                  watchers.delete(directory)
                }
            })
            .then(() => build())
            .then(
              (result) => ({ result }),
              (error: unknown) => ({ error }),
            )

          if (!closed) watchOptions.onResult(event)
        }
      } finally {
        running = false
      }
    }

    async function directories(
      directory: string,
      seen: Set<string>,
    ): Promise<void> {
      if (closed || inside(outDir, directory)) return
      // Watch directories rather than file inodes, which atomic editor saves replace.
      const status = await Fs.stat(directory).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
          return undefined
        },
      )
      if (closed) return
      if (status) seen.add(directory)
      if (!status || watchers.get(directory)?.inode !== status.ino) {
        watchers.get(directory)?.watcher.close()
        watchers.delete(directory)
      }
      if (!status) return
      if (!watchers.has(directory)) {
        const watcher = NativeFs.watch(directory, () => {
          dirty = true
          void flush()
        })
        watcher.on('error', (error) => watchOptions.onResult({ error }))
        watchers.set(directory, { inode: status.ino, watcher })
      }
      const entries = await Fs.readdir(directory, {
        withFileTypes: true,
      }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
        watchers.get(directory)?.watcher.close()
        watchers.delete(directory)
        return []
      })
      for (const entry of entries)
        if (
          entry.isDirectory() &&
          !['.git', 'node_modules'].includes(entry.name)
        )
          await directories(Path.join(directory, entry.name), seen)
    }

    dirty = true
    void flush()
  }

  return { [Symbol.asyncDispose]: close, build, close, watch }
}

/** File host creation contracts. */
export declare namespace create {
  /** Explicit filesystem and module-identity boundaries. */
  type Options = {
    /** Rewrite source calls. False requires runtime-compatible explicit identities. */
    readonly compiler?: boolean | undefined
    /** Publish rewritten modules and metadata alongside CSS. Defaults to true. */
    readonly modules?: boolean | undefined
    /** Lightning CSS processing; false preserves intermediate CSS. Enabled by default. */
    readonly css?:
      | false
      | {
          /** Minify emitted stylesheets. Defaults to false. */
          readonly minify?: boolean | undefined
          /** Lightning CSS browser versions, encoded as major << 16 | minor << 8 | patch. No targets by default. */
          readonly targets?: Readonly<LightningCss.Targets> | undefined
        }
      | undefined
    /** Native context captured at creation. Emits modules and maps without CSS or web initialization. */
    readonly native?: Graph.compile.Options['native']
    /** Output directory exclusively locked until close; may be nested under root. Defaults to `dist`. */
    readonly outDir?: string | undefined
    /** Stable package identity prepended to relative source module IDs. */
    readonly packageId: string
    /** Directory scanned for supported JavaScript/TypeScript source files. */
    readonly root: string
    /**
     * Path of the initialization script restoring saved theme selections.
     * Defaults to `zyzz.js` inside the output directory, where it is an owned
     * artifact. A path elsewhere, such as a bundler's public directory, is
     * rewritten in place without ownership. False disables the script.
     */
    readonly script?: string | false | undefined
  }
}

/** Watch builds report failures without discarding the last successful output. */
export type Event = { readonly error: unknown } | { readonly result: Build }

/** An explicitly disposed file host. */
export type Runtime = {
  /** Stops watching, drains builds, and releases ownership when an await using scope exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>
  /** Serializes a complete scan, compile, and publication; failures reject. */
  readonly build: () => Promise<Build>
  /** Stops watching, drains builds, and releases ownership. Idempotent. */
  readonly close: () => Promise<void>
  /** Starts recursive filesystem watching and an initial build. */
  readonly watch: (options: watch.Options) => void
}

/** Watch notification contracts. */
export declare namespace watch {
  /** Callback ownership remains with the host consumer. */
  type Options = {
    /** Receives successful builds and failures; must not throw. */
    readonly onResult: (event: Event) => void
  }
}

/** Leading comment marking initialization scripts this host wrote. */
const banner = '/* zyzz initialization */\n'

/** Joins processed stylesheets and shifts their composed maps by the preceding line count. */
function concatenate(parts: readonly { code: string; map: string }[]) {
  const map = new Mapping.GenMapping({ file: 'zyzz.css' })
  const chunks: string[] = []
  let offset = 0

  for (const part of parts) {
    if (!part.code) continue

    const code = part.code.endsWith('\n') ? part.code : `${part.code}\n`
    const traced = Mapping.fromMap(part.map)

    for (const mapping of Mapping.allMappings(traced)) {
      const generated = {
        column: mapping.generated.column,
        line: mapping.generated.line + offset,
      }

      if (mapping.source !== undefined && mapping.original !== undefined) {
        const location = {
          generated,
          original: mapping.original,
          source: mapping.source,
        }

        if (mapping.name === undefined) Mapping.addMapping(map, location)
        else Mapping.addMapping(map, { ...location, name: mapping.name })
      } else Mapping.addMapping(map, { generated })
    }

    const encoded = Mapping.toEncodedMap(traced)

    for (const [index, source] of encoded.sources.entries())
      if (source !== null)
        Mapping.setSourceContent(
          map,
          source,
          encoded.sourcesContent?.[index] ?? null,
        )

    chunks.push(code)
    offset += code.split('\n').length - 1
  }

  return {
    code: chunks.join(''),
    map: JSON.stringify(Mapping.toEncodedMap(map)),
  }
}

function hash(content: string | Uint8Array) {
  return Crypto.createHash('sha256').update(content).digest('hex')
}

function inside(parent: string, child: string) {
  const relative = Path.relative(parent, child)

  return (
    !relative ||
    (!relative.startsWith(`..${Path.sep}`) &&
      relative !== '..' &&
      !Path.isAbsolute(relative))
  )
}

function manifest(source: string, packageId: string): Record<string, string> {
  const value: unknown = JSON.parse(source)
  if (
    !value ||
    typeof value !== 'object' ||
    !('packageId' in value) ||
    value.packageId !== packageId ||
    !('version' in value) ||
    value.version !== 1 ||
    !('files' in value) ||
    !value.files ||
    typeof value.files !== 'object' ||
    Array.isArray(value.files)
  )
    throw new Error('Invalid output ownership manifest.')

  for (const [path, digest] of Object.entries(value.files))
    if (
      !path ||
      path.includes('\\') ||
      path.includes(':') ||
      path.split('/').some((part) => !part || part === '.' || part === '..') ||
      typeof digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(digest) ||
      ['.zyzz-lock', '.zyzz.json'].includes(path.split('/')[0]!.toLowerCase())
    )
      throw new Error('Invalid owned output path or digest.')

  return value.files as Record<string, string>
}

/** Orders module identities with dependencies before their consumers, seeded from graph roots. */
function order(
  dependencies: Readonly<Record<string, readonly string[]>>,
  ids: readonly string[],
) {
  const members = new Set(ids)
  const ordered: string[] = []
  const seen = new Set<string>()

  function visit(id: string) {
    if (seen.has(id)) return

    seen.add(id)

    for (const dependency of dependencies[id] ?? [])
      if (members.has(dependency)) visit(dependency)

    ordered.push(id)
  }

  // Graph roots seed the traversal so siblings keep their authored import
  // order; modules only reachable through cycles follow in name order.
  const imported = new Set(
    ids.flatMap((id) =>
      (dependencies[id] ?? []).filter((dependency) => members.has(dependency)),
    ),
  )

  for (const id of ids) if (!imported.has(id)) visit(id)
  for (const id of ids) visit(id)

  return ordered
}

async function read(path: string): Promise<string | undefined>
async function read(path: string, binary: true): Promise<Uint8Array | undefined>
async function read(
  path: string,
  binary = false,
): Promise<string | Uint8Array | undefined> {
  try {
    return binary ? await Fs.readFile(path) : await Fs.readFile(path, 'utf8')
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return undefined

    throw error
  }
}

/** Rewrites a nested module stylesheet's relative URLs against the output root. */
function rebase(
  stylesheet: { code: string; map: string },
  name: string,
  minify: boolean,
) {
  const directory = Path.posix.dirname(name)

  if (directory === '.' || !stylesheet.code.includes('url(')) return stylesheet

  const result = AtRules.transform({
    code: Buffer.from(stylesheet.code),
    filename: `${name}.css`,
    inputSourceMap: stylesheet.map,
    minify,
    sourceMap: true,
    visitor: {
      Url(url) {
        if (/^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i.test(url.url)) return url

        return { ...url, url: Path.posix.join(directory, url.url) }
      },
    },
  })

  return {
    code: Buffer.from(result.code).toString(),
    map: Buffer.from(result.map!).toString(),
  }
}

async function regular(path: string, root: string) {
  for (let current = path; current !== root; current = Path.dirname(current)) {
    try {
      const entry = await Fs.lstat(current)
      if (
        entry.isSymbolicLink() ||
        (current === path ? !entry.isFile() : !entry.isDirectory())
      )
        throw new Error('Output paths must be regular files and directories.')
    } catch (error) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
      )
        throw error
    }
  }
}

async function write(path: string, content: string | Uint8Array) {
  await Fs.mkdir(Path.dirname(path), { recursive: true })

  const temporary = `${path}.${Crypto.randomUUID()}.tmp`

  try {
    await Fs.writeFile(temporary, content, { flag: 'wx' })
    await Fs.rename(temporary, path)
  } finally {
    await Fs.rm(temporary, { force: true })
  }
}
