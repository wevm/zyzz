/** Supplies editor hints independently of inferred declaration validation. @module */
import type * as Theme from './Theme.js'
import type * as Condition from './Condition.js'
import type * as Literal from './Literal.js'
import type * as Token from './Token.js'
import type * as Typography from './Typography.js'

/** Recursive hints do not determine which authored declarations are accepted. */
export type Properties<
  tokens extends Theme.Tokens = {},
  styles = Record<string, unknown>,
> = {
  readonly [property in keyof Literal.Properties &
    keyof styles]?: Hints<tokens>[property]
} & {
  // Escaped custom-property names can contain nesting characters.
  readonly [key in (`@${string}` | `:${string}` | `${string}&${string}`) &
    keyof styles]?:
    | Nested<tokens>
    | (key extends `${string}&${string}` ? string | number : never)
} & {
  readonly [key in (
    | Condition.Suggestions
    | Exclude<Condition.Keys<tokens>, Condition.Raw>
  ) &
    keyof styles]?: Nested<tokens>
} & {
  readonly [property in (Typography.Names<tokens> extends never
    ? never
    : 'typography') &
    keyof styles]?: Typography.Names<tokens> | (string & {})
}

// One hint table per token set: every call reads its entries instead of resolving token
// names again for each property it authors.
type Hints<tokens extends Theme.Tokens> = {
  readonly [property in keyof Literal.Properties]:
    // Configured tokens replace literal CSS values, so only token names are suggested.
    | ([Token.Names<tokens, property>] extends [never]
        ? string extends Literal.Properties[property]
          ? never
          : Literal.Properties[property]
        : never)
    | Token.Names<tokens, property>
    | (string & {})
    | number
    | object
}

// Inferred validation checks extra fields, including vars and configured shorthands.
type Nested<tokens extends Theme.Tokens> = Properties<tokens> &
  Readonly<Record<string, unknown>>
