/** Rewrites shared authoring to native tables and ordered runtime bindings. @module */
import type * as Source from './Source.js'
import * as Context from './internal/Context.js'
import * as Edits from './internal/Edits.js'
import * as Results from './internal/Results.js'
import type * as StyleSheet from '../react-native/StyleSheet.js'
import type * as Variants from '../react-native/Variants.js'

/**
 * Compiles local styles, variants, and variable reads for an explicit native target.
 * @param options - Shared source, destination mappings, and selected set/scheme.
 * @returns Native callables, source map, and static recipe tables.
 * @throws {Source.ExtractError} For invalid source authoring.
 * @throws {CompileError} For native features outside the static source boundary.
 * @throws {StyleSheet.CompileError} For unsupported native declaration values.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const output = Results.call<Results.NativeOutput>('native.compile', {
    ...Results.native(options),
    context: options[Context.key] === true,
    moduleId: options.moduleId,
    source: options.source,
  })

  return {
    [Edits.key]: output.edits,
    code: output.code,
    map: output.map,
    recipes: Results.frozen(output.recipes) as compile.ReturnType['recipes'],
  }
}

/** Native source compilation contracts. */
export declare namespace compile {
  /** Failures during extraction, table compilation, or explicit context selection. */
  type ErrorType =
    | Source.ExtractError
    | CompileError
    | StyleSheet.CompileError
    | StyleSheet.SelectionError
    | Variants.CompileError

  /** Explicit source and native context, independent of device state. */
  type Options = Omit<StyleSheet.compile.Options, 'styles'> & {
    /** Internal Babel emission mode; authoring types are still validated. */
    readonly [Edits.runtime]?: boolean | undefined
    /** Compiles the module as a member of an adapter-owned graph. */
    readonly [Context.key]?: true | undefined
    /** Retain every set and scheme for render-local selection. */
    readonly contextual?: boolean | undefined
    /** Scheme compiled into this module's callables. Recompile to select another scheme. */
    readonly colorScheme: StyleSheet.ColorScheme
    /** Stable source identity, including the TypeScript or JavaScript extension. */
    readonly moduleId: string
    /** Shared local style and variants authoring. */
    readonly source: string
    /** Label selected from supplied vars. Defaults to the token-fallback default table. */
    readonly set?: string | undefined
  }
  /** Executable source with immutable native data and authored source mappings. */
  type ReturnType = {
    /** Internal node replacements for syntax-tree adapters. */
    readonly [Edits.key]: readonly Edits.Edit[]
    /** Rewritten TypeScript or JavaScript preserving original exports. */
    readonly code: string
    /** Version-three source map encoded as JSON. */
    readonly map: string
    /** Set/scheme tables for definitions without variant or scalar programs. */
    readonly recipes: Readonly<Record<string, Variants.Definition>>
  }
}

/** An unsupported native source feature. */
export class CompileError extends Error {
  /** Stable namespaced diagnostic name. */
  override name = 'Native.CompileError'
}
