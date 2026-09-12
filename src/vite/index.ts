/**
 * Connects static Zyzz source compilation to Vite resolution and CSS delivery.
 * @module
 */
import * as Namespaces from '../compiler/internal/Namespaces.js'
import * as AtRules from '../compiler/internal/AtRules.js'
import * as Mapping from '@jridgewell/gen-mapping'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import * as Scope from '../compiler/internal/Scope.js'
import * as Svelte from './internal/Svelte.js'
import type { Environment, Plugin } from 'vite'
import * as Graph from '../compiler/Graph.js'
import * as Source from '../compiler/Source.js'

/**
 * Compiles physical project source without executing authoring code.
 * Vite owns resolution, transpilation, CSS processing, watching, and HMR.
 * Svelte components contribute their top-level script blocks; the compiled
 * script is spliced back into the component before the Svelte plugin runs.
 * @returns A Vite 8 plugin with isolated state for each environment.
 */
export function zyzz(): Plugin {
  const states = new WeakMap<Environment, Map<string, Entry>>()
  const discoveries = new WeakMap<Environment, Promise<Map<string, string>>>()
  const contributionFiles = new WeakMap<Environment, Set<string>>()
  const assets = new Map<string, string>()
  let root: string

  function entries(environment: Environment) {
    let state = states.get(environment)

    if (!state) {
      state = new Map()
      states.set(environment, state)
    }

    return state
  }

  function sourceId(file: string) {
    return `app/${Path.relative(root, file).split(Path.sep).join('/')}`
  }

  function resource(id: string) {
    const query = id.split('?')[1]?.split('#')[0]

    return (
      query !== undefined &&
      [...new URLSearchParams(query).keys()].some(
        (key) => !['v', 't', 'import'].includes(key),
      )
    )
  }

  function normalize(id: string) {
    return resource(id) ? id : id.split('?')[0]!
  }

  function eligible(id: string) {
    const relative = Path.relative(root, id)

    return (
      Path.isAbsolute(id) &&
      !relative.startsWith('..') &&
      !relative.split(Path.sep).includes('node_modules') &&
      /\.(?:[cm]?[jt]sx?|svelte)$/.test(id) &&
      !/\.(?:d|test|test-d|bench)\.[cm]?[jt]sx?$/.test(id)
    )
  }

  // Svelte components enter the compiler as their concatenated script blocks.
  function script(file: string, source: string) {
    return file.endsWith('.svelte') ? Svelte.extract(source).code : source
  }

  function discover(environment: Environment, host: Host) {
    let pending = discoveries.get(environment)

    if (!pending) {
      pending = (async () => {
        const sources = new Map<string, string>()
        const eagerFiles = new Set<string>()

        contributionFiles.set(environment, eagerFiles)

        async function collect(directory: string): Promise<void> {
          for (const item of await Fs.readdir(directory, {
            withFileTypes: true,
          })) {
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
                'fixtures',
                '__fixtures__',
              ].includes(item.name)
            )
              continue

            const file = Path.join(directory, item.name)

            if (item.isDirectory()) await collect(file)
            else if (item.isFile() && eager(file)) {
              host.watch(file)

              const source = await Fs.readFile(file, 'utf8')

              sources.set(file, source)

              if (contributes(script(file, source))) eagerFiles.add(file)
            }
          }
        }

        await collect(root)

        return sources
      })()
      discoveries.set(environment, pending)
    }

    return pending
  }

  function eager(file: string) {
    return (
      eligible(file) &&
      !Path.relative(root, file)
        .split(Path.sep)
        .some((part) =>
          ['test', 'tests', '__tests__', 'fixtures', '__fixtures__'].includes(
            part,
          ),
        )
    )
  }

  function contributes(source: string) {
    const { program } = Parser.parseSync('source.tsx', source, {
      sourceType: 'module',
    })
    const imports = new Map<number, string>()

    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration' || node.importKind === 'type')
        continue

      for (const specifier of node.specifiers) {
        if (
          specifier.type !== 'ImportSpecifier' ||
          specifier.importKind === 'type'
        )
          continue

        const name =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value

        if (
          node.source.value === 'zyzz/web'
            ? [
                'colorProfile',
                'counterStyle',
                'cssFunction',
                'customMedia',
                'fontFace',
                'fontFeatureValues',
                'fontPaletteValues',
                'global',
                'importCss',
                'keyframes',
                'layers',
                'namespace',
                'page',
                'positionTry',
                'viewTransition',
              ].includes(name)
            : name === 'Config' || node.source.value !== 'zyzz'
        )
          imports.set(specifier.start, name)
      }
    }
    // Local call imports are candidates; Graph follows their re-exports before emission.

    if (!imports.size) return false

    const scopeTracker = new Scope.Tracker({ preserveExitedScopes: true })

    Walker.walk(program, { scopeTracker })
    scopeTracker.freeze()

    let found = false

    Walker.walk(program, {
      scopeTracker,
      enter(node) {
        if (node.type !== 'CallExpression') return

        const callee = node.callee

        if (callee.type === 'Identifier') {
          const binding = scopeTracker.getDeclaration(callee.name)

          if (
            binding?.type === 'Import' &&
            imports.has(binding.node.start) &&
            imports.get(binding.node.start) !== 'Config'
          )
            found = true
        } else if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'create'
        ) {
          const binding = scopeTracker.getDeclaration(callee.object.name)
          const argument = node.arguments[0]

          if (
            binding?.type === 'Import' &&
            imports.get(binding.node.start) === 'Config' &&
            argument?.type === 'ObjectExpression' &&
            argument.properties.some(
              (property) =>
                property.type === 'Property' &&
                (property.key.type === 'Identifier'
                  ? property.key.name === 'layers'
                  : property.key.type === 'Literal' &&
                    property.key.value === 'layers'),
            )
          )
            found = true
        }
      },
    })

    return found
  }

  async function updateDiscovery(
    environment: Environment,
    file: string,
    event: string,
  ) {
    if (event === 'delete') entries(environment).delete(file)

    const pending = discoveries.get(environment)
    if (!pending || !eager(file)) return

    const sources = await pending

    if (event === 'delete') sources.delete(file)
    else {
      const source = await Fs.readFile(file, 'utf8')

      sources.set(file, source)

      if (contributes(script(file, source)))
        contributionFiles.get(environment)?.add(file)
      else contributionFiles.get(environment)?.delete(file)
    }
  }

  async function compile(
    entry: Entry,
    host: Host,
    code?: string,
    allSources = false,
  ) {
    async function resolve(source: string, importer: string) {
      const resolved = await host.resolve(source, importer)
      if (!resolved) return resolved

      if (entry.environment.mode === 'dev') {
        const optimized = Object.values({
          ...entry.environment.depsOptimizer?.metadata.optimized,
          ...entry.environment.depsOptimizer?.metadata.discovered,
        }).find((item) => item.file === resolved.id.split('?')[0])
        if (optimized?.src) return { ...resolved, id: optimized.src }
      }

      return { ...resolved, id: normalize(resolved.id) }
    }

    const imports: Record<
      string,
      Record<string, string | null>
    > = Object.create(null)
    const contracts: Record<string, string> = Object.create(null)
    const modules: Record<string, string> = Object.create(null)
    const documents = new Map<string, Svelte.extract.ReturnType>()
    const files = new Set<string>()

    async function visit(file: string, source?: string) {
      if (files.has(file)) return

      files.add(file)
      host.watch(file)

      const id = sourceId(file)
      const raw = source ?? (await Fs.readFile(file, 'utf8'))
      const text = (() => {
        if (!file.endsWith('.svelte')) return raw

        const document = Svelte.extract(raw)

        documents.set(id, document)

        return document.code
      })()

      modules[id] = text

      const resolutions: Record<string, string | null> = Object.create(null)

      imports[id] = resolutions

      const parsed = Parser.parseSync('source.tsx', text, {
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
        if (specifier === 'zyzz' || specifier.startsWith('zyzz/')) {
          resolutions[specifier] = null
          continue
        }

        const resolved = await resolve(specifier, file)
        if (!resolved) {
          const document = documents.get(id)

          throw new Source.ExtractError([
            {
              code: 'unsupported_syntax',
              end: document ? Svelte.original(document, node.end) : node.end,
              message: `Unable to resolve ${JSON.stringify(specifier)}`,
              source: file,
              start: document
                ? Svelte.original(document, node.start)
                : node.start,
            },
          ])
        }

        if (resource(specifier) || resource(resolved.id)) {
          resolutions[specifier] = null
          continue
        }

        if (resolved.external || !eligible(resolved.id)) {
          const physical = resolved.id.split('?')[0]!.split('#')[0]!
          const sidecar = `${physical}.zyzz.json`

          if (Path.isAbsolute(physical) && /\.[cm]?[jt]sx?$/.test(physical)) {
            try {
              contracts[resolved.id] = await Fs.readFile(sidecar, 'utf8')
              host.watch(sidecar)
              files.add(sidecar)
              resolutions[specifier] = resolved.id
              continue
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error
            }
          }

          resolutions[specifier] = null
          continue
        }

        resolutions[specifier] = sourceId(resolved.id)
        await visit(resolved.id)
      }
    }

    await visit(entry.file, code)

    const connected = new Set(files)

    for (const [file, source] of await discover(entry.environment, host)) {
      if (files.has(file) && !allSources) continue

      const selected = contributionFiles.get(entry.environment)?.has(file)

      if (allSources) {
        const { program } = Parser.parseSync(
          'source.tsx',
          script(file, source),
          { sourceType: 'module' },
        )
        const dynamic: import('@oxc-project/types').ImportExpression[] = []

        Walker.walk(program, {
          enter(node) {
            if (
              node.type === 'ImportExpression' &&
              node.source.type === 'Literal' &&
              typeof node.source.value === 'string'
            )
              dynamic.push(node)
          },
        })

        for (const node of [...program.body, ...dynamic]) {
          if (
            (node.type !== 'ImportExpression' &&
              node.type !== 'ImportDeclaration' &&
              node.type !== 'ExportNamedDeclaration' &&
              node.type !== 'ExportAllDeclaration') ||
            !node.source
          )
            continue

          if (
            node.type === 'ImportExpression'
              ? false
              : node.type === 'ImportDeclaration'
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
            node.source.type !== 'Literal' ||
            typeof node.source.value !== 'string'
          )
            continue

          const specifier = node.source.value
          if (specifier === 'zyzz' || specifier.startsWith('zyzz/')) continue

          const resolved = await resolve(specifier, file)
          if (!resolved || (!resolved.external && eligible(resolved.id)))
            continue

          if (resource(specifier) || resource(resolved.id)) continue

          const physical = resolved.id.split(/[?#]/)[0]!
          if (!Path.isAbsolute(physical) || !/\.[cm]?[jt]sx?$/.test(physical))
            continue

          try {
            const sidecar = `${physical}.zyzz.json`

            contracts[resolved.id] = await Fs.readFile(sidecar, 'utf8')
            host.watch(sidecar)
            files.add(sidecar)

            // Discover the package contribution without compiling unrelated authoring
            // expressions in an otherwise unreachable source file.
            const discovery = `${sourceId(file)}.zyzz-discovery`

            modules[discovery] =
              (modules[discovery] ?? '') +
              `import ${JSON.stringify(specifier)};\n`
            ;(imports[discovery] ??= Object.create(null))[specifier] =
              resolved.id
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
        }
      }

      if (selected) await visit(file, source)
    }

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

          const target = await resolve(specifier, owner)
          if (!target || !Path.isAbsolute(target.id))
            throw new Error('Unable to resolve packed stylesheet dependency.')

          imports[owner] ??= Object.create(null)
          imports[owner]![specifier] = target.id

          if (!Object.hasOwn(contracts, target.id)) {
            const sidecar = `${target.id.split(/[?#]/)[0]}.zyzz.json`

            contracts[target.id] = await Fs.readFile(sidecar, 'utf8')
            host.watch(sidecar)
            files.add(sidecar)
          }

          await dependencies(target.id)
          owner = target.id
        }
      }
    }

    for (const id of Object.keys(contracts)) await dependencies(id)

    const result = (() => {
      try {
        return entry.compiler.compile({ contracts, imports, modules })
      } catch (error) {
        if (!(error instanceof Source.ExtractError) || !documents.size)
          throw error

        // Diagnostics address the concatenated script; report component offsets.
        throw new Source.ExtractError(
          error.diagnostics.map((diagnostic) => {
            const document = documents.get(diagnostic.source)
            if (!document) return diagnostic

            return {
              ...diagnostic,
              end: Svelte.original(document, diagnostic.end),
              start: Svelte.original(document, diagnostic.start),
            }
          }),
        )
      }
    })()
    const map = new Mapping.GenMapping()
    const styles: string[] = []
    let line = 0

    for (const [id, output] of Object.entries(result.modules)) {
      if (!connected.has(Path.join(root, id.slice(4)))) continue
      if (!output.css) continue

      for (const mapping of Mapping.allMappings(
        Mapping.fromMap(JSON.stringify(output.cssMap)),
      )) {
        const generated = {
          column: mapping.generated.column,
          line: mapping.generated.line + line,
        }

        if (mapping.source !== undefined && mapping.original !== undefined) {
          const location = {
            generated,
            original: mapping.original,
            source: Path.join(root, mapping.source.slice(4)),
          }

          if (mapping.name === undefined) Mapping.addMapping(map, location)
          else Mapping.addMapping(map, { ...location, name: mapping.name })
        } else Mapping.addMapping(map, { generated })
      }

      for (const [index, source] of output.cssMap.sources.entries())
        if (source !== null)
          Mapping.setSourceContent(
            map,
            Path.join(root, source.slice(4)),
            output.cssMap.sourcesContent?.[index] ?? null,
          )

      styles.push(output.css)
      line += output.css.split('\n').length
    }

    const appRoot = await Fs.realpath(root)
    const owners = new Map<string, string>()

    for (const id of new Set(Object.values(result.sharedAssetOwners ?? {}))) {
      if (!Path.isAbsolute(id)) continue

      let directory = Path.dirname(id.split(/[?#]/)[0]!)

      for (;;) {
        try {
          await Fs.access(Path.join(directory, 'package.json'))
          owners.set(id, await Fs.realpath(directory))
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }

        const parent = Path.dirname(directory)
        if (parent === directory)
          throw new Error('Packed assets require an owning package.json.')

        directory = parent
      }
    }

    const assetUrls = new Map<string, string>()

    for (const [key, target] of Object.entries(result.sharedAssets ?? {})) {
      const raw = target.split(/[?#]/)[0]!

      const file = await Fs.realpath(
        target.startsWith('app/')
          ? Path.join(root, decodeURIComponent(raw.slice(4)))
          : Path.isAbsolute(raw)
            ? decodeURIComponent(raw)
            : (() => {
                throw new Error('Asset path escapes the Vite graph.')
              })(),
      )

      const identity = result.sharedAssetOwners?.[key]

      const owner = identity?.startsWith('app/')
        ? appRoot
        : identity
          ? owners.get(identity)
          : undefined

      const relative = owner ? Path.relative(owner, file) : '..'
      if (
        relative === '..' ||
        relative.startsWith(`..${Path.sep}`) ||
        Path.isAbsolute(relative)
      )
        throw new Error('Asset path escapes its owning package.')

      host.watch(file)
      files.add(file)

      let url: string

      if (/[?#%]/.test(file)) {
        if (entry.environment.mode === 'build') {
          url = await host.asset(file)

          if (target.slice(raw.length)) url += `$_${target.slice(raw.length)}__`
        } else {
          url = `/@zyzz/asset/${Crypto.hash('sha256', file)}/${encodeURIComponent(Path.basename(file))}`
          assets.set(url, file)
          url += target.slice(raw.length)
        }
      } else {
        const pathname = file
          .replaceAll('\\', '/')
          .split('/')
          .map((part, index) =>
            index === 0 && /^[a-z]:$/i.test(part)
              ? part
              : encodeURIComponent(part),
          )
          .join('/')

        url = `/@fs/${pathname}${target.slice(raw.length)}`
      }

      assetUrls.set(target, url)
    }

    const shared = !Object.keys(result.sharedAssets ?? {}).length
      ? {
          code: new TextEncoder().encode(result.sharedCss ?? ''),
          map: new TextEncoder().encode(
            JSON.stringify(
              result.sharedCssMap ??
                Mapping.toEncodedMap(new Mapping.GenMapping()),
            ),
          ),
        }
      : AtRules.transform({
          filename: 'zyzz.shared.css',
          code: new TextEncoder().encode(result.sharedCss ?? ''),
          sourceMap: true,
          inputSourceMap: JSON.stringify(
            result.sharedCssMap ??
              Mapping.toEncodedMap(new Mapping.GenMapping()),
          ),
          visitor: {
            Rule(rule) {
              if (rule.type !== 'import') return
              const target = result.sharedAssets?.[rule.value.url]
              if (target)
                return AtRules.relocateImport(
                  rule.value,
                  assetUrls.get(target)!,
                )
            },
            Url(url) {
              const target = result.sharedAssets?.[url.url]
              if (!target) return

              return { ...url, url: assetUrls.get(target)! }
            },
          },
        })

    const sharedMap = JSON.parse(
      new TextDecoder().decode(shared.map!),
    ) as Mapping.EncodedSourceMap

    sharedMap.sources = sharedMap.sources.map((source) =>
      source?.startsWith('app/') ? Path.join(root, source.slice(4)) : source,
    )

    const output = result.modules[sourceId(entry.file)]!

    entry.files = files

    return {
      code: output.code,
      css: styles.join('\n'),
      sharedCss: new TextDecoder().decode(shared.code),
      sharedCssMap: sharedMap,
      cssMap: Mapping.toEncodedMap(map),
      map: {
        ...output.map,
        sources: output.map.sources.map((source) =>
          source === null ? null : Path.join(root, source.slice(4)),
        ),
      },
    }
  }

  function host(context: HostContext): Host {
    return {
      asset: async (file) => {
        const reference = context.emitFile({
          type: 'asset',
          name: Path.basename(file).replace(/[?#%]/g, '_'),
          source: await Fs.readFile(file),
        })

        // Vite's CSS asset placeholder preserves its configured base and output naming.
        return `__VITE_ASSET__${reference}__`
      },
      resolve: (source, importer) => context.resolve(source, importer),
      // Vite links watched files as imports of the requesting module. Eligible
      // sources are graph modules already and hotUpdate invalidates their
      // dependents, so relinking them in development only forms import cycles,
      // which make the client reload the page whenever an update fails to load.
      watch: (file) => {
        if (context.environment.mode === 'dev' && eligible(file)) return

        context.addWatchFile(file)
      },
    }
  }

  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        const file = assets.get(path)
        if (!file) return next()

        Fs.readFile(file).then((content) => {
          response.setHeader(
            'Content-Type',
            file.endsWith('.svg')
              ? 'image/svg+xml'
              : 'application/octet-stream',
          )
          response.setHeader('Cache-Control', 'no-cache')
          response.end(content)
        }, next)
      })
    },
    configResolved(config) {
      root = config.root
    },
    enforce: 'pre',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset' || !output.fileName.endsWith('.css'))
            continue
          const css =
            typeof output.source === 'string'
              ? output.source
              : new TextDecoder().decode(output.source)
          const external = bundle[`${output.fileName}.map`]
          const inline = css.match(
            /\/\*# sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)\s*\*\//,
          )
          const previous =
            external?.type === 'asset'
              ? (JSON.parse(
                  typeof external.source === 'string'
                    ? external.source
                    : new TextDecoder().decode(external.source),
                ) as Mapping.EncodedSourceMap)
              : inline
                ? (JSON.parse(
                    Buffer.from(inline[1]!, 'base64').toString(),
                  ) as Mapping.EncodedSourceMap)
                : undefined
          const result = Namespaces.bundle(css, previous)
          let restored = AtRules.rename(
            AtRules.rename(
              result.css,
              '-zyzz-ffv-000000000',
              'font-feature-values',
            ),
            '-zyzz-fpv-000000000',
            'font-palette-values',
          )
          if (result.map && external?.type === 'asset')
            external.source = JSON.stringify(result.map)
          if (result.map && inline)
            restored = restored.replace(
              inline[0],
              `/*# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(result.map)).toString('base64')} */`,
            )
          output.source = restored
        }
      },
    },
    async watchChange(file, change) {
      await updateDiscovery(this.environment, file, change.event)
    },
    async hotUpdate({ file, modules, timestamp, type }) {
      await updateDiscovery(this.environment, file, type)

      const affected = new Set(modules)

      for (const entry of entries(this.environment).values()) {
        if (!entry.files.has(file) && !eager(file)) continue

        // Theme scopes affect CSS even when Vite's JavaScript import was erased.
        for (const id of [entry.file, cssId(entry.file), sharedId]) {
          const module = this.environment.moduleGraph.getModuleById(id)
          if (!module) continue

          this.environment.moduleGraph.invalidateModule(
            module,
            new Set(),
            timestamp,
            true,
          )

          // An entry that nothing imports and that does not accept updates
          // would only dead-end propagation into a full reload; it recompiles
          // on its next load while its stylesheets update in place.
          if (
            id === entry.file &&
            !module.isSelfAccepting &&
            !module.importers.size
          )
            continue

          affected.add(module)
        }
      }

      return [...affected]
    },
    async load(id) {
      if (!id.startsWith(prefix)) return

      const file =
        id === sharedId
          ? undefined
          : decodeURIComponent(id.slice(prefix.length, -4))
      const entry =
        file === undefined
          ? entries(this.environment).values().next().value
          : entries(this.environment).get(file)
      if (!entry) throw new Error(`Unknown Zyzz stylesheet: ${file}`)

      const output = await compile(
        entry,
        host(this),
        undefined,
        id === sharedId,
      )
      const transport = (css: string) =>
        this.environment.config.command === 'build'
          ? AtRules.rename(
              AtRules.rename(
                Namespaces.protect(css),
                'font-feature-values',
                '-zyzz-ffv-000000000',
              ),
              'font-palette-values',
              '-zyzz-fpv-000000000',
            )
          : css
      if (id === sharedId)
        return {
          code: transport(output.sharedCss),
          map: JSON.stringify(output.sharedCssMap),
        }
      return { code: transport(output.css), map: JSON.stringify(output.cssMap) }
    },
    name: 'zyzz',
    resolveId(id) {
      if (id.startsWith(prefix)) return id
    },
    async transform(code, id) {
      id = normalize(id)

      if (!eligible(id)) return

      const document = id.endsWith('.svelte') ? Svelte.extract(code) : undefined
      if (document && !document.blocks.length) return

      const state = entries(this.environment)
      let entry = state.get(id)

      if (!entry) {
        entry = {
          compiler: Graph.create(),
          environment: this.environment,
          file: id,
          files: new Set([id]),
        }
        state.set(id, entry)
      }

      const output = await compile(entry, host(this), code)

      // Svelte hoists imports from either script block, so the stylesheet
      // dependencies join the first script line without moving later lines.
      if (document) {
        const spliced = Svelte.splice({
          code: output.code,
          document,
          file: id,
          map: output.map,
          prepend: `import ${JSON.stringify(sharedId)};import ${JSON.stringify(cssId(id))};`,
          source: code,
        })

        return { code: spliced.code, map: JSON.stringify(spliced.map) }
      }

      // Keep the CSS dependency even when the current graph has no live rules.
      // Later edits can introduce styles without changing this import boundary.
      const parsed = Parser.parseSync('source.tsx', output.code, {
        sourceType: 'module',
      })
      let offset = output.code.startsWith('#!')
        ? output.code.indexOf('\n') + 1
        : 0

      for (const node of parsed.program.body) {
        if (node.type !== 'ExpressionStatement' || !node.directive) break

        offset = node.end
      }

      const sharedImport = `\nimport ${JSON.stringify(sharedId)};\n`
      const map = Mapping.fromMap(JSON.stringify(output.map))
      // The inserted dependency shifts only generated positions after the prologue.
      const before = output.code.slice(0, offset)
      const insertionLine = before.split('\n').length
      const insertionColumn = before.length - (before.lastIndexOf('\n') + 1)
      const shifted = new Mapping.GenMapping()

      for (const mapping of Mapping.allMappings(map)) {
        const generated = { ...mapping.generated }

        if (
          generated.line > insertionLine ||
          (generated.line === insertionLine &&
            generated.column >= insertionColumn)
        ) {
          if (generated.line === insertionLine)
            generated.column -= insertionColumn

          generated.line += 2
        }

        if (mapping.source !== undefined && mapping.original !== undefined) {
          const location = {
            generated,
            original: mapping.original,
            source: mapping.source,
          }

          if (mapping.name === undefined) Mapping.addMapping(shifted, location)
          else Mapping.addMapping(shifted, { ...location, name: mapping.name })
        } else Mapping.addMapping(shifted, { generated })
      }

      for (const [index, source] of output.map.sources.entries())
        if (source !== null)
          Mapping.setSourceContent(
            shifted,
            source,
            output.map.sourcesContent?.[index] ?? null,
          )

      return {
        code: `${before}${sharedImport}${output.code.slice(offset)}\nimport ${JSON.stringify(cssId(id))};`,
        map: JSON.stringify(Mapping.toEncodedMap(shifted)),
      }
    },
  }
}

type Entry = {
  environment: Environment
  compiler: Graph.create.ReturnType
  file: string
  files: Set<string>
}

type Host = {
  asset: (file: string) => Promise<string>
  resolve: (
    source: string,
    importer: string,
  ) => Promise<{
    external?: boolean | 'absolute' | 'relative'
    id: string
  } | null>
  watch: (file: string) => void
}

type HostContext = {
  addWatchFile: (file: string) => void
  emitFile: (file: {
    name: string
    source: Uint8Array
    type: 'asset'
  }) => string
  environment: Environment
  resolve: Host['resolve']
}

const prefix = '\0zyzz:'
const sharedId = `${prefix}shared.css`

function cssId(file: string) {
  return `${prefix}${encodeURIComponent(file)}.css`
}
