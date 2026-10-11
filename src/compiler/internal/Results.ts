/**
 * Runs compiler operations in the Rust engine and rebuilds their frozen results and errors.
 * @module
 */
import type * as Mapping from '@jridgewell/gen-mapping'
import * as Css from '../../web/Css.js'
import * as ClassName from '../../web/internal/ClassName.js'
import * as Engine from '../../web/internal/Engine.js'
import * as ThemeRules from '../../web/internal/Themes.js'
import type * as Graph from '../Graph.js'
import * as Native from '../Native.js'
import * as Source from '../Source.js'
import type * as Transform from '../Transform.js'
import * as Stylesheets from './Stylesheets.js'

/** A failure as the engine encodes it. */
type Failure = {
  readonly diagnostics?: readonly unknown[] | undefined
  readonly message: string
  readonly name: string
  readonly source?: string | undefined
}

/** One module's transform output as the engine encodes it. */
export type Module = {
  readonly classes: Readonly<Record<string, string>>
  readonly code: string
  readonly css: string
  readonly cssMap: Mapping.EncodedSourceMap
  readonly map: Transform.compile.ReturnType['map']
  readonly rules: Readonly<Record<string, string>>
  readonly shared?: readonly ThemeRules.Resource[] | undefined
  readonly units: readonly (readonly [string, boolean, string])[]
  readonly vars: Readonly<Record<string, string>>
}

/** One rendered stylesheet as the engine encodes it. */
type Rendered = {
  readonly assets: Readonly<Record<string, string>>
  readonly css: string
  readonly id?: string | undefined
  readonly map: Mapping.EncodedSourceMap
  readonly owners: Readonly<Record<string, string>>
}

/** A graph result as the engine encodes it. Unchanged modules are `0`. */
export type Output = {
  readonly contracts: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, readonly string[]>>
  readonly modules: Readonly<Record<string, Module | 0>>
  readonly packed?: readonly Rendered[] | undefined
  readonly reset?: Rendered | undefined
  readonly same?: true | undefined
  readonly shared?: Rendered | undefined
}

/**
 * Runs an engine operation on JSON input.
 * @param operation - Operation name, such as `graph.compile`.
 * @param input - Input data, serialized as JSON.
 * @returns The parsed result.
 * @throws {Source.ExtractError} For source the compiler does not support.
 * @throws {Css.CompileError} For CSS emission failures.
 * @throws {Native.CompileError} For native features outside the static boundary.
 */
export function call<result>(operation: string, input: unknown): result {
  const output = JSON.parse(Engine.call(operation, JSON.stringify(input))) as {
    readonly error?: Failure | undefined
  }

  if (output.error) throw failure(output.error)

  return output as result
}

function failure(error: Failure): Error {
  if (error.name === 'Source.ExtractError')
    return new Source.ExtractError(
      error.diagnostics as readonly Source.Diagnostic[],
    )
  if (error.name === 'Css.CompileError')
    return new Css.CompileError(error.diagnostics as readonly Css.Diagnostic[])
  if (error.name === 'Native.CompileError')
    return new Native.CompileError(error.message)
  if (error.name === 'Stylesheets.ConflictError')
    return new Stylesheets.ConflictError(error.source ?? '', error.message)

  return new Error(error.message)
}

/**
 * Rebuilds one module's frozen transform output.
 * @param value - The encoded module.
 * @returns The output `Transform.compile` returns.
 */
export function module(value: Module): Transform.compile.ReturnType {
  const result = {
    ...(value.shared
      ? {
          [ThemeRules.shared]: Object.freeze(
            value.shared.map((resource) => Object.freeze(resource)),
          ),
        }
      : {}),
    [ClassName.rules]: Object.freeze({ ...value.rules }),
    [ClassName.units]: new Map(
      value.units.map(([key, borrowed, name]) => [key, { borrowed, name }]),
    ),
    classes: Object.freeze(value.classes),
    code: value.code,
    css: value.css,
    cssMap: value.cssMap,
    map: value.map,
    vars: Object.freeze(Object.assign(Object.create(null), value.vars)),
  }

  Object.defineProperty(result, ClassName.rules, { enumerable: false })
  Object.defineProperty(result, ClassName.units, { enumerable: false })

  return Object.freeze(result) as Transform.compile.ReturnType
}

function rendered(value: Rendered) {
  return Object.freeze({
    ...(value.id === undefined ? {} : { id: value.id }),
    css: value.css,
    map: value.map,
    assets: Object.freeze(Object.assign(Object.create(null), value.assets)),
    owners: Object.freeze(Object.assign(Object.create(null), value.owners)),
  })
}

/**
 * Rebuilds a frozen graph result, keeping the module objects of `previous` that the engine
 * reports unchanged.
 * @param value - The encoded graph result.
 * @param previous - The result of the same compiler's previous call.
 * @returns The output `Graph.compile` returns.
 */
export function graph(
  value: Output,
  previous?: Graph.compile.ReturnType | undefined,
): Graph.compile.ReturnType {
  if (value.same && previous) return previous

  const modules = Object.fromEntries(
    Object.entries(value.modules).map(([id, encoded]) => [
      id,
      encoded === 0 ? previous!.modules[id]! : module(encoded),
    ]),
  )

  return Object.freeze({
    ...(value.reset
      ? { [Stylesheets.reset]: rendered(value.reset) as Stylesheets.Resource }
      : {}),
    ...(value.packed
      ? {
          [Stylesheets.packed]: Object.freeze(
            value.packed.map((resource) => rendered(resource)),
          ) as readonly Stylesheets.Resource[],
        }
      : {}),
    ...(value.shared
      ? {
          sharedCss: value.shared.css,
          sharedCssMap: value.shared.map,
          sharedAssets: Object.freeze(
            Object.assign(Object.create(null), value.shared.assets),
          ),
          sharedAssetOwners: Object.freeze(
            Object.assign(Object.create(null), value.shared.owners),
          ),
        }
      : {}),
    contracts: Object.freeze({ ...value.contracts }),
    dependencies: Object.freeze(
      Object.assign(
        Object.create(null),
        Object.fromEntries(
          Object.entries(value.dependencies).map(([id, targets]) => [
            id,
            Object.freeze([...targets]),
          ]),
        ),
      ),
    ),
    modules: Object.freeze(modules),
  }) as Graph.compile.ReturnType
}
