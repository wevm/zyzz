/** Carries source-owned stylesheet sections across packed boundaries and rebases their assets. @module */
import * as Mapping from '@jridgewell/gen-mapping'
import * as Lightning from 'lightningcss'
import * as Contributions from '../../web/internal/Contributions.js'

/** Ordered CSS owned by one portable source module. */
export type Section = {
  /** Portable identity of the contributing source module. */
  readonly source: string
  /** Stable contribution identity within its source module. */
  readonly key?: string | undefined
  /** Ordered emitted CSS before host asset relocation. */
  readonly css: string
  /** Authored layer-order constraints retained across packages. */
  readonly layers: readonly (readonly string[])[]
  /** Original source text, when available for source maps. */
  readonly content?: string | undefined
  /** Start offset of this contribution in original source text. */
  readonly start?: number | undefined
}
/** Resolves a relative path within a portable graph, retaining query/hash suffixes. */
export function resolve(source: string, reference: string): string {
  const parts = source.split('/').slice(0, -1)
  for (const part of reference.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!parts.length)
        throw new Error('Asset path escapes the supplied graph.')
      parts.pop()
    } else parts.push(part)
  }
  return parts.join('/')
}
/** Makes a module location relative to another module for relocation in a package. */
export function relative(owner: string, source: string): string {
  const from = owner.split('/').slice(0, -1),
    to = source.split('/')
  while (from.length && from[0] === to[0]) {
    from.shift()
    to.shift()
  }
  return [...from.map(() => '..'), ...to].join('/')
}
/** Combines reachable sections, layer constraints, source maps, and asset identities. */
export function render(sections: readonly Section[]) {
  const seen = new Map<string, string>()
  const ordered = sections.filter((section) => {
    const signature = JSON.stringify([section.css, section.layers])
    const identity = JSON.stringify([section.source, section.key])
    const prior = seen.get(identity)
    if (prior !== undefined) {
      if (prior !== signature)
        throw new Error('Conflicting packed stylesheet contributions.')
      return false
    }
    seen.set(identity, signature)
    return true
  })
  const layers = Contributions.order(
    ordered.flatMap((section) => section.layers),
  )
  const map = new Mapping.GenMapping({ file: 'zyzz.shared.css' })
  const assets: Record<string, string> = Object.create(null)
  const chunks: string[] = layers.length ? [`@layer ${layers.join(',')};`] : []
  let line = chunks.length + 1
  for (const section of ordered) {
    if (!section.css) continue
    let changed = false
    const rewritten = Lightning.transform({
      filename: section.source,
      code: new TextEncoder().encode(section.css),
      visitor: {
        Url(url) {
          if (/^(?:\/|#|[a-z][a-z\d+.-]*:)/i.test(url.url)) return
          changed = true
          const target = resolve(section.source, url.url)
          const key = `zyzz-asset:${encodeURIComponent(target)}`
          assets[key] = target
          return { ...url, url: key }
        },
      },
      errorRecovery: false,
    })
    const css = changed
      ? new TextDecoder().decode(rewritten.code).trimEnd()
      : section.css
    const lines = (section.content ?? '')
      .slice(0, section.start ?? 0)
      .split('\n')
    Mapping.setSourceContent(map, section.source, section.content ?? null)
    for (let index = 0; index < css.split('\n').length; index++)
      Mapping.addMapping(map, {
        generated: { line: line + index, column: 0 },
        source: section.source,
        original: { line: lines.length, column: lines.at(-1)!.length },
      })
    chunks.push(css)
    line += css.split('\n').length
  }
  return { css: chunks.join('\n'), map: Mapping.toEncodedMap(map), assets }
}
/** Reads packed sections as validated data; CSS is parsed before emission. */
export function read(value: unknown): readonly Section[] {
  if (value === undefined) return []
  if (!Array.isArray(value))
    throw new Error('Invalid packed stylesheet sections.')
  return value.map((section) => {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.source !== 'string' ||
      typeof section.css !== 'string' ||
      (section.key !== undefined && typeof section.key !== 'string') ||
      !Array.isArray(section.layers) ||
      section.layers.some(
        (list: unknown) =>
          !Array.isArray(list) || list.some((name) => typeof name !== 'string'),
      )
    )
      throw new Error('Invalid packed stylesheet section.')
    if (section.css)
      Lightning.transform({
        filename: section.source,
        code: new TextEncoder().encode(section.css),
        errorRecovery: false,
      })
    return {
      source: section.source,
      ...(section.key !== undefined ? { key: section.key } : {}),
      css: section.css,
      layers: section.layers,
      ...(typeof section.content === 'string'
        ? { content: section.content }
        : {}),
      ...(Number.isSafeInteger(section.start) && section.start >= 0
        ? { start: section.start }
        : {}),
    } as Section
  })
}
