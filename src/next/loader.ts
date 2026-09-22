/** Loads a physical source graph through Next.js resolution and emits cache-owned CSS. @module */
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Stylesheets from '../compiler/internal/Stylesheets.js'
import * as Project from './internal/Project.js'

type Context = Project.Context & {
  async(): (error: Error | null, code?: string, map?: object) => void
  getOptions(): {
    bundler: string
    development?: boolean | undefined
    mode?: 'style' | undefined
    reset?: boolean | undefined
    root: string
  }
  resourceQuery?: string | undefined
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
  if (options.mode) {
    const hash = new URLSearchParams(context.resourceQuery).get('zyzz')
    if (!hash || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error('Invalid generated stylesheet request.')
    const file = Path.join(directory, `${hash}.css`)
    context.addDependency(file)
    return { code: await Fs.readFile(file, 'utf8'), map: undefined }
  }

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

  if (!eligible(context.resourcePath)) return { code: source, map: undefined }

  const key = JSON.stringify([
    root,
    options.bundler,
    options.reset ?? false,
    options.development ?? false,
  ])
  let project = projects.get(key)
  if (!project) {
    project = Project.create(options)
    projects.set(key, project)
  }
  const graph = await project.compile(context, source)
  const output =
    graph.modules[
      `app/${Path.relative(root, context.resourcePath).split(Path.sep).join('/')}`
    ]

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

  if (
    output.code === source &&
    !output.css &&
    !/(?:^|[/\\])(?:layout|_app)\.[cm]?[jt]sx?$/.test(context.resourcePath) &&
    !graph.sharedCssMap?.sources.some((name) => name !== 'zyzz/reset.css') &&
    !graph[Stylesheets.packed]?.length
  )
    return { code: source, map }

  const shared = await compileShared({
    css: graph.sharedCss ?? '',
    map: graph.sharedCssMap!,
    assets: graph.sharedAssets ?? {},
    owners: graph.sharedAssetOwners ?? {},
  })

  async function compileShared(
    stylesheet: ReturnType<typeof Stylesheets.render>,
  ) {
    const assets = new Map<string, string>()
    for (const [placeholder, target] of Object.entries(stylesheet.assets)) {
      const raw = target.split(/[?#]/)[0]!
      const file = await Fs.realpath(
        target.startsWith('app/')
          ? Path.join(root, decodeURIComponent(raw.slice(4)))
          : decodeURIComponent(raw),
      )
      const identity = stylesheet.owners[placeholder]
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
        Path.relative(directory, file)
          .split(Path.sep)
          .map(encodeURIComponent)
          .join('/') + target.slice(raw.length),
      )
    }

    return stylesheet.css
      ? AtRules.transform({
          code: Buffer.from(stylesheet.css),
          filename: 'shared.css',
          inputSourceMap: JSON.stringify({
            ...stylesheet.map,
            sources: sources(stylesheet.map.sources),
          }),
          sourceMap: true,
          visitor: {
            Url: (url) =>
              assets.has(url.url)
                ? { ...url, url: assets.get(url.url)! }
                : undefined,
          },
        })
      : undefined
  }

  const styles = [
    ...(await Promise.all(
      (graph[Stylesheets.packed] ?? []).map(async (resource) => {
        const output = await compileShared(resource)
        return {
          css: output?.code.toString(),
          map: output?.map?.toString(),
          id: resource.id,
        }
      }),
    )),
    {
      id: undefined,
      css: shared?.code.toString(),
      map: shared?.map?.toString(),
    },
    { id: undefined, css: output.css, map: JSON.stringify(cssMap) },
  ]
  const requests: string[] = []
  await Fs.mkdir(directory, { recursive: true })
  try {
    await Fs.writeFile(
      Path.join(directory, 'package.json'),
      JSON.stringify({ sideEffects: true, type: 'module' }),
      { flag: 'wx' },
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  for (const [index, stylesheet] of styles.entries()) {
    if (!stylesheet.css) continue
    const css =
      stylesheet.css +
      (stylesheet.map
        ? `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(stylesheet.map).toString('base64')} */`
        : '')
    const hash = Crypto.createHash('sha256')
      .update(
        options.development &&
          !(
            index === (graph[Stylesheets.packed]?.length ?? 0) &&
            graph.sharedCssMap?.sources.every(
              (name) => name === 'zyzz/reset.css',
            )
          )
          ? (stylesheet.id ??
              JSON.stringify([context.resourcePath, index, graph.dependencies]))
          : css,
      )
      .digest('hex')
    const file = Path.join(directory, `${hash}.css`)
    if (options.development) {
      const previous = await Fs.readFile(file, 'utf8').catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
          return undefined
        },
      )
      if (previous !== css) {
        const temporary = `${file}.${Crypto.randomUUID()}.tmp`
        await Fs.writeFile(temporary, css)
        await Fs.rename(temporary, file)
      }
    } else {
      try {
        await Fs.writeFile(file, css, { flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    let request = file
    if (options.development) {
      // Server-component CSS needs a client graph edge for Next's native CSS HMR.
      request = `${file}.js`
      const stylesheet =
        options.bundler === 'turbopack'
          ? `./style.css?zyzz=${hash}`
          : `./${hash}.css`
      const code = `'use client';import ${JSON.stringify(stylesheet)};`
      const existing = await Fs.readFile(request, 'utf8').catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
          return undefined
        },
      )
      if (existing !== code) await Fs.writeFile(request, code)
    } else if (options.bundler === 'turbopack') {
      request = Path.join(directory, 'style.css') + `?zyzz=${hash}`
    }
    const relative = Path.relative(Path.dirname(context.resourcePath), request)
      .split(Path.sep)
      .join('/')
    requests.push(
      `import ${JSON.stringify(relative.startsWith('../') ? relative : `./${relative}`)};`,
    )
  }

  return { code: `${output.code}\n${requests.join('\n')}`, map }
}
