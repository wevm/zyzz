/** Resolves individual CSS variables across lexical scopes and packed libraries. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import type * as Binding from '../../internal/Binding.js'
import * as Theme from '../../Theme.js'
import type * as Css from '../../web/Css.js'
import * as Expression from './Expression.js'
import type * as Scope from './Scope.js'
import type * as Themes from './Themes.js'
import { InvalidError } from './Themes.js'

/** One authoring call replaced with immutable compiler-assigned slot data. */
export type Call = {
  /** Exclusive source offset. */
  readonly end: number
  /** Fixed scalar reference retained in portable metadata. */
  readonly slots: Readonly<Record<string, Binding.Reference>>
  /** Inclusive source offset. */
  readonly start: number
}

/** Collects module-owned declarations without executing application code. */
export function collect(
  program: Ast.Program,
  namespace: string,
  scope: Scope.Tracker,
  links: Readonly<Record<string, Themes.Link>> = {},
  moduleId = namespace,
) {
  const imports = new Set<number>()
  const external = new Map<number, Themes.Link>()
  for (const statement of program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type'
    )
      continue
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind === 'type'
      )
        continue
      if (links[specifier.local.name]?.kind === 'variables')
        external.set(specifier.start, links[specifier.local.name]!)
      if (
        statement.source.value === 'zyzz' &&
        specifier.type === 'ImportSpecifier' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'variable'
      )
        imports.add(specifier.start)
    }
  }

  if (!imports.size && !external.size)
    return {
      calls: [] as Call[],
      exports: {} as Record<string, Themes.Link>,
      reference: () => false,
      references: new Map<
        number,
        { end: number; reference: Binding.Reference }
      >(),
      registrations: [] as Css.Contribution[],
      registrationStarts: [] as number[],
      registrationLocations: [] as Ast.Node[],
    }

  const declarations = new Map<number, number>()
  const bindings = new Map<number, Ast.Expression>()
  const namespaces = new Map<number, Map<string, Ast.Expression>>()
  const factories: Ast.CallExpression[] = []
  const undefinedValues = new Set<number>()
  const ancestors: Ast.Node[] = []

  function members(node: Ast.TSModuleDeclaration | Ast.TSGlobalDeclaration) {
    const result = new Map<string, Ast.Expression>()
    if (node.body?.type !== 'TSModuleBlock') return result
    for (const statement of node.body.body) {
      if (
        statement.type !== 'ExportNamedDeclaration' ||
        statement.declaration?.type !== 'VariableDeclaration' ||
        statement.declaration.kind !== 'const'
      )
        continue
      for (const declaration of statement.declaration.declarations)
        if (declaration.id.type === 'Identifier' && declaration.init)
          result.set(declaration.id.name, declaration.init)
    }
    return result
  }

  Walker.walk(program, {
    scopeTracker: scope,
    enter(node, parent) {
      if (node.type === 'Identifier') {
        const declaration = scope.getDeclaration(node.name)
        if (declaration) declarations.set(node.start, declaration.node.start)
        else if (node.name === 'undefined') undefinedValues.add(node.start)
        if (
          declaration?.type === 'Import' &&
          imports.has(declaration.node.start) &&
          Walker.isReferenceIdentifier(node, parent!)
        ) {
          if (
            parent?.type !== 'CallExpression' ||
            parent.callee !== node ||
            parent.optional
          )
            throw new InvalidError(
              'variable must be called directly in a module-level constant.',
              node,
            )
          if (
            !ancestors.some(
              (entry) =>
                entry.type === 'VariableDeclaration' && entry.kind === 'const',
            ) ||
            ancestors.some((entry) =>
              [
                'ArrowFunctionExpression',
                'FunctionExpression',
                'FunctionDeclaration',
                'BlockStatement',
              ].includes(entry.type),
            )
          )
            throw new InvalidError(
              'variable requires a module-level constant.',
              parent,
            )
          factories.push(parent)
        }
      }
      if (node.type === 'VariableDeclaration' && node.kind === 'const')
        for (const declaration of node.declarations)
          if (declaration.id.type === 'Identifier' && declaration.init)
            bindings.set(declaration.start, declaration.init)
      if (node.type === 'TSModuleDeclaration' && node.id.type === 'Identifier')
        namespaces.set(node.id.start, members(node))
      ancestors.push(node)
    },
    leave() {
      ancestors.pop()
    },
  })

  const calls: Call[] = []
  const definitions = new Map<number, Themes.Link>()
  const registrations: Css.Contribution[] = []
  const registrationStarts: number[] = []
  const registrationLocations: Ast.Node[] = []
  for (const call of factories) {
    const domain = call.arguments[0] && Expression.unwrap(call.arguments[0])
    const value = call.arguments[1] && Expression.unwrap(call.arguments[1])
    const kind = domain?.type === 'Literal' ? domain.value : undefined
    if (
      ![
        'color',
        'length',
        'number',
        'percentage',
        'signedLength',
        'signedPercentage',
      ].includes(String(kind)) ||
      call.arguments.length > 2 ||
      (value && value.type !== 'ObjectExpression')
    )
      throw new InvalidError(
        'variable requires a scalar domain and optional literal registration options.',
        call,
      )
    const descriptor: Record<string, string | number | boolean> =
      Object.create(null)

    if (value?.type === 'ObjectExpression')
      for (const entry of value.properties) {
        if (
          entry.type !== 'Property' ||
          entry.computed ||
          entry.method ||
          entry.kind !== 'init'
        )
          throw new InvalidError(
            'Variable registrations require literal descriptors.',
            value,
          )

        const key =
          entry.key.type === 'Identifier'
            ? entry.key.name
            : entry.key.type === 'Literal'
              ? String(entry.key.value)
              : ''

        const input = Expression.unwrap(entry.value)
        if (
          key === 'syntax' &&
          input.type === 'Identifier' &&
          input.name === 'undefined' &&
          undefinedValues.has(input.start)
        )
          continue

        const literal =
          input.type === 'Literal'
            ? input.value
            : input.type === 'UnaryExpression' &&
                ['+', '-'].includes(input.operator) &&
                input.argument.type === 'Literal' &&
                typeof input.argument.value === 'number'
              ? (input.operator === '-' ? -1 : 1) * input.argument.value
              : undefined
        if (
          !['syntax', 'inherits', 'initialValue'].includes(key) ||
          Object.hasOwn(descriptor, key) ||
          !['string', 'number', 'boolean'].includes(typeof literal)
        )
          throw new InvalidError(
            'Invalid variable registration descriptor.',
            entry,
          )

        descriptor[key] = literal as string | number | boolean
      }

    const name = `--z-v${namespace}-${call.start}` as const
    if (value?.type === 'ObjectExpression') {
      const syntax =
        kind === 'signedLength'
          ? '<length>'
          : kind === 'signedPercentage'
            ? '<percentage>'
            : `<${kind}>`
      if (
        typeof descriptor.inherits !== 'boolean' ||
        !['string', 'number'].includes(typeof descriptor.initialValue) ||
        (descriptor.syntax !== undefined && descriptor.syntax !== syntax)
      )
        throw new InvalidError(
          'Registration requires matching syntax, inherits, and an independent initialValue.',
          value,
        )

      registrationStarts.push(call.start)
      registrationLocations.push(call)
      registrations.push({
        kind: 'property',
        name,
        syntax,
        inherits: descriptor.inherits,
        initialValue: descriptor.initialValue as string | number,
      })
    }

    const slot = Object.freeze({
      name,
      type: kind as Binding.Kind,
      variable: true as const,
    })
    const entry = Object.freeze({
      start: call.start,
      end: call.end,
      slots: Object.freeze({ value: slot }),
    })
    calls.push(entry)
    definitions.set(call.start, {
      binding: name,
      kind: 'variables',
      definition: Theme.define({}),
      call: {
        start: call.start,
        end: call.end,
        name,
        tokenType: '{}',
        variables: entry.slots,
        variableOwner: moduleId.replace(/\.[cm]?[jt]sx?$/, ''),
      },
    })
  }

  function group(
    values: Map<string, Ast.Expression>,
    start: number,
    seen: Set<Ast.Node>,
  ): Themes.Link | undefined {
    const members: Record<string, Themes.Link> = Object.create(null)
    for (const [name, value] of values) {
      const member = resolve(value, new Set(seen))
      if (member) members[name] = member
    }
    if (!Object.keys(members).length) return undefined
    return {
      binding: `z-v${namespace}-${start}`,
      kind: 'variables',
      definition: Theme.define({}),
      call: { start: -1, end: -1, name: '', tokenType: '{}', variables: {} },
      members,
    }
  }

  function resolve(
    input: Ast.Node,
    seen = new Set<Ast.Node>(),
  ): Themes.Link | undefined {
    const node = Expression.unwrap(input)
    if (seen.has(node)) return undefined
    seen.add(node)
    if (node.type === 'CallExpression') return definitions.get(node.start)
    if (node.type === 'Identifier') {
      const declaration = declarations.get(node.start)
      if (declaration === undefined) return undefined
      const imported = external.get(declaration)
      if (imported) return imported
      const values = namespaces.get(declaration)
      if (values) return group(values, declaration, seen)
      const value = bindings.get(declaration)
      return value ? resolve(value, seen) : undefined
    }
    if (node.type === 'MemberExpression' && !node.optional) {
      const key =
        !node.computed && node.property.type === 'Identifier'
          ? node.property.name
          : node.property.type === 'Literal'
            ? String(node.property.value)
            : undefined
      if (key === undefined) return undefined
      return resolve(node.object, seen)?.members?.[key]
    }
    if (node.type === 'ObjectExpression') {
      const values = new Map<string, Ast.Expression>()
      for (const property of node.properties) {
        if (
          property.type !== 'Property' ||
          property.method ||
          property.kind !== 'init' ||
          property.computed
        )
          return undefined
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : undefined
        if (key !== undefined) values.set(key, property.value)
      }
      return group(values, node.start, seen)
    }
    return undefined
  }

  const references = new Map<
    number,
    { end: number; reference: Binding.Reference }
  >()
  Walker.walk(program, {
    enter(node) {
      if (node.type !== 'Identifier' && node.type !== 'MemberExpression') return
      const resolved = resolve(node)
      const reference = resolved?.call.variables?.value
      if (reference) references.set(node.start, { end: node.end, reference })
    },
  })

  const exports: Record<string, Themes.Link> = Object.create(null)
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const link = resolve(statement.declaration)
      if (link) exports.default = link
    }
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.exportKind === 'type'
    )
      continue
    const declaration = statement.declaration
    if (declaration?.type === 'VariableDeclaration')
      for (const variable of declaration.declarations) {
        if (variable.id.type !== 'Identifier' || !variable.init) continue
        const link = resolve(variable.init)
        if (link) exports[variable.id.name] = link
      }
    if (
      declaration?.type === 'TSModuleDeclaration' &&
      declaration.id.type === 'Identifier'
    ) {
      const link = group(members(declaration), declaration.start, new Set())
      if (link) exports[declaration.id.name] = link
    }
    for (const specifier of statement.specifiers) {
      if (specifier.exportKind === 'type') continue
      const link = resolve(specifier.local)
      if (link)
        exports[
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        ] = link
    }
  }

  function reference(
    node: Extract<Ast.Node, { type: 'Identifier' | 'JSXIdentifier' }>,
    parent: Ast.Node,
    binding: Walker.ScopeTrackerNode | null,
  ) {
    if (binding?.type === 'Import' && imports.has(binding.node.start))
      return true
    const link =
      resolve(
        parent.type === 'MemberExpression' && parent.object === node
          ? parent
          : node,
      ) ?? resolve(node)
    if (!link) return false
    if (link.call.start >= 0 && node.start < link.call.end)
      throw new InvalidError('Variables must be declared before use.', node)
    return true
  }

  return {
    calls,
    exports,
    reference,
    references,
    registrations,
    registrationStarts,
    registrationLocations,
  }
}
