/** Distinguishes compiler-owned CSS identities from unrelated declaration domains. @module */
declare const reference: unique symbol
/** Supported named stylesheet identity domains. */
export type Kind =
  | 'colorProfile'
  | 'counterStyle'
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

type Domain<property> = property extends
  | 'fallback'
  | 'listStyle'
  | 'listStyleType'
  | 'speakAs'
  ? 'counterStyle'
  : property extends 'fontPalette'
    ? 'fontPaletteValues'
    : property extends 'positionTry' | 'positionTryFallbacks'
      ? 'positionTry'
      : never
/** Checks domain-sensitive descriptor members without widening literals. */
export type Checked<value> = { [key in keyof value]: Check<value[key], key> }
