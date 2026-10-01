/** Derives emitted names from authored bindings rather than source locations. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as Identity from '../../internal/Identity.js'

/** Collects readable declaration paths for calls in constants and namespaces. */
export function collect(program: Ast.Program): ReadonlyMap<number, string> {
  const names = new Map<number, string>()
  const ancestors: Ast.Node[] = []

  Walker.walk(program, {
    enter(node) {
      if (node.type === 'CallExpression') {
        const parts: string[] = []
        for (const ancestor of ancestors) {
          if (
            ancestor.type === 'TSModuleDeclaration' &&
            ancestor.id.type === 'Identifier'
          )
            parts.push(ancestor.id.name)
          if (
            ancestor.type === 'VariableDeclarator' &&
            ancestor.id.type === 'Identifier'
          )
            parts.push(ancestor.id.name)
          if (ancestor.type === 'Property' && !ancestor.computed) {
            if (ancestor.key.type === 'Identifier')
              parts.push(ancestor.key.name)
            else if (ancestor.key.type === 'Literal')
              parts.push(String(ancestor.key.value))
          }
          if (ancestor.type === 'FunctionDeclaration' && ancestor.id)
            parts.push(ancestor.id.name)
        }
        names.set(
          node.start,
          parts.length ? parts.map(Identity.name).join('-') : 'style',
        )
      }
      ancestors.push(node)
    },
    leave() {
      ancestors.pop()
    },
  })

  return names
}
