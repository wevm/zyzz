/** Defers precompiled native selection until a React render supplies its context. @module */
import type * as Native from './Native.js'

const binding = Symbol('zyzz.native.context')

/** Render-local theme and resolved appearance. */
export type Context = {
  /** Resolved system appearance or an explicit override. */
  readonly colorScheme: 'dark' | 'light'
  /** Named compiled theme; omission uses each configuration default. */
  readonly theme?: string | undefined
}

type Callable = (input?: never) => Native.Props<object>
type Tables = Readonly<
  Record<string, Readonly<Record<'dark' | 'light', Callable>>>
>

/** Retains compiled alternatives without selecting a device context at module evaluation. */
export function create<const tables extends Tables>(
  tables: tables,
  defaultTheme: keyof tables & string,
): tables[keyof tables]['light'] {
  const callable = (input?: never): Native.Props<object> => ({
    style: {
      [binding]: (context: Context) => {
        const theme = context.theme ?? defaultTheme
        const table =
          tables[theme] ??
          (Object.keys(tables).length === 1 && defaultTheme === 'default'
            ? tables.default
            : undefined)
        if (!table) throw new Error(`Unknown native theme: ${theme}.`)
        return table[context.colorScheme](input).style
      },
    },
  })
  return callable as tables[keyof tables]['light']
}

/** Resolves generated bindings and arrays while preserving caller-owned native objects. */
export function resolve(value: unknown, context: Context | undefined): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolve(entry, context))
  if (value && typeof value === 'object' && binding in value) {
    if (!context)
      throw new Error('Compiled native styles require a Zyzz Provider.')
    const select = value[binding]
    if (typeof select === 'function') return resolve(select(context), context)
  }
  if (typeof value === 'function')
    return (...args: unknown[]) => resolve(value(...args), context)
  return value
}
