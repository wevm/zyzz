/** Supplies automatic window measurements for native React consumers. @module */
import type * as Config from '../../Config.js'
import * as NativeContext from '../../runtime/NativeContext.js'
import NativeZyzz from './NativeZyzz.js'
import * as React from 'react'
import * as ReactNative from 'react-native'
import * as Store from './Store.js'
import * as Subscription from '../react.js'
import * as Viewport from './Viewport.js'

/** Creates native authoring helpers and a Provider with automatic window subscriptions. */
export function defineConfig<const options extends Config.create.Options = {}>(
  options: options & Parameters<typeof Config.create<options>>[0] = {} as never,
): Subscription.defineConfig.ReturnType<options> {
  const config = Subscription.defineConfig<options>(options)
  return Object.freeze({
    ...config,
    Provider: dimensions(config.Provider),
  }) as Subscription.defineConfig.ReturnType<options>
}

/** Provides selected variables, appearance, and automatic native dimensions. */
export const Provider = dimensions(Subscription.Provider)

export { useStyles, useVars } from '../react.js'

function dimensions<props extends Subscription.Provider.Props>(
  Component: React.FunctionComponent<props>,
): React.FunctionComponent<props> {
  return function WindowProvider(props: props) {
    const window = ReactNative.useWindowDimensions()
    const viewport = React.useMemo(
      () => ({ height: window.height, width: window.width }),
      [window.height, window.width],
    )
    return React.createElement(
      Viewport.context.Provider,
      { value: viewport },
      React.createElement(Component, props),
    )
  }
}

/** Compiler-only binding path, with React subscriptions for Expo Go. */
export const useNativeStyles = useBindings

type Instance = {
  readonly __internalInstanceHandle?:
    | {
        readonly stateNode?: { readonly node?: object | undefined } | undefined
      }
    | undefined
  readonly getNativeScrollRef?: (() => Instance) | undefined
}

function useBindings() {
  const owner = React.useContext(Store.context)
  const [fallback] = React.useState(() =>
    Store.create({
      colorScheme: 'light',
      viewport: ReactNative.Dimensions.get('window'),
    }),
  )
  const store = owner ?? fallback
  const [, render] = React.useReducer((count: number) => count + 1, 0)
  return {
    style: NativeContext.application,
    view: (props: Record<string, unknown>) => {
      if (!Object.hasOwn(props, 'style')) return props
      const snapshot = store.getSnapshot()
      const selected = NativeContext.resolve(props.style, snapshot)
      const initial = NativeContext.key(props.style, snapshot)
      if (!initial.length && typeof selected !== 'function')
        return { ...props, style: selected }

      return {
        ...props,
        ref: (value: Instance | null) => {
          const ref = props.ref as React.Ref<Instance> | undefined
          const release = typeof ref === 'function' ? ref(value) : undefined
          if (ref && typeof ref !== 'function') ref.current = value
          if (!value) return

          const instance = value.getNativeScrollRef?.() ?? value
          const node = instance.__internalInstanceHandle?.stateNode?.node
          const detach = (() => {
            if (!NativeZyzz || !node || typeof selected === 'function') {
              const unsubscribe = store.subscribe(render)
              if (store.getSnapshot() !== snapshot) render()
              return unsubscribe
            }
            const id = NativeZyzz!.attach(node, nativeProps(selected))
            let previous = initial
            const read = (context: NativeContext.Context) => {
              const keys = NativeContext.key(props.style, context)
              if (
                keys.length === previous.length &&
                keys.every((key, index) => Object.is(key, previous[index]))
              )
                return { commit: () => {} }
              return {
                commit: () => {
                  previous = keys
                },
                patch: {
                  id,
                  props: nativeProps(
                    NativeContext.resolve(props.style, context),
                  ),
                },
              }
            }
            // Context can change between render and committing the host ref.
            const current = read(store.getSnapshot())
            if (current.patch) write([current.patch])
            current.commit()
            const unbind = store.bind(read, write)
            return () => {
              unbind()
              NativeZyzz!.detach(id)
            }
          })()
          const update = () =>
            fallback.update({
              colorScheme: 'light',
              viewport: ReactNative.Dimensions.get('window'),
            })
          const subscription = owner
            ? undefined
            : ReactNative.Dimensions.addEventListener('change', update)
          if (!owner) update()
          return () => {
            detach()
            subscription?.remove()
            if (typeof release === 'function') release()
            else if (typeof ref === 'function') ref(null)
            else if (ref) ref.current = null
          }
        },
        style: selected,
      }
    },
  }
}

function nativeProps(style: unknown): Record<string, unknown> {
  const flattened =
    ReactNative.StyleSheet.flatten(
      style as ReactNative.StyleProp<ReactNative.ViewStyle>,
    ) ?? {}
  const result: Record<string, unknown> = { ...flattened }
  for (const [name, value] of Object.entries(result)) {
    if (name === 'color' || name.endsWith('Color'))
      result[name] = ReactNative.processColor(value as ReactNative.ColorValue)
    else if (name === 'boxShadow' && Array.isArray(value))
      result[name] = value.map((shadow) => ({
        ...shadow,
        color: ReactNative.processColor(shadow.color),
      }))
  }
  return result
}

function write(patches: readonly Store.Patch[]) {
  NativeZyzz!.update(patches)
}
