/**
 * Emits deterministic CSS, class mappings, and live theme scopes from ordered styles.
 * @module
 */
import * as ClassName from './internal/ClassName.js'
import * as Contributions from './internal/Contributions.js'
import * as Binding from '../internal/Binding.js'
import * as Cascade from '../internal/Cascade.js'
import * as Literal from '../internal/Literal.js'
import * as Token from '../internal/Token.js'
import type * as Style from '../Style.js'
import type * as Theme from '../Theme.js'
import * as Themes from './internal/Themes.js'

/** Explicit ordered stylesheet contribution data. */
export type Contribution = Contributions.Definition

/**
 * Emits atomic or grouped CSS without reading files or generating runtime code.
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

  const references = new Map<object, boolean>()

  function isReference(value: unknown): value is Token.Reference {
    if (typeof value !== 'object' || value === null) return false

    const previous = references.get(value)
    if (previous !== undefined) return previous

    const result = Token.is(value)

    references.set(value, result)

    return result
  }

  // Only primitive declaration lists can be interned without erasing token identity.
  const repeated = new Map<string, Style.NamedStyle>()

  const canonicalStyles = options.styles.styles.map((style) => {
    if (
      'rules' in style ||
      style.declarations.some(
        (declaration) => typeof declaration.value === 'object',
      )
    )
      return style

    const key = JSON.stringify(style.declarations)
    const previous = repeated.get(key)
    if (previous) return previous

    repeated.set(key, style)

    return style
  })

  const analyzed = [...new Set(canonicalStyles)]
  const classes = Object.create(null) as Record<name, string>
  const diagnostics: Diagnostic[] = []
  const groups = new Map<string, false | string>()
  const nestedComposition = options.styles.styles.some((style) => style.rules)

  // Logical dimensions may alias either physical axis in inherited writing modes.
  // Preserve physical-only factoring when no logical dimension is authored.
  const logicalSizing = analyzed.some((style) =>
    style.declarations.some(({ property }) =>
      /^(min|max)?(blockSize|inlineSize)$/i.test(property),
    ),
  )

  const resets = analyzed.some((style) =>
    style.declarations.some(({ property }) => property === 'all'),
  )
  const combinedLines = new Set<string>()

  for (const style of analyzed)
    for (const { property } of style.declarations)
      if (Literal.rule(property)?.kind === 'line') {
        const canonical =
          property in Literal.aliases
            ? Literal.aliases[property as keyof typeof Literal.aliases]
            : property

        combinedLines.add(canonical.startsWith('border') ? 'border' : canonical)
      }

  function canonical(property: string): string {
    return property in Literal.aliases
      ? Literal.aliases[property as keyof typeof Literal.aliases]
      : property
  }

  function domain(property: string): string {
    if (
      resets &&
      !property.startsWith('--') &&
      property !== 'direction' &&
      property !== 'unicodeBidi'
    )
      return 'all'

    if (/^marker(?:Start|Mid|End)?$/.test(property)) return 'marker'
    if (property.startsWith('corner')) return 'cornerShape'
    if (property.startsWith('containIntrinsic')) return 'containIntrinsicSize'
    if (property.startsWith('interestDelay')) return 'interestDelay'
    if (property.startsWith('backgroundPosition')) return 'backgroundPosition'

    if (combinedLines.has('columnRule') && property.startsWith('columnRule'))
      return 'columnRule'

    if (combinedLines.has('outline') && property.startsWith('outline'))
      return 'outline'

    if (property.startsWith('borderImage')) return 'borderImage'

    if (property.startsWith('border')) {
      if (combinedLines.has('border')) return 'border'

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

    if (['fontStretch', 'fontWidth'].includes(property)) return 'fontWidth'
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

    if (['wordWrap', 'overflowWrap'].includes(property)) return 'overflowWrap'

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
  }

  const parents = new Map<string, string>()

  function root(domain: string): string {
    const parent = parents.get(domain)
    if (!parent) return domain

    const result = root(parent)

    parents.set(domain, result)

    return result
  }

  // Union only authored shorthands. Unrelated axes retain their original factoring.
  // Recursion includes nested and reset-only shorthands without parsing CSS values.
  function join(property: string, target: string, visited = new Set<string>()) {
    if (visited.has(property)) return

    visited.add(property)

    const current = root(domain(canonical(property)))
    const group = root(target)

    if (current !== group) parents.set(current, group)

    if (Object.hasOwn(Cascade.shorthands, property))
      for (const child of Cascade.shorthands[
        property as keyof typeof Cascade.shorthands
      ])
        join(child, target, visited)
  }

  for (const style of analyzed)
    for (const { property } of style.declarations)
      if (Object.hasOwn(Cascade.shorthands, canonical(property)))
        join(canonical(property), domain(canonical(property)))

  const serialized = new Map<object, string>()

  function serialize(input: Style.Declaration['value']): number | string {
    if (typeof input !== 'object' || input === null) return input

    const cached = serialized.get(input)
    if (cached !== undefined) return cached

    const value = serializeReference(input)

    if (typeof value === 'string') serialized.set(input, value)

    return value
  }

  function serializeReference(
    input: Style.Declaration['value'],
  ): number | string {
    if (Binding.is(input)) return `var(${input.name})`
    if (isReference(input)) return (theme ??= Themes.create()).serialize(input)

    if (Token.isExpression(input))
      return input.parts
        .map((part) => (typeof part === 'string' ? part : serialize(part)))
        .join('')

    return input as number | string
  }

  function nested(style: Style.NamedStyle): string {
    if (style.rules)
      return style.rules
        .map((rule) => {
          const body = nested(rule.style)

          return rule.condition === undefined
            ? body
            : `${rule.condition}{${body}}`
        })
        .join('')

    return style.declarations
      .map(
        ({ property, value, important }) =>
          `${Literal.name(property)}:${serialize(value)}${important ? '!important' : ''};`,
      )
      .join('')
  }

  // Sharing is safe only when every use of a conflict domain has the same
  // declaration sequence. Conditions conservatively retain contextual identities.
  for (const style of analyzed) {
    const domains = new Map<string, string>()

    for (const { important, property, value } of style.declarations) {
      const key = root(domain(canonical(property)))
      const declaration = `${Literal.name(property)}:${serialize(value)}${important ? '!important' : ''};`
      domains.set(key, (domains.get(key) ?? '') + declaration)
    }

    // Sharing individual properties cannot retain a multi-property conflict
    // sequence (for example padding, padding-left, padding again).
    for (const key of domains.keys()) {
      const properties = new Set(
        style.declarations
          .filter(({ property }) => root(domain(canonical(property))) === key)
          .map(({ property }) => property),
      )
      if (properties.size > 1) groups.set(key, false)
    }

    for (const [key, value] of domains) {
      const previous = groups.get(key)
      groups.set(
        key,
        previous === undefined || previous === value ? value : false,
      )
    }
  }

  const defaultMode = options.cssOutput ?? 'atomic'
  if (defaultMode !== 'atomic' && defaultMode !== 'grouped')
    throw new CompileError([
      {
        code: 'invalid_output',
        message: 'cssOutput must be atomic or grouped.',
        path: ['cssOutput'],
      },
    ])

  const identities = new Map<string, string>()
  const rules = new Map<string, string>()
  const identical = new Map<string, string>()

  for (const style of options.styles.styles) {
    const mode = style.cssOutput ?? defaultMode
    if (!style.name || Object.hasOwn(classes, style.name)) {
      diagnostics.push({
        code: 'invalid_name',
        message: 'Style names must be nonempty and unique.',
        path: [style.name],
      })
      continue
    }

    const names: string[] = []
    let ordinal = 0

    function emit(body: string, label: string, shared: boolean, output = mode) {
      if (!body) return

      const independent =
        mode === 'grouped' &&
        output === mode &&
        options.composition === 'independent'
      const key = `${output}:${body}`
      // Development slots belong to each style even when their initial values match.
      const reusable = !options.development && (shared || independent)
      const previous = reusable ? identical.get(key) : undefined
      if (previous) {
        names.push(previous)
        return
      }

      // Contextual slots preserve authored ordering; development names survive value edits.
      const slot = ordinal++
      const identity = (() => {
        if (output === 'grouped' && mode === 'grouped')
          return `g-${encode(style.name)}`
        return ClassName.create({
          body,
          context:
            !shared || options.development
              ? JSON.stringify([options.scope, mode, style.name])
              : options.scope,
          property: label,
          slot: !shared || options.development ? slot : undefined,
          stable: options.development,
        })
      })()
      const owner = mode === 'atomic' ? `${style.name}:${slot}` : undefined
      if (
        (rules.has(identity) && rules.get(identity) !== body) ||
        (owner !== undefined &&
          identities.has(identity) &&
          identities.get(identity) !== owner)
      )
        diagnostics.push({
          code: 'identity_collision',
          message: 'Distinct rules produced the same class identifier.',
          path: [style.name],
        })

      if (owner !== undefined) identities.set(identity, owner)
      rules.set(identity, body)
      if (reusable) identical.set(key, identity)
      names.push(identity)
    }

    function atoms(
      style: Style.NamedStyle,
      conditions: readonly string[] = [],
    ) {
      if (style.cssOutput === 'grouped') {
        const body = conditions.reduceRight(
          (body, condition) => `${condition}{${body}}`,
          nested(style),
        )
        emit(body, 'style', false, 'grouped')
        return
      }
      if (style.rules) {
        for (const rule of style.rules)
          atoms(
            rule.style,
            rule.condition === undefined
              ? conditions
              : [...conditions, rule.condition],
          )
        return
      }

      for (let index = 0; index < style.declarations.length; ) {
        const declaration = style.declarations[index++]!
        const property = declaration.property
        const values = [declaration]
        // Keep same-property fallbacks ordered; they form one semantic value.
        while (style.declarations[index]?.property === property)
          values.push(style.declarations[index++]!)

        const value = values
          .map(
            ({ important, value }) =>
              `${Literal.name(property)}:${serialize(value)}${important ? '!important' : ''};`,
          )
          .join('')
        const body = conditions.reduceRight(
          (body, condition) => `${condition}{${body}}`,
          value,
        )
        const shared =
          !nestedComposition &&
          !conditions.length &&
          groups.get(root(domain(canonical(property)))) !== false
        emit(body, property, shared)
      }
    }

    try {
      if (mode === 'grouped') emit(nested(style), 'style', false)
      else atoms(style)
    } catch (error) {
      diagnostics.push({
        code: 'invalid_declaration',
        message: (error as Error).message,
        path: [style.name],
      })
    }

    classes[style.name] = [...new Set(names)].join(' ')
  }

  if (diagnostics.length) throw new CompileError(diagnostics)

  const contributionCss = (() => {
    try {
      return Contributions.render(options.contributions ?? [], nested)
    } catch (error) {
      throw new CompileError([
        {
          code: 'invalid_declaration',
          message: (error as Error).message,
          path: ['contributions'],
        },
      ])
    }
  })()

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

  const scopedCss = [
    scopes.css,
    ...[...rules].map(([name, body]) => `.${name}{${body}}`),
  ]
    .filter(Boolean)
    .join('\n')

  return Object.freeze({
    ...(contributionCss ? { contributionCss, scopedCss } : {}),
    classes: Object.freeze(classes),
    css: [contributionCss, scopedCss].filter(Boolean).join('\n'),
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
    /** Eager module-level stylesheet contributions, supplied as static data. */
    readonly contributions?: readonly Contribution[] | undefined
    /** CSS representation; atomic declarations are the default. */
    readonly cssOutput?: 'atomic' | 'grouped' | undefined
    readonly composition?: 'independent' | 'ordered' | undefined
    /** Stable declaration names for CSS-only development updates. */
    readonly development?: boolean | undefined
    /** Optional module scope for independently delivered stylesheets. */
    readonly scope?: string | undefined
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
    /** Contribution text separated for graph-wide hoisting. */
    readonly contributionCss?: string | undefined
    /** Ordinary scope and style rules when contributions were supplied. */
    readonly scopedCss?: string | undefined
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
    | 'invalid_output'
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
