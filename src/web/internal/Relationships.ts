/** Defines typed marker authoring and lowers marker predicates to scoped CSS selectors. @module */
import type * as Conditions from '../../internal/Condition.js'
import * as Marker from '../../runtime/Marker.js'

/** Supported element-state predicates; arbitrary selectors belong in has. */
export type Pseudo =
  | ':active'
  | ':checked'
  | ':disabled'
  | ':empty'
  | ':enabled'
  | ':focus'
  | ':focus-visible'
  | ':focus-within'
  | ':hover'
  | ':indeterminate'
  | ':invalid'
  | ':optional'
  | ':read-only'
  | ':read-write'
  | ':required'
  | ':valid'
  | ':visited'
/** Marker state selection, inferred only from its declared schema. */
export type State<schema extends Marker.Schema> = {
  readonly [key in keyof schema]?: schema[key][number] | undefined
}
declare const stateSchema: unique symbol
/** Opaque compiler condition key; cannot introduce an arbitrary property index. */
export type Key = Conditions.Relationship
/** Marker callable with no styling fields. */
export type Handle<schema extends Marker.Schema> = {
  <const input extends State<schema> = State<schema>>(
    input?: input & Record<Exclude<keyof input, keyof schema>, never>,
  ): Readonly<Record<`data-${string}`, string>>
  /** Compile-time invariant retaining the schema for relationship inference. */
  readonly [stateSchema]: schema
}
/** Optional conjunction of marker data, an element pseudo, and descendant selector. */
export type Condition<schema extends Marker.Schema> =
  | Pseudo
  | {
      readonly data?: State<schema> | undefined
      readonly has?: string | undefined
      readonly pseudo?: Pseudo | undefined
    }
/** Rejects unknown option and state keys even through intermediate variables. */
export type Checked<
  schema extends Marker.Schema,
  condition,
  allowHas extends boolean = true,
> = condition extends string
  ? allowHas extends false
    ? Exclude<condition, ':visited'>
    : condition
  : condition &
      (allowHas extends false
        ? { readonly pseudo?: Exclude<Pseudo, ':visited'> | undefined }
        : unknown) &
      Record<
        Exclude<
          keyof condition,
          'data' | 'pseudo' | (allowHas extends true ? 'has' : never)
        >,
        never
      > &
      (condition extends { data: infer data }
        ? {
            readonly data: data extends undefined
              ? undefined
              : data &
                  Record<Exclude<keyof NonNullable<data>, keyof schema>, never>
          }
        : {})
/** Requires finite, unambiguous state domains. */
export type Validated<schema extends Marker.Schema> = {
  [key in keyof schema]: key extends string
    ? Name<key> extends true
      ? Extract<
          Lowercase<key>,
          Lowercase<Exclude<keyof schema, key> & string>
        > extends never
        ? Lowercase<key> extends
            | 'class'
            | 'classname'
            | 'style'
            | 'key'
            | 'ref'
            | '__proto__'
          ? never
          : number extends schema[key]['length']
            ? never
            : schema[key] extends readonly []
              ? never
              : Unique<schema[key]>
        : never
      : never
    : never
}
type Letter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
type Name<
  name extends string,
  first extends boolean = true,
> = name extends `${infer char}${infer rest}`
  ? Lowercase<char> extends
      | Letter
      | (first extends true
          ? never
          :
              | '0'
              | '1'
              | '2'
              | '3'
              | '4'
              | '5'
              | '6'
              | '7'
              | '8'
              | '9'
              | '_'
              | '-')
    ? rest extends ''
      ? true
      : Name<rest, false>
    : false
  : false

type Unique<
  values extends readonly (boolean | string)[],
  seen extends string = never,
> = values extends readonly [
  infer first extends boolean | string,
  ...infer rest extends readonly (boolean | string)[],
]
  ? `${first}` extends `${string}\0${string}` | `${string}\r${string}` | seen
    ? never
    : Unique<rest, seen | `${first}`>
  : unknown
/** Supported relationship directions relative to the styled element. */
export type Kind =
  | 'ancestor'
  | 'anySibling'
  | 'descendant'
  | 'siblingAfter'
  | 'siblingBefore'
/** Lowers validated marker state and direction with zero predicate specificity. */
export function selector(
  kind: Kind,
  marker: Marker.Definition,
  condition: unknown = {},
): string {
  const options =
    typeof condition === 'string' ? { pseudo: condition } : condition
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error(
      'Relationship conditions require a pseudo or options record.',
    )
  const values = options as Record<string, unknown>
  if (
    !['ancestor', 'siblingBefore'].includes(kind) &&
    values.pseudo === ':visited'
  )
    throw new Error(
      'Visited predicates cannot be observed through has-based relationships.',
    )
  if (
    Object.keys(values).some((key) => !['data', 'has', 'pseudo'].includes(key))
  )
    throw new Error('Unknown relationship condition option.')
  const attrs = Marker.create(marker)(
    (values.data === undefined ? {} : values.data) as State<Marker.Schema>,
  )
  const escape = (value: string) =>
    Array.from(value)
      .map((char) =>
        char === '\0'
          ? '\ufffd'
          : /["\\\n\r\f]/.test(char)
            ? `\\${char.codePointAt(0)!.toString(16)} `
            : char,
      )
      .join('')
  let predicate = Object.entries(attrs)
    .map(([key, value]) =>
      value === '' && key === marker.id
        ? `[${key}]`
        : `[${key}="${escape(value)}"]`,
    )
    .join('')
  if (values.pseudo !== undefined) {
    if (
      typeof values.pseudo !== 'string' ||
      !/^:(active|checked|disabled|empty|enabled|focus|focus-visible|focus-within|hover|indeterminate|invalid|optional|read-only|read-write|required|valid|visited)$/.test(
        values.pseudo,
      )
    )
      throw new Error('Unsupported marker pseudo.')
    predicate += values.pseudo
  }
  if (values.has !== undefined) {
    if (!['ancestor', 'siblingBefore'].includes(kind))
      throw new Error('has is supported only by ancestor and siblingBefore.')
    if (
      typeof values.has !== 'string' ||
      !values.has.trim() ||
      [
        ...values.has.matchAll(
          /\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\\.|(&)/gs,
        ),
      ].some((match) => match[1])
    )
      throw new Error('has requires a descendant selector without nesting.')
    predicate += `:has(${values.has})`
  }
  if (kind === 'ancestor') return `:where(${predicate}) &`
  if (kind === 'descendant') return `&:where(:has(${predicate}))`
  if (kind === 'siblingBefore') return `:where(${predicate}) ~ &`
  if (kind === 'siblingAfter') return `&:where(:has(~ ${predicate}))`
  return `:is(:where(${predicate}) ~ &, &:where(:has(~ ${predicate})))`
}
