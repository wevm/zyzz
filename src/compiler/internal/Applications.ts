/** Finds nonescaping local static callables whose applications can become props. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import type * as Source from '../Source.js'

/** Conservatively proves direct applications without changing binding reads. */
export function find(
  program: Ast.Program,
  calls: readonly Source.Call[],
): readonly Application[] {
  const parents = new Map<Ast.Node, Ast.Node>()
  const references = new Map<string, Ast.Identifier[]>()
  let evaluation = false
  Walker.walk(program, {
    enter(node, parent) {
      if (parent) parents.set(node, parent)
      if (node.type !== 'Identifier') return
      if (node.name === 'eval') evaluation = true
      const nodes = references.get(node.name) ?? []
      nodes.push(node)
      references.set(node.name, nodes)
    },
  })
  if (evaluation) return []
  const definitions = new Map(
    calls.filter((call) => !call.slots).map((call) => [call.start, call]),
  )
  const result: Application[] = []
  for (const statement of program.body) {
    // Exported values can escape and object members can subsequently be replaced.
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const')
      continue
    for (const declaration of statement.declarations) {
      if (declaration.id.type !== 'Identifier' || !declaration.init) continue
      const members = new Map<string, Source.Call>()
      const direct = definitions.get(declaration.init.start)
      if (!direct) {
        if (declaration.init.type !== 'ObjectExpression') continue
        let valid = true
        for (const property of declaration.init.properties) {
          if (
            property.type !== 'Property' ||
            property.computed ||
            property.method ||
            property.kind !== 'init'
          ) {
            valid = false
            break
          }
          const key =
            property.key.type === 'Identifier' ? property.key.name : undefined
          const call = definitions.get(property.value.start)
          if (!key || key === '__proto__' || !call || members.has(key)) {
            valid = false
            break
          }
          members.set(key, call)
        }
        if (!valid || !members.size) continue
      }
      const applications: Application[] = []
      let valid = true
      for (const reference of references.get(declaration.id.name) ?? []) {
        if (reference === declaration.id) continue
        let callee: Ast.Node = reference
        let call = direct
        if (!direct) {
          const member = parents.get(reference)
          if (
            member?.type !== 'MemberExpression' ||
            member.object !== reference ||
            member.computed ||
            member.optional ||
            member.property.type !== 'Identifier'
          ) {
            valid = false
            break
          }
          call = members.get(member.property.name)
          callee = member
        }
        const application = parents.get(callee)
        if (
          !call ||
          application?.type !== 'CallExpression' ||
          application.callee !== callee ||
          application.optional ||
          application.arguments.length
        ) {
          valid = false
          break
        }
        applications.push({
          calleeEnd: callee.end,
          end: application.end,
          name: call.name,
          start: application.start,
        })
      }
      if (valid) result.push(...applications)
    }
  }
  return result
}

/** Proven call site and its compiled definition. */
type Application = {
  /** End of the original binding or property read. */
  readonly calleeEnd: number
  /** End of the application. */
  readonly end: number
  /** Extracted class identity. */
  readonly name: string
  /** Start of the application. */
  readonly start: number
}
