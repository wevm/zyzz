/** Carries source-owned stylesheet sections across packed boundaries and rebases their assets. @module */
import * as Mapping from '@jridgewell/gen-mapping'
import type * as Namespace from '../../web/internal/Namespace.js'
import * as Namespaces from './Namespaces.js'
import * as AtRules from './AtRules.js'
import * as Contributions from '../../web/internal/Contributions.js'

/** Identifies the owner of invalid packed stylesheet output. */
export class ConflictError extends Error {
  /** Attaches the contract/source identity to the rendering failure. */
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(message)
  }
  override name = 'Stylesheets.ConflictError'
}

/** Selects module-owned effects when the host loads source dependencies separately. */
export const entry = Symbol('stylesheet entry')

/** Independently shared packed sections for hosts that load source modules separately. */
export const packed = Symbol('packed stylesheets')

/** Reset stylesheet shared independently of authored contributions and layer order. */
export const reset = Symbol('reset stylesheet')

/** One packed resource with stable source ownership for development updates. */
export type Resource = ReturnType<typeof render> & { readonly id: string }

/** Ordered CSS owned by one portable source module. */
export type Section = {
  /** Isolated selector namespaces belonging to the source owner. */
  readonly namespaces?: readonly Namespace.Definition[] | undefined
  /** Portable identity of the contributing source module. */
  readonly source: string
  /** Trusted graph owner; ignored when reading external metadata. */
  readonly owner?: string | undefined
  /** Import chain to the declaring contract when repacked through dependencies. */
  readonly dependency?: readonly string[] | undefined
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
  const suffixStart = reference.search(/[?#]/)
  const pathname = suffixStart < 0 ? reference : reference.slice(0, suffixStart)
  const suffix = suffixStart < 0 ? '' : reference.slice(suffixStart)
  const parts = source.split('/').slice(0, -1)

  for (const part of pathname.split('/')) {
    if (!part || part === '.') continue

    if (part === '..') {
      if (!parts.length)
        throw new Error('Asset path escapes the supplied graph.')

      parts.pop()
    } else parts.push(part)
  }

  return parts.join('/') + suffix
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
    const signature = JSON.stringify([
      section.css,
      section.namespaces,
      section.layers,
      section.content,
      section.start,
    ])

    const identity = JSON.stringify([section.source, section.key])
    const prior = seen.get(identity)

    if (prior !== undefined) {
      if (prior !== signature)
        throw new ConflictError(
          section.owner ?? section.source,
          'Conflicting packed stylesheet contributions.',
        )

      return false
    }

    seen.set(identity, signature)

    return true
  })
  ordered.sort((a, b) => rank(a.css) - rank(b.css))
  const namespaceUris = new Map<string, string>()
  for (const section of ordered)
    for (const entry of section.namespaces ?? []) {
      const previous = namespaceUris.get(entry.name)
      if (previous !== undefined && previous !== entry.uri)
        throw new ConflictError(
          section.owner ?? section.source,
          'Conflicting namespace identity.',
        )
      namespaceUris.set(entry.name, entry.uri)
    }

  const layers = Contributions.order(
    ordered.flatMap((section) => section.layers),
  )
  const map = new Mapping.GenMapping({ file: 'zyzz.shared.css' })
  const assets: Record<string, string> = Object.create(null)
  const owners: Record<string, string> = Object.create(null)
  const animations = new Map<string, { source: string; signature: string }>()
  const identities = new Map<string, { source: string; signature: string }>()
  const chunks: string[] = layers.length ? [`@layer ${layers.join(',')};`] : []
  let line = chunks.length + 1

  for (const section of ordered) {
    if (!section.css) continue
    const namespaced = Namespaces.rewrite(
      section.css,
      section.namespaces ?? [],
    ).css
    let changed = namespaced !== section.css
    function relocate(url: string): string {
      if (!url || /^(?:\/|[?#]|[a-z][a-z\d+.-]*:)/i.test(url)) return url
      changed = true
      const target = resolve(section.source, url)
      const key = `zyzz-asset:${encodeURIComponent(target)}`
      assets[key] = target
      owners[key] = section.owner ?? section.source
      return key
    }
    const rewritten = AtRules.transform({
      filename: section.source,
      code: new TextEncoder().encode(namespaced),
      visitor: {
        Rule(rule) {
          if (rule.type === 'import') {
            const url = relocate(rule.value.url)
            if (url !== rule.value.url)
              return AtRules.relocateImport(rule.value, url)
            return
          }
          if (rule.type !== 'keyframes') {
            const identity = (() => {
              if (rule.type === 'counter-style' || rule.type === 'position-try')
                return {
                  name: rule.value.name,
                  data: rule.value.declarations,
                  kind: rule.type,
                }
              if (rule.type === 'font-palette-values')
                return {
                  name: rule.value.name,
                  data: rule.value.properties,
                  kind: rule.type,
                }
              if (
                rule.type === 'unknown' &&
                (rule.value.name.startsWith('-zyzz-fpv-') ||
                  ['color-profile', 'function', 'custom-media'].includes(
                    rule.value.name,
                  ))
              ) {
                const name = rule.value.prelude[0]
                if (
                  name?.type === 'dashed-ident' ||
                  (rule.value.name === 'function' && name?.type === 'function')
                )
                  return {
                    name:
                      name.type === 'function' ? name.value.name : name.value,
                    data: [rule.value.prelude, rule.value.block],
                    kind: rule.value.name.startsWith('-zyzz-fpv-')
                      ? 'font-palette-values'
                      : rule.value.name,
                  }
              }
              return undefined
            })()
            if (!identity) return
            const key = `${identity.kind}:${identity.name}`
            const signature = JSON.stringify(identity.data)
            const previous = identities.get(key)
            if (
              previous &&
              (previous.source !== section.source ||
                previous.signature !== signature)
            )
              throw new ConflictError(
                section.owner ?? section.source,
                `Conflicting stylesheet identity: ${identity.name}; compile libraries with package-qualified module IDs.`,
              )
            identities.set(key, { source: section.source, signature })
            return
          }

          const name = rule.value.name.value
          const signature = JSON.stringify(rule.value.keyframes)
          const previous = animations.get(name)
          if (
            previous &&
            (previous.source !== section.source ||
              previous.signature !== signature)
          )
            throw new ConflictError(
              section.owner ?? section.source,
              `Conflicting animation identity: ${name}; compile libraries with package-qualified module IDs.`,
            )

          animations.set(name, { source: section.source, signature })
        },
        Url(url) {
          const value = relocate(url.url)
          if (value !== url.url) return { ...url, url: value }
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

  return {
    css: chunks.join('\n'),
    map: Mapping.toEncodedMap(map),
    assets,
    owners,
  }
}

/** Reads packed sections as validated data; CSS is parsed before emission. */
export function read(value: unknown): readonly Section[] {
  if (value === undefined) return []

  if (!Array.isArray(value))
    throw new Error('Invalid packed stylesheet sections.')

  const contents = new Map<string, string>()

  const sections = value.map((section) => {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.source !== 'string' ||
      typeof section.css !== 'string' ||
      (section.content !== undefined && typeof section.content !== 'string') ||
      (section.start !== undefined &&
        (!Number.isSafeInteger(section.start) || section.start < 0)) ||
      (section.key !== undefined && typeof section.key !== 'string') ||
      (section.dependency !== undefined &&
        (!Array.isArray(section.dependency) ||
          !section.dependency.length ||
          section.dependency.some(
            (specifier: unknown) =>
              typeof specifier !== 'string' ||
              !specifier ||
              specifier.includes('\0'),
          ))) ||
      !Array.isArray(section.layers) ||
      section.layers.some(
        (list: unknown) =>
          !Array.isArray(list) || list.some((name) => typeof name !== 'string'),
      )
    )
      throw new Error('Invalid packed stylesheet section.')

    if (typeof section.content === 'string') {
      const existing = contents.get(section.source)
      if (existing !== undefined && existing !== section.content)
        throw new Error('Conflicting packed source content.')

      contents.set(section.source, section.content)
    }

    if (section.css)
      AtRules.transform({
        filename: section.source,
        code: new TextEncoder().encode(section.css),
        errorRecovery: false,
      })

    return {
      source: section.source,
      ...(section.namespaces !== undefined
        ? { namespaces: Namespaces.read(section.namespaces) }
        : {}),
      ...(section.dependency !== undefined
        ? { dependency: [...section.dependency] }
        : {}),
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

  Contributions.order(sections.flatMap((section) => section.layers))

  return sections.map((section) => ({
    ...section,
    ...(contents.has(section.source)
      ? { content: contents.get(section.source)! }
      : {}),
  }))
}

/** Serializes source text once per packed source identity. */
export function write(sections: readonly Section[]): readonly Section[] {
  const sources = new Set<string>()

  return sections.map((section) => {
    const { content, ...rest } = section
    if (content === undefined || sources.has(section.source)) return rest

    sources.add(section.source)

    return { ...rest, content }
  })
}

function rank(css: string): number {
  if (css.startsWith('@import ')) return 0
  if (css.startsWith('@namespace ')) return 1
  return 2
}
