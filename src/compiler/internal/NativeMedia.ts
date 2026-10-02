/** Lowers native media rules and conditional tokens to bounded static alternatives. @module */
import * as CssTree from 'css-tree'
import type * as Media from '../../runtime/internal/NativeMedia.js'
import * as Scalar from '../../react-native/internal/Scalar.js'
import type * as Style from '../../Style.js'
import type * as StyleSheet from '../../react-native/StyleSheet.js'
import * as Token from '../../internal/Token.js'

/** Retains authored precedence while selecting each possible media outcome. */
export function prepare<variables extends StyleSheet.compile.Options['vars']>(
  styles: readonly Style.NamedStyle[] | undefined,
  vars: variables,
  options: Scalar.Options,
) {
  const catalog: StyleSheet.compile.Options['vars'] = vars
  const expressions = new Map<string, number>()
  const names = new Map<string, number>()
  const queries: Media.Query[] = []
  const visited = new Set<object>()

  function add(name: string) {
    if (names.has(name)) return

    const query = parse(name, options)
    const expression = JSON.stringify(query)
    let index = expressions.get(expression)
    if (index === undefined) {
      index = queries.length
      if (index === 8)
        throw new Error(
          'Native media supports at most eight distinct conditions per definition.',
        )

      queries.push(query)
      expressions.set(expression, index)
    }

    names.set(name, index)
  }

  function values(value: unknown) {
    if (!value || typeof value !== 'object' || visited.has(value)) return

    visited.add(value)
    if (Token.is(value)) {
      values(value.value)
      for (const theme of Object.values(catalog ?? {})) {
        const metadata = theme[Token.definition]
        if (
          metadata.contract === value.contract ||
          (metadata.contract[Token.identity] !== undefined &&
            metadata.contract[Token.identity] ===
              value.contract[Token.identity])
        )
          values(metadata.values[value.path])
      }
    } else if (Token.isExpression(value)) value.parts.forEach(values)
    else if ('default' in value) {
      for (const [name, entry] of Object.entries(value)) {
        if (name !== 'default') {
          // Unsupported variable leaves keep their deferred read diagnostic.
          try {
            add(name)
          } catch (error) {
            if (!(error instanceof UnsupportedError)) throw error
          }
        }
        values(entry)
      }
    } else if ('light' in value && 'dark' in value) {
      values(value.light)
      values(value.dark)
    }
  }

  function visit(style: Style.NamedStyle) {
    for (const declaration of style.declarations) values(declaration.value)
    for (const rule of style.rules ?? []) {
      if (rule.condition?.startsWith('@media')) add(rule.condition)
      visit(rule.style)
    }
  }

  styles?.forEach(visit)
  if (!styles)
    for (const theme of Object.values(catalog ?? {})) {
      const metadata = theme[Token.definition]
      Object.values(metadata.values).forEach(values)
    }
  if (!queries.length) return

  return {
    queries,
    select(selection: string) {
      const active = new Set<object>()
      function value<entry>(entry: entry): entry {
        if (!entry || typeof entry !== 'object') return entry
        if (active.has(entry))
          throw new Error('Native token aliases must not form a cycle.')

        active.add(entry)
        try {
          if (Token.is(entry))
            return Token.create({
              ...entry,
              value: value(entry.value),
            }) as entry
          if (Token.isExpression(entry))
            return { ...entry, parts: entry.parts.map(value) } as entry
          if ('default' in entry) {
            const branches = Object.entries(entry)
            if (
              branches.some(([name]) => name !== 'default' && !names.has(name))
            )
              return entry

            let selected = entry.default
            for (const [name, branch] of branches)
              if (name !== 'default' && selection[names.get(name)!] === '1')
                selected = branch

            return value(selected) as entry
          }
          if ('light' in entry && 'dark' in entry)
            return {
              ...entry,
              dark: value(entry.dark),
              light: value(entry.light),
            }
          return entry
        } finally {
          active.delete(entry)
        }
      }

      function style(entry: Style.NamedStyle): Style.NamedStyle {
        return {
          ...entry,
          declarations: entry.declarations.map((declaration) => ({
            ...declaration,
            value: value(declaration.value),
          })),
          ...(entry.rules
            ? {
                rules: entry.rules.flatMap((rule) => {
                  const index =
                    rule.condition === undefined
                      ? undefined
                      : names.get(rule.condition)
                  if (index !== undefined && selection[index] !== '1') return []

                  return [
                    {
                      ...(index === undefined ? rule : {}),
                      style: style(rule.style),
                    },
                  ]
                }),
              }
            : {}),
        }
      }

      return {
        style,
        vars:
          catalog &&
          (Object.fromEntries(
            Object.entries(catalog).map(([name, theme]) => {
              const metadata = theme[Token.definition]
              return [
                name,
                Object.defineProperty({}, Token.definition, {
                  value: {
                    ...metadata,
                    values: Object.fromEntries(
                      Object.entries(metadata.values).map(([path, entry]) => [
                        path,
                        value(entry),
                      ]),
                    ),
                  },
                }) as typeof theme,
              ]
            }),
          ) as variables),
      }
    },
    selections: Array.from({ length: 2 ** queries.length }, (_entry, index) =>
      index.toString(2).padStart(queries.length, '0'),
    ),
  }
}

class UnsupportedError extends Error {
  override name = 'NativeMedia.UnsupportedError'
}

function parse(input: string, options: Scalar.Options): Media.Query {
  if (!input.startsWith('@media'))
    throw new UnsupportedError(
      'Native conditional variables require media queries.',
    )
  const parsed = CssTree.parse(input.slice(6), { context: 'mediaQueryList' })
  let count = 0
  function read(node: CssTree.CssNode): Media.Query {
    if (++count > 128)
      throw new Error('Native media queries exceed 128 syntax nodes.')
    if (node.type === 'MediaQueryList') {
      const queries = node.children.toArray().map(read)
      return queries.length === 1 ? queries[0]! : { kind: 'or', queries }
    }
    if (node.type === 'MediaQuery') {
      if (
        (node.mediaType &&
          !['all', 'screen'].includes(node.mediaType.toLowerCase())) ||
        node.modifier?.toLowerCase() === 'not'
      )
        throw new UnsupportedError(
          'Native media types support all or screen without negation.',
        )
      return node.condition
        ? read(node.condition)
        : { kind: 'compare', left: 0, operator: '=', right: 0 }
    }
    if (node.type === 'Condition') {
      const parts = node.children.toArray()
      if (parts.length === 1) return read(parts[0]!)
      if (
        parts.length === 2 &&
        parts[0]?.type === 'Identifier' &&
        parts[0].name.toLowerCase() === 'not'
      )
        return { kind: 'not', query: read(parts[1]!) }
      const operator =
        parts[1]?.type === 'Identifier'
          ? parts[1].name.toLowerCase()
          : undefined
      if (
        (operator !== 'and' && operator !== 'or') ||
        parts.length % 2 !== 1 ||
        parts.some(
          (part, index) =>
            index % 2 === 1 &&
            (part.type !== 'Identifier' ||
              part.name.toLowerCase() !== operator),
        )
      )
        throw new UnsupportedError('Unsupported native media condition.')
      return {
        kind: operator,
        queries: parts.filter((_part, index) => index % 2 === 0).map(read),
      }
    }
    function operand(entry: CssTree.CssNode): number | 'height' | 'width' {
      if (
        entry.type === 'Identifier' &&
        (entry.name.toLowerCase() === 'height' ||
          entry.name.toLowerCase() === 'width')
      )
        return entry.name.toLowerCase() as 'height' | 'width'
      if (entry.type === 'Dimension') {
        try {
          return Scalar.length(
            `${entry.value}${entry.unit.toLowerCase()}`,
            options,
            false,
            [],
          )
        } catch (error) {
          throw new UnsupportedError((error as Error).message)
        }
      }
      if (entry.type === 'Number' && Number(entry.value) === 0) return 0
      throw new UnsupportedError(
        'Native media ranges require width/height and px/rem thresholds.',
      )
    }
    function comparison(
      left: CssTree.CssNode,
      operator: string | null,
      right: CssTree.CssNode,
    ): Media.Query {
      if (!operator || !['<', '<=', '=', '>', '>='].includes(operator))
        throw new UnsupportedError('Unsupported native media comparison.')
      return {
        kind: 'compare',
        left: operand(left),
        operator: operator as '<' | '<=' | '=' | '>' | '>=',
        right: operand(right),
      }
    }
    if (node.type === 'FeatureRange') {
      const first = comparison(node.left, node.leftComparison, node.middle)
      return node.right
        ? {
            kind: 'and',
            queries: [
              first,
              comparison(node.middle, node.rightComparison, node.right),
            ],
          }
        : first
    }
    if (node.type === 'Feature') {
      const name = node.name.toLowerCase()
      if (
        name === 'orientation' &&
        node.value?.type === 'Identifier' &&
        ['landscape', 'portrait'].includes(node.value.name.toLowerCase())
      )
        return {
          kind: 'compare',
          left: 'width',
          operator: node.value.name.toLowerCase() === 'landscape' ? '>' : '<=',
          right: 'height',
        }
      const match = /^(?:(min|max)-)?(height|width)$/.exec(name)
      if (match)
        return {
          kind: 'compare',
          left: match[2] as 'height' | 'width',
          operator:
            match[1] === 'min'
              ? '>='
              : match[1] === 'max'
                ? '<='
                : node.value
                  ? '='
                  : '>',
          right: node.value ? operand(node.value) : 0,
        }
    }
    throw new UnsupportedError('Unsupported native media feature.')
  }

  return read(parsed)
}
