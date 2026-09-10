/**
 * Reads static template primitives and transparent TypeScript syntax without execution.
 * @module
 */
import type * as Ast from '@oxc-project/types'
import * as Token from '../../internal/Token.js'

/** Folds cooked template text and literal primitive substitutions; unresolved syntax returns undefined. */
export function template(
  node: Ast.TemplateLiteral,
  depth = 0,
  resolve?: (node: Ast.Node) => Token.Reference | undefined,
): string | Token.Expression | undefined {
  if (depth >= 128) return undefined
  const parts: (string | Token.Reference)[] = []
  for (const [index, quasi] of node.quasis.entries()) {
    if (quasi.value.cooked === null) return undefined
    parts.push(quasi.value.cooked)
    const expression = node.expressions[index]
    if (!expression) continue
    const value = unwrap(expression)
    const reference = resolve?.(expression) ?? resolve?.(value)
    if (reference) parts.push(reference)
    else if (value.type === 'Literal' && !('regex' in value)) {
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
