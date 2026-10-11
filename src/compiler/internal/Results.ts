/**
 * Runs compiler operations in the Rust engine and rebuilds their frozen results and errors.
 * @module
 */
import type * as Mapping from '@jridgewell/gen-mapping'
import * as StyleSheet from '../../react-native/StyleSheet.js'
import * as Variants from '../../react-native/Variants.js'
import * as Css from '../../web/Css.js'
import * as ClassName from '../../web/internal/ClassName.js'
import * as Engine from '../../web/internal/Engine.js'
import * as ThemeRules from '../../web/internal/Themes.js'
import * as Wire from '../../web/internal/Wire.js'
import type * as Graph from '../Graph.js'
import * as Native from '../Native.js'
import * as Source from '../Source.js'
import type * as Transform from '../Transform.js'
import * as Edits from './Edits.js'
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

/** One native graph module as the engine encodes it. */
type NativeModule = {
  readonly code: string
  readonly edits: readonly Edits.Edit[]
  readonly map: Mapping.EncodedSourceMap
}

/** A `native.compile` result as the engine encodes it. */
export type NativeOutput = {
  readonly code: string
  readonly edits: readonly Edits.Edit[]
  readonly map: string
  readonly recipes: Readonly<Record<string, unknown>>
}

/** One rendered stylesheet as the engine encodes it. */
type Rendered = {
  readonly assets: Readonly<Record<string, string>>
  readonly css: string
  readonly id?: string | undefined
  readonly map: Mapping.EncodedSourceMap
  readonly owners: Readonly<Record<string, string>>
}

/**
 * A graph result as the engine encodes it. Modules whose output the host last decoded are `0`,
 * and `prune` drops every other decoded module.
 */
export type Output = {
  readonly contracts: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, readonly string[]>>
  readonly modules: Readonly<Record<string, Module | NativeModule | 0>>
  readonly packed?: readonly Rendered[] | undefined
  readonly prune?: true | undefined
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
  return decode(Engine.call(operation, JSON.stringify(input)))
}

/**
 * Parses an engine result, throwing the failure it encodes.
 * @param json - The engine's JSON result.
 * @returns The parsed result.
 * @throws {Source.ExtractError} For source the compiler does not support.
 * @throws {Css.CompileError} For CSS emission failures.
 * @throws {Native.CompileError} For native features outside the static boundary.
 */
export function decode<result>(json: string): result {
  const output = JSON.parse(json) as { readonly error?: Failure | undefined }

  if (output.error) throw failure(output.error)

  return output as result
}

/**
 * Lists each packed stylesheet section's import chain of a library contract, which hosts
 * resolve before compiling the graph.
 * @param contract - Serialized library contract.
 * @param moduleId - Host-resolved identity of the contract's module.
 * @returns One specifier chain per stylesheet section, in section order.
 * @throws {SyntaxError} For malformed contract JSON.
 * @throws {Error} For unsupported or invalid contract metadata.
 */
export function dependencies(
  contract: string,
  moduleId: string,
): readonly (readonly string[])[] {
  return call<{ readonly dependencies: readonly (readonly string[])[] }>(
    'contract.dependencies',
    { contract, moduleId },
  ).dependencies
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
  if (error.name === 'StyleSheet.CompileError')
    return new StyleSheet.CompileError(
      error.diagnostics as readonly StyleSheet.Diagnostic[],
    )
  if (error.name === 'StyleSheet.SelectionError')
    return new StyleSheet.SelectionError(error.message)
  if (error.name === 'Stylesheets.ConflictError')
    return new Stylesheets.ConflictError(error.source ?? '', error.message)
  if (error.name === 'Variants.CompileError')
    return new Variants.CompileError(error.message)
  if (error.name === 'SyntaxError') return new SyntaxError(error.message)

  return new Error(error.message)
}

/**
 * Deeply freezes decoded JSON data, giving its objects null prototypes as compiled tables have.
 * @param value - Data parsed from engine JSON.
 * @returns The same data, frozen.
 */
export function frozen(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(frozen))
  if (value === null || typeof value !== 'object') return value

  return Object.freeze(
    Object.assign(
      Object.create(null),
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, frozen(entry)]),
      ),
    ),
  )
}

/**
 * Rebuilds a frozen graph result, keeping the decoded module objects the engine reports
 * unchanged.
 * @param value - The encoded graph result.
 * @param previous - The result of the same compiler's previous call.
 * @param decoded - The same compiler's last decoded module per identity, updated in place.
 * @returns The output `Graph.compile` returns.
 */
export function graph(
  value: Output,
  previous?: Graph.compile.ReturnType | undefined,
  decoded?: Map<string, Transform.compile.ReturnType> | undefined,
): Graph.compile.ReturnType {
  if (value.same && previous) return previous

  const modules = Object.fromEntries(
    Object.entries(value.modules).map(([id, encoded]) => [
      id,
      (() => {
        if (encoded === 0) return decoded!.get(id)!
        if ('edits' in encoded) return nativeModule(encoded)

        return module(encoded)
      })(),
    ]),
  )

  if (decoded) {
    for (const [id, output] of Object.entries(modules)) decoded.set(id, output)
    if (value.prune)
      for (const id of decoded.keys())
        if (!Object.hasOwn(modules, id)) decoded.delete(id)
  }

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

/**
 * Encodes native options as the engine reads them. Sets are written in the `Css.compile` wire
 * format, so the engine decodes them as it decodes literal definitions.
 * @param options - Native options of `Native.compile` or a native graph.
 * @returns The engine's native input.
 */
export function native(
  options: Omit<Native.compile.Options, 'moduleId' | 'source'>,
) {
  return {
    colorScheme: options.colorScheme,
    contextual: options.contextual,
    fonts: options.fonts,
    platform: options.platform,
    runtime: options[Edits.runtime],
    set: options.set,
    units: options.units,
    vars:
      options.vars === undefined
        ? undefined
        : Wire.encode({
            styles: { styles: [] },
            vars: options.vars,
          } as unknown as Css.compile.Options),
  }
}

// A graph's native module carries the web output shape with empty CSS.
function nativeModule(value: NativeModule): Transform.compile.ReturnType {
  return Object.freeze({
    [ClassName.rules]: Object.freeze({}),
    classes: Object.freeze({}),
    [Edits.key]: value.edits,
    code: value.code,
    css: '',
    cssMap: {
      version: 3 as const,
      names: [],
      sources: [],
      mappings: '',
    },
    map: value.map,
    vars: Object.freeze({}),
  }) as Transform.compile.ReturnType
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
