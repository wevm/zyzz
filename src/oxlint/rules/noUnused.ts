/** Finds unused style members in local TypeScript namespaces. @module */
import type { ESTree, Rule } from '@oxlint/plugins'
import * as Bindings from '../internal/Bindings.js'

/** Leaves module exports and escaped namespaces available to unknown consumers. */
export const noUnused: Rule = {
  meta: {
    messages: { unused: "Style '{{name}}' is never used." },
    schema: [],
    type: 'suggestion',
  },
  create(context) {
    const bindings = Bindings.create(context)
    const declarations: ESTree.VariableDeclarator[] = []
    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          node.init &&
          bindings.resolve(node.init)?.kind === 'definition'
        )
          declarations.push(node)
      },
      'Program:exit'() {
        for (const declaration of declarations) {
          if (declaration.id.type !== 'Identifier') continue
          let parent: ESTree.Node = declaration.parent
          while (
            parent.type === 'VariableDeclaration' ||
            parent.type === 'ExportNamedDeclaration'
          )
            parent = parent.parent
          if (
            parent.type !== 'TSModuleBlock' ||
            parent.parent.type !== 'TSModuleDeclaration'
          )
            continue
          const namespace = parent.parent
          if (namespace.id.type !== 'Identifier') continue
          // Nested and exported namespaces may have consumers outside this local scope.
          if (namespace.parent.type !== 'Program') continue
          const variable = bindings.variable(declaration.id)
          const owner = bindings.variable(namespace.id)
          if (!variable || !owner || owner.defs.length !== 1) continue
          if (variable.references.some((reference) => reference.isRead()))
            continue
          const used = owner.references.some((reference) => {
            if (!reference.isRead()) return false
            const member = reference.identifier.parent
            return (
              member.type !== 'MemberExpression' ||
              member.object !== reference.identifier ||
              Bindings.key(member) === undefined ||
              Bindings.key(member) === variable.name
            )
          })
          if (!used)
            context.report({
              data: { name: `${namespace.id.name}.${variable.name}` },
              messageId: 'unused',
              node: declaration.id,
            })
        }
      },
    }
  },
}
