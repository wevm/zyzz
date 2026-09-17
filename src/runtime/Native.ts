/** Selects precompiled native props and composes caller-owned native style values. @module */
import type * as StyleSheet from '../react-native/StyleSheet.js'

type Choices<values extends readonly string[]> =
  values[number] extends infer value
    ? value extends 'true'
      ? true
      : value extends 'false'
        ? false
        : value
    : never

/** Inferred finite inputs for a generated native recipe callable. */
export type Callable<axes extends Readonly<Record<string, readonly string[]>>> =
  (
    input?: {
      readonly [axis in keyof axes]?: Choices<axes[axis]> | null | undefined
    } & {
      /** Caller-owned native overrides, applied after the selected table entry. */
      readonly style?: StyleSheet.StyleProp<StyleSheet.NativeStyle> | undefined
    },
  ) => Props

/**
 * Combines applied native props in order without flattening caller-owned values.
 * @param entries - Applied props or falsy conditional entries.
 * @returns Native style props preserving nested arrays and object identity.
 */
export function compose(
  ...entries: readonly (Props | false | null | undefined)[]
): Props {
  for (const entry of entries)
    if (
      entry &&
      (!Object.hasOwn(entry, 'style') ||
        Object.keys(entry).some((key) => key !== 'style'))
    )
      throw new SelectionError(
        'Native composition requires native style props.',
      )
  const styles = entries
    .filter((entry): entry is Props => !!entry)
    .map((entry) => entry.style)
  return { style: styles.length === 1 ? styles[0] : styles }
}

/**
 * Binds a finite native table to defaults and optional styling overrides.
 * @param options - Compiler-owned axes, defaults, and a selected theme/scheme table.
 * @returns A callable that only looks up static data and composes native overrides.
 * @throws {SelectionError} For undeclared axes, choices, or missing table entries.
 */
export function create<
  const axes extends Readonly<Record<string, readonly string[]>>,
>(options: create.Options<axes>): Callable<axes> {
  const axes = Object.entries(options.axes)
  for (const style of Object.values(options.styles)) freeze(style)
  return (input = {}) => {
    for (const key of Object.keys(input))
      if (key !== 'style' && !Object.hasOwn(options.axes, key))
        throw new SelectionError(`Unknown native recipe input: ${key}.`)
    let index = 0
    let stride = 1
    const values: Readonly<Record<string, unknown>> = input
    for (const [axis, choices] of axes) {
      const supplied = Object.hasOwn(values, axis) ? values[axis] : undefined
      const selected =
        supplied === undefined
          ? Object.hasOwn(options.defaults, axis)
            ? options.defaults[axis]
            : undefined
          : supplied
      const choice =
        selected === null || selected === undefined
          ? choices.length
          : typeof selected === 'string' || typeof selected === 'boolean'
            ? choices.indexOf(String(selected))
            : -1
      if (choice < 0)
        throw new SelectionError(`Unknown native recipe choice for ${axis}.`)
      index += choice * stride
      stride *= choices.length + 1
    }
    const style = options.styles[String(index)]
    if (!style)
      throw new SelectionError('Native recipe table is missing a selection.')
    return { style: input.style ? [style, input.style] : style }
  }
}

/** Inputs emitted by the native compiler. */
export declare namespace create {
  /** Finite metadata and precompiled objects, with no device-state lookup. */
  type Options<
    axes extends Readonly<Record<string, readonly string[]>> = Readonly<
      Record<string, readonly string[]>
    >,
  > = {
    /** Ordered finite choice names. */
    readonly axes: axes
    /** Default selections. Null suppresses an axis. */
    readonly defaults: Readonly<Record<string, string | null>>
    /** One theme/scheme table indexed by finite selections. */
    readonly styles: Readonly<Record<string, StyleSheet.NativeStyle>>
  }
}

/** Props returned by compiled native definitions and native composition. */
export type Props = {
  /** Native style values ready for an ordinary component's style prop. */
  readonly style: StyleSheet.StyleProp<StyleSheet.NativeStyle>
}

/** An application selected an unknown finite native variant. */
export class SelectionError extends Error {
  /** Stable namespaced diagnostic name. */
  override name = 'Native.SelectionError'
}

function freeze(value: object): void {
  if (Object.isFrozen(value)) return
  for (const child of Object.values(value))
    if (child && typeof child === 'object') freeze(child)
  Object.freeze(value)
}
