/** Describes static grid placement constraints. @module */
import type * as Numeric from './Numeric.js'

/** Refines numeric line indexes and span counts without parsing custom names or math arguments. */
export type Checked<
  value,
  items extends number = 1,
> = value extends readonly unknown[]
  ? { [key in keyof value]: Checked<value[key], items> }
  : value extends number
    ? Count<value, false>
    : value extends `${infer body}!important` | `${infer body}!`
      ? Checked<Trim<body>, items> extends never
        ? never
        : value
      : value extends string
        ? value extends `${string}(${string}`
          ? value
          : Lines<value, items> extends never
            ? never
            : value
        : value

type Lines<
  text extends string,
  items extends number,
  count extends readonly unknown[] = [0],
> = text extends `${infer before}/${infer after}`
  ? count['length'] extends items
    ? never
    : Checked<before> extends never
      ? never
      : Lines<after, items, readonly [...count, 0]>
  : Words<text, ` ${text} ` extends `${string} span ${string}` ? true : false>

type Words<
  text extends string,
  span extends boolean,
> = text extends `${infer first} ${infer rest}`
  ? Word<first, span> extends never
    ? never
    : Words<rest, span>
  : Word<text, span>
type Word<text extends string, span extends boolean> = [
  Numeric.Parse<text>,
] extends [never]
  ? text extends `${number}`
    ? never
    : text
  : Count<text, span>
type Count<value extends string | number, span extends boolean> =
  Numeric.Checked<value, true> extends never
    ? never
    : Numeric.Zero<value> extends true
      ? never
      : span extends true
        ? `${value}` extends `-${string}`
          ? never
          : value
        : value

type Trim<value extends string> =
  value extends `${infer body}${' ' | '\n' | '\r' | '\t' | '\f'}`
    ? Trim<body>
    : value
