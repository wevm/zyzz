/** React subscriptions for compiled native styles and variable values. @module */
import * as Config from '../Config.js'
import type * as NativeContext from '../runtime/NativeContext.js'
import * as NativeVars from '../runtime/NativeVars.js'
import * as React from 'react'
import type * as Vars from '../Vars.js'
import * as Store from './internal/Store.js'
import * as Styles from './internal/Styles.js'
import * as Viewport from './internal/Viewport.js'

/** Creates native authoring helpers and a Provider typed to the configured variables. */
export function defineConfig<const options extends Config.create.Options = {}>(
  options: options & Parameters<typeof Config.create<options>>[0] = {} as never,
): defineConfig.ReturnType<options> {
  const config = Config.create<options>(options)
  const defaultVars = (options as Config.VariableOptions).defaultVars
  const names =
    defaultVars === undefined
      ? undefined
      : new Set(Object.keys((options as Config.VariableOptions).vars))

  function BoundProvider(props: defineConfig.ProviderProps<options>) {
    if (props.vars !== undefined && !names?.has(props.vars))
      throw new Error(`Unknown native vars: ${props.vars}.`)

    return React.createElement(Provider, {
      ...props,
      vars: props.vars ?? defaultVars,
    })
  }

  return Object.freeze({
    ...config,
    Provider: BoundProvider,
  }) as defineConfig.ReturnType<options>
}

/** Native configuration helpers and inferred Provider props. */
export declare namespace defineConfig {
  /** Resolved scheme and variable names from the owning configuration. */
  type ProviderProps<options extends Config.create.Options> = Omit<
    Provider.Props,
    'vars'
  > & {
    /** Selected variables. Omission uses the owning configuration's default. */
    readonly vars?:
      | (options extends { defaultVars: string; vars: infer catalog }
          ? Extract<keyof catalog, string>
          : never)
      | undefined
  }
  /** Existing authoring helpers plus a configuration-scoped Provider. */
  type ReturnType<options extends Config.create.Options = {}> =
    Config.create.ReturnType<options> & {
      /** Provides this configuration's typed selection to native consumers. */
      readonly Provider: React.FunctionComponent<ProviderProps<options>>
    }
}

/** Supplies selected variables, appearance, and adapter measurements to this subtree. */
export function Provider(props: Provider.Props) {
  if (Object.hasOwn(props, 'set'))
    throw new Error('Provider uses vars instead of set.')
  if (
    (props.colorScheme !== 'light' && props.colorScheme !== 'dark') ||
    (props.vars !== undefined &&
      (typeof props.vars !== 'string' || !props.vars.trim()))
  )
    throw new Error(
      'Native appearance requires a resolved light/dark scheme and a nonempty vars name.',
    )

  const viewport = React.useContext(Viewport.context)
  const [store] = React.useState(() =>
    Store.create({ colorScheme: props.colorScheme, set: props.vars, viewport }),
  )
  const [, publish] = React.useReducer((version: number) => version + 1, 0)
  const committed = React.useRef(props.children)
  const snapshot = store.getSnapshot()
  const pending =
    snapshot.colorScheme !== props.colorScheme ||
    snapshot.set !== props.vars ||
    snapshot.viewport?.width !== viewport?.width ||
    snapshot.viewport?.height !== viewport?.height
  const children = pending ? committed.current : props.children
  React.useLayoutEffect(() => {
    committed.current = children
    if (!pending) return
    // Keep the committed subtree until its selection is published. This avoids
    // rendering new application props with the previous store snapshot, without
    // mutating an external store during a potentially abandoned React render.
    store.update({ colorScheme: props.colorScheme, set: props.vars, viewport })
    publish()
  }, [children, pending, props.colorScheme, props.vars, store, viewport])

  return React.createElement(Store.context.Provider, { value: store }, children)
}

/** Application boundary for native variable selection. */
export declare namespace Provider {
  /** Resolved appearance and a configuration-relative variable name. */
  type Props = {
    /** Components that consume compiled native styling or values. */
    readonly children?: React.ReactNode | undefined
    /** Resolved device scheme or an application override. */
    readonly colorScheme: 'dark' | 'light'
    /** Selected variables. Omission uses each configuration's default. */
    readonly vars?: string | undefined
  }
}

/**
 * Compiler-inserted subscription for resolving native style applications.
 * Outside a Provider, selections use default variables and the light scheme.
 */
export function useStyles(): useStyles.ReturnType {
  const [fallback] = React.useState(() =>
    Store.create({ colorScheme: 'light' }),
  )
  return Styles.use(React.useContext(Store.context) ?? fallback)
}

/** Resolver types for Provider-selected native styles. */
export declare namespace useStyles {
  /** Resolvers bound to the nearest Provider selection. */
  type ReturnType = {
    /** Resolves the `style` prop of applied props and preserves other props. */
    readonly props: <
      props extends Readonly<Record<string, unknown>> | null | undefined,
    >(
      props: props,
    ) => props
    /** Resolves an applied style, native style, style array, or style callback. */
    readonly style: <style>(style: style, input?: unknown) => Style<style>
  }
  /**
   * Resolved style type. Caller-owned values keep their types. Native applications
   * always carry `style`, so an applied style drops the `undefined` allowed by the shared props type.
   */
  type Style<style> = [
    style extends object ? (string extends keyof style ? style : never) : never,
  ] extends [never]
    ? style
    : Exclude<style, undefined>
}

/** Compiler fallback for native view bindings when no native adapter is installed. */
export function useNativeStyles() {
  const selected = useStyles()
  return { ...selected, view: selected.props }
}

/**
 * Reads readonly native variables using the nearest Provider's selection.
 * @throws For missing providers, uncompiled definitions, or unsupported field reads.
 */
export function useVars<const variables extends Vars.Definition>(
  variables: variables,
  select?: undefined,
): NativeVars.Values<Vars.Extract<variables>>
/**
 * Subscribes to a selection, comparing results with Object.is.
 * @throws For invalid variable selection or unsupported field reads.
 */
export function useVars<const variables extends Vars.Definition, selected>(
  variables: variables,
  select: (values: NativeVars.Values<Vars.Extract<variables>>) => selected,
): selected
export function useVars(
  variables: Vars.Definition,
  select: (values: never) => unknown = (values) => values,
) {
  const store = React.useContext(Store.context)
  if (!store) throw new Error('useVars requires a Zyzz Provider.')

  const read = React.useMemo(() => {
    let previous: NativeContext.Context | undefined
    let selected: unknown
    return () => {
      const snapshot = store.getSnapshot()
      if (snapshot !== previous) {
        const next = select(NativeVars.read(variables, snapshot) as never)
        if (!previous || !Object.is(selected, next)) selected = next
        previous = snapshot
      }
      return selected
    }
  }, [select, store, variables])

  return React.useSyncExternalStore(store.subscribe, read, read)
}

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
  options?: NoInfer<withStyles.Options<(props: props) => result>>,
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
  options?: withStyles.Options<component>,
): React.ForwardRefExoticComponent<React.ComponentPropsWithRef<component>>
export function withStyles(
  Component: React.ElementType,
  options: withStyles.Options<
    (props: Readonly<Record<string, unknown>>) => React.ReactNode
  > = {},
): React.ElementType {
  return Styles.wrap(Component, options, useStyles)
}

/** Style-bearing component properties resolved by the wrapper. */
export declare namespace withStyles {
  /** Additional names are resolved alongside style and contentContainerStyle. */
  type Options<component extends React.ElementType> = {
    /** Additional style props declared by the wrapped component. */
    readonly styleProps?:
      | readonly Exclude<
          Extract<keyof React.ComponentProps<component>, string>,
          'key' | 'ref'
        >[]
      | undefined
  }
}
