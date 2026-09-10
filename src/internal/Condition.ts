/** Typed nested selector and condition keys without a general string index. @module */
import type * as Theme from '../Theme.js'

/** Explicit scoped selectors and standard conditional rule forms. */
export type Raw =
  | `${string}&${string}`
  | `:${string}`
  | '@starting-style'
  | `@supports ${string}`
  | `@media (${string}`
  | `@media ${'all' | 'print' | 'screen'}`
  | `@media ${'all' | 'print' | 'screen'} ${string}`
  | `@container (${string}`
  | `@container ${string} (${string}`
type Names<tokens, group extends PropertyKey> = group extends keyof tokens
  ? Extract<keyof NonNullable<tokens[group]>, string>
  : never
type Alias<name extends string> =
  | name
  | `>=${name}`
  | `<${name}`
  | `${name}..${name}`
type Containers<tokens> = tokens extends {
  containerNames: readonly (infer name extends string)[]
}
  ? name
  : never
/** Keys inferred from the bound theme's own threshold groups. */
export type Keys<tokens extends Theme.Tokens = {}> =
  | Raw
  | `@media ${Alias<Names<tokens, 'breakpoints'>>}`
  | `@container ${Alias<Names<tokens, 'containers'>>}`
  | `@container ${Containers<tokens>} ${Alias<Names<tokens, 'containers'>>}`
/** Recognizes structured rule keys before declaration parsing. */
export function is(key: string): boolean {
  return (
    key.includes('&') ||
    key.startsWith(':') ||
    key === '@starting-style' ||
    /^@(media|supports|container) /.test(key)
  )
}
