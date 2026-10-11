/**
 * Emits deterministic CSS, class mappings, and live theme scopes from ordered styles.
 * The Rust compiler emits the CSS: Node runs its native addon and browsers its WebAssembly build.
 * @module
 */
import type * as Style from '../Style.js'
import type * as Vars from '../Vars.js'
import type * as Theme from '../internal/Theme.js'
import * as ClassName from './internal/ClassName.js'
import type * as Contributions from './internal/Contributions.js'
import * as Engine from './internal/Engine.js'
import type * as Themes from './internal/Themes.js'
import * as Wire from './internal/Wire.js'

/** Explicit ordered stylesheet contribution data. */
export type Contribution = Contributions.Definition

/**
 * Emits atomic or grouped CSS without reading files or generating runtime code.
 * Shares only nonconflicting declaration domains; conflicting rules retain authored
 * order by default. Independent composition deduplicates complete applications and
 * shares equal atomic domain declarations under short names.
 * Class lists are scoped to the complete compilation input. Empty styles
 * return an empty class list and no rule.
 * @param options - Validated, ordered definitions from Style.define.
 * @returns Frozen class and theme maps alongside stylesheet text.
 * @throws {CompileError} If declarations or themes are invalid, or class identities collide.
 */
export function compile<
  const name extends string,
  const themeName extends string = never,
>(
  options: compile.Options<name, themeName>,
): compile.ReturnType<name, themeName> {
  const input = Wire.encode(options as compile.Options)

  // A supplied unit scope receives the naming decisions the engine made against its table.
  return Wire.decode(
    Engine.call('css.compile', input),
    options[ClassName.units],
  ) as compile.ReturnType<name, themeName>
}

/** Input and output contracts for literal compilation. */
export declare namespace compile {
  /** Structured failure returned by literal compilation. */
  type ErrorType = CompileError

  /** Environment-independent compiler input. */
  type Options<
    name extends string = string,
    themeName extends string = string,
  > = {
    /** Separates generated token rules for hosts with independent CSS resources. */
    readonly [Themes.shared]?: 'all' | 'defaults' | undefined
    /** Readable source bindings and consumer-owned configuration namespaces. */
    readonly [ClassName.labels]?: ClassName.Labels | undefined
    /** Names shared independent atomic rules, with one name table across a graph's modules. */
    readonly [ClassName.units]?: ClassName.Units | undefined
    /** Fixed class identities used by CSS-only consumers. */
    readonly names?: Readonly<Record<string, string>> | undefined
    /**
     * Ordered by default, preserving precedence across combined class lists.
     * Independent shares applications and atomic declarations, so resolve
     * composition first and never combine its lists.
     */
    readonly composition?: 'independent' | 'ordered' | undefined
    /** Eager module-level stylesheet contributions, supplied as static data. */
    readonly contributions?: readonly Contribution[] | undefined
    /** CSS representation; atomic declarations are the default. */
    readonly cssOutput?: 'atomic' | 'grouped' | undefined
    /** Retains live definitions for development updates. */
    readonly development?: boolean | undefined
    /**
     * Emit the `color-scheme` selection classes. Set by modules whose runtime
     * helpers can apply a scheme, so lowered `light-dark()` resolves there.
     */
    readonly schemes?: boolean | undefined
    /** Explicit consumer-owned namespace for independently delivered stylesheets. */
    readonly scope?: string | undefined
    /** Ordered definitions; no themes or source adapter is required. */
    readonly styles: Style.Definition<name>
    /** Named scopes; only variables referenced by these styles are emitted. */
    readonly vars?:
      | Readonly<Record<themeName, Theme.Definition | Vars.Definition>>
      | undefined
  }

  /** Static web artifacts with precisely inferred authored names. */
  type ReturnType<
    name extends string = string,
    themeName extends string = string,
  > = {
    /** Exact emitted rule bodies retained for graph-wide collision diagnostics. */
    readonly [ClassName.rules]: Readonly<Record<string, string>>
    /** Shared rule names chosen by this compilation, for graph cache validation. */
    readonly [ClassName.units]: ClassName.Units['used']
    /** Shared token resources omitted from this module's stylesheet. */
    readonly [Themes.shared]?: readonly Themes.Resource[] | undefined
    /** Contribution text separated for graph-wide hoisting. */
    readonly contributionCss?: string | undefined
    /** Ordinary scope and style rules when contributions were supplied. */
    readonly scopedCss?: string | undefined
    /** Readable space-separated class identifiers per authored style. */
    readonly classes: Readonly<Record<name, string>>
    /** Factored CSS preserving cascade behavior, without reset or layers. */
    readonly css: string
    /** Scope classes keyed by the supplied theme labels. */
    readonly vars: Readonly<Record<themeName, string>>
  }
}

/** Aggregated literal compilation diagnostics in authored traversal order. */
export class CompileError extends Error {
  /** Copies diagnostic paths and freezes all caller-visible diagnostic data. */
  constructor(diagnostics: readonly Diagnostic[]) {
    super(
      diagnostics
        .map((item) => `${JSON.stringify(item.path)}: ${item.message}`)
        .join('\n'),
    )
    this.diagnostics = Object.freeze(
      diagnostics.map((item) =>
        Object.freeze({
          ...item,
          path: Object.freeze([...item.path]),
        }),
      ),
    )
  }
  /** Frozen failures with unambiguous component paths. */
  readonly diagnostics: readonly Diagnostic[]
  /** Stable namespaced error identifier. */
  override name = 'Css.CompileError'
}

/** A literal compilation failure. */
export type Diagnostic = {
  /** Stable failure category. */
  readonly code:
    | 'identity_collision'
    | 'invalid_declaration'
    | 'invalid_name'
    | 'invalid_output'
    | 'invalid_theme'
  /** Explanation of the unsupported input. */
  readonly message: string
  /** Authored style name, followed by a property when applicable. */
  readonly path: readonly string[]
}
