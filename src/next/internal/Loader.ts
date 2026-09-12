/**
 * Compiles project modules and their stylesheets inside the Next.js webpack and Turbopack loader runners.
 * @module
 */
import type * as Mapping from '@jridgewell/gen-mapping'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Parser from 'oxc-parser'
import * as Graph from '../../compiler/Graph.js'

/** Loader context capabilities shared by webpack and the Turbopack loader runner. */
export type Context = {
  /** Registers a file whose change re-runs this loader. */
  readonly addDependency: (file: string) => void
  /** Switches the loader to asynchronous completion. */
  readonly async: () => (
    error: Error | null,
    content?: string,
    map?: Mapping.EncodedSourceMap,
  ) => void
  /** Rule options; the wrapper supplies the active bundler. */
  readonly getOptions: () => unknown
  /** Creates a resolver bound to the active bundler configuration. */
  readonly getResolve: (
    options: Record<string, never>,
  ) => (context: string, request: string) => Promise<string | false | undefined>
  /** Absolute path of the module being processed. */
  readonly resourcePath: string
  /** Query attached to the module request, including the leading question mark. */
  readonly resourceQuery: string
  /** Project directory that bounds the compiled source graph. */
  readonly rootContext: string
}

/**
 * Physical stylesheet behind every webpack stylesheet request. Next.js accepts a `.css` resource
 * from Server Components and client bundles alike; the query selects the compiled CSS that
 * replaces its content. Plain imports of the package reset remain untouched.
 */
export const carrier = Path.resolve(
  Path.dirname(Url.fileURLToPath(import.meta.url)),
  '../../reset.css',
)

/** Query keys naming the source file whose stylesheet a webpack request asks for. */
export const queries = {
  module: 'zyzz.css',
  shared: 'zyzz.shared.css',
} as const

/** Resource queries that route a webpack stylesheet request back through this loader. */
export const stylesheet = /^\?zyzz(?:\.shared)?\.css=/

/**
 * Transforms eligible project modules and answers the stylesheet requests they import.
 * Modules compile through one graph compiler per entry; failures reject the loader callback so
 * the bundler reports them and retries after the next edit.
 */
export default function loader(this: Context, source: string): void {
  const callback = this.async()

  run(this, source).then(
    (output) => callback(null, output.code, output.map),
    (error: unknown) =>
      callback(error instanceof Error ? error : new Error(String(error))),
  )
}

type Compilation = {
  /** Visited source files, dependencies before their importers. */
  readonly order: readonly string[]
  readonly result: Graph.compile.ReturnType
}

type Output = {
  readonly code: string
  readonly map?: Mapping.EncodedSourceMap | undefined
}

// Loader modules live for the bundler process, which is the lifetime these caches follow.
const compilers = new Map<string, Graph.create.ReturnType>()

const excluded = /\.(?:d|test|test-d|bench)\.[cm]?[jt]sx?$/

const extension = /\.[cm]?[jt]sx?$/

async function run(context: Context, source: string): Promise<Output> {
  const file = context.resourcePath
  const root = context.rootContext
  const query = new URLSearchParams(context.resourceQuery)
  const shared = query.get(queries.shared)
  const owner = shared ?? query.get(queries.module)

  if (owner !== null && stylesheet.test(context.resourceQuery)) {
    const { result } = await compile(context, owner)

    if (shared !== null)
      return {
        code: result.sharedCss ?? '',
        map:
          result.sharedCssMap === undefined
            ? undefined
            : remap(result.sharedCssMap, root),
      }

    const output = result.modules[sourceId(root, owner)]!

    return { code: output.css, map: remap(output.cssMap, root) }
  }

  if (!eligible(root, file)) return { code: source }

  const bundler = (() => {
    const options = context.getOptions()

    if (
      options &&
      typeof options === 'object' &&
      'bundler' in options &&
      (options.bundler === 'turbopack' || options.bundler === 'webpack')
    )
      return options.bundler

    throw new Error('The Zyzz loader requires a bundler option.')
  })()

  const { order, result } = await compile(context, file, source)
  const output = result.modules[sourceId(root, file)]!
  const imports: string[] = []

  // Shared contributions load before every module stylesheet; dependencies precede importers.
  if (result.sharedCss)
    imports.push(
      bundler === 'webpack'
        ? request(file, 'shared')
        : inline(result.sharedCss),
    )

  for (const target of order) {
    const css = result.modules[sourceId(root, target)]?.css
    if (!css) continue

    imports.push(
      bundler === 'webpack' ? request(target, 'module') : inline(css),
    )
  }

  if (output.code === source && !imports.length) return { code: source }

  return {
    code: [output.code, ...imports].join('\n'),
    map: remap(output.map, root),
  }
}

async function compile(
  context: Context,
  entry: string,
  code?: string,
): Promise<Compilation> {
  const root = context.rootContext
  const resolve = context.getResolve({})
  const contracts: Record<string, string> = Object.create(null)
  const imports: Record<string, Record<string, string | null>> = Object.create(
    null,
  )
  const modules: Record<string, string> = Object.create(null)
  const files = new Set<string>()
  const order: string[] = []

  async function locate(importer: string, specifier: string) {
    try {
      const resolved = await resolve(Path.dirname(importer), specifier)

      return typeof resolved === 'string' ? resolved : undefined
    } catch {
      // The bundler reports genuinely missing modules with its own diagnostics.
      return undefined
    }
  }

  async function contract(id: string) {
    if (Object.hasOwn(contracts, id)) return true

    const physical = id.split(/[?#]/)[0]!
    if (!Path.isAbsolute(physical) || !extension.test(physical)) return false

    const sidecar = `${physical}.zyzz.json`

    try {
      contracts[id] = await Fs.readFile(sidecar, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error

      return false
    }

    context.addDependency(sidecar)

    return true
  }

  async function visit(file: string, source?: string): Promise<void> {
    if (files.has(file)) return

    files.add(file)
    context.addDependency(file)

    const id = sourceId(root, file)
    const text = source ?? (await Fs.readFile(file, 'utf8'))

    modules[id] = text

    const resolutions: Record<string, string | null> = Object.create(null)

    imports[id] = resolutions

    const parsed = Parser.parseSync(Path.basename(file), text, {
      sourceType: 'module',
    })

    for (const node of parsed.program.body) {
      if (
        (node.type !== 'ImportDeclaration' &&
          node.type !== 'ExportNamedDeclaration' &&
          node.type !== 'ExportAllDeclaration') ||
        !node.source
      )
        continue

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

      const specifier = node.source.value

      // Zyzz authoring and runtime entrypoints are handled by the static transform.
      if (
        specifier === 'zyzz' ||
        specifier.startsWith('zyzz/') ||
        specifier.includes('?')
      ) {
        resolutions[specifier] = null
        continue
      }

      const resolved = await locate(file, specifier)

      if (resolved === undefined || resolved.includes('?')) {
        resolutions[specifier] = null
        continue
      }

      if (!eligible(root, resolved)) {
        resolutions[specifier] = (await contract(resolved)) ? resolved : null
        continue
      }

      resolutions[specifier] = sourceId(root, resolved)
      await visit(resolved)
    }

    order.push(file)
  }

  await visit(entry, code)

  const loaded = new Set<string>()

  async function dependencies(id: string): Promise<void> {
    if (loaded.has(id)) return

    loaded.add(id)

    const metadata = (() => {
      try {
        return JSON.parse(contracts[id]!)
      } catch (error) {
        Graph.compile({ modules: {}, contracts: { [id]: contracts[id]! } })
        throw error
      }
    })()
    if (!Array.isArray(metadata?.stylesheets)) return

    for (const section of metadata.stylesheets) {
      if (!Array.isArray(section?.dependency)) continue

      let owner = id

      for (const specifier of section.dependency) {
        if (
          typeof specifier !== 'string' ||
          !specifier ||
          specifier.includes('\0')
        )
          throw new Error('Invalid packed stylesheet dependency.')

        const target = await locate(owner.split(/[?#]/)[0]!, specifier)
        if (target === undefined || !Path.isAbsolute(target))
          throw new Error('Unable to resolve packed stylesheet dependency.')

        imports[owner] ??= Object.create(null)
        imports[owner]![specifier] = target

        if (!(await contract(target)))
          throw new Error('Packed stylesheet dependencies require metadata.')

        await dependencies(target)
        owner = target
      }
    }
  }

  for (const id of Object.keys(contracts)) await dependencies(id)

  let compiler = compilers.get(entry)

  if (!compiler) {
    compiler = Graph.create()
    compilers.set(entry, compiler)
  }

  const result = compiler.compile({ contracts, imports, modules })

  if (Object.keys(result.sharedAssets ?? {}).length)
    throw new Error(
      'Relative stylesheet assets are not supported by the Next.js integration.',
    )

  return { order, result }
}

function eligible(root: string, file: string) {
  const relative = Path.relative(root, file)

  return (
    Path.isAbsolute(file) &&
    !relative.startsWith('..') &&
    !relative.split(Path.sep).includes('node_modules') &&
    extension.test(file) &&
    !excluded.test(file)
  )
}

function inline(css: string) {
  return `import "data:text/css;base64,${Buffer.from(css).toString('base64')}";`
}

// Both loader runners accept map objects; SWC rejects a map that arrives as a JSON string.
function remap(
  map: Mapping.EncodedSourceMap,
  root: string,
): Mapping.EncodedSourceMap {
  return {
    ...map,
    sources: map.sources.map((source) =>
      source?.startsWith('app/') ? Path.join(root, source.slice(4)) : source,
    ),
  }
}

function request(target: string, kind: keyof typeof queries) {
  return `import ${JSON.stringify(`${carrier}?${queries[kind]}=${encodeURIComponent(target)}`)};`
}

function sourceId(root: string, file: string) {
  return `app/${Path.relative(root, file).split(Path.sep).join('/')}`
}
