/**
 * Processes standalone CSS and publishes incremental file builds with watch recovery.
 * @module
 */
import type * as LightningCss from 'lightningcss'
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Crypto from 'node:crypto'
import * as NativeFs from 'node:fs'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Graph from '../compiler/Graph.js'
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
 * Source modules remain TypeScript/JSX; transpilation and CSS loading belong to the consumer.
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

  const outDir = Path.resolve(options.outDir)
  const root = await Fs.realpath(options.root)

  if (inside(outDir, root))
    throw new Error('Output must not contain the source directory.')

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
  let watcher: NativeFs.FSWatcher | undefined

  async function perform(): Promise<Build> {
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

    const graph = compiler.compile({
      modules: Object.fromEntries(
        Object.entries(sources).map(([name, source]) => [
          `${options.packageId}/${name}`,
          source,
        ]),
      ),
    })

    const generated = new Set(
      [
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
      ].map((name) => (insensitive ? name.toLowerCase() : name)),
    )

    if (graph.sharedCss) {
      const assets = new Map<string, string>()

      const shared =
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
                Url(url) {
                  const target = graph.sharedAssets?.[url.url]
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
                    throw new Error(
                      'Asset path conflicts with generated output.',
                    )

                  if (
                    filename
                      .split('/')
                      .some((part) =>
                        ['.zyzz.json', '.zyzz-lock'].includes(
                          part.toLowerCase(),
                        ),
                      )
                  )
                    throw new Error(
                      'Asset path conflicts with host control files.',
                    )

                  assets.set(filename, Path.join(root, filename))

                  return {
                    ...url,
                    url:
                      filename.split('/').map(encodeURIComponent).join('/') +
                      relative.slice(relative.split(/[?#]/)[0]!.length),
                  }
                },
              },
            })

      for (const [name, file] of assets) {
        const real = await Fs.realpath(file)
        if (!inside(root, real))
          throw new Error('Asset path escapes the package root.')

        artifacts.set(name, await Fs.readFile(real))
      }

      artifacts.set('zyzz.shared.css', Buffer.from(shared.code).toString())
      artifacts.set('zyzz.shared.css.map', Buffer.from(shared.map!).toString())
    }

    for (const name of Object.keys(sources)) {
      const output = graph.modules[`${options.packageId}/${name}`]!

      const contract = graph.contracts[`${options.packageId}/${name}`]

      if (contract) artifacts.set(`${name}.zyzz.json`, contract)

      artifacts.set(name, output.code)
      artifacts.set(`${name}.map`, JSON.stringify(output.map))

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
    }

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

    try {
      for (const [name] of before) {
        const content =
          name === '.zyzz.json' ? nextManifest : artifacts.get(name)
        const path = Path.join(outDir, name)

        applied.push(name)

        if (content === undefined) await Fs.rm(path, { force: true })
        else await write(path, content)
      }
    } catch (error) {
      for (const name of applied.reverse()) {
        const content = before.get(name)
        const path = Path.join(outDir, name)

        if (content === undefined) await Fs.rm(path, { force: true })
        else await write(path, content)
      }

      throw error
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
    watcher?.close()

    closing = (async () => {
      await tail
      await lock.close()
      await Fs.rm(lockPath)
    })()

    return closing
  }

  function watch(watchOptions: watch.Options) {
    if (closed) throw new Error('Host is closed.')
    if (watcher) throw new Error('Host is already watching.')

    let dirty = false
    let running = false

    async function flush() {
      if (running) return

      running = true

      try {
        while (dirty && !closed) {
          dirty = false

          const event: Event = await build().then(
            (result) => ({ result }),
            (error: unknown) => ({ error }),
          )

          if (!closed) watchOptions.onResult(event)
        }
      } finally {
        running = false
      }
    }

    watcher = NativeFs.watch(root, { recursive: true }, (_event, filename) => {
      if (filename && inside(outDir, Path.resolve(root, filename))) return

      dirty = true
      void flush()
    })

    watcher.on('error', (error) => watchOptions.onResult({ error }))
    dirty = true
    void flush()
  }

  return { [Symbol.asyncDispose]: close, build, close, watch }
}

/** File host creation contracts. */
export declare namespace create {
  /** Explicit filesystem and module-identity boundaries. */
  type Options = {
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
    /** Output directory exclusively locked until close; may be nested under root. */
    readonly outDir: string
    /** Stable package identity prepended to relative source module IDs. */
    readonly packageId: string
    /** Directory scanned for supported JavaScript/TypeScript source files. */
    readonly root: string
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
