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
  readonly [property in keyof Literal.Properties & keyof styles]?:
    | (string extends Literal.Properties[property]
        ? never
        : Literal.Properties[property])
    | Token.Names<tokens, property>
    | (string & {})
    | number
    | object
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

// Inferred validation checks extra fields, including vars and configured shorthands.
type Nested<tokens extends Theme.Tokens> = Properties<tokens> &
  Readonly<Record<string, unknown>>
