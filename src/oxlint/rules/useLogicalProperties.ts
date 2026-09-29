/** Encourages logical CSS properties in web style declarations. @module */
import type { Rule } from '@oxlint/plugins'
import * as Bindings from '../internal/Bindings.js'
import * as Declarations from '../internal/Declarations.js'

const replacements: Readonly<Record<string, string>> = {
  borderBottomLeftRadius: 'borderEndStartRadius',
  borderBottomRightRadius: 'borderEndEndRadius',
  borderLeft: 'borderInlineStart',
  borderLeftColor: 'borderInlineStartColor',
  borderLeftStyle: 'borderInlineStartStyle',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRight: 'borderInlineEnd',
  borderRightColor: 'borderInlineEndColor',
  borderRightStyle: 'borderInlineEndStyle',
  borderRightWidth: 'borderInlineEndWidth',
  borderTopLeftRadius: 'borderStartStartRadius',
  borderTopRightRadius: 'borderStartEndRadius',
  insetLeft: 'insetInlineStart',
  insetRight: 'insetInlineEnd',
  left: 'insetInlineStart',
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  right: 'insetInlineEnd',
  scrollMarginLeft: 'scrollMarginInlineStart',
  scrollMarginRight: 'scrollMarginInlineEnd',
  scrollPaddingLeft: 'scrollPaddingInlineStart',
  scrollPaddingRight: 'scrollPaddingInlineEnd',
}

/** Reports physical properties without changing direction-dependent behavior. */
export const useLogicalProperties: Rule = {
  meta: {
    messages: {
      logical:
        "Use a CSS logical property instead of '{{property}}', such as '{{replacement}}' for horizontal LTR layouts.",
    },
    schema: [],
    type: 'suggestion',
  },
  create(context) {
    const bindings = Bindings.create(context)
    const reported = new Set<number>()
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
              const replacement = Object.hasOwn(replacements, name)
                ? replacements[name]
                : undefined
              if (!replacement || reported.has(property.start)) return
              if (
                context.sourceCode
                  .getCommentsBefore(property)
                  .some((comment) =>
                    comment.value.includes('allow-physical-property'),
                  )
              )
                return
              reported.add(property.start)
              context.report({
                data: { property: name, replacement },
                messageId: 'logical',
                node: property.key,
              })
            },
          },
        })
      },
    }
  },
}
