/** Defines typed marker authoring and lowers marker predicates to scoped CSS selectors. @module */
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
declare const conditionKey: unique symbol
/** Opaque compiler condition key; cannot introduce an arbitrary property index. */
export type Key = symbol & { readonly [conditionKey]: true }
/** Marker callable with no styling fields. */
export type Handle<schema extends Marker.Schema> = {
  <const input extends State<schema> = State<schema>>(
    input?: input & Record<Exclude<keyof input, keyof schema>, never>,
  ): Readonly<Record<`data-${string}`, string>>
  /** Compile-time invariant retaining the schema for relationship inference. */
  readonly [stateSchema]?: schema
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
> = condition extends string
  ? condition
  : condition &
      Record<Exclude<keyof condition, 'data' | 'has' | 'pseudo'>, never> &
      (condition extends { data: infer data }
        ? {
            readonly data: data &
              Record<Exclude<keyof data, keyof schema>, never>
          }
        : {})
/** Requires finite, unambiguous state domains. */
export type Validated<schema extends Marker.Schema> = {
  [key in keyof schema]: Lowercase<key & string> extends
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
}
type Unique<
  values extends readonly (boolean | string)[],
  seen extends string = never,
> = values extends readonly [
  infer first extends boolean | string,
  ...infer rest extends readonly (boolean | string)[],
]
  ? `${first}` extends seen
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
    Object.keys(values).some((key) => !['data', 'has', 'pseudo'].includes(key))
  )
    throw new Error('Unknown relationship condition option.')
  const attrs = Marker.create(marker)(
    (values.data ?? {}) as State<Marker.Schema>,
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
    if (
      typeof values.has !== 'string' ||
      !values.has.trim() ||
      values.has.includes('&')
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
