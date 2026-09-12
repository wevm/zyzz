/** Distinguishes compiler-owned CSS identities from unrelated declaration domains. @module */
declare const reference: unique symbol
/** Supported named stylesheet identity domains. */
export type Kind =
  | 'colorProfile'
  | 'counterStyle'
  | 'cssFunction'
  | 'customMedia'
  | 'fontPaletteValues'
  | 'positionTry'
/** A fixed CSS name whose domain remains visible to authoring types. */
export type Reference<kind extends Kind> = (kind extends 'counterStyle'
  ? string
  : `--${string}`) & {
  readonly [reference]: kind
}
/** Rejects named references outside their property's CSS identity domain. */
export type Check<value, property> = typeof reference extends keyof value
  ? value[typeof reference] extends Domain<property>
    ? unknown
    : never
  : value extends readonly unknown[]
    ? { [index in keyof value]: Check<value[index], property> }
    : unknown

type Domain<property> = property extends `--${string}`
  ? Kind
  : property extends 'fallback' | 'listStyle' | 'listStyleType' | 'speakAs'
    ? 'counterStyle'
    : property extends 'fontPalette'
      ? 'fontPaletteValues'
      : property extends 'positionTry' | 'positionTryFallbacks'
        ? 'positionTry'
        : never
/** Checks domain-sensitive descriptor members without widening literals. */
export type Checked<value> = { [key in keyof value]: Check<value[key], key> }

/** Checks the domain of a compiler-owned identity at untyped source boundaries. */
export function accepts(kind: Kind, property: string): boolean {
  if (kind === 'cssFunction') return true
  if (kind === 'customMedia') return false
  if (property.startsWith('--')) return true
  if (kind === 'counterStyle')
    return [
      'fallback',
      'listStyle',
      'listStyleType',
      'speakAs',
      'system',
    ].includes(property)
  if (kind === 'fontPaletteValues') return property === 'fontPalette'
  if (kind === 'positionTry')
    return ['positionTry', 'positionTryFallbacks'].includes(property)
  return false
}

/** Permits profile identities only as the color-space argument of color(). */
export function acceptsExpression(
  kind: Kind,
  property: string,
  prefix: string,
): boolean {
  if (kind === 'colorProfile') {
    const text = prefix.replace(/\/\*[\s\S]*?\*\//g, ' ')
    const groups: { name: string; start: number }[] = []
    let quote = ''
    for (let index = 0; index < text.length; index++) {
      const char = text[index]!
      if (char === '\\') {
        index++
        continue
      }
      if (quote) {
        if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'") {
        quote = char
        continue
      }
      if (char === '(')
        groups.push({
          name:
            text
              .slice(0, index)
              .match(/[\w-]+$/)?.[0]
              ?.toLowerCase() ?? '',
          start: index + 1,
        })
      else if (char === ')') groups.pop()
    }

    const group = groups.at(-1)
    if (quote || group?.name !== 'color') return false
    const body = text.slice(group.start)
    if (!body.trim()) return true

    return /^\s*from\s+(?:#[\da-f]+|[-\w]+(?:\([\s\S]*\))?)\s+$/i.test(body)
  }

  return accepts(kind, property)
}
