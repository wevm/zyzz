/** Reports statically known declaration errors using Zyzz's authoring validation. @module */
import type { ESTree, Rule } from '@oxlint/plugins'
import * as Bindings from '../internal/Bindings.js'
import * as Declarations from '../internal/Declarations.js'
import * as Literal from '../../internal/Literal.js'
import * as Style from '../../Style.js'

/** Validates known structure and values while leaving unresolved bindings to the compiler. */
export const validStyles: Rule = {
  meta: { messages: { invalid: '{{message}}' }, schema: [], type: 'problem' },
  create(context) {
    const bindings = Bindings.create(context)
    const reported = new Set<number>()
    function report(node: ESTree.Node, message: string) {
      if (reported.has(node.start)) return
      reported.add(node.start)
      context.report({ data: { message }, messageId: 'invalid', node })
    }
    return {
      CallExpression(node) {
        const binding = bindings.resolve(node.callee)
        if (binding?.kind !== 'style' && binding?.kind !== 'variants') return
        const input = node.arguments[0]
        if (!input || input.type === 'SpreadElement') return
        Declarations.visit(input, {
          bindings,
          recipe: binding.kind === 'variants',
          visitors: {
            declaration(property, name) {
              if (name === 'typography') return
              if (
                !binding.themed &&
                !name.startsWith('--') &&
                !Object.hasOwn(Literal.rules, name)
              ) {
                report(property.key, `Unknown CSS property '${name}'.`)
                return
              }
              const value = bindings.expression(property.value)
              if (value.type === 'ObjectExpression') {
                report(
                  value,
                  'CSS declarations require scalar values or fallback arrays.',
                )
                return
              }
              if (
                value.type === 'ArrayExpression' &&
                value.elements.some((element) => !element)
              ) {
                report(
                  value,
                  'Fallback arrays require dense data entries without holes.',
                )
                return
              }
              const literal = Declarations.literal(value, bindings)
              if (!literal) return
              const values = Array.isArray(literal.value)
                ? literal.value
                : [literal.value]
              if (
                values.some(
                  (value) =>
                    typeof value !== 'string' && typeof value !== 'number',
                )
              ) {
                report(
                  value,
                  'CSS declarations require string or number values.',
                )
                return
              }
              try {
                Style.define({ lint: { [name]: literal.value } } as never)
              } catch (error) {
                if (!(error instanceof Style.InvalidError)) throw error
                for (const diagnostic of error.diagnostics)
                  report(value, diagnostic.message)
              }
            },
            invalid: report,
          },
        })
      },
    }
  },
}
