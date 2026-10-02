/** Selects immutable native variable tables emitted by the compiler. @module */
import type * as Literal from '../internal/Literal.js'
import * as Media from './internal/NativeMedia.js'
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
  readonly media?:
    | {
        readonly profiles: Readonly<Record<string, Definition['profiles']>>
        readonly queries: readonly Media.Query[]
      }
    | undefined
  readonly profiles: Readonly<
    Record<string, Readonly<Record<'dark' | 'light', Tree>>>
  >
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

  function profiles(value: create.Options['profiles']): Definition['profiles'] {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([name, schemes]) => [
          name,
          Object.freeze({
            dark: freeze(schemes.dark),
            light: freeze(schemes.light),
          }),
        ]),
      ),
    )
  }

  return Object.freeze({
    [binding]: Object.freeze({
      defaultVars: options.defaultVars,
      ...(options.media
        ? {
            media: Object.freeze({
              profiles: Object.freeze(
                Object.fromEntries(
                  Object.entries(options.media.profiles).map(([key, value]) => [
                    key,
                    profiles(value),
                  ]),
                ),
              ),
              queries: options.media.queries,
            }),
          }
        : {}),
      profiles: profiles(options.profiles),
    }),
  })
}

/** Compiler-generated native profiles. */
export declare namespace create {
  /** Static tables and the owning configuration's default name. */
  type Options = {
    /** Fallback when the Provider omits its selection. */
    readonly defaultVars: string
    /** Precompiled alternatives for supported window queries. */
    readonly media?:
      | {
          readonly profiles: Readonly<Record<string, Options['profiles']>>
          readonly queries: readonly Media.Query[]
        }
      | undefined
    /** Native values for every configured name and scheme. */
    readonly profiles: Readonly<
      Record<string, Readonly<Record<'dark' | 'light', EncodedTree>>>
    >
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
  const profiles =
    definition.media && selection.viewport
      ? definition.media.profiles[
          Media.select(definition.media.queries, selection.viewport)
        ]!
      : definition.profiles
  const name = selection.set ?? definition.defaultVars
  const profile =
    (Object.hasOwn(profiles, name) ? profiles[name] : undefined) ??
    (definition.defaultVars === 'default' && Object.keys(profiles).length === 1
      ? profiles.default
      : undefined)
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
    /** Native window dimensions; unsupported leaves remain lazy when absent. */
    readonly viewport?: Media.Viewport | undefined
  }
}
