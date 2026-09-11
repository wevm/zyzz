/** Finds nonescaping local static callables whose applications can become props. @module */
import type * as Ast from '@oxc-project/types'
import type * as Source from '../Source.js'

/** Conservatively proves direct applications without changing binding reads. */
export function create(
  program: Ast.Program,
  calls: readonly Source.Call[],
): Collector | undefined {
  const definitions = new Map(
    calls.filter((call) => !call.slots).map((call) => [call.start, call]),
  )

  const candidates: {
    declaration: Ast.VariableDeclarator & {
      id: Extract<Ast.Node, { type: 'Identifier' }>
    }
    direct: Source.Call | undefined
    members: Map<string, Source.Call>
  }[] = []

  for (const statement of program.body) {
    // Exported values can escape and object members can subsequently be replaced.
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const')
      continue

    for (const declaration of statement.declarations) {
      if (declaration.id.type !== 'Identifier' || !declaration.init) continue

      const members = new Map<string, Source.Call>()
      const candidate = definitions.get(declaration.init.start)

      const direct =
        declaration.init.type === 'CallExpression' &&
        declaration.init.end === candidate?.end
          ? candidate
          : undefined

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
          const candidate = definitions.get(property.value.start)

          const call =
            property.value.type === 'CallExpression' &&
            property.value.end === candidate?.end
              ? candidate
              : undefined

          if (!key || key === '__proto__' || !call || members.has(key)) {
            valid = false
            break
          }

          members.set(key, call)
        }

        if (!valid || !members.size) continue
      }

      candidates.push({
        declaration: { ...declaration, id: declaration.id },
        direct,
        members,
      })
    }
  }

  if (!candidates.length) return undefined

  const parents = new Map<Ast.Node, Ast.Node>()
  const references = new Map<
    string,
    Extract<Ast.Node, { type: 'Identifier' }>[]
  >(candidates.map(({ declaration }) => [declaration.id.name, []]))
  let evaluation = false

  return {
    enter(node, parent) {
      if (
        node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        references.has(node.object.name) &&
        parent
      )
        parents.set(node, parent)

      if (node.type !== 'Identifier') return

      if (node.name === 'eval') evaluation = true

      const nodes = references.get(node.name)
      if (!nodes) return

      nodes.push(node)

      if (parent) parents.set(node, parent)
    },
    find() {
      if (evaluation) return []

      const result: Application[] = []

      for (const { declaration, direct, members } of candidates) {
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

      return result
    },
  }
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

/** Binding references gathered during the transform's existing walk. */
type Collector = {
  /** Records relevant reads and their immediate parents. */
  enter: (node: Ast.Node, parent: Ast.Node | null | undefined) => void
  /** Resolves applications after traversal completes. */
  find: () => readonly Application[]
}
