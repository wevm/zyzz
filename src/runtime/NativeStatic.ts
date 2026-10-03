/** Selects finite native variants from precompiled fragments. @module */
import * as Native from './Native.js'
import type * as StyleSheet from '../react-native/StyleSheet.js'

/**
 * Binds finite selection data without including dynamic value converters.
 * @param options - Compiler-owned axes, defaults, ordered rules, and native fragments.
 * @returns A callable preserving finite choices and caller-owned native overrides.
 * @throws {Native.SelectionError} For invalid selections, missing fragments, or invalid line heights.
 */
export function create<
  const axes extends Readonly<Record<string, readonly string[]>>,
>(options: create.Options<axes>): Native.Callable<axes> {
  const axes = Object.entries(options.axes)
  const rules = options.rules.map((rule) => ({
    matches: rule.matches.map(([name, choices]) => {
      const axis = axes.findIndex(([key]) => key === name)
      return [
        axis,
        choices.map((choice) => axes[axis]![1].indexOf(choice)),
      ] as const
    }),
    steps: rule.steps.map((step) => {
      if (typeof step === 'number') return step
      const style = options.styles[step]
      if (!style)
        throw new Native.SelectionError(
          'Native binding program is missing a static style.',
        )
      freeze(style)
      return style
    }),
  }))
  const cache = new Map<string, StyleSheet.NativeStyle>()

  return (input = {}) => {
    for (const key of Object.keys(input))
      if (key !== 'style' && !Object.hasOwn(options.axes, key))
        throw new Native.SelectionError(`Unknown native recipe input: ${key}.`)
    const selected: number[] = []
    let key = ''
    const values: Readonly<Record<string, unknown>> = input
    for (const [axis, choices] of axes) {
      const supplied = Object.hasOwn(values, axis) ? values[axis] : undefined
      const value =
        supplied === undefined
          ? Object.hasOwn(options.defaults, axis)
            ? options.defaults[axis]
            : undefined
          : supplied
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const entries = Object.keys(value)
        if (entries.length !== 1)
          throw new Native.SelectionError(
            'Native payloads require exactly one choice.',
          )
        if (choices.includes(entries[0]!))
          throw new Native.SelectionError(
            `Static native choice does not accept a payload: ${axis}.`,
          )
      }
      const choice =
        value == null
          ? choices.length
          : typeof value === 'string' || typeof value === 'boolean'
            ? choices.indexOf(String(value))
            : -1
      if (choice < 0)
        throw new Native.SelectionError(
          `Unknown native recipe choice for ${axis}.`,
        )
      selected.push(choice)
      key += `${choice},`
    }
    let style = cache.get(key)
    if (!style) {
      const output: Record<string, unknown> = {}
      let lineHeight: number | undefined
      for (const rule of rules) {
        if (
          !rule.matches.every(([axis, choices]) =>
            choices.includes(selected[axis]!),
          )
        )
          continue
        for (const step of rule.steps) {
          if (typeof step === 'number') lineHeight = step
          else {
            Object.assign(output, step)
            if (step.lineHeight !== undefined) lineHeight = undefined
          }
        }
      }
      if (lineHeight !== undefined) {
        if (
          !Number.isFinite(lineHeight) ||
          lineHeight < 0 ||
          typeof output.fontSize !== 'number'
        )
          throw new Native.SelectionError(
            'Numeric lineHeight requires an explicit fontSize and a nonnegative finite multiplier.',
          )
        output.lineHeight = lineHeight * output.fontSize
        if (!Number.isFinite(output.lineHeight))
          throw new Native.SelectionError(
            'Converted lineHeight must be finite.',
          )
      }
      style = Object.freeze(output) as StyleSheet.NativeStyle
      // Retain a bounded working set even for recipes with many independent axes.
      if (cache.size >= 256) cache.delete(cache.keys().next().value!)
      cache.set(key, style)
    }
    return { style: input.style ? [style, input.style] : style }
  }
}

/** Compiler-owned finite metadata and converted native fragments. */
export declare namespace create {
  /** Numeric steps are line-height multipliers resolved against the final font size. */
  type Options<
    axes extends Readonly<Record<string, readonly string[]>> = Readonly<
      Record<string, readonly string[]>
    >,
  > = Native.create.Options<axes> & {
    /** Ordered rules containing static fragment names and line-height multipliers. */
    readonly rules: readonly {
      /** Axis names and allowed choices, all of which must match. */
      readonly matches: readonly (readonly [string, readonly string[]])[]
      /** Fragment names or line-height multipliers applied in order. */
      readonly steps: readonly (string | number)[]
    }[]
  }
}

function freeze(value: object): void {
  if (Object.isFrozen(value)) return
  for (const child of Object.values(value))
    if (child && typeof child === 'object') freeze(child)
  Object.freeze(value)
}
