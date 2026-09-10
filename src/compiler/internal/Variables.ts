/** Extracts module-owned explicit slot contracts without executing application code. @module */
import type * as Ast from '@oxc-project/types'
import type * as Walker from 'oxc-walker'
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
export function collect(program: Ast.Program, namespace: string) {
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
  const calls: Call[] = []
  const definitions = new Map<number, Call>()
  const references = new Map<
    number,
    { end: number; reference: Binding.Reference }
  >()
  for (const statement of program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (node?.type !== 'VariableDeclaration' || node.kind !== 'const') continue
    for (const declaration of node.declarations) {
      if (declaration.id.type !== 'Identifier' || !declaration.init) continue
      const call = Expression.unwrap(declaration.init)
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
        if (
          !key ||
          Object.hasOwn(slots, key) ||
          value.type !== 'Literal' ||
          !['color', 'length', 'number', 'percentage'].includes(
            String(value.value),
          )
        )
          throw new InvalidError(
            'Variable schemas require unique names and supported scalar domains.',
            property,
          )
        const name =
          `--z-v${namespace}-${encode(declaration.id.name)}-${encode(key)}` as const
        slots[key] = Object.freeze({
          name,
          type: value.value as Binding.Kind,
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
        !parent.computed &&
        parent.property.type === 'Identifier' &&
        parent.property.name === 'set'
      )
        return true
      if (
        parent.type === 'MemberExpression' &&
        calls.some((call) => parent.start === call.start)
      )
        return true
      throw new InvalidError(
        'Vars.define requires a module-level constant; Vars.set assigns compiled slots.',
        node,
      )
    }
    if (binding?.type !== 'Variable') return false
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
  return { calls, reference, references }
}

function encode(value: string): string {
  return Array.from(value)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join('-')
}
