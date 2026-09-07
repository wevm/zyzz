import * as Babel from '@babel/core'
import * as Style from '../Style.js'

/** A direct definition call available for a later source rewriter. */
export type Call = {
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
 * Extracts direct literal calls bound to named css imports from zyzz.
 * Parses TypeScript and JSX without reading files, loading config, or evaluating source.
 * @param options - Source text and a portable package-relative module identity.
 * @returns Frozen ordered definitions and call spans. Source text is not rewritten.
 * @throws {ExtractError} For syntax errors, unsupported imported references, or invalid literals.
 */
export function extract(options: extract.Options): extract.ReturnType {
  const calls: Call[] = []
  const diagnostics: Diagnostic[] = []
  const pending: Babel.types.CallExpression[] = []
  const styles: Style.NamedStyle[] = []
  function report(
    code: Diagnostic['code'],
    message: string,
    node?: Babel.types.Node,
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
  const plugin: Babel.PluginObj = {
    visitor: {
      ImportDeclaration(path) {
        if (
          path.node.source.value !== 'zyzz' ||
          path.node.importKind === 'type'
        )
          return
        for (const specifier of path.node.specifiers) {
          if (Babel.types.isImportNamespaceSpecifier(specifier)) {
            const binding = path.scope.getBinding(specifier.local.name)
            for (const reference of binding?.referencePaths ?? []) {
              const parent = reference.parentPath
              if (
                parent?.isMemberExpression() &&
                parent.node.object === reference.node &&
                ((Babel.types.isIdentifier(parent.node.property) &&
                  !parent.node.computed &&
                  parent.node.property.name === 'css') ||
                  (Babel.types.isStringLiteral(parent.node.property) &&
                    parent.node.property.value === 'css'))
              )
                report(
                  'unsupported_syntax',
                  'Import css by name; namespace authoring calls are not supported yet.',
                  parent.node,
                )
            }
          }
          if (
            !Babel.types.isImportSpecifier(specifier) ||
            specifier.importKind === 'type'
          )
            continue
          const imported = specifier.imported
          if (
            (Babel.types.isIdentifier(imported)
              ? imported.name
              : imported.value) !== 'css'
          )
            continue
          const binding = path.scope.getBinding(specifier.local.name)
          if (!binding) continue
          for (const violation of binding.constantViolations)
            report(
              'unsupported_syntax',
              'Imported css bindings cannot be reassigned.',
              violation.node,
            )
          for (const reference of binding.referencePaths) {
            if (reference.findParent((parent) => parent.isTSType())) continue
            const parent = reference.parentPath
            if (
              parent?.isCallExpression() &&
              parent.node.callee === reference.node
            )
              pending.push(parent.node)
            else
              report(
                'unsupported_syntax',
                'Use a direct css call; aliases, re-exports, and indirect references are not supported yet.',
                reference.node,
              )
          }
        }
      },
    },
  }
  try {
    Babel.transformSync(options.source, {
      ast: false,
      babelrc: false,
      code: false,
      configFile: false,
      filename: 'source.tsx',
      parserOpts: { plugins: ['typescript', 'jsx'], sourceType: 'module' },
      plugins: [plugin],
    })
  } catch (error) {
    const position =
      typeof error === 'object' &&
      error !== null &&
      'pos' in error &&
      typeof error.pos === 'number'
        ? error.pos
        : 0
    diagnostics.push({
      code: 'syntax_error',
      end: Math.min(position + 1, options.source.length),
      message:
        typeof error === 'object' &&
        error !== null &&
        'reasonCode' in error &&
        typeof error.reasonCode === 'string'
          ? `Unable to parse source: ${error.reasonCode}.`
          : 'Unable to parse source.',
      source: options.moduleId,
      start: position,
    })
    throw new ExtractError(diagnostics)
  }
  // Imports and reference lists can have a different order from authored calls.
  pending.sort((a, b) => a.start! - b.start!)
  for (const call of pending) {
    let argument = call.arguments[0]
    while (
      Babel.types.isTSAsExpression(argument) ||
      Babel.types.isTSSatisfiesExpression(argument)
    )
      argument = argument.expression
    if (
      call.arguments.length !== 1 ||
      !Babel.types.isObjectExpression(argument)
    ) {
      report(
        'unsupported_syntax',
        'Expected one direct literal object; callbacks, spreads, and referenced definitions are not supported yet.',
        call,
      )
      continue
    }
    const before = diagnostics.length
    const name = `style-${identity(options.moduleId)}-${call.start}`
    const values: Record<string, unknown> = Object.create(null)
    const locations: Style.SourceLocation[] = []
    for (const property of argument.properties) {
      if (
        !Babel.types.isObjectProperty(property) ||
        property.computed ||
        property.shorthand ||
        (!Babel.types.isIdentifier(property.key) &&
          !Babel.types.isStringLiteral(property.key))
      ) {
        report(
          'unsupported_syntax',
          'Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.',
          property,
        )
        continue
      }
      const key = Babel.types.isIdentifier(property.key)
        ? property.key.name
        : property.key.value
      if (Object.hasOwn(values, key)) {
        report(
          'unsupported_syntax',
          'Duplicate properties are not supported in source definitions yet.',
          property,
        )
        continue
      }
      const value = property.value
      if (
        Babel.types.isStringLiteral(value) ||
        Babel.types.isNumericLiteral(value)
      )
        values[key] = value.value
      else if (
        Babel.types.isUnaryExpression(value) &&
        (value.operator === '-' || value.operator === '+') &&
        Babel.types.isNumericLiteral(value.argument)
      )
        values[key] =
          value.operator === '-' ? -value.argument.value : value.argument.value
      else {
        report(
          'unsupported_syntax',
          'Expected a literal string or number; expressions are not evaluated.',
          value,
        )
        continue
      }
      locations.push({
        end: value.end!,
        path: [name, key],
        source: options.moduleId,
        start: value.start!,
      })
    }
    if (diagnostics.length !== before) continue
    try {
      const definition = Style.define(
        { [name]: values as Style.Properties },
        { locations },
      )
      styles.push(...definition.styles)
      calls.push({ end: call.end!, name, start: call.start! })
    } catch (error) {
      if (!(error instanceof Style.InvalidError)) throw error
      for (const diagnostic of error.diagnostics)
        diagnostics.push({
          code: 'invalid_literal',
          end: diagnostic.location?.end ?? call.end!,
          message: diagnostic.message,
          source: options.moduleId,
          start: diagnostic.location?.start ?? call.start!,
        })
    }
  }
  if (diagnostics.length) throw new ExtractError(diagnostics)
  return Object.freeze({
    calls: Object.freeze(calls.map((call) => Object.freeze(call))),
    styles: Object.freeze({ styles: Object.freeze(styles) }),
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
    /** Complete module text, parsed as TypeScript with JSX. */
    readonly source: string
  }
  /** Ordered public compiler input and spans for later rewriting. */
  type ReturnType = {
    /** Direct calls in source order. */
    readonly calls: readonly Call[]
    /** Validated definitions accepted by Css.compile. */
    readonly styles: Style.Definition
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
