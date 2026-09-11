/** Isolates CSS namespace selectors and composes their generated source maps. @module */
import MagicString from 'magic-string'
import * as Mapping from '@jridgewell/gen-mapping'
import * as Trace from '@jridgewell/trace-mapping'
import type * as Lightning from 'lightningcss'
import type * as Namespace from '../../web/internal/Namespace.js'
import * as AtRules from './AtRules.js'

/** Rewrites namespace-sensitive selectors using native selector ASTs. */
export function rewrite(
  css: string,
  namespaces: readonly Namespace.Definition[],
  previous?: Mapping.EncodedSourceMap,
  includeDeclarations = false,
) {
  if (!namespaces.length || !css) return { css, map: previous }
  const names = new Map(namespaces.map((value) => [value.prefix, value.name]))
  function selector(input: Lightning.Selector): Lightning.Selector {
    const output: Lightning.Selector = []
    let first = true
    for (const original of input) {
      let component = original
      if (component.type === 'combinator') first = true
      else if (first) {
        const name = names.get(undefined)
        if (
          name &&
          component.type !== 'namespace' &&
          component.type !== 'nesting'
        ) {
          output.push({ type: 'namespace', kind: 'named', prefix: name })
          if (component.type !== 'type' && component.type !== 'universal')
            output.push({ type: 'universal' })
        }
        first = false
      }
      if (component.type === 'namespace' && component.kind === 'named')
        component = {
          ...component,
          prefix: names.get(component.prefix) ?? component.prefix,
        }
      if (
        component.type === 'attribute' &&
        component.namespace?.type === 'specific'
      )
        component = {
          ...component,
          namespace: {
            ...component.namespace,
            prefix:
              names.get(component.namespace.prefix) ??
              component.namespace.prefix,
          },
        }
      if ('selectors' in component && Array.isArray(component.selectors))
        component = {
          ...component,
          selectors: Array.isArray(component.selectors[0])
            ? (component.selectors as Lightning.Selector[]).map(selector)
            : selector(component.selectors as Lightning.Selector),
        } as typeof component
      if ('of' in component && component.of)
        component = { ...component, of: component.of.map(selector) }
      output.push(component)
    }
    return output
  }
  const declared = new Set<string>()
  const rewritten = AtRules.transform({
    filename: 'zyzz.css',
    code: new TextEncoder().encode(css),
    sourceMap: !!previous,
    visitor: {
      Selector: selector,
      Rule(rule) {
        if (rule.type === 'namespace' && rule.value.prefix)
          declared.add(rule.value.prefix)
      },
    },
  })
  const declarations = includeDeclarations
    ? namespaces
        .filter((value) => !declared.has(value.name))
        .map(
          (value) => `@namespace ${value.name} ${JSON.stringify(value.uri)};`,
        )
    : []
  const output = [
    ...declarations,
    new TextDecoder().decode(rewritten.code).trimEnd(),
  ].join('\n')
  if (!previous || !rewritten.map) return { css: output, map: previous }
  const input = new Trace.TraceMap(previous)
  const map = new Mapping.GenMapping({ file: previous.file ?? 'zyzz.css' })
  Trace.eachMapping(
    new Trace.TraceMap(JSON.parse(new TextDecoder().decode(rewritten.map))),
    (entry) => {
      if (entry.originalLine === null || entry.originalColumn === null) return
      const original = Trace.originalPositionFor(input, {
        line: entry.originalLine,
        column: entry.originalColumn,
      })
      if (
        original.line === null ||
        original.column === null ||
        original.source === null
      )
        return
      const generated = {
        line: entry.generatedLine + declarations.length,
        column: entry.generatedColumn,
      }
      const position = { line: original.line, column: original.column }
      if (original.name)
        Mapping.addMapping(map, {
          generated,
          original: position,
          source: original.source,
          name: original.name,
        })
      else
        Mapping.addMapping(map, {
          generated,
          original: position,
          source: original.source,
        })
    },
  )
  previous.sources.forEach((source, index) => {
    if (source !== null)
      Mapping.setSourceContent(
        map,
        source,
        previous.sourcesContent?.[index] ?? null,
      )
  })
  return { css: output, map: Mapping.toEncodedMap(map) }
}

/** Reads namespace metadata at the packed-library boundary. */
export function read(value: unknown): readonly Namespace.Definition[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid packed namespaces.')
  const names = new Set<string | undefined>()
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object')
      throw new Error('Invalid packed namespace.')
    const { name, prefix, uri } = entry as Partial<Namespace.Definition>
    if (
      typeof name !== 'string' ||
      !/^z-n[a-z0-9-]+$/.test(name) ||
      typeof uri !== 'string' ||
      (prefix !== undefined &&
        (typeof prefix !== 'string' || !/^-?[_a-zA-Z][\w-]*$/.test(prefix))) ||
      names.has(prefix)
    )
      throw new Error('Invalid packed namespace.')
    names.add(prefix)
    return { name, uri, ...(prefix !== undefined ? { prefix } : {}) }
  })
}

/** Shields namespaces until Vite has concatenated and minified its CSS chunks. */
export function protect(css: string): string {
  return AtRules.rename(css, 'namespace', '-zyzz-namespace')
}

/** Restores namespace declarations to the stylesheet prolog after bundling. */
export function bundle(css: string): string {
  if (!css.includes('@-zyzz-namespace')) return css
  const lines = [0]
  for (let index = 0; index < css.length; index++)
    if (css[index] === '\n') lines.push(index + 1)
  const statements: { start: number; end: number; namespace: boolean }[] = []
  AtRules.transform({
    filename: 'bundle.css',
    code: new TextEncoder().encode(css),
    visitor: {
      StyleSheet(sheet) {
        for (const rule of sheet.rules) {
          const namespace =
            rule.type === 'unknown' && rule.value.name === '-zyzz-namespace'
          if (
            !namespace &&
            rule.type !== 'import' &&
            rule.type !== 'layer-statement'
          )
            continue
          if (!('value' in rule) || !('loc' in rule.value)) continue
          const start = lines[rule.value.loc.line]! + rule.value.loc.column - 1
          let quote = '',
            parentheses = 0,
            end = start
          for (; end < css.length; end++) {
            const char = css[end]
            if (char === '\\') {
              end++
              continue
            }
            if (quote) {
              if (char === quote) quote = ''
              continue
            }
            if (char === '"' || char === "'") quote = char
            else if (char === '/' && css[end + 1] === '*')
              end = css.indexOf('*/', end + 2) + 1
            else if (char === '(') parentheses++
            else if (char === ')') parentheses--
            else if (char === ';' && !parentheses) {
              end++
              break
            }
          }
          statements.push({ start, end, namespace })
        }
      },
    },
  })
  const output = new MagicString(css)
  const prolog = statements.toSorted(
    (a, b) => Number(a.namespace) - Number(b.namespace),
  )
  for (const statement of statements)
    output.remove(statement.start, statement.end)
  output.prepend(
    [...new Set(prolog.map((value) => css.slice(value.start, value.end)))].join(
      '\n',
    ) + '\n',
  )
  return AtRules.rename(output.toString(), '-zyzz-namespace', 'namespace')
}
