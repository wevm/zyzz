import * as Literal from '../internal/Literal.js'
import type * as Style from '../Style.js'

/**
 * Emits factored literal CSS without reading files or generating runtime code.
 * Shares only nonconflicting declaration domains; conflicting rules retain authored
 * order. Class lists are scoped to the complete compilation input. Empty styles
 * return an empty class list and no rule.
 * @param options - Validated, ordered definitions from Style.define.
 * @returns Frozen class and theme maps alongside stylesheet text.
 * @throws {CompileError} If declarations are invalid or class identities collide.
 */
export function compile<const name extends string>(
  options: compile.Options<name>,
): compile.ReturnType<name> {
  type Cached = {
    declaration: string
    domain: string
    message: string | undefined
  }
  const cache = new Map<string, Map<number | string, Cached>>()
  const classes = Object.create(null) as Record<name, string>
  const diagnostics: Diagnostic[] = []
  const groups = new Map<string, false | string>()
  const prepared = options.styles.styles.map((style) => {
    const declarations: string[] = []
    const domains = new Map<string, string[]>()
    for (const { property, value } of style.declarations) {
      let values = cache.get(property)
      if (!values) {
        values = new Map()
        cache.set(property, values)
      }
      let entry = values.get(value)
      if (!entry) {
        const message = Object.hasOwn(Literal.rules, property)
          ? Literal.validate(property, value)
          : 'Unsupported literal property.'
        entry = {
          declaration: message
            ? ''
            : `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`,
          domain: property.startsWith('margin')
            ? 'margin'
            : property.startsWith('padding')
              ? 'padding'
              : ['columnGap', 'gap', 'rowGap'].includes(property)
                ? 'gap'
                : property,
          message,
        }
        values.set(value, entry)
      }
      const { declaration, domain, message } = entry
      if (message) {
        diagnostics.push({
          code: 'invalid_declaration',
          message,
          path: [style.name, property],
        })
        continue
      }
      declarations.push(declaration)
      const sequence = domains.get(domain) ?? []
      sequence.push(declaration)
      domains.set(domain, sequence)
    }
    for (const [domain, sequence] of domains) {
      const previous = groups.get(domain)
      if (previous === false) continue
      const signature = sequence.join('')
      groups.set(
        domain,
        previous === undefined || previous === signature ? signature : false,
      )
    }
    return { declarations, domains, name: style.name }
  })
  const factored = prepared.map((style) => {
    const common = new Set<string>()
    for (const [domain, sequence] of style.domains)
      if (groups.get(domain) !== false)
        for (const declaration of sequence) common.add(declaration)
    const ordered = style.declarations
      .filter((declaration) => !common.has(declaration))
      .join('')
    const shared = style.declarations
      .filter((declaration) => common.has(declaration))
      .join('')
    return { name: style.name, ordered, shared }
  })
  // Sort identities only, never authored declarations or cascade order. Separate
  // prefixes keep generated base identities disjoint from encoded authored names.
  const bases = new Map(
    [...new Set(factored.map((style) => style.shared))]
      .filter(Boolean)
      .sort()
      .map((body, index) => [body, `z_base${index}`]),
  )
  const rules = new Map<string, string>()
  for (const style of factored) {
    if (!style.name || Object.hasOwn(classes, style.name)) {
      diagnostics.push({
        code: 'invalid_name',
        message: 'Style names must be nonempty and unique.',
        path: [style.name],
      })
      continue
    }
    const { ordered, shared } = style
    const names: string[] = []
    // Shared domains have identical ordered declarations everywhere they occur.
    // All conflicting domains retain a distinct rule per authored style.
    for (const [body, sharedRule] of [
      [shared, true],
      [ordered, false],
    ] as const) {
      if (!body) continue
      const identity = sharedRule ? bases.get(body)! : `z-${encode(style.name)}`
      const previous = rules.get(identity)
      if (previous !== undefined && previous !== body)
        diagnostics.push({
          code: 'identity_collision',
          message: 'Distinct rules produced the same class identifier.',
          path: [style.name],
        })
      rules.set(identity, body)
      names.push(identity)
    }
    classes[style.name] = names.join(' ')
  }
  if (diagnostics.length) throw new CompileError(diagnostics)
  return Object.freeze({
    classes: Object.freeze(classes),
    css: [...rules].map(([name, body]) => `.${name}{${body}}`).join('\n'),
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
    /** Readable space-separated class identifiers per authored style. */
    readonly classes: Readonly<Record<name, string>>
    /** Factored CSS preserving cascade behavior, without reset or layers. */
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

// Encoding underscores and delimiters makes the value form injective.
function encode(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )
}
