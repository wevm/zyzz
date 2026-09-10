/** Pure ordered stylesheet contribution data and layer ordering. @module */
import type * as Style from '../../Style.js'

/** Explicit stylesheet data supplied by source adapters or in-memory callers. */
export type Definition =
  | {
      readonly kind: 'rule'
      readonly selector: string
      readonly style: Style.NamedStyle
    }
  | {
      readonly kind: 'font-face'
      readonly declarations: Readonly<Record<string, string | number>>
    }
  | {
      readonly kind: 'keyframes'
      readonly name: string
      readonly frames: readonly {
        readonly stop: string
        readonly style: Style.NamedStyle
      }[]
    }
  | { readonly kind: 'layers'; readonly names: readonly string[] }

/** Merges declared ordering constraints with deterministic unconstrained ties. */
export function order(
  lists: readonly (readonly string[])[],
): readonly string[] {
  const scopes = new Map<string, Map<string, Set<string>>>()
  const authored = new Set<string>()
  function scope(parent: string) {
    let graph = scopes.get(parent)
    if (!graph) {
      graph = new Map()
      scopes.set(parent, graph)
    }
    return graph
  }
  for (const list of lists) {
    if (new Set(list).size !== list.length)
      throw new Error('Duplicate layer name.')
    for (const name of list) {
      if (
        !/^(?:--|-?[_a-zA-Z])[\w-]*(?:\.(?:--|-?[_a-zA-Z])[\w-]*)*$/.test(
          name,
        ) ||
        name
          .split('.')
          .some((part) =>
            [
              'default',
              'inherit',
              'initial',
              'revert',
              'revert-layer',
              'unset',
            ].includes(part.toLowerCase()),
          )
      )
        throw new Error('Invalid layer name.')
      authored.add(name)
      const parts = name.split('.')
      for (let index = 0; index < parts.length; index++) {
        const graph = scope(parts.slice(0, index).join('.'))
        if (!graph.has(parts[index]!)) graph.set(parts[index]!, new Set())
      }
    }
    for (let index = 1; index < list.length; index++) {
      const before = list[index - 1]!.split('.'),
        after = list[index]!.split('.')
      const at = before.findIndex((value, index) => value !== after[index])
      if (at >= 0 && after[at] !== undefined)
        scope(before.slice(0, at).join('.')).get(before[at]!)!.add(after[at]!)
    }
  }
  const result: string[] = []
  function emit(parent: string) {
    const graph = scopes.get(parent)
    if (!graph) return
    while (graph.size) {
      const targets = new Set(
        [...graph.values()].flatMap((values) => [...values]),
      )
      const next = [...graph.keys()].find((name) => !targets.has(name))
      if (next === undefined)
        throw new Error('Conflicting layer order constraints.')
      const name = parent ? `${parent}.${next}` : next
      if (authored.has(name)) result.push(name)
      graph.delete(next)
      emit(name)
    }
  }
  emit('')
  return result
}

/** Renders static contributions without registration or environment access. */
export function render(
  definitions: readonly Definition[],
  style: (value: Style.NamedStyle) => string,
): string {
  const layers = order(
    definitions.flatMap((value) =>
      value.kind === 'layers' ? [value.names] : [],
    ),
  )
  return [
    layers.length ? `@layer ${layers.join(',')};` : '',
    ...definitions.map((value) => {
      if (value.kind === 'layers') return ''
      if (value.kind === 'rule')
        return `${value.selector}{${style(value.style)}}`
      if (value.kind === 'font-face')
        return `@font-face{${Object.entries(value.declarations)
          .map(
            ([key, value]) =>
              `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`,
          )
          .join('')}}`
      return `@keyframes ${value.name}{${value.frames.map((frame) => `${frame.stop}{${style(frame.style)}}`).join('')}}`
    }),
  ]
    .filter(Boolean)
    .join('\n')
}
