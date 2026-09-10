/** Declares statically named animation frames. @module */
import { MissingTransformError } from '../css.js'
import type * as Style from '../Style.js'
import type * as Value from '../internal/Value.js'

/** Compiles ordered frame stops and returns a fixed animation name. */
export function keyframes<const frames extends Record<string, unknown>>(
  frames: frames &
    NoInfer<{
      [key in keyof frames]: key extends
        | 'from'
        | 'to'
        | `${number}%`
        | `${string},${string}`
        ? Value.Accepted<frames[key], Style.DeclarationProperties> &
            Value.Checked<frames[key]>
        : never
    }>,
): string {
  void frames
  throw new MissingTransformError()
}
