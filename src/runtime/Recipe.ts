/** Selects finite precompiled recipe alternatives without generating rules. @module */
import type { style } from '../styleFunction.js'
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
  /** Class prefix of a recipe that selects choices with classes instead of `data-*` attributes. */
  readonly prefix?: string | undefined
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
 * Names the class of one choice, as the compiler names it for class-selection recipes.
 * @param options - Recipe class prefix, positions, and an optional condition index.
 * @returns The class, whose conditional form appends the condition index.
 */
export function choice(options: choice.Options): string {
  const name = `${options.prefix}-${options.axis}-${options.choice}`
  return options.condition === undefined ? name : `${name}-${options.condition}`
}

/** Choice class identity. */
export declare namespace choice {
  /** Recipe prefix and positions in authored order. */
  type Options = {
    /** Axis position. */
    readonly axis: number
    /** Choice position within the axis. */
    readonly choice: number
    /** Condition index of a conditional selection. */
    readonly condition?: number | undefined
    /** Recipe class prefix. */
    readonly prefix: string
  }
}

/**
 * Binds an unconditional recipe class to selection attributes or choice classes and styling overrides.
 * Type checking and compilation validate authoring; this path only selects data.
 * @param options - Precompiled classes, defaults, axes, and renderer output.
 * @returns A selection callable producing fresh props without retaining inputs.
 */
export function create(options: create.Options) {
  const props = Props.create({ className: options.className })
  // Attribute names, choice classes, and defaults are fixed, so calls only read the selection.
  const axes = Object.keys(options.axes).map((axis, index) => ({
    attribute: `data-${axis}` as const,
    axis,
    classes: options.prefix
      ? new Map(
          options.axes[axis]!.map((name, position) => [
            name,
            ` ${choice({ axis: index, choice: position, prefix: options.prefix! })}`,
          ]),
        )
      : undefined,
    fallback: Object.hasOwn(options.defaults, axis)
      ? options.defaults[axis]
      : undefined,
  }))

  return (input: Record<string, unknown> & style.Options = {}) => {
    const overrides: style.Options = input
    let classes = ''
    // Props are fresh on every call, so selection attributes extend them in place.
    const result = props(overrides) as style.Props &
      Record<`data-${string}`, string>

    for (const entry of axes) {
      const selected = Object.hasOwn(input, entry.axis)
        ? input[entry.axis]
        : undefined
      const value = (selected === undefined ? entry.fallback : selected) as
        | string
        | boolean
        | null
        | undefined
      if (value === null || value === undefined) continue

      if (entry.classes) classes += entry.classes.get(String(value)) ?? ''
      else result[entry.attribute] = String(value)
    }

    // A recipe without rules has no compiled class list, so its first choice class keeps no space.
    if (classes)
      (result as { className: string }).className = Props.merge(
        `${options.className ?? ''}${classes}`.trimStart(),
        overrides.className,
      )

    return options.html ? Html.from(result) : result
  }
}

/** Generated recipe initialization inputs. */
export declare namespace create {
  /** Fixed metadata retained by the compiled callable. */
  type Options = Pick<Definition, 'axes' | 'defaults' | 'prefix'> & {
    /** Complete compiled class list. */
    readonly className: string
    /** Whether to return native HTML attributes. */
    readonly html?: boolean | undefined
  }
}

/**
 * Names the class marking that a condition overrides an axis, with a choice or `null`.
 * @param options - Recipe class prefix, axis position, and condition index.
 * @returns The class that excludes earlier selections of the axis while the condition matches.
 */
export function overridden(options: overridden.Options): string {
  return `${options.prefix}-${options.axis}-s${options.condition}`
}

/** Override class identity. */
export declare namespace overridden {
  /** Recipe prefix, axis position, and condition index. */
  type Options = {
    /** Axis position. */
    readonly axis: number
    /** Condition index in declaration order. */
    readonly condition: number
    /** Recipe class prefix. */
    readonly prefix: string
  }
}
