/** Visits declaration positions in styles and recipes without evaluating expressions. @module */
import type { ESTree } from '@oxlint/plugins'
import * as Bindings from './Bindings.js'
import * as Condition from '../../internal/Condition.js'

/** Callbacks for known declaration blocks and malformed literal structures. */
export type Visitors = {
  readonly declaration: (property: ESTree.ObjectProperty, name: string) => void
  readonly invalid?: ((node: ESTree.Node, message: string) => void) | undefined
}

/** Traverses actual style positions, excluding variant selections and callback internals. */
export function visit(
  node: ESTree.Node,
  options: {
    readonly bindings: ReturnType<typeof Bindings.create>
    readonly recipe: boolean
    readonly visitors: Visitors
  },
) {
  const { bindings, visitors } = options
  const seen = new Set<ESTree.Node>()

  function object(
    node: ESTree.Node,
    callback: (node: ESTree.ObjectExpression) => void,
  ) {
    node = bindings.expression(node)
    if (seen.has(node)) return
    seen.add(node)
    if (node.type === 'ObjectExpression') callback(node)
    else if (node.type === 'Literal' || node.type === 'ArrayExpression')
      visitors.invalid?.(node, 'Expected a style object.')
  }

  function entries(
    node: ESTree.Node,
    callback: (property: ESTree.ObjectProperty) => void,
  ) {
    object(node, (node) => {
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          entries(property.argument, callback)
          continue
        }
        if (property.kind !== 'init' || property.method) {
          visitors.invalid?.(
            property,
            'Style objects require data properties, not methods or accessors.',
          )
          continue
        }
        callback(property)
      }
    })
  }

  function style(node: ESTree.Node) {
    node = bindings.expression(node)
    if (node.type === 'ArrowFunctionExpression') {
      if (seen.has(node)) return
      seen.add(node)
      if (node.body.type !== 'BlockStatement') style(node.body)
      else
        for (const statement of node.body.body)
          if (statement.type === 'ReturnStatement' && statement.argument)
            style(statement.argument)
      return
    }
    entries(node, (property) => {
      const name = Bindings.key(property)
      if (!name) return
      if (name === 'selectors')
        entries(property.value, (selector) => style(selector.value))
      else if (name === 'targets')
        entries(property.value, (target) => {
          if (Bindings.key(target) === 'web') style(target.value)
        })
      else if (Condition.is(name)) style(property.value)
      else if (name !== 'vars' && name !== 'variables')
        visitors.declaration(property, name)
    })
  }

  if (!options.recipe) style(node)
  else
    entries(node, (property) => {
      const name = Bindings.key(property)
      if (name === 'base') style(property.value)
      else if (name === 'variants')
        entries(property.value, (axis) =>
          entries(axis.value, (choice) => style(choice.value)),
        )
      else if (name === 'compoundVariants') {
        const value = bindings.expression(property.value)
        if (value.type === 'ArrayExpression')
          for (const entry of value.elements)
            if (entry && entry.type !== 'SpreadElement')
              entries(entry, (property) => {
                if (Bindings.key(property) === 'style') style(property.value)
              })
      }
    })
}

/** Extracts known scalar values and fallback arrays without executing user code. */
export function literal(
  node: ESTree.Node,
  bindings: ReturnType<typeof Bindings.create>,
  seen = new Set<ESTree.Node>(),
): { readonly value: unknown } | undefined {
  node = bindings.expression(node)
  if (seen.has(node)) return undefined
  seen = new Set(seen).add(node)
  if (node.type === 'Literal') return { value: node.value }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return { value: node.quasis[0]?.value.cooked }
  if (
    node.type === 'UnaryExpression' &&
    (node.operator === '-' || node.operator === '+')
  ) {
    const operand = literal(node.argument, bindings, seen)
    if (typeof operand?.value === 'number')
      return { value: node.operator === '-' ? -operand.value : operand.value }
  }
  if (node.type === 'ArrayExpression') {
    const values: unknown[] = []
    for (const entry of node.elements) {
      if (!entry || entry.type === 'SpreadElement') return undefined
      const result = literal(entry, bindings, seen)
      if (!result) return undefined
      values.push(result.value)
    }
    return { value: values }
  }
  return undefined
}
