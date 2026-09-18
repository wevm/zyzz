/** Describes nested typography sets and their property-aware token paths. @module */
import type * as Literal from './Literal.js'
import * as Token from './Token.js'

/** Resolves the scalar fields owned by one dotted set path. */
export function fields(
  theme: object | undefined,
  name: unknown,
): readonly Property[] {
  const data =
    theme &&
    (Object.getOwnPropertyDescriptor(theme, Token.definition)?.value as
      | Token.Metadata
      | undefined)
  if (!data || typeof name !== 'string') return []

  return properties.filter((property) =>
    Object.hasOwn(data.values, `typography.${name}.${property}`),
  )
}

/** Names of sets containing at least one typography declaration. */
export type Names<tokens> = tokens extends { typography: infer tree }
  ? Paths<tree>
  : never

type Paths<tree> = string extends keyof tree
  ? string
  : {
      [key in Exclude<Extract<keyof tree, string | number>, Property>]:
        | (Extract<keyof tree[key], Property> extends never ? never : `${key}`)
        | `${key}.${Paths<tree[key]>}`
    }[Exclude<Extract<keyof tree, string | number>, Property>]

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
export type Set = Pick<Literal.Properties, Property>

/** Nested names may contain sets and additional named variants. */
export type Sets = { readonly [name: string]: Set | Sets }
