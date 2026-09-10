/**
 * Connects static Zyzz source compilation to Vite resolution and CSS delivery.
 * @module
 */
import * as Mapping from '@jridgewell/gen-mapping'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Parser from 'oxc-parser'
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
    async function collect(directory: string): Promise<void> {
      for (const item of await Fs.readdir(directory, { withFileTypes: true })) {
        if (
          item.name.startsWith('.') ||
          ['node_modules', 'dist', 'build', 'coverage'].includes(item.name)
        )
          continue
        const file = Path.join(directory, item.name)
        if (item.isDirectory()) await collect(file)
        else if (item.isFile() && eligible(file) && !files.has(file)) {
          const source = await Fs.readFile(file, 'utf8')
          if (
            source.includes('zyzz/web') ||
            (source.includes('Config') && source.includes('layers'))
          )
            await visit(file, source)
          else {
            files.add(file)
            host.watch(file)
          }
        }
      }
    }
    await collect(root)
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
    const output = result.modules[sourceId(entry.file)]!
    entry.files = files
    return {
      code: output.code,
      css: styles.join('\n'),
      sharedCss: result.sharedCss ?? '',
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
    hotUpdate({ file, modules, timestamp, type }) {
      const affected = new Set(modules)
      for (const entry of entries(this.environment).values()) {
        if (!entry.files.has(file) && !(type === 'create' && eligible(file)))
          continue
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
      if (id === sharedId) return { code: output.sharedCss }
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
        entry = { compiler: Graph.create(), file: id, files: new Set([id]) }
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
      return {
        code: `${output.code}\nimport ${JSON.stringify(sharedId)};\nimport ${JSON.stringify(cssId(id))};`,
        map: JSON.stringify(output.map),
      }
    },
  }
}

type Entry = {
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
