/** Resolves compiled style applications for consumers outside native view bindings. @module */
import * as NativeContext from '../../runtime/NativeContext.js'
import * as React from 'react'
import type { useStyles } from '../react.js'
import type * as Store from './Store.js'

/** Subscribes to a selection and returns its style resolvers. */
export function use(
  store: ReturnType<typeof Store.create>,
): useStyles.ReturnType {
  const value = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  return React.useMemo(
    () => ({
      props: (props) =>
        props && Object.hasOwn(props, 'style')
          ? { ...props, style: NativeContext.resolve(props.style, value) }
          : props,
      style: <style>(style: style, input?: unknown) =>
        NativeContext.resolve(style, value, input) as useStyles.Style<style>,
    }),
    [value],
  )
}

/**
 * Wraps a component so its style props resolve through an entrypoint's selection hook.
 * @throws For invalid style prop names.
 */
export function wrap<const component extends React.ElementType>(
  Component: component,
  options: wrap.Options,
  useStyles: () => useStyles.ReturnType,
) {
  const additional = options.styleProps ?? []
  if (
    !Array.isArray(additional) ||
    additional.some(
      (name) =>
        typeof name !== 'string' || !name || name === 'key' || name === 'ref',
    )
  )
    throw new Error(
      'withStyles requires style prop names excluding key and ref.',
    )

  const names = [...new Set(['style', 'contentContainerStyle', ...additional])]
  const Wrapped = React.forwardRef<
    React.ComponentRef<component>,
    React.ComponentPropsWithoutRef<component>
  >((props, ref) => {
    const selected = useStyles()
    const resolved: Record<string, unknown> = { ...props, ref }
    for (const name of names)
      if (Object.hasOwn(props, name))
        resolved[name] = selected.style(
          (props as Record<string, unknown>)[name],
        )

    return React.createElement(Component, resolved)
  })
  Wrapped.displayName = `withStyles(${typeof Component === 'string' ? Component : Component.displayName || Component.name || 'Component'})`

  return Wrapped
}

/** Style-bearing prop names accepted by a wrapper. */
export declare namespace wrap {
  /** Entrypoints narrow these names to the wrapped component's props. */
  type Options = {
    /** Additional style props declared by the wrapped component. */
    readonly styleProps?: readonly string[] | undefined
  }
}
