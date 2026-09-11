/** Extracts module-owned explicit slot contracts without executing application code. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import type * as Scope from './Scope.js'
import type * as Css from '../../web/Css.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'
import type * as Binding from '../../internal/Binding.js'
import * as Expression from './Expression.js'
import { InvalidError } from './Themes.js'

/** A variable factory span and immutable compiler-assigned slot data. */
export type Call = {
  /** Exclusive source offset. */
  readonly end: number
  /** Slot reference objects keyed by schema names. */
  readonly slots: Readonly<Record<string, Binding.Reference>>
  /** Inclusive source offset. */
  readonly start: number
}

/** Collects constant schemas and resolves references with the host's lexical bindings. */
export function collect(
  program: Ast.Program,
  namespace: string,
  scope: Scope.Tracker,
  links: Readonly<Record<string, Themes.Link>> = {},
) {
  const imports = new Set<number>()
  const names = new Set<string>()
  for (const node of program.body)
    if (
      node.type === 'ImportDeclaration' &&
      node.source.value === 'zyzz' &&
      node.importKind !== 'type'
    )
      for (const specifier of node.specifiers)
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind !== 'type' &&
          (specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value) === 'Vars'
        ) {
          imports.add(specifier.start)
          names.add(specifier.local.name)
        }
  const undefinedValues = new Set<number>()
  if (imports.size)
    Walker.walk(program, {
      scopeTracker: scope,
      enter(node) {
        if (
          node.type === 'Identifier' &&
          node.name === 'undefined' &&
          !scope.getDeclaration(node.name)
        )
          undefinedValues.add(node.start)
      },
    })
  const exports: Record<string, Themes.Link> = Object.create(null)
  const bound = new Map<string, Themes.Link>()
  const registrations: Css.Contribution[] = []
  const registrationStarts: number[] = []
  const calls: Call[] = []
  const definitions = new Map<number, Call>()
  const references = new Map<
    number,
    { end: number; reference: Binding.Reference }
  >()
  for (const statement of program.body)
    if (statement.type === 'ImportDeclaration')
      for (const specifier of statement.specifiers) {
        if ('exportKind' in specifier && specifier.exportKind === 'type')
          continue
        const link = links[specifier.local.name]
        if (link?.kind === 'variables' && link.call.variables) {
          bound.set(specifier.local.name, link)
          definitions.set(specifier.start, {
            start: -1,
            end: -1,
            slots: link.call.variables,
          })
        }
      }
  for (const statement of program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (node?.type !== 'VariableDeclaration' || node.kind !== 'const') continue
    for (const declaration of node.declarations) {
      if (declaration.id.type !== 'Identifier' || !declaration.init) continue
      const call = Expression.unwrap(declaration.init)
      if (call.type === 'Identifier') {
        const link = bound.get(call.name)
        if (link?.call.variables) {
          bound.set(declaration.id.name, link)
          definitions.set(declaration.start, {
            start: declaration.start,
            end: declaration.end,
            slots: link.call.variables,
          })
          if (statement.type === 'ExportNamedDeclaration')
            exports[declaration.id.name] = link
          continue
        }
      }
      if (
        call.type !== 'CallExpression' ||
        call.optional ||
        call.callee.type !== 'MemberExpression' ||
        call.callee.optional ||
        call.callee.computed ||
        call.callee.object.type !== 'Identifier' ||
        !names.has(call.callee.object.name) ||
        call.callee.property.type !== 'Identifier' ||
        call.callee.property.name !== 'define'
      )
        continue
      const schema = call.arguments[0] && Expression.unwrap(call.arguments[0])
      if (call.arguments.length !== 1 || schema?.type !== 'ObjectExpression')
        throw new InvalidError('Vars.define requires one literal schema.', call)
      const slots: Record<string, Binding.Reference> = Object.create(null)
      for (const property of schema.properties) {
        if (
          property.type !== 'Property' ||
          property.kind !== 'init' ||
          property.method ||
          property.computed ||
          property.shorthand
        )
          throw new InvalidError(
            'Variable schemas require explicit literal properties.',
            property,
          )
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : undefined
        const value = Expression.unwrap(property.value)
        const descriptor: Record<string, string | number | boolean> =
          Object.create(null)
        if (value.type === 'ObjectExpression')
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
              !['type', 'syntax', 'inherits', 'initialValue'].includes(key) ||
              Object.hasOwn(descriptor, key) ||
              !['string', 'number', 'boolean'].includes(typeof literal)
            )
              throw new InvalidError(
                'Invalid variable registration descriptor.',
                entry,
              )
            descriptor[key] = literal as string | number | boolean
          }
        const kind = value.type === 'Literal' ? value.value : descriptor.type
        if (
          !key ||
          key === 'set' ||
          Object.hasOwn(slots, key) ||
          (value.type !== 'Literal' && value.type !== 'ObjectExpression') ||
          ![
            'color',
            'length',
            'number',
            'percentage',
            'signedLength',
            'signedPercentage',
          ].includes(String(kind))
        )
          throw new InvalidError(
            'Variable schemas require unique names and supported scalar domains.',
            property,
          )
        const name =
          `--z-v${namespace}-${encode(declaration.id.name)}--${encode(key)}` as const
        if (value.type === 'ObjectExpression') {
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
          registrationStarts.push(property.start)
          registrations.push({
            kind: 'property',
            name,
            syntax,
            inherits: descriptor.inherits,
            initialValue: descriptor.initialValue as string | number,
          })
        }
        slots[key] = Object.freeze({
          name,
          type: kind as Binding.Kind,
          variable: true,
        })
      }
      const entry = Object.freeze({
        end: call.end,
        slots: Object.freeze(slots),
        start: call.start,
      })
      calls.push(entry)
      definitions.set(declaration.start, entry)
      const link: Themes.Link = {
        binding: `${namespace}-${declaration.id.name}`,
        kind: 'variables',
        definition: Theme.define({}),
        call: {
          start: call.start,
          end: call.end,
          name: `${namespace}-${declaration.id.name}`,
          tokenType: '{}',
          variables: entry.slots,
        },
      }
      bound.set(declaration.id.name, link)
      if (statement.type === 'ExportNamedDeclaration')
        exports[declaration.id.name] = link
    }
  }
  function reference(
    node: Extract<Ast.Node, { type: 'Identifier' | 'JSXIdentifier' }>,
    parent: Ast.Node,
    binding: Walker.ScopeTrackerNode | null,
  ) {
    if (binding?.type === 'Import' && imports.has(binding.node.start)) {
      if (
        parent.type === 'MemberExpression' &&
        (calls.some((call) => parent.start === call.start) ||
          (!parent.computed &&
            parent.property.type === 'Identifier' &&
            parent.property.name === 'MissingTransformError'))
      )
        return true
      throw new InvalidError(
        'Vars.define requires a module-level constant; The returned contract provides set(values).',
        node,
      )
    }
    if (binding?.type !== 'Variable' && binding?.type !== 'Import') return false
    const definition = definitions.get(binding.node.start)
    if (!definition) return false
    if (node.start < definition.end)
      throw new InvalidError(
        'Variable contracts must be declared before use.',
        node,
      )
    if (parent.type === 'MemberExpression' && parent.object === node) {
      const key =
        parent.property.type === 'Identifier' && !parent.computed
          ? parent.property.name
          : parent.property.type === 'Literal' && parent.computed
            ? String(parent.property.value)
            : undefined
      if (key === 'set' && !parent.optional) return true
      const slot = key === undefined ? undefined : definition.slots[key]
      if (parent.optional || !slot)
        throw new InvalidError(
          'Expected a declared scalar variable path.',
          parent,
        )
      references.set(parent.start, { end: parent.end, reference: slot })
    }
    return true
  }
  for (const statement of program.body)
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.exportKind !== 'type' &&
      !statement.source
    )
      for (const specifier of statement.specifiers) {
        if ('exportKind' in specifier && specifier.exportKind === 'type')
          continue
        const name =
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value
        const link = bound.get(name)
        if (link)
          exports[
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value
          ] = link
      }
  return {
    calls,
    reference,
    references,
    registrations,
    registrationStarts,
    exports,
  }
}

function encode(value: string): string {
  return Array.from(value)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('-')
}
