/**
 * Reads static template primitives and transparent TypeScript syntax without execution.
 * @module
 */
import type * as Ast from '@oxc-project/types'
import * as Binding from '../../internal/Binding.js'
import * as Token from '../../internal/Token.js'

/** Folds cooked template text and literal primitive substitutions; unresolved syntax returns undefined. */
export function template(
  node: Ast.TemplateLiteral,
  depth = 0,
  resolve?: (
    node: Ast.Node,
  ) => string | Token.Reference | Binding.Reference | undefined,
): string | Token.Expression | undefined {
  if (depth >= 128) return undefined
  const parts: (string | Token.Reference | Binding.Reference)[] = []
  for (const [index, quasi] of node.quasis.entries()) {
    if (quasi.value.cooked === null) return undefined
    parts.push(quasi.value.cooked)
    const expression = node.expressions[index]
    if (!expression) continue
    const value = unwrap(expression)
    const reference = resolve?.(expression) ?? resolve?.(value)
    if (reference) {
      if (
        quoted(
          parts
            .filter((part): part is string => typeof part === 'string')
            .join(''),
        )
      )
        return undefined
      // var() substitutions must remain whole CSS tokens.
      if (
        /[%a-zA-Z_\d.-]/.test(
          node.quasis[index + 1]?.value.cooked?.[0] ?? '',
        ) ||
        /[\w.#@+\\-]$/.test(quasi.value.cooked)
      )
        return undefined
      parts.push(reference)
    } else if (value.type === 'Literal' && !('regex' in value)) {
      if (typeof value.value === 'number' && !Number.isFinite(value.value))
        return undefined
      parts.push(String(value.value))
    } else if (
      value.type === 'UnaryExpression' &&
      (value.operator === '-' || value.operator === '+') &&
      value.argument.type === 'Literal' &&
      typeof value.argument.value === 'number' &&
      Number.isFinite(value.argument.value)
    ) {
      parts.push(
        String(
          value.operator === '-' ? -value.argument.value : value.argument.value,
        ),
      )
    } else if (
      value.type === 'UnaryExpression' &&
      value.operator === '-' &&
      value.argument.type === 'Literal' &&
      typeof value.argument.value === 'bigint'
    ) {
      parts.push(String(-value.argument.value))
    } else if (value.type === 'TemplateLiteral') {
      const nested = template(value, depth + 1, resolve)
      if (nested === undefined) return undefined
      if (typeof nested === 'string') parts.push(nested)
      else parts.push(...nested.parts)
    } else return undefined
  }
  return parts.every((part) => typeof part === 'string')
    ? parts.join('')
    : Token.compose(parts)
}

/** Returns the expression beneath assertions without evaluating application code. */
export function unwrap(node: Ast.Node): Ast.Node {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  )
    node = node.expression
  return node
}

function quoted(text: string): boolean {
  let quote = ''
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (char === '\\') {
      index++
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      if (end < 0) return true
      index = end + 1
    }
  }
  return !!quote
}
