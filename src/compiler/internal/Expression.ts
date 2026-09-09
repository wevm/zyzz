/**
 * Normalizes transparent TypeScript syntax at static expression boundaries.
 * @module
 */
import type * as Ast from '@oxc-project/types'

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
