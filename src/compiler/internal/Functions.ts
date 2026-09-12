/** Checks CSS function arguments and defaults against native syntax definitions. @module */
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Lightning from 'lightningcss'
import * as Tree from 'css-tree'

/** Checks complete static values while leaving computed substitutions to CSS. */
export function value(syntax: string, input: string): string | undefined {
  const text = input.trim()
  const body =
    text.startsWith('{') && text.endsWith('}') ? text.slice(1, -1) : text
  const parsed = Tree.parse(body, { context: 'value' })
  let computed = false
  Tree.walk(parsed, (node) => {
    if (
      node.type === 'Function' &&
      /^(?:--|var$|env$|attr$)/i.test(Tree.ident.decode(node.name))
    )
      computed = true
  })
  const normalized = syntax.trim()
  const definition = normalized.startsWith('type(')
    ? normalized.slice(5, -1).trim()
    : normalized
  if (computed || definition === '*') return
  const alternatives: string[] = []
  let start = 0
  Tree.tokenize(definition, (type, from, to) => {
    if (type === Tree.tokenTypes.Delim && definition.slice(from, to) === '|') {
      alternatives.push(definition.slice(start, from).trim())
      start = to
    }
  })
  alternatives.push(definition.slice(start).trim())
  for (const alternative of alternatives) {
    try {
      if (alternative.startsWith('<')) {
        if (alternative.startsWith('<string>')) {
          if (Tree.lexer.match(alternative, body).error) continue
        } else
          Lightning.transform({
            filename: 'argument.css',
            code: new TextEncoder().encode(
              `@property --argument{syntax:${JSON.stringify(alternative)};inherits:false;initial-value:${body};}`,
            ),
          })
        return alternative
      }
      let multiplier = ''
      let atom = alternative
      Tree.tokenize(alternative, (type, from, to) => {
        if (
          type === Tree.tokenTypes.Delim &&
          to === alternative.length &&
          ['+', '#'].includes(alternative.slice(from, to))
        ) {
          multiplier = alternative.slice(from, to)
          atom = alternative.slice(0, from)
        }
      })
      const expected = Tree.ident.decode(atom)
      const nodes = (parsed as Tree.Value).children.toArray()
      let count = 0
      let comma = false
      let valid = true
      for (const node of nodes) {
        if (
          node.type === 'Operator' &&
          node.value === ',' &&
          multiplier === '#' &&
          count > 0 &&
          !comma
        ) {
          comma = true
          continue
        }
        if (
          node.type !== 'Identifier' ||
          Tree.ident.decode(node.name) !== expected ||
          (count > 0 && (multiplier === '' || (multiplier === '#' && !comma)))
        ) {
          valid = false
          break
        }
        count++
        comma = false
      }
      if (valid && count > 0 && !comma) return alternative
    } catch {
      /* Another syntax alternative may accept this value. */
    }
  }
  throw new Error('Invalid CSS function argument for its declared syntax.')
}

/** Validates packed function headers and body contexts before parser recovery. */
export function validate(source: string): void {
  Tree.walk(Tree.parse(source), {
    visit: 'Atrule',
    enter(rule) {
      if (rule.name.toLowerCase() !== 'function') return
      if (!rule.prelude || !rule.block)
        throw new Error('CSS functions require parameters and a body.')
      const prelude = Tree.generate(rule.prelude)
      let opening = 0
      let closing = -1
      let depth = 0
      const commas: number[] = []
      Tree.tokenize(prelude, (type, start, end) => {
        if (closing >= 0) return
        if (
          type === Tree.tokenTypes.Function ||
          type === Tree.tokenTypes.LeftParenthesis
        ) {
          if (depth === 0) {
            const name = Tree.ident.decode(prelude.slice(start, end - 1))
            if (
              start !== 0 ||
              type !== Tree.tokenTypes.Function ||
              !name.startsWith('--') ||
              name.length <= 2
            )
              throw new Error('CSS function names require a dashed identifier.')
            opening = end
          }
          depth++
        } else if (type === Tree.tokenTypes.RightParenthesis) {
          depth--
          if (depth === 0) closing = start
        } else if (type === Tree.tokenTypes.Comma && depth === 1)
          commas.push(start)
      })
      if (closing < 0) throw new Error('Unclosed CSS function parameters.')
      const names = new Set<string>()
      let start = opening
      for (const end of [...commas, closing]) {
        const parameter = prelude.slice(start, end).trim()
        start = end + 1
        if (!parameter && end === closing && opening === closing) continue
        let name = ''
        let offset = 0
        let colon = -1
        let depth = 0
        Tree.tokenize(parameter, (type, from, to) => {
          if (from === 0 && type === Tree.tokenTypes.Ident) {
            name = Tree.ident.decode(parameter.slice(from, to))
            offset = to
          }
          if (
            type === Tree.tokenTypes.Function ||
            type === Tree.tokenTypes.LeftParenthesis
          )
            depth++
          if (type === Tree.tokenTypes.RightParenthesis) depth--
          if (type === Tree.tokenTypes.Colon && depth === 0 && colon < 0)
            colon = from
        })
        if (!name.startsWith('--') || name.length <= 2 || names.has(name))
          throw new Error(
            'CSS function parameters require unique dashed names.',
          )
        names.add(name)
        const syntax =
          parameter.slice(offset, colon < 0 ? undefined : colon).trim() || '*'
        if (!FunctionSyntax.accepts(syntax))
          throw new Error('Invalid CSS function parameter syntax.')
        if (colon >= 0) value(syntax, parameter.slice(colon + 1))
      }
      const returns = prelude.slice(closing + 1).trim()
      if (
        returns &&
        (!returns.startsWith('returns ') ||
          !FunctionSyntax.accepts(returns.slice(8)))
      )
        throw new Error('Invalid CSS function return syntax.')
      function body(block: Tree.Block): void {
        const declarations = Tree.parse(Tree.generate(block).slice(1, -1), {
          context: 'declarationList',
        }) as Tree.DeclarationList
        declarations.children.forEach((node) => {
          if (
            node.type === 'Atrule' &&
            ['media', 'supports', 'container'].includes(node.name) &&
            node.block &&
            node.prelude
          ) {
            if (
              Tree.lexer.matchAtrulePrelude(
                node.name,
                Tree.generate(node.prelude),
              ).error
            )
              throw new Error('Invalid CSS function condition.')
            body(node.block)
          } else if (
            node.type === 'Declaration' &&
            !node.important &&
            (node.property === 'result' || node.property.startsWith('--'))
          ) {
            value('*', Tree.generate(node.value))
          } else throw new Error('Invalid CSS function body context.')
        })
      }
      body(rule.block)
    },
  })
}
