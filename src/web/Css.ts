/**
 * Emits deterministic CSS, class mappings, and live theme scopes from ordered styles.
 * @module
 */
import * as Literal from '../internal/Literal.js'
import * as Token from '../internal/Token.js'
import type * as Style from '../Style.js'
import type * as Theme from '../Theme.js'
import * as Themes from './internal/Themes.js'

/**
 * Emits factored literal and theme-reference CSS without reading files or generating runtime code.
 * Shares only nonconflicting declaration domains; conflicting rules retain authored
 * order by default. Independent composition deduplicates complete applications.
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
  let theme: ReturnType<typeof Themes.create> | undefined
  type Cached = {
    declaration: string
    domain: string
    message: string | undefined
  }
  const cache = new Map<string, Map<number | string, Cached>>()
  const references = new Map<object, boolean>()
  function isReference(value: unknown): value is Token.Reference {
    if (typeof value !== 'object' || value === null) return false
    const previous = references.get(value)
    if (previous !== undefined) return previous
    const result = Token.is(value)
    references.set(value, result)
    return result
  }
  const classes = Object.create(null) as Record<name, string>
  const diagnostics: Diagnostic[] = []
  const groups = new Map<string, false | string>()
  // Logical dimensions may alias either physical axis in inherited writing modes.
  // Preserve physical-only factoring when no logical dimension is authored.
  const logicalSizing = options.styles.styles.some((style) =>
    style.declarations.some(({ property }) =>
      /^(min|max)?(blockSize|inlineSize)$/i.test(property),
    ),
  )
  type Prepared = {
    declarations: readonly Cached[]
    ordered: string
    shared: string
  }
  const unique = new Map<string, Prepared>()
  const prepared = options.styles.styles.map((style) => {
    let body = ''
    const declarations: Cached[] = []
    for (const { important, property, value: input } of style.declarations) {
      if (important !== undefined && typeof important !== 'boolean') {
        diagnostics.push({
          code: 'invalid_declaration',
          message: 'Declaration importance must be boolean.',
          path: [style.name, property],
        })
        continue
      }
      const token = isReference(input)
      let value: number | string
      try {
        value = token
          ? (theme ??= Themes.create()).serialize(input, property)
          : (input as number | string)
      } catch (error) {
        diagnostics.push({
          code: 'invalid_declaration',
          message: (error as Error).message,
          path: [style.name, property],
        })
        continue
      }
      const key = `${important ? 1 : 0}:${property}`
      let values = cache.get(key)
      if (!values) {
        values = new Map()
        cache.set(key, values)
      }
      let entry = values.get(value)
      if (!entry) {
        const message = (() => {
          if (Object.hasOwn(Literal.rules, property)) {
            if (token) {
              return undefined
            }
            return Literal.validate(property, value)
          }
          return 'Unsupported literal property.'
        })()
        entry = {
          declaration: message
            ? ''
            : `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}${important ? '!important' : ''};`,
          domain: (() => {
            if (property.startsWith('backgroundPosition'))
              return 'backgroundPosition'
            if (property.startsWith('border')) {
              if (property.endsWith('Color')) {
                return 'borderColor'
              }
              if (property.endsWith('Style')) {
                return 'borderStyle'
              }
              if (property.endsWith('Width')) {
                return 'borderWidth'
              }
              return 'borderRadius'
            }
            if (['flexDirection', 'flexFlow', 'flexWrap'].includes(property))
              return 'flexFlow'
            if (/^(pageBreak|break)(After|Before|Inside)$/.test(property))
              return property.replace('pageBreak', 'break')
            if (property.startsWith('fontSynthesis')) return 'fontSynthesis'
            if (
              [
                'whiteSpace',
                'whiteSpaceCollapse',
                'textWrap',
                'textWrapMode',
                'textWrapStyle',
              ].includes(property)
            )
              return 'whiteSpace'
            if (['wordWrap', 'overflowWrap'].includes(property))
              return 'overflowWrap'
            if (property.startsWith('margin')) {
              return 'margin'
            }
            if (property.startsWith('padding')) {
              return 'padding'
            }
            if (
              property === 'overflow' ||
              property === 'overflowX' ||
              property === 'overflowY' ||
              property === 'overflowBlock' ||
              property === 'overflowInline'
            ) {
              return 'overflow'
            }
            if (property.startsWith('overscrollBehavior')) {
              return 'overscrollBehavior'
            }
            if (property.startsWith('scrollMargin')) {
              return 'scrollMargin'
            }
            if (property.startsWith('scrollPadding')) {
              return 'scrollPadding'
            }
            if (['columnGap', 'gap', 'rowGap'].includes(property)) {
              return 'gap'
            }
            if (/^(inset|top$|right$|bottom$|left$)/.test(property)) {
              return 'inset'
            }
            if (
              logicalSizing &&
              /^(min|max)?(width|height|blockSize|inlineSize)$/i.test(property)
            ) {
              if (property.startsWith('min')) {
                return 'min-size'
              }
              if (property.startsWith('max')) {
                return 'max-size'
              }
              return 'size'
            }
            return property
          })(),
          message,
        }
        values.set(value, entry)
      }
      const { declaration, message } = entry
      if (message) {
        diagnostics.push({
          code: 'invalid_declaration',
          message,
          path: [style.name, property],
        })
        continue
      }
      body += declaration
      declarations.push(entry)
    }
    const previous = unique.get(body)
    if (previous) return { content: previous, name: style.name }

    const content = { declarations, ordered: '', shared: '' }
    unique.set(body, content)
    const domains = new Map<string, string>()
    for (const { declaration, domain } of declarations)
      domains.set(domain, (domains.get(domain) ?? '') + declaration)
    for (const [domain, signature] of domains) {
      const previous = groups.get(domain)
      if (previous === false) continue
      groups.set(
        domain,
        previous === undefined || previous === signature ? signature : false,
      )
    }
    return { content, name: style.name }
  })
  // Equivalent validated bodies share factoring work, including repeated tokens.
  // Validation still visits every input to retain diagnostics and live contracts.
  for (const content of unique.values())
    for (const { declaration, domain } of content.declarations) {
      if (groups.get(domain) === false) content.ordered += declaration
      else content.shared += declaration
    }
  // Sort identities only, never authored declarations or cascade order. Separate
  // prefixes keep generated base identities disjoint from encoded authored names.
  const bases = new Map(
    [...new Set([...unique.values()].map((style) => style.shared))]
      .filter(Boolean)
      .sort()
      .map((body, index) => [
        body,
        `${options.composition === 'independent' ? 'base_' : 'z_base'}${index}`,
      ]),
  )
  const identical = new Map<string, string>()
  const rules = new Map<string, string>()
  for (const style of prepared) {
    if (!style.name || Object.hasOwn(classes, style.name)) {
      diagnostics.push({
        code: 'invalid_name',
        message: 'Style names must be nonempty and unique.',
        path: [style.name],
      })
      continue
    }
    const { ordered, shared } = style.content
    const names: string[] = []
    // Shared domains have identical ordered declarations everywhere they occur.
    // Ordered composition retains a distinct rule per authored style for conflicts.
    for (const [body, sharedRule] of [
      [shared, true],
      [ordered, false],
    ] as const) {
      if (!body) continue
      const identity = (() => {
        if (sharedRule) {
          return bases.get(body)!
        }
        if (options.composition === 'independent') {
          return identifier(style.name)
        }
        return `z-${encode(style.name)}`
      })()
      // Independent styles are already complete applications. Reusing a rule
      // cannot affect another application, but would change raw A/B/A composition.
      if (!sharedRule && options.composition === 'independent') {
        const canonical = identical.get(body)
        if (canonical) {
          names.push(canonical)
          continue
        }
        identical.set(body, identity)
      }
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
  let scopes: ReturnType<NonNullable<typeof theme>['emit']>
  try {
    scopes =
      theme || options.themes
        ? (theme ??= Themes.create()).emit(options.themes ?? {})
        : { classes: Object.freeze({}), css: '' }
  } catch (error) {
    throw new CompileError([
      {
        code: 'invalid_theme',
        message: (error as Error).message,
        path: ['themes'],
      },
    ])
  }
  return Object.freeze({
    classes: Object.freeze(classes),
    css: [scopes.css, ...[...rules].map(([name, body]) => `.${name}{${body}}`)]
      .filter(Boolean)
      .join('\n'),
    themes: scopes.classes as Readonly<Record<themeName, string>>,
  })
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
    /**
     * Defaults to ordered, preserving stylesheet precedence across combined class lists.
     * Independent deduplicates complete applications; its class lists must not be
     * combined with each other. Resolve composition before compiling in this mode.
     */
    readonly composition?: 'independent' | 'ordered' | undefined
    /** Ordered definitions; no themes or source adapter is required. */
    readonly styles: Style.Definition<name>
    /** Named scopes; only variables referenced by these styles are emitted. */
    readonly themes?: Readonly<Record<themeName, Theme.Definition>> | undefined
  }
  /** Static web artifacts with precisely inferred authored names. */
  type ReturnType<
    name extends string = string,
    themeName extends string = string,
  > = {
    /** Readable space-separated class identifiers per authored style. */
    readonly classes: Readonly<Record<name, string>>
    /** Factored CSS preserving cascade behavior, without reset or layers. */
    readonly css: string
    /** Scope classes keyed by the supplied theme labels. */
    readonly themes: Readonly<Record<themeName, string>>
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
    | 'invalid_theme'
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

function identifier(value: string): string {
  return encode(value).replace(
    /^[0-9]|^-(?=[0-9]|$)/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )
}
