/** Reads serialized variable data and selects visual previews. @module */
import LZString from 'lz-string'

export type Configuration = {
  name?: string | undefined
  vars: Record<string, unknown>
  mappings?: Readonly<Record<string, readonly string[]>> | false | undefined
}

export type Entry = {
  dark?: string
  path: readonly string[]
  raw?: object
  kind: string
  value: string | number | Typography
}

export type Typography = {
  fontFamily?: string
  fontSize: string
  fontWeight?: number
  letterSpacing?: string
  lineHeight?: string
}

/** Reads raw variables or a configuration with vars and optional mappings. */
export function decode(value: string | undefined): Configuration | undefined {
  if (value === undefined) return undefined
  if (!value || value.length > 32000)
    throw new Error('The configuration is empty or too large.')
  const json = value.startsWith('lz:')
    ? LZString.decompressFromEncodedURIComponent(value.slice(3))
    : value
  if (!json || json.length > 1000000)
    throw new Error(
      'The configuration could not be decompressed or is too large.',
    )
  const parsed: unknown = JSON.parse(json)
  if (!record(parsed))
    throw new Error('Expected a JSON object containing variables.')
  const vars = Object.hasOwn(parsed, 'vars') ? parsed.vars : parsed
  if (!record(vars)) throw new Error('Expected vars to be a JSON object.')
  const name = Object.hasOwn(parsed, 'vars') ? parsed.name : undefined
  if (name !== undefined && typeof name !== 'string')
    throw new Error('The configuration name must be a string.')
  let count = 0
  function validate(value: unknown, depth: number) {
    if (++count > 20000 || depth > 24)
      throw new Error('The configuration has too many values or nested groups.')
    if (typeof value === 'string' || typeof value === 'number') return
    if (!record(value))
      throw new Error(
        'Variable values must be strings, numbers, or nested objects.',
      )
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key))
        throw new Error('The configuration contains an unsupported key.')
      validate(child, depth + 1)
    }
  }
  validate(vars, 0)
  const mappings = Object.hasOwn(parsed, 'vars') ? parsed.mappings : undefined
  if (
    mappings !== undefined &&
    mappings !== false &&
    (!record(mappings) ||
      Object.values(mappings).some(
        (value) =>
          !Array.isArray(value) ||
          value.some((property) => typeof property !== 'string'),
      ))
  )
    throw new Error(
      'Mappings must be false or an object of CSS property arrays.',
    )
  return {
    vars,
    name: name?.trim() || undefined,
    mappings: mappings as Configuration['mappings'],
  }
}

/** Preserves authored paths, including light/dark values and media overrides. */
export function collect(
  value: unknown,
  path: readonly string[] = [],
  mappings?: Configuration['mappings'],
): readonly Entry[] {
  const kind = previewKind(path, value, mappings)
  if (typeof value === 'string' || typeof value === 'number')
    return [{ path, value, kind }]
  if (!record(value)) return []
  if (Object.hasOwn(value, 'fontSize')) {
    const fields = [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
    ]
    const conditions = [
      ...new Set(
        fields.flatMap((key) =>
          record(value[key])
            ? Object.keys(value[key]).filter((key) => key !== 'default')
            : [],
        ),
      ),
    ]
    const entries: Entry[] = []
    const overrides: Record<string, unknown> = {}
    for (const condition of ['default', ...conditions]) {
      const resolved = Object.fromEntries(
        fields
          .map((key) => {
            const field = value[key]
            if (record(field) && Object.hasOwn(field, condition))
              overrides[key] = field[condition]
            return [key, record(field) ? overrides[key] : field]
          })
          .filter(([, value]) => value !== undefined),
      )
      if (typeof resolved.fontSize !== 'string') continue
      entries.push({
        path: condition === 'default' ? path : [...path, condition],
        value: {
          fontSize: resolved.fontSize,
          ...(typeof resolved.fontFamily === 'string'
            ? { fontFamily: resolved.fontFamily }
            : {}),
          ...(typeof resolved.fontWeight === 'number'
            ? { fontWeight: resolved.fontWeight }
            : {}),
          ...(typeof resolved.letterSpacing === 'string'
            ? { letterSpacing: resolved.letterSpacing }
            : {}),
          ...(typeof resolved.lineHeight === 'string'
            ? { lineHeight: resolved.lineHeight }
            : {}),
        },
        raw: value,
        kind: 'typography',
      })
    }
    if (entries.length)
      return [
        ...entries,
        ...Object.entries(value)
          .filter(([key, child]) => !fields.includes(key) && record(child))
          .flatMap(([key, child]) => collect(child, [...path, key], mappings)),
      ]
  }
  if (typeof value.light === 'string' && typeof value.dark === 'string')
    return [
      {
        path,
        kind: previewKind(path, value.light, mappings),
        value: value.light,
        dark: value.dark,
      },
    ]
  return Object.entries(value).flatMap(([key, child]) =>
    collect(child, [...path, key], mappings),
  )
}

/** Maps custom categories to CSS properties before using name/value hints. */
export function previewKind(
  path: readonly string[],
  value: unknown,
  mappings?: Configuration['mappings'],
): string {
  const kinds: Record<string, string> = {
    backgroundColor: 'color',
    color: 'color',
    borderColor: 'color',
    fill: 'color',
    stroke: 'color',
    fontFamily: 'fontFamily',
    fontSize: 'fontSize',
    fontWeight: 'fontWeight',
    letterSpacing: 'letterSpacing',
    lineHeight: 'lineHeight',
    borderRadius: 'radius',
    cornerRadius: 'radius',
    radius: 'radius',
    boxShadow: 'shadow',
    shadow: 'shadow',
    insetShadow: 'insetShadow',
    dropShadow: 'dropShadow',
    textShadow: 'textShadow',
    width: 'container',
    maxWidth: 'container',
    minWidth: 'container',
    container: 'container',
    breakpoint: 'breakpoint',
    gap: 'spacing',
    padding: 'spacing',
    margin: 'spacing',
    spacing: 'spacing',
    pageMargin: 'spacing',
    pageGutter: 'spacing',
    pagePadding: 'spacing',
    section: 'spacing',
    pageColumns: 'columns',
    gridTemplateColumns: 'columns',
    columns: 'columns',
    borderWidth: 'borderWidth',
    size: 'fontSize',
    headingSize: 'fontSize',
    labelSize: 'fontSize',
    descriptionSize: 'fontSize',
    articleHeadingSize: 'fontSize',
    aspect: 'aspect',
    aspectRatio: 'aspect',
    blur: 'blur',
    perspective: 'perspective',
    ease: 'ease',
    transitionTimingFunction: 'ease',
    animate: 'animate',
    animation: 'animate',
  }
  const properties = mappings ? mappings[path[0] ?? ''] : undefined
  const mapped = properties
    ?.map((property) =>
      Object.hasOwn(kinds, property) ? kinds[property] : undefined,
    )
    .find(Boolean)
  if (mapped) return mapped
  for (const key of [...path].reverse())
    if (Object.hasOwn(kinds, key)) return kinds[key]!
  if (typeof value === 'string') {
    if (
      /^(#(?:[\da-f]{3,8})\b|(?:rgb|hsl|oklch|oklab|lab|lch|color)\(|transparent$)/i.test(
        value,
      )
    )
      return 'color'
    if (/\b(?:sans-serif|serif|monospace)\b/.test(value)) return 'fontFamily'
    if (/^-?[\d.]+(?:px|rem|em|vh|vw|%)$/.test(value)) return 'spacing'
  }
  return 'value'
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
