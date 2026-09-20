/** Describes nested typography sets and their property-aware token paths. @module */
import type * as Literal from './Literal.js'
import * as Token from './Token.js'

/** Responsive query blocks accepted within a typography set. */
export type Condition = `@media ${string}` | `@container ${string}`

/** Recognizes responsive blocks without accepting selectors or unrelated at-rules. */
export function condition(key: string): key is Condition {
  return /^@(media|container)\s+\S/.test(key)
}

/** Expands one named set into portable field references and ordered query blocks. */
export function entries(
  theme: object | undefined,
  name: unknown,
  explicit: ReadonlySet<string> = new Set(),
  important = false,
): readonly (readonly [string, unknown])[] {
  if (
    !theme ||
    typeof name !== 'string' ||
    name.split('.').some((part) => part.startsWith('@'))
  )
    return []
  let tree: unknown = Object.getOwnPropertyDescriptor(theme, 'tokens')?.value
  for (const part of ['typography', ...name.split('.')]) {
    if (!tree || typeof tree !== 'object') return []
    tree = Object.getOwnPropertyDescriptor(tree, part)?.value
  }
  function expand(value: unknown): readonly (readonly [string, unknown])[] {
    if (!value || typeof value !== 'object') return []
    return Object.entries(value).flatMap(
      ([key, child]): (readonly [string, unknown])[] => {
        if (
          properties.includes(key as Property) &&
          Token.is(child) &&
          !explicit.has(key)
        )
          return [
            [key, important ? Token.compose([child, ' !important']) : child],
          ]
        if (condition(key)) {
          const nested = expand(child)
          return nested.length ? [[key, Object.fromEntries(nested)]] : []
        }
        return []
      },
    )
  }
  return expand(tree)
}

/** Lists expanded fields and queries in source-map traversal order. */
export function keys(
  theme: object | undefined,
  name: unknown,
  explicit: ReadonlySet<string>,
): readonly string[] {
  function collect(values: readonly (readonly [string, unknown])[]): string[] {
    return values.flatMap(([key, value]) =>
      condition(key)
        ? [key, ...collect(Object.entries(value as object))]
        : [key],
    )
  }
  return collect(entries(theme, name, explicit))
}

/** Names of sets containing at least one typography declaration. */
export type Names<tokens> = tokens extends { typography: infer tree }
  ? Paths<tree>
  : never

type Paths<tree> = string extends keyof tree
  ? string
  : {
      [key in Exclude<
        Extract<keyof tree, string | number>,
        Property | Condition
      >]:
        | (Extract<keyof tree[key], Property | Condition> extends never
            ? never
            : `${key}`)
        | `${key}.${Paths<tree[key]>}`
    }[Exclude<Extract<keyof tree, string | number>, Property | Condition>]

/** Scalar properties applied by a typography set. */
export const properties = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
] as const

/** Property domain retained by each field in a set. */
export type Property = (typeof properties)[number]

/** A set may supply any of the five typography properties. */
export type Set = Pick<Literal.Properties, Property> & {
  readonly [key in Condition]?: Set
}

/** Nested names may contain sets and additional named variants. */
export type Sets = { readonly [name: string]: Set | Sets }
