/** Declares statically named animation frames. @module */
import type * as Context from './internal/Context.js'
import { MissingTransformError } from '../css.js'
import type * as Style from '../Style.js'
import type * as Value from '../internal/Value.js'

/** Compiles ordered frame stops and returns a fixed animation name. */
export function keyframes<const frames extends Record<string, unknown>>(
  frames: frames &
    NoInfer<{
      [key in keyof frames]: key extends string
        ? Stops<key> extends true
          ? Value.Accepted<frames[key], Style.DeclarationProperties> &
              Value.Checked<frames[key]>
          : never
        : never
    }>,
  context: Context.Options = {},
): string {
  void context
  void frames
  throw new MissingTransformError()
}

type Trim<value extends string> = value extends
  | ` ${infer rest}`
  | `\n${infer rest}`
  | `\t${infer rest}`
  ? Trim<rest>
  : value extends `${infer rest} ` | `${infer rest}\n` | `${infer rest}\t`
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
        | `${'contain' | 'cover' | 'entry' | 'entry-crossing' | 'exit' | 'exit-crossing'} ${number}%`
    ? true
    : false
