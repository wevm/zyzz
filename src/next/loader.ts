/** Loads a physical source graph through Next.js resolution and emits cache-owned CSS. @module */
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Project from './internal/Project.js'

type Context = Project.Context & {
  async(): (error: Error | null, code?: string, map?: object) => void
  getOptions(): {
    bundler: string
    mode: 'shared' | 'source' | 'style'
    reset?: boolean | undefined
    root: string
  }
}

// Next owns loader worker lifetimes. Each project retains only its latest graph in that worker.
const projects = new Map<string, ReturnType<typeof Project.create>>()

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
  const eligible = (file: string) =>
    /\.[cm]?[jt]sx?$/.test(file) &&
    !/\.(?:d|test|test-d|bench|bench-d)\.[cm]?[jt]sx?$/.test(file) &&
    !Path.relative(root, file)
      .split(Path.sep)
      .some(
        (part) =>
          part === '..' || part === 'node_modules' || part.startsWith('.'),
      )

  // Next.js hoists instrumentation CSS out of route stylesheets without loading it.
  if (
    /^(?:src\/)?instrumentation-client\.[cm]?[jt]s$/.test(
      Path.relative(root, context.resourcePath).split(Path.sep).join('/'),
    )
  )
    return { code: source, map: undefined }

  if (options.mode !== 'shared' && !eligible(context.resourcePath))
    return { code: source, map: undefined }

  const key = JSON.stringify([root, options.bundler, options.reset ?? false])
  let project = projects.get(key)
  if (!project) {
    project = Project.create(options)
    projects.set(key, project)
  }
  const graph = await project.compile(
    context,
    options.mode === 'shared' ? undefined : source,
  )
  const output =
    graph.modules[
      `app/${Path.relative(root, context.resourcePath).split(Path.sep).join('/')}`
    ]

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
    // Turbopack appends the output extension to loader-transformed resource paths.
    const resource = await Fs.stat(context.resourcePath).then(
      () => context.resourcePath,
      async (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
        const original = context.resourcePath.slice(
          0,
          -Path.extname(context.resourcePath).length,
        )
        await Fs.access(original)
        return original
      },
    )
    // Changed CSS needs a new resource identity when a server component refreshes.
    const requests = [
      ...(graph.sharedCss
        ? [
            `import ${JSON.stringify(sharedFile.startsWith('../') ? sharedFile : `./${sharedFile}`)};`,
          ]
        : []),
      ...(output.css
        ? [
            `import ${JSON.stringify(`./${Path.basename(resource)}?zyzz-style=${Crypto.createHash('sha256').update(output.css).digest('hex').slice(0, 16)}`)};`,
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
      `import ${JSON.stringify(relative.startsWith('../') ? relative : `./${relative}`)};`,
    )
  }

  return { code: `${output.code}\n${requests.join('\n')}`, map }
}
