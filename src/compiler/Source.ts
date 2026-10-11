/**
 * Extracts literal styles and local themes through lexical source analysis.
 * @module
 */
import * as Addon from '../internal/Addon.js'
import type * as Binding from '../internal/Binding.js'
import type * as StaticRecipe from '../internal/Recipe.js'
import type * as RuleReference from '../internal/RuleReference.js'
import type * as Shorthands from '../internal/Shorthands.js'
import type * as Theme from '../internal/Theme.js'
import type * as Composition from '../runtime/Composition.js'
import type * as Recipe from '../runtime/Recipe.js'
import type * as Style from '../Style.js'
import type * as Vars from '../Vars.js'
import type * as Css from '../web/Css.js'
import type { cssFunction } from '../web/cssFunction.js'
import type * as Namespace from '../web/internal/Namespace.js'
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
  /** Alias targets retained for declaration source locations. */
  readonly shorthands?: Shorthands.Map | undefined
  /** Emitted typography field counts keyed by authored property offsets. */
  readonly typography?: ReadonlyMap<number, number> | undefined
  /** Emitted typography query counts keyed by authored property offsets. */
  readonly typographyQueries?: ReadonlyMap<number, number> | undefined
  /** Native HTML attribute output selected by the bound configuration. */
  readonly output?: 'html' | undefined
  /** Typed runtime slots for callback definitions. */
  readonly slots?: Readonly<Record<string, Binding.Reference>> | undefined
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

/** A static stylesheet effect call replaced by its compiled data. */
type ContributionCall = {
  /** Exported binding offset of a named factory result. */
  readonly binding?: number | undefined
  /** Exclusive UTF-16 offset of the complete call. */
  readonly end: number
  /** Whether the factory result is exported. */
  readonly exported?: boolean | undefined
  /** CSS function signature of a `cssFunction` call. */
  readonly function?: ThemeCall['function']
  /** Stylesheet factory that created the effect. */
  readonly kind: string
  /** Authored binding of a named factory result. */
  readonly name?: string | undefined
  /** Inclusive UTF-16 offset of the complete call. */
  readonly start: number
}

/** Local bound-authoring initializer replaced while retaining its inferred type. */
type ThemeAlias = ThemeCall & {
  /** Ordered authoring members replaced in a shared destructuring initializer. */
  readonly bindings?: readonly ('style' | 'variants')[] | undefined
  /** Whether the initializer supplies destructured authoring bindings. */
  readonly destructured: boolean
  /** Retains an immutable theme/configuration alias value with an explicit type. */
  readonly retained?: boolean | undefined
}

/** Theme factory span and generated scope key. */
type ThemeCall = {
  /** Whether the compiled configuration supplies root controls. */
  readonly appearance?: boolean | undefined
  /** Legacy packed catalog exposes members but lacks callable-selection capability. */
  readonly catalogOnly?: boolean | undefined
  readonly directVariables?: boolean | undefined
  /** Exclusive source offset. */
  readonly end: number
  /** Static CSS function signature shared during extraction and packed serialization. */
  readonly function?:
    | {
        parameters: readonly cssFunction.Parameter[]
        returns: cssFunction.Syntax
      }
    | undefined
  /** Bound root initialization script export. */
  readonly initialization?: boolean | undefined
  /** JSON-encoded member path tuples and their compiled scope keys. */
  readonly members?: Readonly<Record<string, string>> | undefined
  /** Stable module/binding scope key. */
  readonly name: string
  /** Whether native defineConfig retains a typed React Provider. */
  readonly nativeProvider?: boolean | undefined
  /** Validated inline configuration options retained for packed declarations. */
  readonly options?: Readonly<Record<string, unknown>> | undefined
  readonly output?: 'html' | undefined
  /** Whether this bound authoring alias declares recipes. */
  readonly recipe?: boolean | undefined
  /** Named stylesheet identity domain. */
  readonly reference?: RuleReference.Kind | undefined
  /** Bound root controls export. */
  readonly root?: boolean | undefined
  /** Whether the compiled configuration supplies initialization. */
  readonly script?: boolean | undefined
  /** Config helper represented by this linked binding. */
  readonly selection?: boolean | undefined
  /** Inclusive source offset. */
  readonly start: number
  /** Literal token contract retained in rewritten TypeScript type assertions. */
  readonly tokenType: string
  /** Complete authoring type retained for configuration declarations. */
  readonly type?: string | undefined
  readonly variableConfig?: boolean | undefined
  readonly variableMappings?: Vars.Mappings | false | undefined
  /** Canonical defining module for multi-entry variable contracts. */
  readonly variableOwner?: string | undefined
  /** Portable explicit variable references. */
  readonly variables?: Readonly<Record<string, Binding.Reference>> | undefined
  readonly variableSet?: boolean | undefined
}

/** An explicit variable contract replaced by fixed slot data. */
type VariableCall = {
  /** Exclusive source offset. */
  readonly end: number
  /** Whether the consumer supplied a portable variable identity. */
  readonly explicit?: boolean | undefined
  /** Fixed scalar reference retained in portable metadata. */
  readonly slots: Readonly<Record<string, Binding.Reference>>
  /** Inclusive source offset. */
  readonly start: number
}

/** A readonly variable argument consumed by a native React hook. */
type VarsRead = {
  /** Owning configuration fallback. */
  readonly defaultVars: string
  /** Exclusive source offset. */
  readonly end: number
  /** Stable configuration identity for graph-owned native profiles. */
  readonly owner: string
  /** Inclusive source offset. */
  readonly start: number
  /** A standalone definition that does not select a named catalog entry. */
  readonly unnamed: boolean
  /** Complete compatible variable alternatives. */
  readonly vars: Readonly<Record<string, Theme.Definition>>
}

/**
 * Extracts direct style calls and local Theme definitions imported from zyzz.
 * Parses TypeScript and JSX in the Rust compiler without reading files, loading config, or
 * evaluating source. The returned calls carry no syntax trees.
 * @param options - Source text and a portable package-relative module identity.
 * @returns Frozen style/theme definitions and rewrite spans. Source text is unchanged.
 * @throws {ExtractError} For syntax errors, unsupported imported references, or invalid literals.
 */
export function extract(options: extract.Options): extract.ReturnType {
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
    { compiler: options.compiler },
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
    /** Complete module text, parsed as TypeScript with JSX. */
    readonly source: string
  }

  /** Ordered public compiler input and spans for later rewriting. */
  type ReturnType = {
    /** Readonly native variable arguments and their complete catalogs. */
    readonly nativeVars?: readonly VarsRead[] | undefined
    /** Module-owned namespace bindings retained when contributions are shared. */
    readonly namespaces?: readonly Namespace.Definition[] | undefined
    /** Static stylesheet effects and their source replacements. */
    readonly contributionStarts?: readonly number[] | undefined
    readonly contributions?: readonly Css.Contribution[] | undefined
    readonly contributionCalls?: readonly ContributionCall[] | undefined
    /** Explicit variable contracts replaced by fixed slot data. */
    readonly variableCalls?: readonly VariableCall[] | undefined
    /** Direct calls in source order. */
    readonly calls: readonly Call[]
    /** Validated definitions accepted by Css.compile. */
    readonly styles: Style.Definition
    /** Local bound-authoring initializers and their retained token types. */
    readonly themeAliases: readonly ThemeAlias[]
    /** Configuration identities retaining their root controls. */
    readonly themeAppearances?: readonly string[] | undefined
    /** Configuration identities retaining their initialization helper. */
    readonly themeScripts?: readonly string[] | undefined
    /** Configuration identities whose theme selector is called, passed, or bound. */
    readonly themeSelections?: readonly string[] | undefined
    /** Local factory spans replaced by compiled scope data. */
    readonly themeCalls: readonly ThemeCall[]
    /** Scope reads replaced by class constants. */
    readonly staticThemeReferences?:
      | readonly {
          readonly start: number
          readonly end: number
          readonly value: string
        }[]
      | undefined
    readonly themeReferences: readonly Pick<
      ThemeCall,
      'end' | 'name' | 'start'
    >[]
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
