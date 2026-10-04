/** Publishes scoped native selections to Reanimated shared values. @module */
import * as NativeContext from '../runtime/NativeContext.js'
import * as NativeVars from '../runtime/NativeVars.js'
import * as React from 'react'
import * as ReactNative from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import * as Store from './internal/Store.js'
import type * as StyleSheet from './StyleSheet.js'
import type * as Vars from '../Vars.js'

/**
 * Reads a numeric or color property from a selected, composed native style.
 * @param appliedStyle - Applied native style, including arrays and caller overrides.
 * @param property - Numeric or color property to publish.
 * @returns A shared value updated on style input and Provider selection changes.
 * @throws For unresolved bindings, missing properties, or unsupported property values.
 */
export function useAnimatedStyleValue<
  const property extends useAnimatedStyleValue.Property,
>(
  appliedStyle: StyleSheet.StyleProp<object>,
  property: property,
): Reanimated.SharedValue<useAnimatedStyleValue.Value<property>> {
  const store = React.useContext(Store.context)
  const read = React.useCallback(() => {
    const resolved = NativeContext.resolve(appliedStyle, store?.getSnapshot())
    const style = ReactNative.StyleSheet.flatten(
      resolved as ReactNative.StyleProp<ReactNative.ViewStyle>,
    )
    const value = style?.[property as keyof ReactNative.ViewStyle]
    const color = property === 'color' || property.endsWith('Color')
    if (
      color
        ? typeof value !== 'string' || ReactNative.processColor(value) == null
        : typeof value !== 'number' || !Number.isFinite(value)
    )
      throw new Error(
        `useAnimatedStyleValue requires a numeric or color value for ${property}.`,
      )

    return value as useAnimatedStyleValue.Value<property>
  }, [appliedStyle, property, store])

  return useSelection(read, store)
}

/** Properties supported by scalar style animation bindings. */
export declare namespace useAnimatedStyleValue {
  /** Numeric native properties and native color properties. */
  type Property = {
    [key in keyof StyleSheet.NativeStyle]-?: key extends
      | 'color'
      | `${string}Color`
      ? key
      : Extract<StyleSheet.NativeStyle[key], number> extends never
        ? never
        : key
  }[keyof StyleSheet.NativeStyle] &
    string
  /** Color strings or finite numeric selections, excluding layout strings. */
  type Value<property extends Property> = property extends
    | 'color'
    | `${string}Color`
    ? string
    : number
}

/**
 * Publishes compiled native variables without subscribing the component to React updates.
 * @param variables - Statically linked variables from the owning configuration.
 * @param select - Optional JS selector, with results compared using Object.is.
 * @returns A shared value containing the selected serializable native values.
 * @throws For a missing Provider, unsupported variable reads, or nonserializable selections.
 */
export function useAnimatedVars<const variables extends Vars.Definition>(
  variables: variables,
  select?: undefined,
): Reanimated.SharedValue<NativeVars.Values<Vars.Extract<variables>>>
/** Publishes a selected variable value to the UI thread. */
export function useAnimatedVars<
  const variables extends Vars.Definition,
  selected extends useAnimatedVars.Value,
>(
  variables: variables,
  select: (values: NativeVars.Values<Vars.Extract<variables>>) => selected,
): Reanimated.SharedValue<selected>
export function useAnimatedVars(
  variables: Vars.Definition,
  select: (values: never) => unknown = (values) => values,
) {
  const store = React.useContext(Store.context)
  if (!store) throw new Error('useAnimatedVars requires a Zyzz Provider.')

  const read = React.useCallback(
    () => select(NativeVars.read(variables, store.getSnapshot()) as never),
    [select, store, variables],
  )

  return useSelection(read, store)
}

/** Serializable selections shared with animation worklets. */
export declare namespace useAnimatedVars {
  /** Plain native values, arrays, and objects without functions or class instances. */
  type Value =
    | boolean
    | null
    | number
    | readonly Value[]
    | string
    | undefined
    | { readonly [key: string]: Value }
}

function useSelection<value>(
  read: () => value,
  store: ReturnType<typeof Store.create> | undefined,
): Reanimated.SharedValue<value> {
  const initial = read()
  serializable(initial)
  const previous = React.useRef(initial)
  const shared = Reanimated.useSharedValue(initial)

  React.useLayoutEffect(() => {
    const update = () => {
      const next = read()
      if (Object.is(previous.current, next)) return
      serializable(next)
      shared.set(next)
      previous.current = next
    }
    update()
    return store?.subscribe(update)
  }, [read, shared, store])

  return shared
}

function serializable(value: unknown, ancestors = new Set<object>()): void {
  if (value == null || typeof value === 'string' || typeof value === 'boolean')
    return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (
    typeof value !== 'object' ||
    (Array.isArray(value)
      ? Object.getPrototypeOf(value) !== Array.prototype
      : Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)
  )
    throw new Error(
      'Animated selections require finite, serializable native values.',
    )

  if (ancestors.has(value))
    throw new Error('Animated selections cannot contain cycles.')
  if (Object.getOwnPropertySymbols(value).length)
    throw new Error('Animated selections cannot contain symbol properties.')

  ancestors.add(value)
  for (const entry of Object.values(value)) serializable(entry, ancestors)
  ancestors.delete(value)
}
