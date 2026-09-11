/** Samples compositional grammar branches independently of Zyzz property metadata. @module */
import * as CssTree from 'css-tree'

const primitives: Readonly<Record<string, readonly string[]>> = {
  angle: ['1deg'],
  'custom-ident': ['probe'],
  'dashed-ident': ['--probe'],
  'declaration-value': ['red'],
  dimension: ['1px'],
  flex: ['1fr'],
  frequency: ['1Hz'],
  ident: ['probe'],
  integer: ['1'],
  length: ['1px'],
  'length-percentage': ['1px', '10%'],
  number: ['1'],
  percentage: ['10%'],
  resolution: ['1dppx'],
  string: ['"probe"'],
  time: ['1s'],
  url: ['url("#probe")'],
}

/** Produces bounded branch, repetition, and order probes, retaining only valid upstream declarations. */
export function values(
  lexer: CssTree.Lexer,
  property: string,
): readonly string[] {
  const cache = new Map<string, readonly string[]>()

  function reference(
    kind: 'Property' | 'Type',
    name: string,
    depth: number,
  ): readonly string[] {
    if (kind === 'Type' && primitives[name]) return primitives[name]
    if (depth < 0) return name === 'color' ? ['red'] : []

    const key = `${kind}:${name}:${depth}`
    const previous = cache.get(key)
    if (previous) return previous

    const syntax = (
      kind === 'Property' ? lexer.getProperty(name) : lexer.getType(name)
    )?.syntax
    if (!syntax || typeof syntax === 'function') return []

    const output = expand(syntax, depth)

    cache.set(key, output)

    return output
  }

  function merge(groups: readonly (readonly string[])[]): readonly string[] {
    const output = new Set<string>()

    // Round-robin selection keeps large keyword families from hiding later branches.
    for (let index = 0; index < 64 && output.size < 64; index++) {
      let found = false

      for (const group of groups) {
        const value = group[index]
        if (value === undefined) continue

        found = true
        output.add(value)
      }

      if (!found) break
    }

    return [...output]
  }

  function sequence(groups: readonly (readonly string[])[]): readonly string[] {
    if (groups.some((group) => !group.length)) return []

    const base = groups.map((group) => group[0]!)

    return merge(
      groups.map((group, index) =>
        group.map((value) =>
          base
            .map((entry, position) => (position === index ? value : entry))
            .filter(Boolean)
            .join(' '),
        ),
      ),
    )
  }

  function expand(node: CssTree.DSNode, depth: number): readonly string[] {
    switch (node.type) {
      case 'AtKeyword':
        return [`@${node.name}`]
      case 'Boolean':
        return expand(node.term, depth)
      case 'Comma':
        return [',']
      case 'Function':
        return [`${node.name}(`]
      case 'Keyword':
        return [node.name]
      case 'Property':
        return reference('Property', node.name, depth - 1)
      case 'String':
        return [node.value]
      case 'Token':
        return [node.value]
      case 'Type':
        if ((node.name === 'integer' || node.name === 'number') && node.opts)
          return [
            String(
              Math.min(
                node.opts.max ?? Infinity,
                Math.max(1, node.opts.min ?? -Infinity),
              ),
            ),
          ]

        return reference('Type', node.name, depth - 1)
      case 'Multiplier': {
        const terms = expand(node.term, depth)

        const counts = [
          ...new Set([
            node.min,
            Math.max(1, node.min),
            node.max > 0
              ? Math.min(node.max, Math.max(node.min, 3))
              : Math.max(2, node.min),
          ]),
        ]

        return merge(
          counts.map((count) =>
            count === 0
              ? ['']
              : terms.map((term) =>
                  Array.from({ length: count }, () => term).join(
                    node.comma ? ', ' : ' ',
                  ),
                ),
          ),
        )
      }
      case 'Group': {
        const groups = node.terms.map((term) => expand(term, depth))
        if (node.combinator === '|') return merge(groups)
        if (node.combinator === ' ') return sequence(groups)

        const permutations = groups.map((_, offset) =>
          sequence([...groups.slice(offset), ...groups.slice(0, offset)]),
        )

        return merge(
          node.combinator === '||'
            ? [...groups, ...permutations]
            : permutations,
        )
      }
    }
  }

  const candidates = reference('Property', property, 8)
    .map((value) => value.trim())
    .filter((value) => value && !lexer.matchProperty(property, value).error)

  return [
    ...new Set(
      candidates.flatMap((value) => [
        value,
        CssTree.generate(CssTree.parse(value, { context: 'value' })),
      ]),
    ),
  ]
}
