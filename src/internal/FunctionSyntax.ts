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

type AsciiOther =
  | ' '
  | '\t'
  | '\n'
  | '\r'
  | '\f'
  | '!'
  | '"'
  | '#'
  | '$'
  | '%'
  | '&'
  | "'"
  | '('
  | ')'
  | '*'
  | '+'
  | ','
  | '.'
  | '/'
  | ':'
  | ';'
  | '<'
  | '='
  | '>'
  | '?'
  | '@'
  | '['
  | '\\'
  | ']'
  | '^'
  | '`'
  | '{'
  | '|'
  | '}'
  | '~'
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
      : first extends AsciiOther
        ? false
        : Tail<rest>
    : false
type Identifier<value extends string> = value extends `--${infer rest}`
  ? Tail<rest>
  : value extends `-${infer rest}`
    ? Identifier<rest>
    : value extends `${infer first}${infer rest}`
      ? Lowercase<first> extends Letter | '_'
        ? Tail<rest>
        : first extends AsciiOther | `${number}`
          ? false
          : Tail<rest>
      : false
type Atom<value extends string> = value extends `${string}\\${string}`
  ? true
  : value extends Primitive
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

  const escape = String.raw`\\(?:[0-9a-fA-F]{1,6}[ \t\n\r\f]?|[^\n\r\f0-9a-fA-F])`
  const start = `(?:[_a-zA-Z\\u0080-\\uFFFF]|${escape})`
  const tail = `(?:[-_a-zA-Z0-9\\u0080-\\uFFFF]|${escape})*`
  const component = new RegExp(
    `(?:<[-a-z]+>|(?:--|-${start}|${start})${tail})([+#])?`,
    'y',
  )
  let index = 0
  while (index < body.length) {
    while (/[ \t\n\r\f]/.test(body[index] ?? '') && index < body.length) index++
    component.lastIndex = index
    const match = component.exec(body)
    if (!match) return false
    const atom = match[0].slice(0, match[0].length - (match[1]?.length ?? 0))
    if (atom.startsWith('<')) {
      if (
        !(primitives as readonly string[]).includes(atom) ||
        (atom === '<transform-list>' && match[1])
      )
        return false
    } else {
      const decoded = atom.replace(
        /\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([^\n\r\f])/g,
        (_, hex: string | undefined, literal: string | undefined) => {
          const point = hex ? Number.parseInt(hex, 16) : 0
          return hex
            ? String.fromCodePoint(
                point === 0 ||
                  point > 0x10ffff ||
                  (point >= 0xd800 && point <= 0xdfff)
                  ? 0xfffd
                  : point,
              )
            : literal!
        },
      )
      if (
        [
          'default',
          'inherit',
          'initial',
          'revert',
          'revert-layer',
          'unset',
        ].includes(decoded.replace(/[A-Z]/g, (c) => c.toLowerCase()))
      )
        return false
    }
    index = component.lastIndex
    while (index < body.length && /[ \t\n\r\f]/.test(body[index]!)) index++
    if (index === body.length) return true
    if (!wrapped || body[index++] !== '|') return false
    if (index === body.length) return false
  }
  return false
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
    : syntax extends `${infer base}+` | `${infer base}#`
      ? NumericKind<base>
      : syntax extends '<number>'
        ? 'number'
        : syntax extends '<integer>'
          ? 'integer'
          : never

/** Finds the integer-only scalar domain in a checked function signature. */
export function integerOnly(syntax: string): boolean {
  const value = syntax.trim()
  const body = value.startsWith('type(') ? value.slice(5, -1) : value
  const alternatives = body
    .split('|')
    .map((value) => value.trim().replace(/[+#]$/, ''))

  return (
    alternatives.includes('<integer>') && !alternatives.includes('<number>')
  )
}
