/** Reuses typed callback extraction for isolated recipe payload contexts. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import type * as Binding from '../../internal/Binding.js'
import * as Dynamic from './Dynamic.js'
import * as Expression from './Expression.js'

/** Shared callback validation and lookup boundary consumed by source extraction. */
export type Bindings = Pick<
  NonNullable<ReturnType<typeof Dynamic.read>>,
  'accepts' | 'resolve' | 'slots'
>

/** Collects isolated bindings without evaluating any author callback. */
export function create(options: create.Options) {
  const references = new WeakMap<Ast.Node, Binding.Reference>()
  const owners = new Map<
    Binding.Reference,
    NonNullable<ReturnType<typeof Dynamic.read>>
  >()
  const slots: Record<string, Binding.Reference> = Object.create(null)

  return {
    accepts(reference: Binding.Reference, property: string) {
      return owners.get(reference)?.accepts(reference, property) ?? false
    },
    read(node: Ast.Node, identity: string) {
      const model = Dynamic.read(
        structuredClone(node),
        identity,
        options.resolveType,
      )
      if (!model) return undefined
      const body = options.normalize(model.body) as Ast.ObjectExpression
      Walker.walk(body, {
        enter(node) {
          const slot = model.resolve(node)
          if (slot) references.set(Expression.unwrap(node), slot)
        },
      })
      for (const slot of Object.values(model.slots)) {
        owners.set(slot, model)
        slots[slot.name] = slot
      }
      return {
        ...model,
        body,
        acceptsValue(field: string, value: string | number) {
          const type = options.resolveType(model.type)
          if (type.type !== 'TSTypeLiteral') return false
          const member = type.members.find(
            (member) =>
              member.type === 'TSPropertySignature' &&
              (member.key.type === 'Identifier'
                ? member.key.name
                : member.key.type === 'Literal'
                  ? member.key.value
                  : undefined) === field,
          )
          return (
            member?.type === 'TSPropertySignature' &&
            member.typeAnnotation != null &&
            accepts(
              options.resolveType(member.typeAnnotation.typeAnnotation),
              value,
            )
          )
        },
      }
    },
    resolve(node: Ast.Node) {
      return references.get(Expression.unwrap(node))
    },
    slots,
  }
}

/** Source-owned static resolution hooks. */
export declare namespace create {
  /** Compiler adapters used for the same resolution as dynamic css callbacks. */
  type Options = {
    /** Expands immutable body data without executing expressions. */
    readonly normalize: (node: Ast.Node) => Ast.Node
    /** Resolves finite local or imported callback type aliases. */
    readonly resolveType: (node: Ast.Node) => Ast.Node
  }
}

function accepts(node: Ast.Node, value: string | number): boolean {
  if (node.type === 'TSUnionType')
    return node.types.some((node) => accepts(node, value))
  if (node.type === 'TSIntersectionType')
    return node.types.every((node) => accepts(node, value))
  if (node.type === 'TSStringKeyword') return typeof value === 'string'
  if (node.type === 'TSNumberKeyword')
    return typeof value === 'number' && Number.isFinite(value)
  if (node.type === 'TSLiteralType') {
    if (node.literal.type === 'Literal') return node.literal.value === value
    if (
      node.literal.type === 'UnaryExpression' &&
      node.literal.operator === '-' &&
      node.literal.argument.type === 'Literal' &&
      typeof node.literal.argument.value === 'number'
    )
      return -node.literal.argument.value === value
  }
  if (node.type === 'TSTemplateLiteralType' && typeof value === 'string') {
    const template = node
    const input = value
    function match(index: number, offset: number): boolean {
      const text =
        template.quasis[index]!.value.cooked ??
        template.quasis[index]!.value.raw
      if (!input.startsWith(text, offset)) return false
      offset += text.length
      if (index === template.types.length) return offset === input.length
      for (let end = offset; end <= input.length; end++) {
        const part = input.slice(offset, end)
        const type = template.types[index]!
        const valid =
          accepts(type, part) ||
          (part.trim() !== '' &&
            Number.isFinite(Number(part)) &&
            accepts(type, Number(part)))
        if (valid && match(index + 1, end)) return true
      }
      return false
    }
    return match(0, 0)
  }
  return false
}
