/** Loads a physical source graph through Next.js resolution and emits cache-owned CSS. @module */
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Parser from 'oxc-parser'
import * as Graph from '../compiler/Graph.js'
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Contract from '../compiler/internal/Contract.js'

type Context = {
  addContextDependency(directory: string): void
  addDependency(file: string): void
  async(): (error: Error | null, code?: string, map?: object) => void
  getOptions(): {
    bundler: string
    mode: 'shared' | 'source' | 'style'
    root: string
  }
  getResolve(
    options: object,
  ): (
    directory: string,
    specifier: string,
    callback: (error: Error | null, file?: string | false) => void,
  ) => void
  resourcePath: string
}

/** Loader-runner boundary used by Webpack and Turbopack. */
export default function loader(this: Context, source: string): void {
  const callback = this.async()
  compile(this, source).then(
    (result) => callback(null, result.code, result.map),
    (error: unknown) =>
      callback(error instanceof Error ? error : new Error(String(error))),
  )
}

async function compile(context: Context, source: string) {
  const options = context.getOptions()
  const root = options.root
  const directory = Path.resolve(root, '.zyzz', 'next')
  const modules: Record<string, string> = Object.create(null)
  const imports: Record<string, Record<string, string | null>> = Object.create(
    null,
  )
  const contracts: Record<string, string> = Object.create(null)
  const resolve = context.getResolve({})
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

  if (options.mode !== 'shared' && !eligible(context.resourcePath))
    return { code: source, map: undefined }

  async function visit(file: string, text?: string): Promise<void> {
    const name = id(file)
    if (Object.hasOwn(modules, name)) return

    context.addDependency(file)
    modules[name] = text ?? (await Fs.readFile(file, 'utf8'))
    const links: Record<string, string | null> = Object.create(null)
    imports[name] = links
    const parsed = Parser.parseSync(file, modules[name]!, {
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

      const specifier = node.source.value
      links[specifier] = null
      if (
        specifier === 'zyzz' ||
        (specifier.startsWith('zyzz/') &&
          specifier !== 'zyzz/themes/default') ||
        specifier.startsWith('node:')
      )
        continue

      const resolved = await new Promise<string | false | undefined>(
        (accept, reject) => {
          resolve(Path.dirname(file), specifier, (error, value) =>
            error ? reject(error) : accept(value),
          )
        },
      )
      if (!resolved || !/\.[cm]?[jt]sx?$/.test(resolved)) continue
      if (eligible(resolved)) {
        links[specifier] = id(resolved)
        await visit(resolved)
        continue
      }

      const sidecar = `${resolved}.zyzz.json`
      try {
        contracts[resolved] = await Fs.readFile(sidecar, 'utf8')
        context.addDependency(sidecar)
        links[specifier] = resolved
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
  }

  async function discover(directory: string): Promise<void> {
    const items = await Fs.readdir(directory, { withFileTypes: true })

    // Recursive tracking of a package root follows every installed dependency,
    // including a symlink back to an ancestor, which Turbopack rejects as a
    // loop. Package roots are tracked through their files and subdirectories.
    if (!items.some((item) => item.name === 'node_modules'))
      context.addContextDependency(directory)

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

  if (options.mode !== 'shared') await visit(context.resourcePath, source)
  await discover(root)
  const loaded = new Set<string>()
  async function dependencies(file: string): Promise<void> {
    if (loaded.has(file)) return
    loaded.add(file)

    const metadata = Contract.read(contracts[file]!, new Map(), file)
    for (const section of metadata.stylesheets) {
      let owner = file
      for (const specifier of section.dependency ?? []) {
        const target = await new Promise<string | false | undefined>(
          (accept, reject) => {
            resolve(Path.dirname(owner), specifier, (error, value) =>
              error ? reject(error) : accept(value),
            )
          },
        )
        if (!target || !Path.isAbsolute(target))
          throw new Error('Unable to resolve packed stylesheet dependency.')

        const links = (imports[owner] ??= Object.create(null))
        links[specifier] = target
        if (!Object.hasOwn(contracts, target)) {
          const sidecar = `${target}.zyzz.json`
          contracts[target] = await Fs.readFile(sidecar, 'utf8')
          context.addDependency(sidecar)
        }
        await dependencies(target)
        owner = target
      }
    }
  }
  for (const file of Object.keys(contracts)) await dependencies(file)

  const graph = Graph.compile({ contracts, imports, modules })
  const output = graph.modules[id(context.resourcePath)]

  const assets = new Map<string, string>()
  for (const [placeholder, target] of Object.entries(
    graph.sharedAssets ?? {},
  )) {
    const raw = target.split(/[?#]/)[0]!
    const file = await Fs.realpath(
      target.startsWith('app/')
        ? Path.join(root, decodeURIComponent(raw.slice(4)))
        : decodeURIComponent(raw),
    )
    const identity = graph.sharedAssetOwners?.[placeholder]
    let owner = root
    if (identity && Path.isAbsolute(identity)) {
      owner = Path.dirname(identity)
      for (;;) {
        try {
          await Fs.access(Path.join(owner, 'package.json'))
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          const parent = Path.dirname(owner)
          if (parent === owner)
            throw new Error('Packed assets require an owning package.json.')
          owner = parent
        }
      }
    }

    const relative = Path.relative(await Fs.realpath(owner), file)
    if (
      !identity ||
      relative === '..' ||
      relative.startsWith(`..${Path.sep}`) ||
      Path.isAbsolute(relative)
    )
      throw new Error('Asset path escapes its owning package.')

    context.addDependency(file)
    assets.set(
      placeholder,
      Path.relative(
        options.bundler === 'turbopack'
          ? Path.dirname(context.resourcePath)
          : directory,
        file,
      )
        .split(Path.sep)
        .map(encodeURIComponent)
        .join('/') + target.slice(raw.length),
    )
  }

  const shared = graph.sharedCss
    ? AtRules.transform({
        code: Buffer.from(graph.sharedCss),
        filename: 'shared.css',
        inputSourceMap: JSON.stringify(graph.sharedCssMap),
        sourceMap: true,
        visitor: {
          Url: (url) =>
            assets.has(url.url)
              ? { ...url, url: assets.get(url.url)! }
              : undefined,
        },
      })
    : undefined
  if (options.mode === 'shared')
    return {
      code: shared?.code.toString() ?? '',
      map: shared?.map
        ? (JSON.parse(shared.map.toString()) as object)
        : undefined,
    }
  if (!output) throw new Error('Missing Next.js source compilation.')
  // Bundlers resolve map sources relative to the loader resource, not graph identities.
  const sources = (names: readonly (string | null)[]) =>
    names.map((name) =>
      name?.startsWith('app/') ? Path.resolve(root, name.slice(4)) : name,
    )
  const map = {
    ...output.map,
    file: context.resourcePath,
    sources: sources(output.map.sources),
  }
  const cssMap = { ...output.cssMap, sources: sources(output.cssMap.sources) }
  if (options.mode === 'style') return { code: output.css, map: cssMap }

  if (options.bundler === 'turbopack') {
    const sharedFile = Path.relative(
      Path.dirname(context.resourcePath),
      Path.join(directory, 'shared.css'),
    )
      .split(Path.sep)
      .join('/')
    const requests = [
      ...(graph.sharedCss
        ? [
            `import ${JSON.stringify(sharedFile.startsWith('.') ? sharedFile : `./${sharedFile}`)};`,
          ]
        : []),
      ...(output.css
        ? [
            `import ${JSON.stringify(`./${Path.basename(context.resourcePath)}?zyzz-style`)};`,
          ]
        : []),
    ]
    return { code: `${output.code}\n${requests.join('\n')}`, map }
  }
  const styles = [
    { css: shared?.code.toString(), map: shared?.map?.toString() },
    { css: output.css, map: JSON.stringify(cssMap) },
  ]
  const requests: string[] = []
  await Fs.mkdir(directory, { recursive: true })
  for (const stylesheet of styles) {
    if (!stylesheet.css) continue
    const css =
      stylesheet.css +
      (stylesheet.map
        ? `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(stylesheet.map).toString('base64')} */`
        : '')
    const hash = Crypto.createHash('sha256').update(css).digest('hex')
    const file = Path.join(directory, `${hash}.css`)
    try {
      await Fs.writeFile(file, css, { flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    const relative = Path.relative(Path.dirname(context.resourcePath), file)
      .split(Path.sep)
      .join('/')
    requests.push(
      `import ${JSON.stringify(relative.startsWith('.') ? relative : `./${relative}`)};`,
    )
  }

  return { code: `${output.code}\n${requests.join('\n')}`, map }
}
