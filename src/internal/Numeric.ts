/** Refines CSS numeric token spellings entirely within TypeScript. @module */
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type Digits<
  text extends string,
  prefix extends string = '',
> = text extends `${infer first}${infer rest}`
  ? first extends Digit
    ? Digits<rest, `${prefix}${first}`>
    : readonly [prefix, text]
  : readonly [prefix, '']
type Exponent<
  text extends string,
  integer extends boolean,
> = text extends `${'e' | 'E'}${infer rest}`
  ? Digits<Sign<rest>> extends readonly [
      infer digits extends string,
      infer unit extends string,
    ]
    ? digits extends ''
      ? readonly [text, integer]
      : readonly [unit, false]
    : never
  : readonly [text, integer]

type Sign<text extends string> = text extends `${'+' | '-'}${infer rest}`
  ? rest
  : text

type Zeros<text extends string> = text extends ''
  ? true
  : text extends `${'0' | '.'}${infer rest}`
    ? Zeros<rest>
    : false

/** Checks a complete CSS number or integer token without allowing JavaScript radix syntax. */
export type Checked<
  value extends string | number,
  integer extends boolean = false,
> = `${number}` extends `${value}`
  ? value
  : [Parse<`${value}`>] extends [never]
    ? never
    : Parse<`${value}`> extends readonly ['', infer whole extends boolean]
      ? integer extends true
        ? whole extends true
          ? value
          : never
        : value
      : never

/** Returns the unconsumed unit and whether the number has integer token syntax. */
export type Parse<text extends string> =
  Digits<Sign<text>> extends readonly [
    infer digits extends string,
    infer rest extends string,
  ]
    ? rest extends `.${infer fraction}`
      ? Digits<fraction> extends readonly [
          infer decimal extends string,
          infer unit extends string,
        ]
        ? decimal extends ''
          ? never
          : Exponent<unit, false>
        : never
      : digits extends ''
        ? never
        : Exponent<rest, true>
    : never

/** Identifies signed zero mantissas for nonnegative and positive range constraints. */
export type Zero<value extends string | number> =
  Sign<`${value}`> extends `${infer mantissa}${'e' | 'E'}${string}`
    ? Zeros<mantissa>
    : Zeros<Sign<`${value}`>>
