/**
 * Extracts literal styles and local themes through lexical source analysis.
 * @module
 */
import * as Condition from '../internal/Condition.js'
import * as Markers from './internal/Markers.js'
import * as Contributions from './internal/Contributions.js'
import * as Css from '../web/Css.js'
import * as Dynamic from './internal/Dynamic.js'
import * as Binding from '../internal/Binding.js'
import * as Variables from './internal/Variables.js'
import * as Expression from './internal/Expression.js'
import * as Token from '../internal/Token.js'
import type * as Ast from '@oxc-project/types'
import * as Lightning from 'lightningcss'
import * as Parser from 'oxc-parser'
import * as Walker from 'oxc-walker'
import type * as Shorthands from '../internal/Shorthands.js'
import * as Style from '../Style.js'
import type * as Theme from '../Theme.js'
import * as Scope from './internal/Scope.js'
import * as Themes from './internal/Themes.js'

// JavaScript extraction supplies untyped values. Keep structural checks without
// asserting that those values already satisfy the TypeScript authoring contract.
const define = Style.define as unknown as (
  styles: Record<string, unknown>,
  options: Style.define.Options,
) => Style.Definition

/** A direct definition call available for a later source rewriter. */
export type Call = {
  /** Alias targets retained for declaration source locations. */
  readonly shorthands?: Shorthands.Map | undefined
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
 * Extracts direct css calls and local Theme definitions imported from zyzz.
 * Parses TypeScript and JSX without reading files, loading config, or evaluating source.
 * @param options - Source text and a portable package-relative module identity.
 * @returns Frozen style/theme definitions and rewrite spans. Source text is unchanged.
 * @throws {ExtractError} For syntax errors, unsupported imported references, or invalid literals.
 */
export function extract(options: extract.Options): extract.ReturnType {
  const calls: Call[] = []
  const diagnostics: Diagnostic[] = []
  const pending: Ast.CallExpression[] = []
  const styles: Style.NamedStyle[] = []
  function report(
    code: Diagnostic['code'],
    message: string,
    node?: Pick<Ast.Node, 'end' | 'start'>,
  ) {
    diagnostics.push({
      code,
      end: node?.end ?? 0,
      message,
      source: options.moduleId,
      start: node?.start ?? 0,
    })
  }
  if (
    !options.moduleId ||
    options.moduleId.includes('\\') ||
    options.moduleId.includes(':') ||
    options.moduleId
      .split('/')
      .some((part) => !part || part === '.' || part === '..')
  ) {
    report(
      'invalid_module',
      'Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.',
    )
    throw new ExtractError(diagnostics)
  }
  const parsed = Parser.parseSync('source.tsx', options.source, {
    preserveParens: false,
    showSemanticErrors: true,
    sourceType: 'module',
  })
  if (parsed.errors.length) {
    for (const error of parsed.errors) {
      const span = error.labels[0]
      report('syntax_error', error.message, span)
    }
    throw new ExtractError(diagnostics)
  }
  const program = parsed.program
  const scopeTracker = new Scope.Tracker({ preserveExitedScopes: true })
  Walker.walk(program, { scopeTracker })
  scopeTracker.freeze()
  const contributions = (() => {
    try {
      return Contributions.scan(
        program,
        scopeTracker,
        identity(options.moduleId),
      )
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error
      report('unsupported_syntax', error.message, error)
      throw new ExtractError(diagnostics)
    }
  })()
  const variables = (() => {
    try {
      return Variables.collect(program, identity(options.moduleId))
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error
      report('unsupported_syntax', error.message, error)
      throw new ExtractError(diagnostics)
    }
  })()
  const markers = (() => {
    try {
      return Markers.scan(
        program,
        scopeTracker,
        identity(options.moduleId),
        options[Themes.context]?.links,
      )
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error
      report('unsupported_syntax', error.message, error)
      throw new ExtractError(diagnostics)
    }
  })()
  const themes = (() => {
    try {
      return Themes.collect(program, {
        namespace: identity(options.moduleId),
        contributionCalls: new Set(
          contributions.calls.map((call) => call.start),
        ),
        linked: options[Themes.context] !== undefined,
        links: options[Themes.context]?.links,
      })
    } catch (error) {
      if (!(error instanceof Themes.InvalidError)) throw error
      report('unsupported_syntax', error.message, error)
      throw new ExtractError(diagnostics)
    }
  })()
  const ancestors: Ast.Node[] = []
  Walker.walk(program, {
    enter(node, parent) {
      ancestors.push(node)
      if (
        (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') ||
        !parent ||
        !Walker.isReferenceIdentifier(node, parent)
      )
        return
      // Both passes visit identical scopes; skipping type subtrees changes scope IDs.
      if (
        ancestors.some(
          (ancestor) =>
            ('typeAnnotation' in ancestor &&
              typeof ancestor.typeAnnotation === 'object' &&
              ancestor.typeAnnotation !== null &&
              ancestors.includes(ancestor.typeAnnotation as Ast.Node)) ||
            ancestor.type === 'TSTypeParameterInstantiation' ||
            ancestor.type === 'TSTypeParameterDeclaration' ||
            ancestor.type === 'TSTypeAnnotation' ||
            ancestor.type === 'TSTypeAliasDeclaration' ||
            ancestor.type === 'TSInterfaceDeclaration' ||
            ancestor.type === 'TSTypeQuery' ||
            (ancestor.type === 'ExportNamedDeclaration' &&
              (ancestor.source !== null || ancestor.exportKind === 'type')) ||
            (ancestor.type === 'ExportSpecifier' &&
              ancestor.exportKind === 'type'),
        )
      )
        return
      const binding = scopeTracker.getDeclaration(node.name)
      contributions.read(node, parent, binding)
      try {
        if (variables.reference(node, parent, binding)) return
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error
        report('unsupported_syntax', error.message, error)
        return
      }
      if (themes)
        try {
          if (themes.reference(node, parent, ancestors, binding)) return
        } catch (error) {
          if (!(error instanceof Themes.InvalidError)) throw error
          report('unsupported_syntax', error.message, error)
          return
        }
      if (
        binding?.type !== 'Import' ||
        binding.importNode.source.value !== 'zyzz' ||
        binding.importNode.importKind === 'type'
      )
        return
      const specifier = binding.node
      if (specifier.type === 'ImportNamespaceSpecifier') {
        if (parent.type === 'MemberExpression' && parent.object === node) {
          const name = (() => {
            if (parent.property.type === 'Identifier' && !parent.computed) {
              return parent.property.name
            }
            if (parent.property.type === 'Literal') {
              return parent.property.value
            }
            return undefined
          })()
          if (
            name === 'Config' ||
            name === 'css' ||
            name === 'Theme' ||
            name === 'Vars'
          )
            report(
              'unsupported_syntax',
              `Import ${name} by name; namespace authoring calls are not supported yet.`,
              parent,
            )
        }
        return
      }
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type' ||
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) !== 'css'
      )
        return
      // Follow only assignment targets; computed keys and default values are reads.
      let target: Ast.Node = node
      let write: Ast.Node | undefined
      for (let index = ancestors.length - 2; index >= 0; index--) {
        const ancestor = ancestors[index]!
        if (
          (ancestor.type === 'AssignmentExpression' &&
            ancestor.left === target) ||
          (ancestor.type === 'UpdateExpression' &&
            ancestor.argument === target) ||
          ((ancestor.type === 'ForInStatement' ||
            ancestor.type === 'ForOfStatement') &&
            ancestor.left === target)
        ) {
          write = ancestor
          break
        }
        if (
          (ancestor.type === 'Property' && ancestor.value === target) ||
          ancestor.type === 'ObjectPattern' ||
          ancestor.type === 'ArrayPattern' ||
          (ancestor.type === 'RestElement' && ancestor.argument === target) ||
          (ancestor.type === 'AssignmentPattern' && ancestor.left === target)
        )
          target = ancestor
        else break
      }
      if (write)
        report(
          'unsupported_syntax',
          'Imported css bindings cannot be reassigned.',
          write,
        )
      else if (
        parent.type === 'CallExpression' &&
        parent.callee === node &&
        !parent.optional
      )
        pending.push(parent)
      else
        report(
          'unsupported_syntax',
          'Use a direct css call; aliases, re-exports, and indirect references are not supported yet.',
          node,
        )
    },
    leave() {
      ancestors.pop()
    },
    scopeTracker,
  })
  // Imports and reference lists can have a different order from authored calls.
  if (themes)
    for (const entry of themes.styles.values()) pending.push(entry.call)
  pending.sort((a, b) => a.start - b.start)
  for (const call of pending) {
    let argument = call.arguments[0]
    while (
      argument?.type === 'TSAsExpression' ||
      argument?.type === 'TSSatisfiesExpression'
    )
      argument = argument.expression
    const diagnosticCount = diagnostics.length
    const dynamic = (() => {
      if (!argument) return undefined
      try {
        return Dynamic.read(
          argument,
          `${identity(options.moduleId)}-${call.start}`,
        )
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error
        report('unsupported_syntax', error.message, error)
        return undefined
      }
    })()
    if (diagnostics.length !== diagnosticCount) continue
    function resolveDynamic(node: Ast.Node) {
      try {
        return dynamic?.resolve(node)
      } catch (error) {
        if (!(error instanceof Themes.InvalidError)) throw error
        report('unsupported_syntax', error.message, error)
        return undefined
      }
    }
    if (dynamic) argument = dynamic.body
    if (call.arguments.length !== 1 || argument?.type !== 'ObjectExpression') {
      report(
        'unsupported_syntax',
        'Expected one literal object or typed callback; spreads and referenced definitions are not supported.',
        call,
      )
      continue
    }
    const before = diagnostics.length
    const name = `style-${identity(options.moduleId)}-${call.start}`
    const locations: Style.SourceLocation[] = []
    const conditionKeys: Ast.Node[] = []
    function object(
      argument: Ast.ObjectExpression,
      prefix: readonly string[] = [],
    ): Record<string, unknown> {
      const values: Record<string, unknown> = Object.create(null)
      const depth = prefix.length + 2
      function localSlot(node: Ast.Node) {
        const slot = resolveDynamic(node)
        if (slot && prefix.some((key) => !Condition.local(key))) {
          report(
            'unsupported_syntax',
            'Dynamic values require conditions that select the styled element.',
            node,
          )
          return undefined
        }
        return slot
      }
      for (const property of argument.properties) {
        if (
          property.type !== 'Property' ||
          property.kind !== 'init' ||
          property.method ||
          (property.computed && !markers.conditions.has(property.key.start)) ||
          property.shorthand ||
          (!markers.conditions.has(property.key.start) &&
            property.key.type !== 'Identifier' &&
            (property.key.type !== 'Literal' ||
              typeof property.key.value !== 'string'))
        ) {
          report(
            'unsupported_syntax',
            'Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.',
            property,
          )
          continue
        }
        const key =
          markers.conditions.get(property.key.start) ??
          (property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : '')
        if (Object.hasOwn(values, key)) {
          report(
            'unsupported_syntax',
            'Duplicate properties are not supported in source definitions yet.',
            property,
          )
          continue
        }
        if (Condition.is(key)) {
          conditionKeys.push(property.key)
          const input = Expression.unwrap(property.value)
          if (input.type !== 'ObjectExpression') {
            report(
              'unsupported_syntax',
              'Conditions require literal declaration objects.',
              input,
            )
            continue
          }
          locations.push({
            source: options.moduleId,
            start: property.start,
            end: property.end,
            path: [name, ...prefix, key],
          })
          values[key] = object(input, [...prefix, key])
          continue
        }
        const targets = themes?.styles.get(call.start)?.theme[Token.definition]
          .contract.shorthands?.[key] ?? [key as Style.Declaration['property']]
        function value(node: Ast.Node, path: readonly string[]): unknown {
          const unwrapped = Expression.unwrap(node)
          const token =
            variables.references.get(unwrapped.start) ??
            themes?.tokens.get(node.start)
          const reference =
            localSlot(node) ??
            (token &&
            token.end ===
              (Binding.is(token?.reference) ? unwrapped.end : node.end)
              ? token.reference
              : undefined)
          if (
            dynamic &&
            reference &&
            Object.values(dynamic.slots).includes(
              reference as Binding.Reference,
            ) &&
            path.length > depth
          ) {
            report(
              'unsupported_syntax',
              'Dynamic fallback entries are not supported.',
              node,
            )
            return undefined
          }
          node = Expression.unwrap(node)
          const animation = contributions.references.get(node.start)
          if (animation) return animation
          const template =
            node.type === 'TemplateLiteral'
              ? Expression.template(node, 0, (expression) => {
                  const animation = contributions.references.get(
                    Expression.unwrap(expression).start,
                  )
                  if (animation) return animation
                  const token =
                    variables.references.get(expression.start) ??
                    themes?.tokens.get(expression.start)
                  const slot = localSlot(expression)
                  if (slot) {
                    if (path.length > depth) {
                      report(
                        'unsupported_syntax',
                        'Dynamic fallback entries are not supported.',
                        expression,
                      )
                      return undefined
                    }
                    return slot
                  }
                  return token?.end === expression.end
                    ? token.reference
                    : undefined
                })
              : undefined
          if (Token.isExpression(template)) {
            for (const part of template.parts) {
              if (
                typeof part !== 'string' &&
                !(Binding.is(part)
                  ? (dynamic !== undefined &&
                      Object.values(dynamic.slots).includes(part)) ||
                    targets.every((target) =>
                      Binding.accepts(part.type, target),
                    )
                  : targets.every((target) =>
                      Token.accepts(part.group, target),
                    ))
              ) {
                report(
                  'unsupported_syntax',
                  Binding.is(part)
                    ? 'Variable domain is incompatible with this property.'
                    : 'Theme variable domain is incompatible with this property.',
                  node,
                )
                return undefined
              }
            }
          }
          if (
            reference &&
            Token.is(reference) &&
            !targets.every((target) =>
              Token.accepts(reference.group, target),
            ) &&
            !targets.every((target) =>
              dynamic?.accepts(
                reference as unknown as Binding.Reference,
                target,
              ),
            )
          ) {
            report(
              'unsupported_syntax',
              'Theme variable domain is incompatible with this property.',
              node,
            )
            return undefined
          }
          if (
            reference &&
            Binding.is(reference) &&
            !(
              dynamic &&
              Object.values(dynamic.slots).includes(reference) &&
              reference.type !== 'number'
            ) &&
            !targets.every((target) =>
              Binding.accepts(reference.type, target),
            ) &&
            !targets.every((target) =>
              dynamic?.accepts(
                reference as unknown as Binding.Reference,
                target,
              ),
            )
          ) {
            report(
              'unsupported_syntax',
              'Variable domain is incompatible with this property.',
              node,
            )
            return undefined
          }
          let result: unknown
          if (reference) result = reference
          else if (template !== undefined) result = template
          else if (
            node.type === 'Literal' &&
            (typeof node.value === 'string' || typeof node.value === 'number')
          )
            result = node.value
          else if (
            node.type === 'UnaryExpression' &&
            (node.operator === '-' || node.operator === '+') &&
            node.argument.type === 'Literal' &&
            typeof node.argument.value === 'number'
          )
            result =
              node.operator === '-' ? -node.argument.value : node.argument.value
          else if (node.type === 'ArrayExpression' && path.length === depth) {
            result = node.elements.map((element, index) => {
              if (!element || element.type === 'SpreadElement') {
                report(
                  'unsupported_syntax',
                  'Fallback arrays require dense literal entries without spreads.',
                  element ?? node,
                )
                return undefined
              }
              return value(element, [...path, String(index)])
            })
          } else {
            report(
              'unsupported_syntax',
              'Expected a literal string or number; expressions are not evaluated.',
              node,
            )
            return undefined
          }
          locations.push({
            end: node.end,
            path,
            source: options.moduleId,
            start: node.start,
          })
          return result
        }
        values[key] = value(property.value, [name, ...prefix, key])
      }
      return values
    }
    const values = object(argument)
    if (diagnostics.length !== before) continue
    try {
      const definition = define(
        { [name]: values },
        { locations, theme: themes?.styles.get(call.start)?.theme },
      )
      let conditionIndex = 0
      function validate(style: Style.NamedStyle) {
        for (const rule of style.rules ?? []) {
          if (rule.condition !== undefined) {
            const location = conditionKeys[conditionIndex++] ?? call
            try {
              Lightning.transform({
                filename: options.moduleId,
                code: Buffer.from(`.z{${rule.condition}{color:red;}}`),
                errorRecovery: false,
              })
            } catch (error) {
              report(
                'unsupported_syntax',
                `Invalid selector or condition: ${(error as Error).message}`,
                location,
              )
            }
          }
          validate(rule.style)
        }
      }
      for (const style of definition.styles) validate(style)
      if (diagnostics.length !== before) continue
      styles.push(...definition.styles)
      const shorthands = themes?.styles.get(call.start)?.theme[Token.definition]
        .contract.shorthands
      calls.push({
        ...(shorthands ? { shorthands } : {}),
        ...(themes?.styles.get(call.start)?.output
          ? { output: 'html' as const }
          : {}),
        ...(dynamic
          ? {
              slots: dynamic.slots,
              valuesType: options.source.slice(
                dynamic.type.start,
                dynamic.type.end,
              ),
            }
          : {}),
        end: call.end,
        name,
        start: call.start,
      })
    } catch (error) {
      if (!(error instanceof Style.InvalidError)) throw error
      for (const diagnostic of error.diagnostics)
        diagnostics.push({
          code: 'invalid_literal',
          end: diagnostic.location?.end ?? call.end,
          message: diagnostic.message,
          source: options.moduleId,
          start: diagnostic.location?.start ?? call.start,
        })
    }
  }
  if (themes && !diagnostics.length)
    for (const [start, token] of themes.tokens) {
      if (
        ![...calls, ...contributions.calls].some(
          (call) => start >= call.start && token.end <= call.end,
        )
      )
        report(
          'unsupported_syntax',
          'Theme references require a compiled style declaration.',
          { start, end: token.end },
        )
    }
  let contributionData: readonly Css.Contribution[] = []
  try {
    contributionData = [
      ...Contributions.extract(contributions, themes?.tokens ?? new Map()),
      ...(themes?.calls ?? []).flatMap((call) =>
        call.options?.layers
          ? [
              {
                kind: 'layers' as const,
                names: call.options.layers as readonly string[],
              },
            ]
          : [],
      ),
    ]
    if (contributionData.length) {
      const rendered = Css.compile({
        styles: { styles: [] },
        contributions: contributionData,
        themes: themes?.themes,
      }).css
      Lightning.transform({
        filename: options.moduleId,
        code: new TextEncoder().encode(rendered),
        visitor: {
          Url(url) {
            if (!/^(?:\/|#|[a-z][a-z\d+.-]*:)/i.test(url.url))
              throw new Error(
                'Contribution URLs must be root-relative or absolute in this compiler slice.',
              )
          },
        },
        errorRecovery: false,
      })
    }
  } catch (error) {
    report(
      'unsupported_syntax',
      (error as Error).message,
      error instanceof Themes.InvalidError ? error : contributions.calls[0],
    )
  }
  if (diagnostics.length) throw new ExtractError(diagnostics)
  return Object.freeze({
    ...(markers.calls.length ? { markerCalls: markers.calls } : {}),
    ...(contributionData.length ? { contributions: contributionData } : {}),
    ...(contributions.calls.length
      ? { contributionCalls: contributions.calls }
      : {}),
    ...(options[Themes.context]
      ? {
          themeExports: Object.freeze({
            ...themes?.exports,
            ...markers.exports,
          }),
        }
      : {}),
    calls: Object.freeze(calls.map((call) => Object.freeze(call))),
    styles: Object.freeze({ styles: Object.freeze(styles) }),
    ...(variables.calls.length
      ? { variableCalls: Object.freeze(variables.calls) }
      : {}),
    themeAliases: Object.freeze(themes?.aliases ?? []),
    ...(themes?.scripts.size
      ? { themeScripts: Object.freeze([...themes.scripts]) }
      : {}),
    themeCalls: Object.freeze(themes?.calls ?? []),
    themeReferences: Object.freeze(themes?.references ?? []),
    themes: themes?.themes ?? Object.freeze({}),
  })
}

/** Input and output of source extraction. */
export declare namespace extract {
  /** Structured source failure. */
  type ErrorType = ExtractError
  /** Source text supplied by an adapter. */
  type Options = {
    /** Portable identity including package and module path; no filesystem access occurs. */
    readonly moduleId: string
    /** Compiler-owned graph context. */
    readonly [Themes.context]?: Themes.Context | undefined
    /** Complete module text, parsed as TypeScript with JSX. */
    readonly source: string
  }
  /** Ordered public compiler input and spans for later rewriting. */
  type ReturnType = {
    /** Marker factories replaced with fixed data-attribute callables. */
    readonly markerCalls?: readonly Markers.Call[] | undefined
    /** Static stylesheet effects and their source replacements. */
    readonly contributions?: readonly Css.Contribution[] | undefined
    readonly contributionCalls?: readonly Contributions.Call[] | undefined
    /** Explicit variable contracts replaced by fixed slot data. */
    readonly variableCalls?: readonly Variables.Call[] | undefined
    /** Direct calls in source order. */
    readonly calls: readonly Call[]
    /** Validated definitions accepted by Css.compile. */
    readonly styles: Style.Definition
    /** Local bound-authoring initializers and their retained token types. */
    readonly themeAliases: readonly Themes.Alias[]
    /** Local factory spans replaced by compiled scope data. */
    /** Configuration identities retaining their initialization helper. */
    readonly themeScripts?: readonly string[] | undefined
    readonly themeCalls: readonly Themes.Call[]
    /** Scope reads replaced by class constants. */
    readonly themeReferences: readonly Themes.Reference[]
    /** Resolved authoring exports when extracted as part of a source graph. */
    readonly themeExports?: Readonly<Record<string, Themes.Link>> | undefined
    /** Stable scope keys and validated local theme definitions. */
    readonly themes: Readonly<Record<string, Theme.Definition>>
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

function identity(value: string): string {
  let first = 2166136261
  let second = 2246822507
  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619)
    second = Math.imul(second ^ value.charCodeAt(index), 3266489909)
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
}
