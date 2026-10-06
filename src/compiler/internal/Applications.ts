/** Finds nonescaping local static callables whose applications can become props. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as Scope from './Scope.js'
import type * as Source from '../Source.js'

/** Conservatively proves direct applications without changing binding reads. */
export function create(
  program: Ast.Program,
  calls: readonly Source.Call[],
  options: create.Options = {},
): Collector | undefined {
  const definitions = new Map(calls.map((call) => [call.start, call]))
  const memberBindings = new Map<number, string>()
  const referencedDefinitions = new Set<string>()
  const namespaceCounts = new Map<string, number>()

  for (const statement of program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement

    if (node?.type === 'TSModuleDeclaration' && node.id.type === 'Identifier')
      namespaceCounts.set(
        node.id.name,
        (namespaceCounts.get(node.id.name) ?? 0) + 1,
      )
  }

  const candidates: {
    declaration: {
      id: Extract<Ast.Node, { type: 'Identifier' }>
    }
    direct: Source.Call | undefined
    members: Map<string, Source.Call>
    /** Namespace statement start and member identifier ends by extracted name. */
    namespace?: Namespace | undefined
    /** Offset after which top-level reads observe an initialized binding. */
    ready: number
  }[] = []

  for (const statement of program.body) {
    if (
      statement.type === 'TSModuleDeclaration' &&
      statement.id.type === 'Identifier' &&
      statement.body?.type === 'TSModuleBlock'
    ) {
      const members = new Map<string, Source.Call>()
      const ends = new Map<string, number>()
      let valid = true

      for (const member of statement.body.body) {
        const node =
          member.type === 'ExportNamedDeclaration'
            ? member.declaration
            : undefined

        if (node?.type !== 'VariableDeclaration' || node.kind !== 'const') {
          valid = false
          break
        }

        for (const declaration of node.declarations) {
          const call =
            declaration.init && definitions.get(declaration.init.start)

          if (
            declaration.id.type !== 'Identifier' ||
            declaration.init?.type !== 'CallExpression' ||
            declaration.init.end !== call?.end ||
            members.has(declaration.id.name)
          ) {
            valid = false
            break
          }

          members.set(declaration.id.name, call)
          ends.set(call.name, declaration.id.end)
          memberBindings.set(declaration.id.start, call.name)
        }
      }

      if (valid && members.size)
        candidates.push({
          declaration: { id: statement.id },
          direct: undefined,
          members,
          namespace: { ends, start: statement.start },
          ready: statement.end,
        })

      continue
    }

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
        ready: declaration.end,
      })
    }
  }

  if (!candidates.length) return undefined

  const lexical = new Set<Ast.Node>()
  // Reads inside functions, classes, or namespaces may run before initialization.
  const deferred = new Set<Ast.Node>()
  const scope = new Scope.Tracker({ preserveExitedScopes: true })
  Walker.walk(program, { scopeTracker: scope })
  scope.freeze()
  const ancestors: Ast.Node[] = []
  Walker.walk(program, {
    scopeTracker: scope,
    enter(node, parent) {
      ancestors.push(node)
      if (
        node.type !== 'Identifier' ||
        !parent ||
        !Walker.isReferenceIdentifier(node, parent)
      )
        return
      if (
        ancestors.some((node) =>
          [
            'TSTypeQuery',
            'TSTypeAnnotation',
            'TSTypeAliasDeclaration',
            'TSInterfaceDeclaration',
            'TSTypeParameterInstantiation',
            'TSTypeParameterDeclaration',
          ].includes(node.type),
        )
      )
        return
      const binding = scope.getDeclaration(node.name, { mode: 'value' })
      const id = binding?.node
      const member = id && memberBindings.get(id.start)
      if (member) referencedDefinitions.add(member)
      if (
        id &&
        candidates.some(
          (candidate) => candidate.declaration.id.start === id.start,
        )
      ) {
        lexical.add(node)
        if (
          ancestors.some((node) =>
            [
              'ArrowFunctionExpression',
              'ClassDeclaration',
              'ClassExpression',
              'FunctionDeclaration',
              'FunctionExpression',
              'TSModuleDeclaration',
            ].includes(node.type),
          )
        )
          deferred.add(node)
      }
    },
    leave() {
      ancestors.pop()
    },
  })

  const parents = new Map<Ast.Node, Ast.Node>()
  const references = new Map<
    string,
    Extract<Ast.Node, { type: 'Identifier' }>[]
  >(candidates.map(({ declaration }) => [declaration.id.name, []]))
  let evaluation = false

  // Returns undefined when any read escapes. Recipes and dynamic styles keep their calls.
  function collect(
    candidate: (typeof candidates)[number],
  ): readonly Application[] | undefined {
    const { declaration, direct, members } = candidate
    const applications: Application[] = []

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
        )
          return undefined

        call = members.get(member.property.name)
        callee = member
      }

      if (
        call?.composition ||
        call?.runtimeComposition ||
        (!options.dynamic && (call?.slots || call?.recipe))
      )
        continue

      const application = parents.get(callee)

      if (
        !call ||
        application?.type !== 'CallExpression' ||
        application.callee !== callee ||
        application.optional ||
        (!options.dynamic && application.arguments.length)
      )
        return undefined

      applications.push({
        calleeEnd: callee.end,
        end: application.end,
        initialized:
          !deferred.has(reference) &&
          reference.start >= candidate.ready &&
          (!candidate.namespace ||
            namespaceCounts.get(declaration.id.name) === 1),
        name: call.name,
        start: application.start,
      })
    }

    return applications
  }

  return {
    dead() {
      if (evaluation) return new Set<string>()

      const result = new Set<string>()
      const counts = new Map<string, number>()

      for (const { declaration } of candidates)
        counts.set(
          declaration.id.name,
          (counts.get(declaration.id.name) ?? 0) + 1,
        )

      for (const { declaration, direct, members } of candidates) {
        if (
          counts.get(declaration.id.name)! > 1 ||
          (namespaceCounts.get(declaration.id.name) ?? 0) > 1
        )
          continue

        const reads = references.get(declaration.id.name) ?? []

        if (direct) {
          if (!reads.length) result.add(direct.name)
          continue
        }

        const used = new Set<string>()
        let escapes = false

        for (const reference of reads) {
          const member = parents.get(reference)

          if (
            member?.type !== 'MemberExpression' ||
            member.object !== reference ||
            member.computed ||
            member.optional ||
            member.property.type !== 'Identifier'
          ) {
            escapes = true
            break
          }

          used.add(member.property.name)
        }

        if (!escapes)
          for (const [name, call] of members)
            if (!used.has(name) && !referencedDefinitions.has(call.name))
              result.add(call.name)
      }

      return result
    },
    definitions() {
      const namespaces: Namespace[] = []
      const values = new Map<string, boolean>()

      if (evaluation) return { namespaces, values }

      const counts = new Map<string, number>()

      for (const { declaration } of candidates)
        counts.set(
          declaration.id.name,
          (counts.get(declaration.id.name) ?? 0) + 1,
        )

      for (const candidate of candidates) {
        const name = candidate.declaration.id.name
        if (counts.get(name)! > 1 || (namespaceCounts.get(name) ?? 0) > 1)
          continue

        const applications = collect(candidate)
        if (!applications) continue

        let erased = !!candidate.namespace

        for (const call of candidate.direct
          ? [candidate.direct]
          : candidate.members.values()) {
          if (
            call.composition ||
            call.runtimeComposition ||
            call.slots ||
            call.recipe
          ) {
            erased = false
            continue
          }

          const initialized = applications.every(
            (application) =>
              application.name !== call.name || application.initialized,
          )

          values.set(call.name, initialized)
          erased &&= initialized
        }

        if (erased) namespaces.push(candidate.namespace!)
      }

      return { namespaces, values }
    },
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

      if (!lexical.has(node)) return

      const nodes = references.get(node.name)
      if (!nodes) return

      nodes.push(node)

      if (parent) parents.set(node, parent)
    },
    find() {
      if (evaluation) return []

      return candidates.flatMap((candidate) => collect(candidate) ?? [])
    },
  }
}

/** Proven call site and its compiled definition. */
type Application = {
  /** End of the original binding or property read. */
  readonly calleeEnd: number
  /** End of the application. */
  readonly end: number
  /** Whether the read runs at top level after its definition initializes. */
  readonly initialized: boolean
  /** Extracted class identity. */
  readonly name: string
  /** Start of the application. */
  readonly start: number
}

/** A top-level namespace whose members are all static definitions. */
type Namespace = {
  /** Member identifier ends keyed by extracted name. */
  readonly ends: ReadonlyMap<string, number>
  /** Start of the namespace statement. */
  readonly start: number
}

/** Binding references gathered during the transform's existing walk. */
type Collector = {
  /** Definitions with no observable value reads, retaining escaped containers. */
  dead: () => ReadonlySet<string>
  /**
   * Static definitions whose every read is a found application, keyed by
   * extracted name with whether every read is initialized. Namespaces list
   * those whose definitions all qualify with initialized reads.
   */
  definitions: () => {
    readonly namespaces: readonly Namespace[]
    readonly values: ReadonlyMap<string, boolean>
  }
  /** Records relevant reads and their immediate parents. */
  enter: (node: Ast.Node, parent: Ast.Node | null | undefined) => void
  /** Resolves applications after traversal completes. */
  find: () => readonly Application[]
}

/** Local application collection modes. */
export declare namespace create {
  /** Controls whether arguments are retained for fixed runtime compositions. */
  type Options = {
    /** Includes recipe/value applications while preserving their runtime calls. */
    readonly dynamic?: boolean | undefined
  }
}
