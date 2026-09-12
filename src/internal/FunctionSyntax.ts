/** Models CSS function syntax components and composite alternatives. @module */

/** Value types in the CSS Properties and Values syntax-definition grammar. */
export const primitives = [
  '<angle>',
  '<color>',
  '<custom-ident>',
  '<image>',
  '<integer>',
  '<length>',
  '<length-percentage>',
  '<number>',
  '<percentage>',
  '<resolution>',
  '<string>',
  '<time>',
  '<transform-function>',
  '<transform-list>',
  '<url>',
] as const

/** One primitive syntax component. */
export type Primitive = (typeof primitives)[number]

/** Removes CSS whitespace around signature components. */
export type Trim<value extends string> =
  value extends `${' ' | '\t' | '\n' | '\r' | '\f'}${infer rest}`
    ? Trim<rest>
    : value extends `${infer rest}${' ' | '\t' | '\n' | '\r' | '\f'}`
      ? Trim<rest>
      : value

/** Removes the type() wrapper without changing authored alternatives. */
export type Unwrap<value extends string> =
  Trim<value> extends `type(${infer body})` ? Trim<body> : Trim<value>

/** Rejects unsupported syntax-definition structure at the authoring boundary. */
export type Checked<value extends string> = string extends value
  ? never
  : Trim<value> extends '*'
    ? value
    : Trim<value> extends `type(${infer body})`
      ? Trim<body> extends '*'
        ? value
        : Valid<Trim<body>> extends true
          ? value
          : never
      : Component<Trim<value>> extends true
        ? value
        : never

type Valid<value extends string> = value extends `${infer first}|${infer rest}`
  ? Component<Trim<first>> extends true
    ? Valid<Trim<rest>>
    : false
  : Component<value>

type Component<value extends string> = value extends `${infer base}${'+' | '#'}`
  ? base extends '<transform-list>'
    ? false
    : Atom<base>
  : Atom<value>

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
type Tail<value extends string> = value extends ''
  ? true
  : value extends `${infer first}${infer rest}`
    ? Lowercase<first> extends
        | Letter
        | '_'
        | '-'
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
      ? Tail<rest>
      : false
    : false
type Identifier<value extends string> = value extends `--${infer rest}`
  ? Tail<rest>
  : value extends `-${infer rest}`
    ? Identifier<rest>
    : value extends `${infer first}${infer rest}`
      ? Lowercase<first> extends Letter | '_'
        ? Tail<rest>
        : false
      : false
type Atom<value extends string> = value extends Primitive
  ? true
  : Lowercase<value> extends
        | 'default'
        | 'inherit'
        | 'initial'
        | 'revert'
        | 'revert-layer'
        | 'unset'
    ? false
    : Identifier<value>

/** Checks a source-extracted signature without executing application code. */
export function accepts(value: string): boolean {
  const text = value.trim()
  if (text === '*') return true

  const wrapped = text.startsWith('type(') && text.endsWith(')')
  const body = wrapped ? text.slice(5, -1).trim() : text
  if (wrapped && body === '*') return true
  if (!wrapped && body.includes('|')) return false

  return body.split('|').every((part) => {
    const component = part.trim()
    const repeated = /[+#]$/.test(component)
    const atom = repeated ? component.slice(0, -1) : component
    if (atom === '<transform-list>' && repeated) return false
    if ((primitives as readonly string[]).includes(atom.toLowerCase()))
      return true

    return (
      /^(?:--|-?[_a-zA-Z])[\w-]*$/.test(atom) &&
      ![
        'default',
        'inherit',
        'initial',
        'revert',
        'revert-layer',
        'unset',
      ].includes(atom.toLowerCase())
    )
  })
}

/** Whether numeric arguments are restricted to integer tokens by every alternative. */
export type IntegerOnly<syntax extends string> =
  'number' extends NumericKind<Unwrap<syntax>>
    ? false
    : 'integer' extends NumericKind<Unwrap<syntax>>
      ? true
      : false

type NumericKind<syntax extends string> =
  syntax extends `${infer first}|${infer rest}`
    ? NumericKind<Trim<first>> | NumericKind<Trim<rest>>
    : syntax extends '<number>'
      ? 'number'
      : syntax extends '<integer>'
        ? 'integer'
        : never

/** Finds the integer-only scalar domain in a checked function signature. */
export function integerOnly(syntax: string): boolean {
  const value = syntax.trim()
  const body = value.startsWith('type(') ? value.slice(5, -1) : value
  const alternatives = body.split('|').map((value) => value.trim())

  return (
    alternatives.includes('<integer>') && !alternatives.includes('<number>')
  )
}
