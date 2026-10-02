/** React subscriptions for compiled native styles and variable values. @module */
import * as Config from '../Config.js'
import * as NativeContext from '../runtime/NativeContext.js'
import * as NativeVars from '../runtime/NativeVars.js'
import * as React from 'react'
import type * as Vars from '../Vars.js'

const context = React.createContext<ReturnType<typeof create> | undefined>(
  undefined,
)
const unbound = {
  getSnapshot: () => undefined,
  subscribe: () => () => {},
}

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

/** Supplies a variable name and resolved color scheme to this React subtree. */
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

  const [store] = React.useState(() =>
    create({ colorScheme: props.colorScheme, set: props.vars }),
  )
  React.useLayoutEffect(() => {
    store.update({ colorScheme: props.colorScheme, set: props.vars })
  }, [props.colorScheme, props.vars, store])

  return React.createElement(context.Provider, { value: store }, props.children)
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

/** Compiler-inserted subscription for resolving native style applications. */
export function useStyles() {
  const store = React.useContext(context) ?? unbound
  const value = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  return React.useMemo(() => styles(value), [value])
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
  const store = React.useContext(context)
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

function create(initial: NativeContext.Context) {
  let snapshot = Object.freeze(initial)
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      const entry = () => listener()
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    update(value: NativeContext.Context) {
      if (
        snapshot.colorScheme === value.colorScheme &&
        snapshot.set === value.set
      )
        return
      snapshot = Object.freeze(value)
      // Subscriptions added during notification wait for the next change.
      const current = Array.from(listeners)
      for (const listener of current) if (listeners.has(listener)) listener()
    },
  }
}

function styles(value: NativeContext.Context | undefined) {
  return {
    props: (props: Record<string, unknown> | null | undefined) =>
      props && Object.hasOwn(props, 'style')
        ? { ...props, style: NativeContext.resolve(props.style, value) }
        : props,
    style: (style: unknown, input?: unknown) =>
      NativeContext.resolve(style, value, input),
  }
}
