/**
 * Extracts literal styles and local themes through lexical source analysis.
 * @module
 */
import * as Addon from '../internal/Addon.js'
import type * as Ast from '@oxc-project/types'
import type * as Composition from '../runtime/Composition.js'
import type * as Contributions from './internal/Contributions.js'
import type * as Css from '../web/Css.js'
import type * as Dynamic from './internal/Dynamic.js'
import * as Extraction from './internal/Extraction.js'
import type * as Namespace from '../web/internal/Namespace.js'
import type * as Recipe from '../runtime/Recipe.js'
import type * as Shorthands from '../internal/Shorthands.js'
import type * as StaticRecipe from '../internal/Recipe.js'
import type * as Style from '../Style.js'
import type * as Theme from '../internal/Theme.js'
import * as Themes from './internal/Themes.js'
import type * as Vars from './internal/Vars.js'
import * as Wire from './internal/Wire.js'

/** A direct definition call available for a later source rewriter. */
export type Call = {
  /** Resolved native alternatives for this authoring contract. */
  readonly nativeContext?:
    | {
        /** Default label selected when the provider omits its theme. */
        readonly defaultVars: string
        /** Compatible alternatives from the owning configuration. */
        readonly vars: Readonly<Record<string, Theme.Definition>>
      }
    | undefined
  /** Class identity available without source rewriting. */
  readonly portable?: string | undefined
  /** Readable authored binding used for contextual CSS names. */
  readonly cssName?: string | undefined
  /** Explicit configuration namespace for emitted CSS. */
  readonly cssNamespace?: string | undefined
  /** Flattened definition identities for nested compositions. */
  readonly portableInputs?: readonly string[] | undefined
  /** Ownership retained by a separately compiled callable. */
  readonly ownership?: Composition.Owner | undefined
  /** CSS-only presence alternative for a runtime composition. */
  readonly compositionCase?: boolean | undefined
  /** Names of precompiled presence alternatives in bitmask order. */
  readonly compositionCases?: readonly string[] | undefined
  /** Fixed runtime applications over an already resolved CSS sequence. */
  readonly runtimeComposition?:
    | readonly {
        /** Original resolved application start retained for selective HTML preparation. */
        readonly applicationStart?: number | undefined
        /** Presence bit for a conditional argument. */
        readonly condition?: number | undefined
        /** Application argument end. */
        readonly end: number
        /** Replaced generated class owner. */
        readonly name: string
        /** Attribute and private variable ownership. */
        readonly owners: readonly Composition.Owner[]
        /** Application argument start. */
        readonly start: number
      }[]
    | undefined
  /** Binding reads preserved by compile-time composition. */
  readonly composition?: readonly string[] | undefined
  /** Finite recipe selection metadata, with all alternatives retained in CSS. */
  readonly recipe?: Recipe.Definition | undefined
  /** Ordered dynamic alternatives retained with scalar binding references. */
  readonly dynamicRecipe?: StaticRecipe.Definition | undefined
  /** Ordered static alternatives retained without CSS selector lowering. */
  readonly staticRecipe?: StaticRecipe.Definition | undefined
  /** Typed payload signatures retained across transformed declarations. */
  readonly recipeTypes?:
    | { readonly [axis: string]: { readonly [choice: string]: string } }
    | undefined
  /** Stable selector identity retained independently of declaration deduplication. */
  readonly identity?: string | undefined
  /** Expanded immutable source data retained for declaration mapping. */
  readonly body?: Ast.ObjectExpression | undefined
  /** Alias targets retained for declaration source locations. */
  readonly shorthands?: Shorthands.Map | undefined
  /** Emitted typography field counts keyed by authored property offsets. */
  readonly typography?: ReadonlyMap<number, number> | undefined
  /** Emitted typography query counts keyed by authored property offsets. */
  readonly typographyQueries?: ReadonlyMap<number, number> | undefined
  /** Native HTML attribute output selected by the bound configuration. */
  readonly output?: 'html' | undefined
  /** Typed runtime slots for callback definitions. */
  readonly slots?: Dynamic.Slots | undefined
  /** Authored scalar input type retained in packed declarations. */
  readonly valuesType?: string | undefined
  /** Exclusive UTF-16 offset of the complete call. */
  readonly end: number
  /** Matching name in the extracted style definition. */
  readonly name: string
  /** Inclusive UTF-16 offset of the complete call. */
  readonly start: number
}

/** A source-owned extraction failure. */
export type Diagnostic = {
  /** Stable failure category. */
  readonly code:
    | 'invalid_literal'
    | 'invalid_module'
    | 'syntax_error'
    | 'unsupported_syntax'
  /** Exclusive UTF-16 source offset. */
  readonly end: number
  /** Explanation of the supported input boundary. */
  readonly message: string
  /** Portable module identity supplied by the host. */
  readonly source: string
  /** Inclusive UTF-16 source offset. */
  readonly start: number
}

/**
 * Extracts direct style calls and local Theme definitions imported from zyzz.
 * Parses TypeScript and JSX in the Rust compiler without reading files, loading config, or
 * evaluating source. Source graph contexts, which carry another module's syntax, use the
 * TypeScript analysis. The returned calls carry no syntax trees.
 * @param options - Source text and a portable package-relative module identity.
 * @returns Frozen style/theme definitions and rewrite spans. Source text is unchanged.
 * @throws {ExtractError} For syntax errors, unsupported imported references, or invalid literals.
 */
export function extract(options: extract.Options): extract.ReturnType {
  if (options[Themes.context]) return Extraction.extract(options)

  return Wire.decode(
    Addon.load().call(
      'source.extract',
      JSON.stringify({
        compiler: options.compiler,
        moduleId: options.moduleId,
        source: options.source,
        target: options.target,
      }),
    ),
  )
}

/** Input and output of source extraction. */
export declare namespace extract {
  /** Structured source failure. */
  type ErrorType = ExtractError

  /** Source text supplied by an adapter. */
  type Options = {
    /** Native extraction retains applications for native props composition. */
    readonly target?: 'native' | 'web' | undefined
    /** Collect portable runtime identities when source rewriting is disabled. */
    readonly compiler?: boolean | undefined
    /** Portable identity including package and module path; no filesystem access occurs. */
    readonly moduleId: string
    /** Compiler-owned graph context. */
    readonly [Themes.context]?: Themes.Context | undefined
    /** Complete module text, parsed as TypeScript with JSX. */
    readonly source: string
  }

  /** Ordered public compiler input and spans for later rewriting. */
  type ReturnType = {
    /** Readonly native variable arguments and their complete catalogs. */
    readonly nativeVars?: readonly Themes.VarsRead[] | undefined
    /** Module-owned namespace bindings retained when contributions are shared. */
    readonly namespaces?: readonly Namespace.Definition[] | undefined
    /** Static stylesheet effects and their source replacements. */
    readonly contributionStarts?: readonly number[] | undefined
    readonly contributions?: readonly Css.Contribution[] | undefined
    readonly contributionCalls?: readonly Contributions.Call[] | undefined
    /** Explicit variable contracts replaced by fixed slot data. */
    readonly variableCalls?: readonly Vars.Call[] | undefined
    /** Direct calls in source order. */
    readonly calls: readonly Call[]
    /** Validated definitions accepted by Css.compile. */
    readonly styles: Style.Definition
    /** Local bound-authoring initializers and their retained token types. */
    readonly themeAliases: readonly Themes.Alias[]
    /** Configuration identities retaining their root controls. */
    readonly themeAppearances?: readonly string[] | undefined
    /** Configuration identities retaining their initialization helper. */
    readonly themeScripts?: readonly string[] | undefined
    /** Configuration identities whose theme selector is called, passed, or bound. */
    readonly themeSelections?: readonly string[] | undefined
    /** Local factory spans replaced by compiled scope data. */
    readonly themeCalls: readonly Themes.Call[]
    /** Scope reads replaced by class constants. */
    readonly staticThemeReferences?:
      | readonly {
          readonly start: number
          readonly end: number
          readonly value: string
        }[]
      | undefined
    readonly themeReferences: readonly Themes.Reference[]
    /** Resolved authoring exports when extracted as part of a source graph. */
    readonly themeExports?: Readonly<Record<string, Themes.Link>> | undefined
    /** Stable scope keys and validated local theme definitions. */
    readonly vars: Readonly<Record<string, Theme.Definition>>
  }
}

/** Aggregated source diagnostics; no partial result is returned. */
export class ExtractError extends Error {
  /** Freezes source diagnostics in source order. */
  constructor(diagnostics: readonly Diagnostic[]) {
    const ordered = [...diagnostics].sort((a, b) => a.start - b.start)

    super(
      ordered
        .map((item) => `${item.source}:${item.start}: ${item.message}`)
        .join('\n'),
    )
    this.diagnostics = Object.freeze(
      ordered.map((item) => Object.freeze({ ...item })),
    )
  }
  /** Immutable source failures. */
  readonly diagnostics: readonly Diagnostic[]
  /** Stable namespaced error identifier. */
  override name = 'Source.ExtractError'
}
