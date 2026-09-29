/** Finds JSX attributes that overwrite known Zyzz application props. @module */
import type { ESTree, Rule } from '@oxlint/plugins'
import * as Bindings from '../internal/Bindings.js'

/** Reports competing style spreads and explicit styling attributes without rewriting JSX. */
export const noConflictingProps: Rule = {
  meta: {
    messages: {
      attribute:
        "Pass '{{property}}' into the Zyzz style call to merge styling props.",
      spread:
        'Compose Zyzz applications with cx() instead of overwriting them with multiple JSX spreads.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const bindings = Bindings.create(context)
    function application(node: ESTree.Node): boolean {
      node = bindings.expression(node)
      if (node.type !== 'CallExpression') return false
      const binding = bindings.resolve(node.callee)
      return binding?.kind === 'definition' || binding?.kind === 'cx'
    }
    return {
      JSXOpeningElement(node) {
        const spreads = node.attributes.filter(
          (attribute) =>
            attribute.type === 'JSXSpreadAttribute' &&
            application(attribute.argument),
        )
        if (!spreads.length) return
        for (const attribute of node.attributes) {
          if (
            attribute.type !== 'JSXAttribute' ||
            attribute.name.type !== 'JSXIdentifier'
          )
            continue
          const property = attribute.name.name
          if (property === 'className' || property === 'style')
            context.report({
              data: { property },
              messageId: 'attribute',
              node: attribute,
            })
        }
        for (const spread of spreads.slice(1))
          context.report({ messageId: 'spread', node: spread })
      },
    }
  },
}
