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
  /** Complete scalar defaults for selected dynamic choices. */
  readonly defaultPayloads?:
    | { readonly [axis: string]: { readonly [field: string]: string | number } }
    | undefined
  /** Dynamic choices and separate base/conditional input slots. */
  readonly payloads?: readonly Payload[] | undefined
}

/** Fixed input bindings for one dynamic choice. */
export type Payload = {
  /** Owning selection axis. */
  readonly axis: string
  /** Choice name used for selectors and compound matching. */
  readonly choice: string
  /** Base slots followed by slots for each condition in declaration order. */
  readonly slots: readonly { readonly [field: string]: `--${string}` }[]
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
      const supplied = Object.hasOwn(input, axis) ? input[axis] : undefined
      const value = (
        supplied === undefined
          ? Object.hasOwn(options.defaults, axis)
            ? options.defaults[axis]
            : undefined
          : supplied
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
