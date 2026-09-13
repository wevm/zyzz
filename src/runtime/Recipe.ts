/** Selects finite precompiled recipe alternatives without generating rules. @module */
import type { css } from '../css.js'
import * as Html from './Html.js'
import * as Props from './Props.js'

/** Compiler-owned static recipe metadata. */
export type Definition = {
  /** Ordered axis names and their finite choices. */
  readonly axes: Readonly<Record<string, readonly string[]>>
  /** Ordered named conditions; only CSS evaluates their queries. */
  readonly conditions?: readonly string[] | undefined
  /** Normalized default selections. */
  readonly defaults: Readonly<Record<string, string | null>>
}

/**
 * Binds an unconditional recipe class to selection attributes and styling overrides.
 * Type checking and compilation validate authoring; this path only selects data.
 * @param options - Precompiled classes, defaults, axes, and renderer output.
 * @returns A selection callable producing fresh props without retaining inputs.
 */
export function create(options: create.Options) {
  const props = Props.create({ className: options.className })
  const axes = Object.keys(options.axes)

  return (input: Record<string, unknown> & css.Options = {}) => {
    const overrides: css.Options = input
    const result: css.Props & Record<`data-${string}`, string> = {
      ...props(overrides),
    }

    for (const axis of axes) {
      const selected = Object.hasOwn(input, axis) ? input[axis] : undefined
      const value = (
        selected === undefined
          ? Object.hasOwn(options.defaults, axis)
            ? options.defaults[axis]
            : undefined
          : selected
      ) as string | boolean | null | undefined
      if (value !== null && value !== undefined)
        result[`data-${axis}`] = String(value)
    }

    return options.html ? Html.from(result) : result
  }
}

/** Generated recipe initialization inputs. */
export declare namespace create {
  /** Fixed metadata retained by the compiled callable. */
  type Options = Pick<Definition, 'axes' | 'defaults'> & {
    /** Complete compiled class list. */
    readonly className: string
    /** Whether to return native HTML attributes. */
    readonly html?: boolean | undefined
  }
}
