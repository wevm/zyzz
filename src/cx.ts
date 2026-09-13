/** Declares ordered props composition for ahead-of-time resolution. @module */
import type { css } from './css.js'
import { MissingTransformError } from './css.js'

/**
 * Combines applied styles in argument order, preserving CSS importance and conditions.
 * Static local applications compile to one props object without a runtime resolver.
 * @param entries - Applied styling props or omitted conditional entries.
 * @returns One spreadable props object.
 * @throws {MissingTransformError} When composition has not been compiled.
 */
export function cx<
  const entries extends readonly (
    | css.Props<css.Output>
    | false
    | null
    | undefined
  )[],
>(
  ...entries: entries & {
    readonly [index in keyof entries]: entries[index] extends object
      ? Record<
          Exclude<
            keyof entries[index],
            'class' | 'className' | 'style' | `data-${string}`
          >,
          never
        >
      : unknown
  }
): Extract<entries[number], { class: string }> extends never
  ? css.Props
  : css.Props<'html'> {
  void entries
  throw new MissingTransformError()
}
