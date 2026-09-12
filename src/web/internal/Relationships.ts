/** Defines typed marker authoring and composes ref interpolations into scoped CSS selectors. @module */
import * as Conditions from '../../internal/Condition.js'
import * as Marker from '../../runtime/Marker.js'

/** Marker state selection, inferred only from its declared schema. */
export type State<schema extends Marker.Schema> = {
  readonly [key in keyof schema]?: schema[key][number] | undefined
}

declare const stateSchema: unique symbol
declare const applied: unique symbol

/** Opaque compiler condition key; cannot introduce an arbitrary property index. */
export type Key = Conditions.Relationship

/** Attributes produced by applying a ref; the brand admits them as `where` interpolations. */
export type Applied = Readonly<Record<`data-${string}`, string>> & {
  readonly [applied]: true
}

/** Marker callable with no styling fields. */
export type Handle<schema extends Marker.Schema> = {
  <const input extends State<schema> = State<schema>>(
    input?: input & Record<Exclude<keyof input, keyof schema>, never>,
  ): Applied
  /** Compile-time invariant retaining the schema for relationship inference. */
  readonly [stateSchema]: schema
}

/** A ref for presence, or its application for presence plus declared states. */
export type Interpolation = { readonly [stateSchema]: Marker.Schema } | Applied

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

type Union<value, whole = value> = value extends whole
  ? [whole] extends [value]
    ? false
    : true
  : never

type Unique<
  values extends readonly (boolean | string)[],
  seen extends string = never,
> = values extends readonly [
  infer first extends boolean | string,
  ...infer rest extends readonly (boolean | string)[],
]
  ? string extends first
    ? never
    : true extends Union<first>
      ? never
      : `${first}` extends
            | `${string}\0${string}`
            | `${string}\r${string}`
            | seen
        ? never
        : Unique<rest, seen | `${first}`>
  : unknown

/** Resolved ref interpolation awaiting selector composition. */
export type Part = {
  readonly marker: Marker.Definition
  readonly state: unknown
}

/** Joins template text with ref attribute compounds and wraps each ref compound in `:where()`. */
export function compose(
  quasis: readonly string[],
  parts: readonly Part[],
): string {
  if (quasis.length !== parts.length + 1)
    throw new Error('where templates require text around every interpolation.')
  if (!parts.length)
    throw new Error('where selectors require at least one ref interpolation.')

  let text = ''
  const ranges: (readonly [number, number])[] = []

  quasis.forEach((quasi, index) => {
    text += quasi

    const part = parts[index]
    if (!part) return

    const start = text.length
    text += attributes(part)
    ranges.push([start, text.length])
  })

  if (!Conditions.nested(text) && !text.startsWith(':'))
    throw new Error('where selectors require & for the styled element.')

  const { depth, skip } = scan(text)
  const isBreak = (index: number) =>
    !skip[index] && /[\s>~+,]/.test(text[index]!)
  const compounds = new Map<number, number>()

  for (const [start, end] of ranges) {
    const level = depth[start]!
    let from = start
    let to = end

    while (from > 0) {
      const index = from - 1
      if (!skip[index]) {
        if (depth[index]! < level) break
        if (depth[index] === level && isBreak(index)) break
      }
      from = index
    }

    while (to < text.length) {
      if (!skip[to]) {
        if (depth[to]! < level) break
        if (depth[to] === level && isBreak(to)) break
      }
      to++
    }

    compounds.set(from, Math.max(compounds.get(from) ?? 0, to))
  }

  const nesting = (from: number, to: number) => {
    for (let index = from; index < to; index++)
      if (!skip[index] && text[index] === '&') return true

    return false
  }

  // Compounds nest through functional pseudo-classes, so render recursively.
  function render(from: number, to: number, drop: boolean): string {
    let output = ''
    let index = from

    while (index < to) {
      const end = compounds.get(index)

      if (
        end !== undefined &&
        end <= to &&
        !(drop && index === from && end === to)
      ) {
        output += `${nesting(index, end) ? '&' : ''}:where(${render(index, end, true)})`
        index = end
        continue
      }

      if (!(drop && !skip[index] && text[index] === '&')) output += text[index]
      index++
    }

    return output
  }

  return render(0, text.length, false)
}

/** Lowers one ref interpolation to its presence and state attribute selectors. */
function attributes(part: Part): string {
  const attrs = Marker.create(part.marker)(part.state as State<Marker.Schema>)

  const escape = (value: string) =>
    Array.from(value)
      .map((char) =>
        char === '\0'
          ? '�'
          : /["\\\n\r\f]/.test(char)
            ? `\\${char.codePointAt(0)!.toString(16)} `
            : char,
      )
      .join('')

  return Object.entries(attrs)
    .map(([key, value]) =>
      value === '' && key === part.marker.id
        ? `[${key}]`
        : `[${key}="${escape(value)}"]`,
    )
    .join('')
}

/** Records parenthesis depth per character and marks quoted, bracketed, and comment text. */
function scan(text: string) {
  const depth: number[] = []
  const skip: boolean[] = []
  let level = 0
  let quote = ''
  let bracket = false
  let comment = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!

    if (comment) {
      depth[index] = level
      skip[index] = true
      if (char === '*' && text[index + 1] === '/') {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
        comment = false
      }
      continue
    }

    if (quote) {
      depth[index] = level
      skip[index] = true
      if (char === '\\' && index + 1 < text.length) {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
      } else if (char === quote) quote = ''
      continue
    }

    if (bracket) {
      depth[index] = level
      skip[index] = true
      if (char === '"' || char === "'") quote = char
      else if (char === ']') bracket = false
      continue
    }

    if (char === '/' && text[index + 1] === '*') {
      comment = true
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '[') {
      bracket = true
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '(') {
      depth[index] = level
      skip[index] = false
      level++
      continue
    }

    if (char === ')') {
      level = Math.max(0, level - 1)
      depth[index] = level
      skip[index] = false
      continue
    }

    depth[index] = level
    skip[index] = false
  }

  return { depth, skip }
}
