/** React lifecycle for automatically compiled native styling. @module */
import * as React from 'react'
import * as NativeContext from '../runtime/NativeContext.js'

const context = React.createContext(styles(undefined))

/** Supplies theme and resolved device appearance to compiled native components. */
export function Provider(props: Provider.Props) {
  if (
    (props.colorScheme !== 'light' && props.colorScheme !== 'dark') ||
    (props.theme !== undefined &&
      (typeof props.theme !== 'string' || !props.theme.trim()))
  )
    throw new Error(
      'Native appearance requires a resolved light/dark scheme and a nonempty theme name.',
    )
  const value = React.useMemo(
    () => styles({ colorScheme: props.colorScheme, theme: props.theme }),
    [props.colorScheme, props.theme],
  )
  return React.createElement(context.Provider, { value }, props.children)
}

/** Application boundary inputs. Pass React Native's useColorScheme result with a light fallback. */
export declare namespace Provider {
  /** Theme selection and resolved appearance for this React subtree. */
  type Props = NativeContext.Context & {
    /** Components that consume compiled native styles. */
    readonly children?: React.ReactNode | undefined
  }
}

/** Compiler-inserted unconditional subscription, including memoized components. */
export function useStyles() {
  return React.useContext(context)
}

function styles(value: NativeContext.Context | undefined) {
  return {
    style: (style: unknown, input?: unknown) =>
      NativeContext.resolve(style, value, input),
    props: (props: Record<string, unknown> | null | undefined) =>
      props && Object.hasOwn(props, 'style')
        ? { ...props, style: NativeContext.resolve(props.style, value) }
        : props,
  }
}
