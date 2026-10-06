/** Defers precompiled native selection until a consumer supplies its scoped selection. @module */
import type * as Native from './Native.js'
import * as Media from './internal/NativeMedia.js'

const binding = Symbol('zyzz.native.context')
const dependency = Symbol('zyzz.native.dependency')

/** Render-local set and resolved appearance. */
export type Context = {
  /** Resolved system appearance or an explicit override. */
  readonly colorScheme: 'dark' | 'light'
  /** Named compiled set; omission uses each configuration default. */
  readonly set?: string | undefined
  /** Logical window dimensions supplied by the native adapter. */
  readonly viewport?: Media.Viewport | undefined
}

type Callable = (input: never) => Native.Props<object>
type Tables = Readonly<
  Record<string, Readonly<Record<'dark' | 'light', Callable>>>
>

/** Retains compiled alternatives without selecting a device context at module evaluation. */
export function create<const tables extends Tables>(
  tables: tables,
  defaultVars: keyof tables & string,
): tables[keyof tables]['light'] {
  const fallback =
    Object.keys(tables).length === 1 && defaultVars === 'default'
      ? tables.default
      : undefined
  const selections = new Set(
    Object.values(tables).flatMap((table) => [table.dark, table.light]),
  )

  function select(context: Context, input?: never) {
    const set = context.set ?? defaultVars
    const table = tables[set] ?? fallback
    if (!table) throw new Error(`Unknown native set: ${set}.`)
    return table[context.colorScheme](input!).style
  }
  return bind(select, (context) => {
    const table = tables[context.set ?? defaultVars] ?? fallback
    if (!table)
      throw new Error(`Unknown native set: ${context.set ?? defaultVars}.`)
    return selections.size === 1 ? [] : [table[context.colorScheme]]
  }) as tables[keyof tables]['light']
}

/** Resolves generated bindings and arrays while preserving caller-owned native objects. */
export function resolve(
  value: unknown,
  context: Context | undefined,
  input?: unknown,
): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolve(entry, context))
  if (
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    binding in value
  ) {
    if (!context)
      throw new Error('Compiled native styles require a Zyzz Provider.')
    const select = value[binding]
    if (typeof select === 'function')
      return resolve(select(context, input), context)
  }
  if (typeof value === 'function')
    return (...args: unknown[]) => resolve(value(...args), context)
  return value
}

/** Selects a precompiled media alternative before applying its scoped styling. */
export function responsive<
  const profiles extends Readonly<Record<string, Callable>>,
>(
  queries: readonly Media.Query[],
  profiles: profiles,
): profiles[keyof profiles] {
  return bind(
    (context, input) => {
      const profile = profiles[Media.select(queries, context.viewport)]
      if (!profile) throw new Error('Native media alternative is missing.')
      return resolve(profile, context, input)
    },
    (context) => {
      const profile = profiles[Media.select(queries, context.viewport)]
      return [profile, ...key(profile, context)]
    },
  ) as unknown as profiles[keyof profiles]
}

/** Retains a compiled application and its input until a view selects its context. */
export function application(value: unknown, input?: unknown): unknown {
  return {
    [binding]: (context: Context) => resolve(value, context, input),
    [dependency]: (context: Context) =>
      input === undefined
        ? key(value, context)
        : [...key(value, context), ...key(input, context)],
  }
}

/** Returns compiler-owned alternatives consumed by a native style application. */
export function key(value: unknown, context: Context): readonly unknown[] {
  if (Array.isArray(value)) return value.flatMap((entry) => key(entry, context))
  if (
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    dependency in value
  ) {
    const read = value[dependency]
    if (typeof read === 'function') return read(context)
  }
  if (value && typeof value === 'object' && 'style' in value)
    return key(value.style, context)
  return []
}

function bind(
  select: (context: Context, input?: never) => unknown,
  read: (context: Context) => readonly unknown[],
) {
  function props(input?: never) {
    return {
      style: {
        [binding]: (context: Context) => select(context, input),
        [dependency]: (context: Context) =>
          input === undefined
            ? read(context)
            : [...read(context), ...key(input, context)],
      },
    }
  }
  const defaults = props()
  Object.freeze(defaults.style)
  Object.freeze(defaults)
  const callable = (input?: never) =>
    input === undefined ? defaults : props(input)
  Object.defineProperties(callable, {
    [binding]: { value: select },
    [dependency]: { value: read },
  })
  return callable
}
