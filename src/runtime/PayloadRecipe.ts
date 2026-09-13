/** Binds scoped recipe payloads to precompiled per-condition variable slots. @module */
import type { css } from '../css.js'
import * as Html from './Html.js'
import type * as Recipe from './Recipe.js'

/** Creates a serializer over an already compiled recipe selection function. */
export function create(options: create.Options) {
  const axes = Object.keys(options.axes)
  const catalog = new Map(
    axes.map((axis) => [
      axis,
      new Map(
        options.payloads
          .filter((payload) => payload.axis === axis)
          .map((payload) => [payload.choice, payload.slots]),
      ),
    ]),
  )

  return (input: Record<string, unknown> & css.Options = {}) => {
    const bindings: Record<string, string | number> = {}
    const normalized: Record<string, unknown> = { ...input }

    function select(value: unknown, axis: string, context: number) {
      if (value === null || typeof value !== 'object') return value

      const choice = Object.keys(value)[0]!
      const values = (value as Record<string, Record<string, string | number>>)[
        choice
      ]!
      const slots = catalog.get(axis)!.get(choice)![context]!
      for (const [field, name] of Object.entries(slots)) {
        const value = values[field]!
        bindings[name] = value === '' ? ' ' : value
      }

      return choice
    }

    for (const axis of axes) {
      const value = Object.hasOwn(input, axis) ? input[axis] : undefined
      const fallback =
        options.defaultPayloads && Object.hasOwn(options.defaultPayloads, axis)
          ? options.defaultPayloads[axis]
          : undefined
      normalized[axis] = select(
        value === undefined && fallback
          ? { [options.defaults[axis]!]: fallback }
          : value,
        axis,
        0,
      )
    }

    const conditions = input.conditions as
      | Record<string, Record<string, unknown> | undefined>
      | undefined
    if (conditions) {
      const selections: Record<string, Record<string, unknown>> = Object.create(
        null,
      )
      for (const [index, name] of (options.conditions ?? []).entries()) {
        const values = Object.hasOwn(conditions, name)
          ? conditions[name]
          : undefined
        if (!values) continue

        const selected: Record<string, unknown> = {}
        for (const axis of axes)
          if (Object.hasOwn(values, axis))
            selected[axis] = select(values[axis], axis, index + 1)
        selections[name] = selected
      }
      normalized.conditions = selections
    }

    const props = options.select(normalized) as css.Props
    const result = Object.keys(bindings).length
      ? { ...props, style: { ...props.style, ...bindings } }
      : props
    return options.html ? Html.from(result) : result
  }
}

/** Fixed payload serializer inputs. */
export declare namespace create {
  /** Validated compiler metadata and a selection-only delegate. */
  type Options = Recipe.Definition & {
    /** Final output uses native HTML attributes when enabled. */
    readonly html?: boolean | undefined
    /** Dynamic choices present in this recipe. */
    readonly payloads: readonly Recipe.Payload[]
    /** Precompiled selector returning React-shaped props. */
    readonly select: ReturnType<typeof Recipe.create>
  }
}
