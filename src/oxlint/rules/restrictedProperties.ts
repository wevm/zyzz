/** Applies explicit project restrictions to known web declarations. @module */
import type { Rule } from '@oxlint/plugins'
import * as Bindings from '../internal/Bindings.js'
import * as Declarations from '../internal/Declarations.js'

/** Reports forbidden properties or literal values outside an explicit allowlist. */
export const restrictedProperties: Rule = {
  meta: {
    messages: {
      restricted: "Property '{{property}}' is restricted. {{reason}}",
    },
    schema: [
      {
        additionalProperties: {
          additionalProperties: false,
          properties: {
            reason: { type: 'string' },
            values: { items: { type: ['string', 'number'] }, type: 'array' },
          },
          type: 'object',
        },
        type: 'object',
      },
    ],
    type: 'suggestion',
  },
  create(context) {
    const bindings = Bindings.create(context)
    const restrictions = context.options[0]
    const reported = new Set<number>()
    return {
      CallExpression(node) {
        if (
          !restrictions ||
          typeof restrictions !== 'object' ||
          Array.isArray(restrictions)
        )
          return
        const binding = bindings.resolve(node.callee)
        if (binding?.kind !== 'style' && binding?.kind !== 'variants') return
        const input = node.arguments[0]
        if (!input || input.type === 'SpreadElement') return
        Declarations.visit(input, {
          bindings,
          recipe: binding.kind === 'variants',
          visitors: {
            declaration(property, name) {
              if (
                !Object.hasOwn(restrictions, name) ||
                reported.has(property.start)
              )
                return
              const restriction = restrictions[name]
              if (
                !restriction ||
                typeof restriction !== 'object' ||
                Array.isArray(restriction)
              )
                return
              const allowed = restriction.values
              if (Array.isArray(allowed)) {
                const literal = Declarations.literal(property.value, bindings)
                if (!literal) return
                const values: unknown[] = Array.isArray(literal.value)
                  ? literal.value
                  : [literal.value]
                if (
                  values.every((value) =>
                    allowed.some((allowed) => allowed === value),
                  )
                )
                  return
              }
              reported.add(property.start)
              context.report({
                data: {
                  property: name,
                  reason:
                    typeof restriction.reason === 'string'
                      ? restriction.reason
                      : 'Use an approved property or value.',
                },
                messageId: 'restricted',
                node: property.key,
              })
            },
          },
        })
      },
    }
  },
}
