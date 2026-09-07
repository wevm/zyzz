import * as Literal from '../internal/Literal.js'
import type * as Style from '../Style.js'

/**
 * Emits grouped literal CSS without reading files or generating runtime code.
 * Preserves style and declaration order. Names depend only on the authored name
 * and ordered declarations. Empty styles receive a class and no CSS rule.
 * @param options - Validated, ordered definitions from Style.define.
 * @returns Frozen class and theme maps alongside stylesheet text.
 * @throws {CompileError} If declarations are invalid or class identities collide.
 */
export function compile<const name extends string>(
  options: compile.Options<name>,
): compile.ReturnType<name> {
  const classes = Object.create(null) as Record<name, string>
  const diagnostics: Diagnostic[] = []
  const identities = new Map<string, string>()
  const rules: string[] = []
  for (const style of options.styles.styles) {
    if (!style.name || Object.hasOwn(classes, style.name)) {
      diagnostics.push({
        code: 'invalid_name',
        message: 'Style names must be nonempty and unique.',
        path: [style.name],
      })
      continue
    }
    const declarations: string[] = []
    for (const { property, value } of style.declarations) {
      const message = Object.hasOwn(Literal.rules, property)
        ? Literal.validate(property, value)
        : 'Unsupported literal property.'
      if (message) {
        diagnostics.push({
          code: 'invalid_declaration',
          message,
          path: [style.name, property],
        })
        continue
      }
      declarations.push(
        `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`,
      )
    }
    const body = declarations.join('')
    // Encode underscores too, so authored escape-like names remain distinct.
    const label = style.name.replace(
      /[^a-zA-Z0-9-]/g,
      (character) => `_${character.charCodeAt(0).toString(16)}_`,
    )
    const className = `zyzz-${label}-${hash(body)}`
    const identity = JSON.stringify([style.name, body])
    const previous = identities.get(className)
    if (previous !== undefined && previous !== identity)
      diagnostics.push({
        code: 'identity_collision',
        message: 'Distinct rules produced the same class identifier.',
        path: [style.name],
      })
    identities.set(className, identity)
    classes[style.name] = className
    if (body) rules.push(`.${className}{${body}}`)
  }
  if (diagnostics.length) throw new CompileError(diagnostics)
  return Object.freeze({
    classes: Object.freeze(classes),
    css: rules.join('\n'),
    themes: Object.freeze({}),
  })
}

/** Input and output contracts for literal compilation. */
export declare namespace compile {
  /** Structured failure returned by literal compilation. */
  type ErrorType = CompileError

  /** Environment-independent compiler input. */
  type Options<name extends string = string> = {
    /** Ordered definitions; no themes or source adapter is required. */
    readonly styles: Style.Definition<name>
  }
  /** Static web artifacts with precisely inferred authored names. */
  type ReturnType<name extends string = string> = {
    /** One readable class identifier per authored style. */
    readonly classes: Readonly<Record<name, string>>
    /** Grouped CSS in authored order, without reset, layers, or minification. */
    readonly css: string
    /** Empty until theme compilation is supported. */
    readonly themes: Readonly<Record<string, never>>
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
  readonly code: 'identity_collision' | 'invalid_declaration' | 'invalid_name'
  /** Explanation of the unsupported input. */
  readonly message: string
  /** Authored style name, followed by a property when applicable. */
  readonly path: readonly string[]
}

// Two independently seeded 32-bit streams; no platform crypto or shared state.
function hash(value: string): string {
  let first = 2166136261
  let second = 2246822507
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 3266489909)
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
}
