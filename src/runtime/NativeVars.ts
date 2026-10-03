/** Selects immutable native variable tables emitted by the compiler. @module */
import type * as Literal from '../internal/Literal.js'
import type * as StyleSheet from '../react-native/StyleSheet.js'
import type * as Vars from '../Vars.js'

const binding = Symbol('zyzz.native.vars')

/** Static values with deferred diagnostics for unsupported native leaves. */
export type EncodedTree = {
  readonly [key: string]: string | number | EncodedTree | readonly [string]
}

/** Resolves portable reference domains to readonly native value types. */
export type Values<
  values,
  category = undefined,
  root extends boolean = true,
> = {
  readonly [key in Exclude<
    keyof values,
    root extends true ? 'breakpoint' | 'containerNames' : never
  >]: values[key] extends Vars.Value
    ? category extends 'fontWeight'
      ? Exclude<StyleSheet.NativeStyle['fontWeight'], undefined>
      : category extends 'typography'
        ? key extends 'fontWeight'
          ? Exclude<StyleSheet.NativeStyle['fontWeight'], undefined>
          : Scalar<Vars.Scalar<values[key]>>
        : Scalar<Vars.Scalar<values[key]>>
    : Values<values[key], root extends true ? key : category, false>
}

/** Native scalar values nested under their authored variable paths. */
export type Tree = { readonly [key: string]: string | number | Tree }

type Scalar<value> = value extends number | Literal.Length ? number : string

type Definition = {
  readonly defaultVars: string
  readonly profiles: Readonly<
    Record<string, Readonly<Record<'dark' | 'light', Tree>>>
  >
  readonly unnamed: boolean
}

/** Copies and shares equal branches across the compiled profiles. */
export function create(options: create.Options): object {
  const shared = new Map<string, Tree>()

  function freeze(tree: EncodedTree): Tree {
    const key = JSON.stringify(tree)
    const previous = shared.get(key)
    if (previous) return previous

    const value: Tree = {}
    for (const [name, entry] of Object.entries(tree)) {
      const diagnostic = Array.isArray(entry) ? String(entry[0]) : undefined
      Object.defineProperty(
        value,
        name,
        diagnostic !== undefined
          ? {
              enumerable: true,
              get() {
                throw new Error(diagnostic)
              },
            }
          : {
              enumerable: true,
              value:
                typeof entry === 'object'
                  ? freeze(entry as EncodedTree)
                  : entry,
            },
      )
    }
    Object.freeze(value)
    shared.set(key, value)
    return value
  }

  return Object.freeze({
    [binding]: Object.freeze({
      defaultVars: options.defaultVars,
      profiles: Object.freeze(
        Object.fromEntries(
          Object.entries(options.profiles).map((entry) => {
            const [name, schemes] = entry
            return [
              name,
              Object.freeze({
                dark: freeze(schemes.dark),
                light: freeze(schemes.light),
              }),
            ]
          }),
        ),
      ),
      unnamed: options.unnamed,
    }),
  })
}

/** Compiler-generated native profiles. */
export declare namespace create {
  /** Static tables and the owning configuration's default name. */
  type Options = {
    /** Fallback when the Provider omits its selection. */
    readonly defaultVars: string
    /** Native values for every configured name and scheme. */
    readonly profiles: Readonly<
      Record<string, Readonly<Record<'dark' | 'light', EncodedTree>>>
    >
    /** A standalone definition whose values do not depend on the selected name. */
    readonly unnamed: boolean
  }
}

/** Reads a compiled profile without evaluating authoring or accessing device state. */
export function read(value: object, selection: read.Options): Tree {
  if (
    !value ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    !Object.hasOwn(value, binding)
  )
    throw new Error(
      'useVars requires variables compiled by the native adapter.',
    )

  const definition = (value as { readonly [binding]: Definition })[binding]
  const name = selection.set ?? definition.defaultVars
  const profile =
    (Object.hasOwn(definition.profiles, name)
      ? definition.profiles[name]
      : undefined) ??
    (definition.unnamed ? definition.profiles.default : undefined)
  if (!profile) throw new Error(`Unknown native vars: ${name}.`)

  return profile[selection.colorScheme]
}

/** Selection supplied by the nearest native Provider. */
export declare namespace read {
  /** Resolved appearance and an optional variable name. */
  type Options = {
    /** Resolved native color scheme. */
    readonly colorScheme: 'dark' | 'light'
    /** Selected name, or the configuration default when omitted. */
    readonly set?: string | undefined
  }
}
