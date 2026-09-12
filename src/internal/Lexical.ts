/** Normalizes CSS token spellings for static contracts and literal precedence. @module */
import type * as Numeric from './Numeric.js'

type Ascii = {
  readonly '30': '0'
  readonly '31': '1'
  readonly '32': '2'
  readonly '33': '3'
  readonly '34': '4'
  readonly '35': '5'
  readonly '36': '6'
  readonly '37': '7'
  readonly '38': '8'
  readonly '39': '9'
  readonly '41': 'A'
  readonly '42': 'B'
  readonly '43': 'C'
  readonly '44': 'D'
  readonly '45': 'E'
  readonly '46': 'F'
  readonly '47': 'G'
  readonly '48': 'H'
  readonly '49': 'I'
  readonly '4a': 'J'
  readonly '4b': 'K'
  readonly '4c': 'L'
  readonly '4d': 'M'
  readonly '4e': 'N'
  readonly '4f': 'O'
  readonly '50': 'P'
  readonly '51': 'Q'
  readonly '52': 'R'
  readonly '53': 'S'
  readonly '54': 'T'
  readonly '55': 'U'
  readonly '56': 'V'
  readonly '57': 'W'
  readonly '58': 'X'
  readonly '59': 'Y'
  readonly '5a': 'Z'
  readonly '61': 'a'
  readonly '62': 'b'
  readonly '63': 'c'
  readonly '64': 'd'
  readonly '65': 'e'
  readonly '66': 'f'
  readonly '67': 'g'
  readonly '68': 'h'
  readonly '69': 'i'
  readonly '6a': 'j'
  readonly '6b': 'k'
  readonly '6c': 'l'
  readonly '6d': 'm'
  readonly '6e': 'n'
  readonly '6f': 'o'
  readonly '70': 'p'
  readonly '71': 'q'
  readonly '72': 'r'
  readonly '73': 's'
  readonly '74': 't'
  readonly '75': 'u'
  readonly '76': 'v'
  readonly '77': 'w'
  readonly '78': 'x'
  readonly '79': 'y'
  readonly '7a': 'z'
  readonly '5f': '_'
  readonly '2d': '-'
}

type Hex =
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
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'

type Space = ' ' | '\t' | '\n' | '\r' | '\f'

type Boundary =
  | Space
  | '('
  | ')'
  | '['
  | ']'
  | '{'
  | '}'
  | ','
  | '/'
  | ':'
  | ';'
  | '!'
  | '"'
  | "'"
  | '%'

type StripZeros<text extends string> = text extends `0${infer rest}`
  ? StripZeros<rest>
  : text

type Code<text extends string> =
  StripZeros<Lowercase<text>> extends keyof Ascii
    ? Ascii[StripZeros<Lowercase<text>>]
    : '�'

type AfterHex<text extends string> = text extends `\r\n${infer rest}`
  ? rest
  : text extends `${Space}${infer rest}`
    ? rest
    : text

type Escape<
  text extends string,
  digits extends string = '',
  count extends readonly unknown[] = [],
> = count['length'] extends 6
  ? readonly [Code<digits>, AfterHex<text>]
  : text extends `${infer first}${infer rest}`
    ? Lowercase<first> extends Hex
      ? Escape<rest, `${digits}${first}`, readonly [...count, 0]>
      : digits extends ''
        ? readonly [first extends Ascii[keyof Ascii] ? first : '�', rest]
        : readonly [Code<digits>, AfterHex<text>]
    : readonly [Code<digits>, '']

type Prefix<text extends string> = [Numeric.Parse<text>] extends [never]
  ? ''
  : Numeric.Parse<text> extends readonly [infer unit extends string, boolean]
    ? unit extends ''
      ? text
      : text extends `${infer prefix}${unit}`
        ? prefix
        : ''
    : ''

// Escapes belong to identifiers, never the numeric part of a dimension token.
type Token<raw extends string, decoded extends string> =
  Prefix<raw> extends Prefix<decoded>
    ? Prefix<decoded> extends Prefix<raw>
      ? decoded
      : '�'
    : '�'

type Scan<
  text extends string,
  output extends string = '',
  raw extends string = '',
  decoded extends string = '',
> = text extends `/*${infer _comment}*/${infer rest}`
  ? Scan<rest, `${output}${Token<raw, decoded>} `>
  : text extends `\\${infer rest}`
    ? Escape<rest> extends readonly [
        infer character extends string,
        infer tail extends string,
      ]
      ? Scan<tail, output, `${raw}\\`, `${decoded}${character}`>
      : never
    : text extends `${infer first}${infer rest}`
      ? first extends Boundary
        ? Scan<rest, `${output}${Token<raw, decoded>}${first}`>
        : Scan<rest, output, `${raw}${first}`, `${decoded}${first}`>
      : `${output}${Token<raw, decoded>}`

/** Leaves ordinary literals untouched; decodes only CSS identifier escapes and comments. */
export type Normalized<text extends string> =
  text extends `${string}${'\\' | '/*'}${string}` ? Scan<text> : text

/** CSS keywords use ASCII case folding, including when Unicode has ASCII lowercase mappings. */
export type Fold<text extends string> =
  text extends `${infer before}K${infer after}`
    ? `${Lowercase<before>}K${Fold<after>}`
    : Lowercase<text>

/** Used only to distinguish literal spellings from theme tokens and importance markers. */
export function normalize(text: string): string {
  return text
    .replace(
      /\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:[\da-f]{1,6}(?:\r\n|[ \t\n\r\f])?|[^\n\r\f])/gi,
      (token) => {
        if (token.startsWith('/*')) return ' '

        const body = token.slice(1)
        const decoded = /^[\da-f]/i.test(body)
          ? String.fromCodePoint(Math.min(Number.parseInt(body, 16), 0x10ffff))
          : body

        return /^[\w-]$/.test(decoded) ? decoded : '�'
      },
    )
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}
