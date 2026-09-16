/** Validates static native values against the pinned declaration domains. @module */
import type * as Native from '../../internal/NativeProperties.js'
import * as Targets from '../../internal/Targets.js'
import schema from './NativeSchema.js'

type Node = {
  kind: string
  properties?: Record<string, { optional: boolean; value: number }> | undefined
  value?: unknown
  values?: readonly number[] | undefined
}
const data = schema as { root: number; nodes: readonly Node[] }

/** Copies static native declarations and returns the first rejected property as a diagnostic. */
export function parse(input: unknown): Native.Output {
  const value = Targets.copy(input)
  const root = data.nodes[data.root]!
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a native declaration record.')
  for (const [key, property] of Object.entries(value)) {
    if (!Object.hasOwn(root.properties!, key))
      throw new Error(`Unknown native property: ${key}.`)
    if (!matches(root.properties![key]!.value, property))
      throw new Error(`Invalid static native value for ${key}.`)
  }
  const transforms = (value as Native.Output).transform
  if (Array.isArray(transforms)) {
    if (transforms.length > 1 && transforms.some((entry) => 'matrix' in entry))
      throw new Error('A native matrix must be the only transform entry.')
    for (const entry of transforms)
      if ('matrix' in entry && ![9, 16].includes(entry.matrix.length))
        throw new Error('Native matrices require nine or sixteen numbers.')
  }
  return value as Native.Output
}

function matches(id: number, value: unknown): boolean {
  const node = data.nodes[id]!
  switch (node.kind) {
    case 'tuple':
      return (
        Array.isArray(value) &&
        value.length === node.values!.length &&
        node.values!.every((entry, index) => matches(entry, value[index]))
      )
    case 'array':
      return (
        Array.isArray(value) &&
        value.every((entry) => matches(node.value as number, entry))
      )
    case 'literal':
      return value === node.value
    case 'never':
      return false
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false
      const record = value as Record<string, unknown>
      return (
        Object.keys(record).every((key) =>
          Object.hasOwn(node.properties!, key),
        ) &&
        Object.entries(node.properties!).every(([key, property]) =>
          !Object.hasOwn(record, key)
            ? property.optional
            : matches(property.value, record[key]),
        )
      )
    }
    case 'percentage':
      return (
        typeof value === 'string' &&
        /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/i.test(value) &&
        Number.isFinite(Number(value.slice(0, -1)))
      )
    case 'string':
      return typeof value === 'string'
    case 'undefined':
      return value === undefined
    case 'union':
      return node.values!.some((entry) => matches(entry, value))
    default:
      throw new Error(`Unclassified native schema kind: ${node.kind}`)
  }
}
