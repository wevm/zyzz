/** Resolves immutable module data and finite local type bindings without executing source. @module */
import type * as Ast from '@oxc-project/types'
import * as Expression from './Expression.js'
import type * as Scope from './Scope.js'
import * as Themes from './Themes.js'
import * as Walker from 'oxc-walker'

/** Collects lexical immutable values and local scalar/object type declarations. */
export function collect(program: Ast.Program, scope: Scope.Tracker) {
  const values = new Map<number, Ast.Node>()
  const references = new Map<number, number>()
  const usages = new Map<number, readonly Ast.Node[][]>()
  const types = new Map<number, Ast.Node>()
  const typeReferences = new Map<number, number>()
  const used = new Set<number>()
  for (const statement of program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (node?.type === 'VariableDeclaration' && node.kind === 'const')
      for (const declaration of node.declarations)
        if (declaration.id.type === 'Identifier' && declaration.init) {
          values.set(declaration.start, declaration.init)
        }
  }
  const ancestors: Ast.Node[] = []
  Walker.walk(program, {
    scopeTracker: scope,
    enter(node, parent) {
      ancestors.push(node)
      if (node.type === 'TSTypeAliasDeclaration' && !node.typeParameters)
        types.set(node.id.start, node.typeAnnotation)
      if (
        node.type === 'TSInterfaceDeclaration' &&
        !node.extends?.length &&
        !node.typeParameters
      ) {
        const key =
          scope.getDeclaration(node.id.name, { mode: 'type' })?.node.start ??
          node.id.start
        const previous = types.get(key)
        types.set(key, {
          ...node.body,
          type: 'TSTypeLiteral',
          members: [
            ...(previous?.type === 'TSTypeLiteral' ? previous.members : []),
            ...node.body.body,
          ],
        } as Ast.TSTypeLiteral)
      }
      if (
        node.type === 'TSTypeReference' &&
        node.typeName.type === 'Identifier' &&
        !node.typeArguments
      ) {
        const declaration = scope.getDeclaration(node.typeName.name, {
          mode: 'type',
        })
        if (declaration) typeReferences.set(node.start, declaration.node.start)
      }
      if (
        node.type !== 'Identifier' ||
        !parent ||
        !Walker.isReferenceIdentifier(node, parent)
      )
        return
      const binding = scope.getDeclaration(node.name)
      if (binding?.type !== 'Variable' || !values.has(binding.node.start))
        return
      references.set(node.start, binding.node.start)
      usages.set(binding.node.start, [
        ...(usages.get(binding.node.start) ?? []),
        [...ancestors],
      ])
    },
    leave() {
      ancestors.pop()
    },
  })
  const aliases = new Map<number, number[]>()
  function root(node: Ast.Node): number | undefined {
    node = Expression.unwrap(node)
    while (node.type === 'MemberExpression') node = node.object
    return node.type === 'Identifier' ? references.get(node.start) : undefined
  }
  function initial(
    input: Ast.Node,
    seen = new Set<number>(),
  ): Ast.Node | undefined {
    const node = Expression.unwrap(input)
    if (node.type === 'Identifier') {
      const binding = references.get(node.start)
      if (binding === undefined || seen.has(binding)) return undefined
      const value = values.get(binding)
      if (!value) return undefined
      seen.add(binding)
      return initial(value, seen)
    }
    if (node.type === 'MemberExpression' && !node.optional) {
      const object = initial(node.object, seen)
      const key =
        !node.computed && node.property.type === 'Identifier'
          ? node.property.name
          : node.property.type === 'Literal'
            ? String(node.property.value)
            : undefined
      if (object?.type === 'ObjectExpression' && key !== undefined) {
        for (const property of [...object.properties].reverse()) {
          if (property.type === 'SpreadElement') return undefined
          const name =
            property.key.type === 'Identifier' && !property.computed
              ? property.key.name
              : property.key.type === 'Literal'
                ? String(property.key.value)
                : undefined
          if (name === key)
            return property.method || property.kind !== 'init'
              ? undefined
              : initial(property.value, seen)
        }
      }
      if (
        object?.type === 'ArrayExpression' &&
        key !== undefined &&
        /^(?:0|[1-9]\d*)$/.test(key)
      ) {
        const element = object.elements[Number(key)]
        return element && element.type !== 'SpreadElement'
          ? initial(element, seen)
          : undefined
      }
      return undefined
    }
    return node
  }
  function scalar(node: Ast.Node): boolean {
    const value = initial(node)
    return (
      value?.type === 'Literal' ||
      value?.type === 'TemplateLiteral' ||
      (value?.type === 'UnaryExpression' && value.operator !== 'delete')
    )
  }
  function owners(input: Ast.Node): number[] {
    const node = Expression.unwrap(input)
    if (scalar(node)) return []
    const owner = root(node)
    if (owner !== undefined) return [owner]
    if (node.type === 'ObjectExpression')
      return node.properties.flatMap((property) =>
        property.type === 'SpreadElement'
          ? owners(property.argument)
          : property.type === 'Property'
            ? owners(property.value)
            : [],
      )
    if (node.type === 'ArrayExpression')
      return node.elements.flatMap((element) =>
        element
          ? owners(
              element.type === 'SpreadElement' ? element.argument : element,
            )
          : [],
      )
    return []
  }
  for (const [id, input] of values)
    for (const owner of owners(input))
      aliases.set(owner, [...(aliases.get(owner) ?? []), id])
  function paths(
    binding: number,
    seen = new Set<number>(),
  ): readonly (readonly Ast.Node[])[] {
    if (seen.has(binding)) return []
    seen.add(binding)
    return [
      ...(usages.get(binding) ?? []),
      ...(aliases.get(binding) ?? []).flatMap((alias) => paths(alias, seen)),
    ]
  }
  function resolve(
    node: Ast.Node,
    allowed: ReadonlySet<number>,
    active = new Set<number>(),
  ): Ast.Node {
    node = Expression.unwrap(node)
    if (node.type === 'Identifier') {
      const binding = references.get(node.start)
      const value = binding === undefined ? undefined : values.get(binding)
      if (binding === undefined || !value) return node
      if (active.has(binding) || node.start < value.end)
        throw new Themes.InvalidError(
          'Static bindings must be acyclic and follow their declaration.',
          node,
        )
      active.add(binding)
      const resolved = resolve(value, allowed, active)
      active.delete(binding)
      if (
        ['CallExpression', 'NewExpression', 'Identifier'].includes(
          resolved.type,
        )
      )
        return node
      if (
        resolved.type === 'ObjectExpression' ||
        resolved.type === 'ArrayExpression'
      ) {
        for (const path of paths(binding)) {
          if (path.some((node) => allowed.has(node.start))) continue
          if (
            !path.some(
              (node) =>
                node.type === 'AssignmentExpression' ||
                node.type === 'UpdateExpression' ||
                ((node.type === 'ForInStatement' ||
                  node.type === 'ForOfStatement') &&
                  path.includes(node.left)) ||
                (node.type === 'UnaryExpression' && node.operator === 'delete'),
            ) &&
            path.some(
              (node) => node.type === 'MemberExpression' && scalar(node),
            )
          )
            continue
          const unsupported = path.find(
            (node) =>
              ![
                'Program',
                'VariableDeclaration',
                'VariableDeclarator',
                'Identifier',
                'MemberExpression',
                'ObjectExpression',
                'Property',
                'ArrayExpression',
                'SpreadElement',
                'TSAsExpression',
                'TSSatisfiesExpression',
                'TSNonNullExpression',
                'TSTypeAssertion',
                'ExportNamedDeclaration',
                'ExportDefaultDeclaration',
                'ExportSpecifier',
              ].includes(node.type),
          )
          if (unsupported)
            throw new Themes.InvalidError(
              'Static data cannot be mutated or escape through unsupported expressions.',
              unsupported,
            )
          const write = path.find(
            (node) =>
              (node.type === 'VariableDeclarator' &&
                (node.id.type !== 'Identifier' || !values.has(node.start))) ||
              node.type === 'AssignmentExpression' ||
              node.type === 'UpdateExpression' ||
              (node.type === 'UnaryExpression' && node.operator === 'delete') ||
              ((node.type === 'ForInStatement' ||
                node.type === 'ForOfStatement') &&
                path.some((value) => value === node.left)),
          )
          const call = path.find(
            (node) =>
              node.type === 'CallExpression' || node.type === 'NewExpression',
          )
          if (write || call)
            throw new Themes.InvalidError(
              'Static data cannot be mutated or escape to runtime calls.',
              write ?? call!,
            )
        }
      }
      used.add(resolved.start)
      return resolved
    }
    if (node.type === 'MemberExpression' && !node.optional) {
      const object = resolve(node.object, allowed, active)
      const key =
        node.property.type === 'Identifier' && !node.computed
          ? node.property.name
          : node.property.type === 'Literal'
            ? String(node.property.value)
            : undefined
      if (key !== undefined && object.type === 'ObjectExpression') {
        const entries = properties(object, allowed)
        if (
          entries.some(
            (property) => property.type === 'Property' && property.computed,
          )
        )
          throw new Themes.InvalidError(
            'Static member reads cannot cross unresolved computed keys.',
            node,
          )
        const property = entries.find(
          (property) =>
            property.type === 'Property' &&
            (property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal'
                ? String(property.key.value)
                : undefined) === key,
        )
        if (property?.type === 'Property')
          return resolve(property.value, allowed, active)
      }
      if (
        key !== undefined &&
        object.type === 'ArrayExpression' &&
        /^(?:0|[1-9]\d*)$/.test(key)
      ) {
        const element = object.elements[Number(key)]
        if (element && element.type !== 'SpreadElement')
          return resolve(element, allowed, active)
      }
    }
    used.add(node.start)
    return node
  }
  function properties(
    node: Ast.ObjectExpression,
    allowed: ReadonlySet<number>,
  ): readonly Ast.ObjectPropertyKind[] {
    const result = new Map<string, Ast.ObjectPropertyKind>()
    for (const property of node.properties) {
      const entries =
        property.type === 'SpreadElement'
          ? (() => {
              const value = resolve(property.argument, allowed)
              if (value.type !== 'ObjectExpression')
                throw new Themes.InvalidError(
                  'Static spreads require an immutable object literal.',
                  property,
                )
              return properties(value, allowed)
            })()
          : [property]
      for (const entry of entries) {
        if (entry.type !== 'Property')
          throw new Themes.InvalidError(
            'Unsupported static object entry.',
            entry,
          )
        if (
          !entry.computed &&
          ((entry.key.type === 'Identifier' &&
            entry.key.name === '__proto__') ||
            (entry.key.type === 'Literal' && entry.key.value === '__proto__'))
        )
          throw new Themes.InvalidError(
            'Static object prototypes are unsupported.',
            entry,
          )
        if (entry.computed) {
          result.set(`computed:${entry.start}`, entry)
          continue
        }
        const key =
          entry.key.type === 'Identifier'
            ? entry.key.name
            : entry.key.type === 'Literal'
              ? String(entry.key.value)
              : undefined
        if (
          key === undefined ||
          entry.computed ||
          entry.method ||
          entry.kind !== 'init'
        )
          throw new Themes.InvalidError(
            'Static data requires literal property keys without methods.',
            entry,
          )
        result.set(
          key,
          entry.shorthand ? { ...entry, shorthand: false } : entry,
        )
      }
    }
    return [...result.values()]
  }
  function type(node: Ast.Node, active = new Set<number>()): Ast.Node {
    if (
      node.type === 'TSTypeReference' &&
      node.typeName.type === 'Identifier'
    ) {
      const name = typeReferences.get(node.start)
      if (name === undefined) return node
      const value = types.get(name)
      if (!value) return node
      if (active.has(name))
        throw new Themes.InvalidError(
          'Dynamic type aliases must be acyclic.',
          node,
        )
      active.add(name)
      const result = type(value, active)
      active.delete(name)
      return result
    }
    if (node.type === 'TSParenthesizedType')
      return type(node.typeAnnotation, active)
    if (node.type === 'TSIntersectionType') {
      const parts = node.types.map((value) => type(value, active))
      if (parts.every((part) => part.type === 'TSTypeLiteral'))
        return {
          ...node,
          type: 'TSTypeLiteral',
          members: parts
            .flatMap((part) =>
              part.type === 'TSTypeLiteral' ? part.members : [],
            )
            .reduce<Ast.TSSignature[]>((members, member) => {
              if (
                member.type !== 'TSPropertySignature' ||
                member.computed ||
                !member.typeAnnotation
              )
                return [...members, member]
              const key =
                member.key.type === 'Identifier'
                  ? member.key.name
                  : member.key.type === 'Literal'
                    ? member.key.value
                    : undefined
              const index = members.findIndex(
                (value) =>
                  value.type === 'TSPropertySignature' &&
                  !value.computed &&
                  value.typeAnnotation &&
                  key !== undefined &&
                  key ===
                    (value.key.type === 'Identifier'
                      ? value.key.name
                      : value.key.type === 'Literal'
                        ? value.key.value
                        : undefined),
              )
              const previous = members[index]
              if (
                previous?.type !== 'TSPropertySignature' ||
                !previous.typeAnnotation
              )
                return [...members, member]
              members[index] = {
                ...previous,
                optional: previous.optional && member.optional,
                typeAnnotation: {
                  ...previous.typeAnnotation,
                  typeAnnotation: {
                    type: 'TSIntersectionType',
                    start: previous.start,
                    end: member.end,
                    types: [
                      previous.typeAnnotation.typeAnnotation,
                      member.typeAnnotation.typeAnnotation,
                    ],
                  },
                },
              }
              return members
            }, []),
        } as Ast.TSTypeLiteral
      return { ...node, types: parts } as Ast.TSIntersectionType
    }
    if (node.type === 'TSUnionType')
      return {
        ...node,
        types: node.types.map((value) => type(value, active)),
      } as Ast.TSUnionType
    if (node.type === 'TSTemplateLiteralType')
      return {
        ...node,
        types: node.types.map((value) => type(value, active)),
      } as Ast.TSTemplateLiteralType
    return node
  }
  function normalize(node: Ast.Node, allowed: ReadonlySet<number>): Ast.Node {
    node = resolve(node, allowed)
    if (node.type === 'ObjectExpression') {
      const expanded = properties(node, allowed)
      const normalized = expanded.map((property) =>
        property.type === 'Property'
          ? (() => {
              const value = normalize(property.value, allowed)
              return value === property.value
                ? property
                : { ...property, value }
            })()
          : property,
      )
      return normalized.length === node.properties.length &&
        normalized.every(
          (property, index) => property === node.properties[index],
        )
        ? node
        : ({ ...node, properties: normalized } as Ast.ObjectExpression)
    }
    if (node.type === 'ArrayExpression') {
      const elements = node.elements.map((element) =>
        element && element.type !== 'SpreadElement'
          ? normalize(element, allowed)
          : element,
      )
      return elements.every(
        (element, index) => element === node.elements[index],
      )
        ? node
        : ({ ...node, elements } as Ast.ArrayExpression)
    }
    if (node.type === 'TemplateLiteral') {
      const expressions = node.expressions.map((expression) =>
        normalize(expression, allowed),
      )
      return expressions.every(
        (expression, index) => expression === node.expressions[index],
      )
        ? node
        : ({ ...node, expressions } as Ast.TemplateLiteral)
    }
    return node
  }
  return {
    resolve,
    properties,
    type,
    used,
    normalize,
    bindings: new Set(values.keys()),
  }
}
