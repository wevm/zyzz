/** Supplies automatic window measurements for native React consumers. @module */
import type * as Config from '../../Config.js'
import * as NativeContext from '../../runtime/NativeContext.js'
import NativeZyzz from './NativeZyzz.js'
import * as React from 'react'
import * as ReactNative from 'react-native'
import * as Store from './Store.js'
import * as Styles from './Styles.js'
import * as Subscription from '../react.js'
import * as Viewport from './Viewport.js'

/** Creates native authoring helpers and a Provider with automatic window subscriptions. */
export function defineConfig<const options extends Config.create.Options = {}>(
  options: options & Parameters<typeof Config.create<options>>[0] = {} as never,
): Subscription.defineConfig.ReturnType<options> {
  const config = Subscription.defineConfig<options>(options)
  // Copy descriptors rather than spreading, so deferred helpers stay deferred.
  return Object.freeze(
    Object.defineProperties(
      { Provider: dimensions(config.Provider) } as Record<string, unknown>,
      Object.fromEntries(
        Object.entries(Object.getOwnPropertyDescriptors(config)).filter(
          ([name]) => name !== 'Provider',
        ),
      ),
    ),
  ) as unknown as Subscription.defineConfig.ReturnType<options>
}

/** Provides selected variables, appearance, and automatic native dimensions. */
export const Provider = dimensions(Subscription.Provider)

/**
 * Compiler-inserted subscription for resolving native style applications.
 * Outside a Provider, selections use default variables, the light scheme, and window dimensions.
 */
export function useStyles(): Subscription.useStyles.ReturnType {
  const owner = React.useContext(Store.context)
  const [fallback] = React.useState(() =>
    Store.create({
      colorScheme: 'light',
      viewport: ReactNative.Dimensions.get('window'),
    }),
  )
  React.useLayoutEffect(() => {
    if (owner) return
    const update = () =>
      fallback.update({
        colorScheme: 'light',
        viewport: ReactNative.Dimensions.get('window'),
      })
    // Dimensions can change between render and commit.
    update()
    const subscription = ReactNative.Dimensions.addEventListener(
      'change',
      update,
    )
    return () => subscription.remove()
  }, [fallback, owner])

  return Styles.use(owner ?? fallback)
}

export { useVars } from '../react.js'

/**
 * Resolves compiled style props for function components using React updates.
 * @param Component - Function, memo, or ref-forwarding component receiving native styles.
 * @param options - Additional style-bearing prop names.
 * @returns A component with the original call signature and ref. Type parameters remain when `styleProps` is omitted.
 * @throws For invalid style prop names.
 */
export function withStyles<
  props extends object,
  result extends React.ReactNode,
>(
  Component: (props: props) => result,
  options?: NoInfer<Subscription.withStyles.Options<(props: props) => result>>,
): (props: props) => result
/**
 * Resolves compiled style props for class and host components using React updates.
 * @param Component - Class component or host element type receiving native styles.
 * @param options - Additional style-bearing prop names.
 * @returns A component preserving the original props and instance ref.
 * @throws For invalid style prop names.
 */
export function withStyles<const component extends React.ElementType>(
  Component: component,
  options?: Subscription.withStyles.Options<component>,
): React.ForwardRefExoticComponent<React.ComponentPropsWithRef<component>>
export function withStyles(
  Component: React.ElementType,
  options: Subscription.withStyles.Options<
    (props: Readonly<Record<string, unknown>>) => React.ReactNode
  > = {},
): React.ElementType {
  return Styles.wrap(Component, options, useStyles)
}

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
  // Views inside a Provider never read the fallback, so it is created only outside one.
  const fallbackRef = React.useRef<ReturnType<typeof Store.create> | undefined>(
    undefined,
  )
  if (!owner)
    fallbackRef.current ??= Store.create({
      colorScheme: 'light',
      viewport: ReactNative.Dimensions.get('window'),
    })
  const fallback = fallbackRef.current
  const store = (owner ?? fallback)!
  const [, render] = React.useReducer((count: number) => count + 1, 0)
  const [refs] = React.useState(() => {
    const entries = new Map<
      Instance,
      {
        active: boolean
        ref: React.Ref<Instance> | undefined
        release: () => void
      }
    >()
    let scheduled = false
    return {
      entries,
      // Runs after the commit, once every cleanup and re-attachment has settled, without a layout effect per render.
      sweep() {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          for (const [instance, entry] of entries) {
            if (entry.active) continue
            entry.release()
            entries.delete(instance)
          }
        })
      },
    }
  })
  return {
    style: NativeContext.application,
    view: (props: Record<string, unknown>) => {
      const snapshot = store.getSnapshot()
      const selected = NativeContext.resolve(props.style, snapshot)
      const initial = NativeContext.key(props.style, snapshot)
      // A context-free style never needs a binding, so React keeps a stable element without a ref wrapper.
      if (
        !initial.length &&
        typeof selected !== 'function' &&
        props.ref == null
      )
        return { ...props, style: selected }

      return {
        ...props,
        ref: (value: Instance | null) => {
          const ref = props.ref as React.Ref<Instance> | undefined
          if (!value) return
          let entry = refs.entries.get(value)
          if (entry && entry.ref !== ref) {
            entry.release()
            refs.entries.delete(value)
            entry = undefined
          }
          if (!entry) {
            const release = typeof ref === 'function' ? ref(value) : undefined
            if (ref && typeof ref !== 'function') ref.current = value
            entry = {
              active: true,
              ref,
              release: () => {
                if (typeof release === 'function') release()
                else if (typeof ref === 'function') ref(null)
                else if (ref) ref.current = null
              },
            }
            refs.entries.set(value, entry)
          }
          entry.active = true
          const attached = entry

          const instance = value.getNativeScrollRef?.() ?? value
          const node = instance.__internalInstanceHandle?.stateNode?.node
          const detach = (() => {
            if (!initial.length && typeof selected !== 'function')
              return () => {}
            if (!NativeZyzz || !node || !selective(selected)) {
              const unsubscribe = store.subscribe(render)
              if (store.getSnapshot() !== snapshot) render()
              return unsubscribe
            }
            // Most views never change selection, so attach on the first patch.
            let id: number | undefined
            let previous = initial
            const read = (context: NativeContext.Context) => {
              const keys = NativeContext.key(props.style, context)
              if (
                keys.length === previous.length &&
                keys.every((key, index) => Object.is(key, previous[index]))
              )
                return { commit: () => {} }
              const next = NativeContext.resolve(props.style, context)
              if (!selective(next)) return { commit: render }
              id ??= NativeZyzz!.attach(node, nativeProps(selected))
              return {
                commit: () => {
                  previous = keys
                },
                patch: {
                  id,
                  props: nativeProps(next),
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
              if (id !== undefined) NativeZyzz!.detach(id)
            }
          })()
          const update = () =>
            fallback!.update({
              colorScheme: 'light',
              viewport: ReactNative.Dimensions.get('window'),
            })
          const contextual =
            initial.length > 0 || typeof selected === 'function'
          const subscription =
            owner || !contextual
              ? undefined
              : ReactNative.Dimensions.addEventListener('change', update)
          if (!owner && contextual) update()
          return () => {
            detach()
            subscription?.remove()
            attached.active = false
            refs.sweep()
          }
        },
        style: selected,
      }
    },
  }
}

function selective(style: unknown): boolean {
  if (typeof style === 'function') return false
  const value = ReactNative.StyleSheet.flatten(
    style as ReactNative.StyleProp<ReactNative.ViewStyle>,
  )
  // Let React Native apply its processors to caller-owned representations.
  // Only color properties are processed by the selective writer below.
  return (
    !value ||
    ![
      'aspectRatio',
      'backgroundImage',
      'backgroundPosition',
      'backgroundRepeat',
      'backgroundSize',
      'boxShadow',
      'experimental_backgroundImage',
      'filter',
      'fontVariant',
      'transform',
      'transformOrigin',
    ].some((property) => property in value)
  )
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
  }
  return result
}

function write(patches: readonly Store.Patch[]) {
  NativeZyzz!.update(patches)
}
