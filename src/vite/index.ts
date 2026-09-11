/**
 * Connects static Zyzz source compilation to Vite resolution and CSS delivery.
 * @module
 */
import * as Lightning from 'lightningcss'
import * as Mapping from '@jridgewell/gen-mapping'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import * as Scope from '../compiler/internal/Scope.js'
import type { Environment, Plugin } from 'vite'
import * as Graph from '../compiler/Graph.js'
import * as Source from '../compiler/Source.js'

/**
 * Compiles physical project source without executing authoring code.
 * Vite owns resolution, transpilation, CSS processing, watching, and HMR.
 * @returns A Vite 8 plugin with isolated state for each environment.
 */
export function zyzz(): Plugin {
  const states = new WeakMap<Environment, Map<string, Entry>>()
  const discoveries = new WeakMap<Environment, Promise<Map<string, string>>>()
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

  function eligible(id: string) {
    const relative = Path.relative(root, id)
    return (
      Path.isAbsolute(id) &&
      !relative.startsWith('..') &&
      !relative.split(Path.sep).includes('node_modules') &&
      /\.[cm]?[jt]sx?$/.test(id) &&
      !/\.(?:d|test|test-d|bench)\.[cm]?[jt]sx?$/.test(id)
    )
  }

  function discover(environment: Environment, host: Host) {
    let pending = discoveries.get(environment)
    if (!pending) {
      pending = (async () => {
        const sources = new Map<string, string>()
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
              if (contributes(source)) sources.set(file, source)
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
    if (!source.includes('zyzz')) return false
    const { program } = Parser.parseSync('source.tsx', source, {
      sourceType: 'module',
    })
    const imports = new Map<number, string>()
    for (const node of program.body) {
      if (
        node.type !== 'ImportDeclaration' ||
        node.importKind === 'type' ||
        !['zyzz', 'zyzz/web'].includes(node.source.value)
      )
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
            ? ['global', 'fontFace', 'keyframes', 'layers'].includes(name)
            : name === 'Config'
        )
          imports.set(specifier.start, name)
      }
    }
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
      if (contributes(source)) sources.set(file, source)
      else sources.delete(file)
    }
  }

  async function compile(entry: Entry, host: Host, code?: string) {
    const imports: Record<
      string,
      Record<string, string | null>
    > = Object.create(null)
    const contracts: Record<string, string> = Object.create(null)
    const modules: Record<string, string> = Object.create(null)
    const files = new Set<string>()
    async function visit(file: string, source?: string) {
      if (files.has(file)) return
      files.add(file)
      host.watch(file)
      const id = sourceId(file)
      const text = source ?? (await Fs.readFile(file, 'utf8'))
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
        const resolved = await host.resolve(specifier, file)
        if (!resolved)
          throw new Source.ExtractError([
            {
              code: 'unsupported_syntax',
              end: node.end,
              message: `Unable to resolve ${JSON.stringify(specifier)}`,
              source: file,
              start: node.start,
            },
          ])
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
    for (const [file, source] of await discover(entry.environment, host))
      if (!files.has(file)) await visit(file, source)
    const result = entry.compiler.compile({ contracts, imports, modules })
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
      : Lightning.transform({
          filename: 'zyzz.shared.css',
          code: new TextEncoder().encode(result.sharedCss ?? ''),
          sourceMap: true,
          inputSourceMap: JSON.stringify(
            result.sharedCssMap ??
              Mapping.toEncodedMap(new Mapping.GenMapping()),
          ),
          visitor: {
            Url(url) {
              const target = result.sharedAssets?.[url.url]
              if (!target) return
              if (!target.startsWith('app/'))
                throw new Error('Asset path escapes the Vite project.')
              const file = Path.join(root, target.slice(4).split(/[?#]/)[0]!)
              host.watch(file)
              return { ...url, url: `/@fs/${Path.join(root, target.slice(4))}` }
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

  return {
    configResolved(config) {
      root = config.root
    },
    enforce: 'pre',
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
      const output = await compile(entry, {
        resolve: (source, importer) => this.resolve(source, importer),
        watch: (file) => this.addWatchFile(file),
      })
      if (id === sharedId)
        return {
          code: output.sharedCss,
          map: JSON.stringify(output.sharedCssMap),
        }
      return { code: output.css, map: JSON.stringify(output.cssMap) }
    },
    name: 'zyzz',
    resolveId(id) {
      if (id.startsWith(prefix)) return id
    },
    async transform(code, id) {
      if (!eligible(id)) return
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
      const output = await compile(
        entry,
        {
          resolve: (source, importer) => this.resolve(source, importer),
          watch: (file) => this.addWatchFile(file),
        },
        code,
      )
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
  resolve: (
    source: string,
    importer: string,
  ) => Promise<{
    external?: boolean | 'absolute' | 'relative'
    id: string
  } | null>
  watch: (file: string) => void
}

const prefix = '\0zyzz:'
const sharedId = `${prefix}shared.css`

function cssId(file: string) {
  return `${prefix}${encodeURIComponent(file)}.css`
}
