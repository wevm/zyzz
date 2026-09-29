/** Declares statically named animation frames. @module */
import type * as Context from './internal/Context.js'
import type * as Lexical from '../internal/Lexical.js'
import * as Identity from '../internal/Identity.js'
import type * as Style from '../Style.js'
import type * as Value from '../internal/Value.js'

/** Compiles ordered frame stops and returns a fixed animation name. */
export function keyframes<const frames extends Record<string, unknown>>(
  frames: frames & NoInfer<Accepted<frames>>,
  context: Context.Options = {},
): string {
  void context
  void frames
  return Identity.contribution('keyframes', context.id)
}

type Space = ' ' | '\t' | '\n' | '\r' | '\f'
type Trim<value extends string> = value extends `${Space}${infer rest}`
  ? Trim<rest>
  : value extends `${infer rest}${Space}`
    ? Trim<rest>
    : value

type Stops<value extends string> = value extends `${infer first},${infer rest}`
  ? Stops<first> extends true
    ? Stops<rest>
    : false
  : Trim<value> extends
        | 'from'
        | 'to'
        | `${number}%`
        | `${'contain' | 'cover' | 'entry' | 'entry-crossing' | 'exit' | 'exit-crossing'}${Space}${number}%`
    ? true
    : false

type Accepted<input> = {
  [key in keyof input as key extends Context.Group ? key : never]: Accepted<
    input[key]
  >
} & (keyof input extends never
  ? Definition<input>
  : Exclude<keyof input, Context.Group> extends never
    ? unknown
    : Definition<Omit<input, Context.Group>>)

type Definition<frames> =
  frames extends Record<string, unknown>
    ? frames &
        NoInfer<{
          [key in keyof frames]: key extends string
            ? Stops<Lexical.Fold<Lexical.Normalized<key>>> extends true
              ? Value.Accepted<frames[key], Style.DeclarationProperties> &
                  Value.Checked<frames[key]>
              : never
            : never
        }>
    : never
