/** Resolves immutable authoring bindings without loading or evaluating modules. @module */
import type { Context, ESTree, Variable } from '@oxlint/plugins'

/** A recognized helper or locally declared style. */
export type Binding = {
  readonly kind:
    | 'config'
    | 'configFactory'
    | 'configNamespace'
    | 'cx'
    | 'definition'
    | 'module'
    | 'style'
    | 'variants'
  readonly themed: boolean
}

/** Resolves helpers using lexical scope, configuration filenames, and explicit import sources. */
export function create(context: Context) {
  const settings = context.settings.zyzz
  const imports = new Set(['zyzz', 'zyzz/default'])
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const sources = settings.imports
    if (Array.isArray(sources))
      for (const source of sources)
        if (typeof source === 'string') imports.add(source)
  }

  function variable(
    node: Extract<ESTree.Node, { type: 'Identifier' }>,
  ): Variable | undefined {
    let scope = context.sourceCode.getScope(node)
    while (scope) {
      const found = scope.set.get(node.name)
      if (found) return found
      if (!scope.upper) break
      scope = scope.upper
    }
    return undefined
  }

  function initializer(
    node: Extract<ESTree.Node, { type: 'Identifier' }>,
  ): ESTree.Node | undefined {
    const binding = variable(node)
    if (!binding || binding.defs.length !== 1) return undefined
    const definition = binding.defs[0]!
    if (definition.node.type !== 'VariableDeclarator') return undefined
    if (
      definition.node.parent.type !== 'VariableDeclaration' ||
      definition.node.parent.kind !== 'const'
    )
      return undefined
    if (
      binding.references.some(
        (reference) => reference.isWrite() && !reference.init,
      )
    )
      return undefined
    if (definition.node.id.type !== 'Identifier') return undefined
    const input = definition.node.init && unwrap(definition.node.init)
    if (
      input?.type === 'ArrayExpression' ||
      input?.type === 'ObjectExpression'
    ) {
      const mutable = binding.references.some((reference) => {
        let value: ESTree.Node = reference.identifier
        while (
          value.parent &&
          ((value.parent.type === 'MemberExpression' &&
            value.parent.object === value) ||
            unwrap(value.parent) === value)
        )
          value = value.parent
        const parent = value.parent
        if (
          parent?.type === 'ArrayExpression' ||
          (parent?.type === 'Property' && parent.value === value)
        )
          return true
        if (parent?.type === 'AssignmentExpression' && parent.left === value)
          return true
        if (
          parent?.type === 'UpdateExpression' ||
          (parent?.type === 'UnaryExpression' && parent.operator === 'delete')
        )
          return true
        if (parent?.type === 'CallExpression') {
          if (parent.callee === value) return true
          const callee = resolve(parent.callee)
          return callee?.kind !== 'style' && callee?.kind !== 'variants'
        }
        return parent?.type === 'VariableDeclarator' && parent.init === value
      })
      if (mutable) return undefined
    }
    return definition.node.init ?? undefined
  }

  function expression(
    node: ESTree.Node,
    seen = new Set<ESTree.Node>(),
  ): ESTree.Node {
    node = unwrap(node)
    if (seen.has(node)) return node
    seen.add(node)
    if (node.type === 'Identifier') {
      const init = initializer(node)
      if (init) return expression(init, seen)
    }
    return node
  }

  function member(
    binding: Binding | undefined,
    name: string | undefined,
  ): Binding | undefined {
    if (!binding || !name) return undefined
    if (binding.kind === 'module') {
      if (!binding.themed && name === 'Config')
        return { kind: 'configNamespace', themed: true }
      if (
        name === 'style' ||
        name === 'variants' ||
        (!binding.themed && name === 'cx')
      )
        return { kind: name, themed: binding.themed }
    }
    if (binding.kind === 'configNamespace' && name === 'create')
      return { kind: 'configFactory', themed: true }
    if (binding.kind === 'config' && (name === 'style' || name === 'variants'))
      return { kind: name, themed: true }
    return undefined
  }

  function resolve(
    node: ESTree.Node,
    seen = new Set<ESTree.Node>(),
  ): Binding | undefined {
    node = unwrap(node)
    if (seen.has(node)) return undefined
    seen.add(node)

    if (node.type === 'Identifier') {
      const binding = variable(node)
      if (!binding || binding.defs.length !== 1) return undefined
      const definition = binding.defs[0]!
      const declaration = definition.node
      if (definition.type === 'ImportBinding') {
        const parent = declaration.parent
        if (
          parent?.type !== 'ImportDeclaration' ||
          parent.importKind === 'type' ||
          (!imports.has(parent.source.value) &&
            !/(?:^|\/)zyzz\.config\.[^/]+$/.test(parent.source.value))
        )
          return undefined
        const module: Binding = {
          kind: 'module',
          themed: parent.source.value !== 'zyzz',
        }
        if (declaration.type === 'ImportNamespaceSpecifier') return module
        if (
          declaration.type === 'ImportSpecifier' &&
          declaration.importKind !== 'type'
        )
          return member(
            module,
            declaration.imported.type === 'Identifier'
              ? declaration.imported.name
              : declaration.imported.value,
          )
        return undefined
      }
      if (
        declaration.type !== 'VariableDeclarator' ||
        !declaration.init ||
        declaration.parent.type !== 'VariableDeclaration' ||
        declaration.parent.kind !== 'const'
      )
        return undefined
      if (
        binding.references.some(
          (reference) => reference.isWrite() && !reference.init,
        )
      )
        return undefined
      if (declaration.id.type === 'Identifier')
        return resolve(declaration.init, seen)
      if (declaration.id.type === 'ObjectPattern') {
        const property = declaration.id.properties.find(
          (property) =>
            property.type === 'Property' &&
            property.value.type === 'Identifier' &&
            property.value.name === node.name,
        )
        if (property?.type === 'Property')
          return member(resolve(declaration.init, seen), key(property))
      }
    }

    if (node.type === 'MemberExpression') {
      const name = key(node)
      const known = member(resolve(node.object, new Set(seen)), name)
      if (known) return known
      if (node.object.type !== 'Identifier' || !name) return undefined
      const namespace = variable(node.object)
      if (!namespace || namespace.defs.length !== 1) return undefined
      const declaration = namespace.defs[0]!.node
      if (
        declaration.type !== 'TSModuleDeclaration' ||
        declaration.body?.type !== 'TSModuleBlock'
      )
        return undefined
      for (const statement of declaration.body.body) {
        if (
          statement.type !== 'ExportNamedDeclaration' ||
          statement.declaration?.type !== 'VariableDeclaration' ||
          statement.declaration.kind !== 'const'
        )
          continue
        for (const entry of statement.declaration.declarations)
          if (
            entry.id.type === 'Identifier' &&
            entry.id.name === name &&
            entry.init
          )
            return resolve(entry.init, seen)
      }
    }

    if (node.type === 'CallExpression') {
      const callee = resolve(node.callee, seen)
      if (callee?.kind === 'configFactory')
        return { kind: 'config', themed: true }
      if (callee?.kind === 'style' || callee?.kind === 'variants')
        return { kind: 'definition', themed: callee.themed }
    }
    return undefined
  }

  return { expression, resolve, variable }
}

/** Resolves only literal property names, never computed identifiers. */
export function key(
  node:
    | ESTree.ObjectProperty
    | ESTree.BindingProperty
    | ESTree.MemberExpression,
): string | undefined {
  const property = node.type === 'Property' ? node.key : node.property
  if (!node.computed && property.type === 'Identifier') return property.name
  if (property.type === 'Literal' && typeof property.value === 'string')
    return property.value
  return undefined
}

/** Removes type-only wrappers while retaining the original source node. */
export function unwrap(node: ESTree.Node): ESTree.Node {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
  )
    node = node.expression
  return node
}
