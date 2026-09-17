/** Applies compiled native binding instructions to runtime scalar payloads. @module */
import * as Scalar from '../react-native/internal/Scalar.js'
import type * as StyleSheet from '../react-native/StyleSheet.js'
import * as Native from './Native.js'
import type * as Recipe from './Recipe.js'

/** A generated callable with required application payloads and native overrides. */
export type Callable<input> = (
  input: input & {
    /** Caller-owned overrides applied after generated values. */
    readonly style?: StyleSheet.StyleProp<StyleSheet.NativeStyle> | undefined
  },
) => Native.Props

/** A native variant callable whose omitted input applies declared defaults. */
export type RecipeCallable<input> = (
  input?: input & {
    /** Caller-owned overrides applied after selected variant values. */
    readonly style?: StyleSheet.StyleProp<StyleSheet.NativeStyle> | undefined
  },
) => Native.Props

/** Adapts a published web callable's payload to native styling overrides. */
export type From<fn> = fn extends (...args: infer args) => unknown
  ? [] extends args
    ? RecipeCallable<
        Omit<NonNullable<args[0]>, 'style' | 'className' | 'variables'>
      >
    : Callable<Omit<NonNullable<args[0]>, 'style' | 'className' | 'variables'>>
  : never

/** Ordered static and dynamic assignments selected by finite recipe choices. */
export type Program = {
  /** Required top-level input fields mapped to internal slot names. */
  readonly slots: Readonly<Record<string, string>>
  /** Base, variant, and compound rules in authored order. */
  readonly rules: readonly {
    readonly matches: readonly (readonly [string, readonly string[]])[]
    readonly steps: readonly (
      | { readonly style: string }
      | {
          readonly property: keyof typeof Scalar.properties
          readonly parts: readonly (
            | string
            | number
            | { readonly slot: string }
          )[]
        }
    )[]
  }[]
}

/** Binds generated instructions without running authoring callbacks or generating CSS. */
export function create(
  options: create.Options,
): Callable<Record<string, unknown>> {
  function freeze(value: object): void {
    if (Object.isFrozen(value)) return
    for (const child of Object.values(value))
      if (child && typeof child === 'object') freeze(child)
    Object.freeze(value)
  }
  for (const style of Object.values(options.styles)) freeze(style)

  return (input = {}) => {
    const bindings: Record<string, string | number> = Object.create(null)
    const selected: Record<string, string | null | undefined> =
      Object.create(null)
    for (const key of Object.keys(input))
      if (
        key !== 'style' &&
        !Object.hasOwn(options.axes, key) &&
        !Object.hasOwn(options.program.slots, key)
      )
        throw new Native.SelectionError(`Unknown native recipe input: ${key}.`)

    function bind(slots: Readonly<Record<string, string>>, values: unknown) {
      if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new Native.SelectionError(
          'Native payloads require scalar fields.',
        )
      const record = values as Record<string, unknown>
      for (const [field, slot] of Object.entries(slots)) {
        const value = Object.hasOwn(record, field) ? record[field] : undefined
        if (
          (typeof value !== 'number' && typeof value !== 'string') ||
          (typeof value === 'number' && !Number.isFinite(value))
        )
          throw new Native.SelectionError(
            `Missing or invalid native payload: ${field}.`,
          )
        bindings[slot] = value
      }
    }
    bind(options.program.slots, input)
    for (const [axis, choices] of Object.entries(options.axes)) {
      let value = Object.hasOwn(input, axis) ? input[axis] : undefined
      if (value === undefined) {
        value = options.defaults[axis]
        if (value != null && Object.hasOwn(options.defaultPayloads ?? {}, axis))
          value = { [String(value)]: options.defaultPayloads![axis] }
      }
      if (value == null) {
        selected[axis] = value
        continue
      }
      let payload: unknown
      if (typeof value === 'object' && !Array.isArray(value)) {
        const entries = Object.entries(value)
        if (entries.length !== 1)
          throw new Native.SelectionError(
            'Native payloads require exactly one choice.',
          )
        ;[value, payload] = entries[0]!
      }
      if (
        (typeof value !== 'string' && typeof value !== 'boolean') ||
        !choices.includes(String(value))
      )
        throw new Native.SelectionError(
          `Unknown native recipe choice for ${axis}.`,
        )
      const choice = String(value)
      selected[axis] = choice
      const definition = options.payloads?.find(
        (entry) => entry.axis === axis && entry.choice === choice,
      )
      if (definition) bind(definition.slots[0]!, payload)
      else if (payload !== undefined)
        throw new Native.SelectionError(
          `Static native choice does not accept a payload: ${axis}.`,
        )
    }

    const output: Record<string, unknown> = {}
    let lineHeight: string | number | undefined
    for (const rule of options.program.rules) {
      if (
        !rule.matches.every(
          ([axis, choices]) =>
            selected[axis] != null && choices.includes(selected[axis]!),
        )
      )
        continue
      for (const step of rule.steps) {
        if ('style' in step) {
          const style = options.styles[step.style]
          if (!style)
            throw new Native.SelectionError(
              'Native binding program is missing a static style.',
            )
          Object.assign(output, style)
          if (style.lineHeight !== undefined) lineHeight = undefined
          continue
        }
        const values = step.parts.map((part) =>
          typeof part === 'object' ? bindings[part.slot] : part,
        )
        if (values.some((value) => value === undefined))
          throw new Native.SelectionError(
            'Native binding program references an unbound slot.',
          )
        const value = values.length === 1 ? values[0]! : values.join('')
        const { property } = step
        if (property === 'lineHeight') {
          lineHeight = value
          continue
        }
        const converted = Scalar.convert(
          Scalar.properties[property],
          value,
          options,
          [property],
        )
        if (property === 'padding' || property === 'margin') {
          const parts =
            typeof value === 'string' ? value.trim().split(/\s+/) : [value]
          const [top, right = top, bottom = top, left = right] = parts.map(
            (part) =>
              Scalar.length(part, options, property === 'margin', [property]),
          )
          Object.assign(output, {
            [`${property}Top`]: top,
            [`${property}Right`]: right,
            [`${property}Bottom`]: bottom,
            [`${property}Left`]: left,
          })
        } else if (property === 'borderColor' || property === 'borderWidth') {
          for (const side of ['Top', 'Right', 'Bottom', 'Left'])
            output[
              `border${side}${property === 'borderColor' ? 'Color' : 'Width'}`
            ] = converted
        } else if (property === 'borderRadius') {
          for (const corner of [
            'TopLeft',
            'TopRight',
            'BottomRight',
            'BottomLeft',
          ])
            output[`border${corner}Radius`] = converted
        } else if (property === 'gap') {
          output.columnGap = converted
          output.rowGap = converted
        } else output[property] = converted
      }
    }
    if (lineHeight !== undefined) {
      if (typeof lineHeight === 'number') {
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
      } else
        output.lineHeight = Scalar.length(lineHeight, options, false, [
          'lineHeight',
        ])
    }
    const style = output as StyleSheet.NativeStyle
    return { style: input.style ? [style, input.style] : style }
  }
}

/** Compiler-owned metadata consumed by native dynamic application. */
export declare namespace create {
  /** Selected static data and ordered runtime bindings. */
  type Options = Recipe.Definition &
    Scalar.Options & {
      /** Binding instructions containing no executable authoring code. */
      readonly program: Program
      /** Static fragments for one theme and color scheme. */
      readonly styles: Readonly<Record<string, StyleSheet.NativeStyle>>
    }
}
