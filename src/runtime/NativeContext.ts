/** Defers precompiled native selection until a React render supplies its context. @module */
import type * as Native from './Native.js'

const binding = Symbol('zyzz.native.context')

/** Render-local set and resolved appearance. */
export type Context = {
  /** Resolved system appearance or an explicit override. */
  readonly colorScheme: 'dark' | 'light'
  /** Named compiled set; omission uses each configuration default. */
  readonly set?: string | undefined
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

  function select(context: Context, input?: never) {
    const set = context.set ?? defaultVars
    const table = tables[set] ?? fallback
    if (!table) throw new Error(`Unknown native set: ${set}.`)
    return table[context.colorScheme](input!).style
  }
  function props(input?: never) {
    return {
      style: {
        [binding]: (context: Context) => select(context, input),
      },
    }
  }
  const defaults = props()
  Object.freeze(defaults.style)
  Object.freeze(defaults)
  const callable = (input?: never) =>
    input === undefined ? defaults : props(input)
  Object.defineProperty(callable, binding, {
    value: select,
  })
  return callable as tables[keyof tables]['light']
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
