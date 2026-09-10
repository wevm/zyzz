/**
 * Reads static template primitives and transparent TypeScript syntax without execution.
 * @module
 */
import type * as Ast from '@oxc-project/types'

/** Folds cooked template text and literal primitive substitutions; unresolved syntax returns undefined. */
export function template(
  node: Ast.TemplateLiteral,
  depth = 0,
): string | undefined {
  if (depth >= 128) return undefined
  let result = ''
  for (const [index, quasi] of node.quasis.entries()) {
    if (quasi.value.cooked === null) return undefined
    result += quasi.value.cooked
    const expression = node.expressions[index]
    if (!expression) continue
    const value = unwrap(expression)
    if (value.type === 'Literal' && !('regex' in value)) {
      if (typeof value.value === 'number' && !Number.isFinite(value.value))
        return undefined
      result += String(value.value)
    } else if (
      value.type === 'UnaryExpression' &&
      (value.operator === '-' || value.operator === '+') &&
      value.argument.type === 'Literal' &&
      typeof value.argument.value === 'number' &&
      Number.isFinite(value.argument.value)
    ) {
      result += String(
        value.operator === '-' ? -value.argument.value : value.argument.value,
      )
    } else if (value.type === 'TemplateLiteral') {
      const nested = template(value, depth + 1)
      if (nested === undefined) return undefined
      result += nested
    } else return undefined
  }
  return result
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
