/** Evaluates finite calc lengths using explicit native unit mappings. @module */
import type * as Scalar from './Scalar.js'

type Value = { amount: number; length: boolean }

/** Resolves number/length arithmetic, rejecting relative units and incompatible dimensions. */
export function length(input: string, options: Scalar.Options): number {
  const pattern =
    /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?(px|rem)?|(calc)|([()+*/-]))/giy
  const positions: number[] = []
  const tokens: (string | Value)[] = []
  let offset = 0
  while (offset < input.trimEnd().length) {
    pattern.lastIndex = offset
    const match = pattern.exec(input)
    if (!match) throw new Error('Unsupported native calc expression.')

    offset = pattern.lastIndex
    positions.push(match.index + match[0].search(/\S/))
    if (match[1] === undefined) {
      tokens.push(match[4]?.toLowerCase() ?? match[5]!)
      continue
    }

    const unit = match[3]?.toLowerCase()
    const scale =
      unit === 'rem'
        ? options.units?.rem
        : unit === 'px'
          ? (options.units?.px ?? 1)
          : 1
    if (scale === undefined)
      throw new Error('Provide units.rem for rem lengths.')

    tokens.push({
      amount:
        Number(`${match[1]}${match[2] === undefined ? '' : `e${match[2]}`}`) *
        scale,
      length: unit !== undefined,
    })
  }

  let cursor = 0
  function atom(): Value {
    const token = tokens[cursor++]
    if (token === '+' || token === '-') {
      const value = atom()
      return { ...value, amount: token === '-' ? -value.amount : value.amount }
    }
    if (token === 'calc' || token === '(') {
      if (token === 'calc' && tokens[cursor++] !== '(')
        throw new Error('Unsupported native calc expression.')
      const value = sum()
      if (tokens[cursor++] !== ')')
        throw new Error('Unsupported native calc expression.')
      return value
    }
    if (!token || typeof token === 'string')
      throw new Error('Unsupported native calc expression.')

    return token
  }

  function product(): Value {
    let value = atom()
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const operator = tokens[cursor++]
      const right = atom()
      if (
        (operator === '*' && value.length && right.length) ||
        (operator === '/' && (right.length || right.amount === 0))
      )
        throw new Error(
          'Native calc requires compatible number and length operands.',
        )

      value = {
        amount:
          operator === '*'
            ? value.amount * right.amount
            : value.amount / right.amount,
        length: value.length || right.length,
      }
    }
    return value
  }

  function sum(): Value {
    let value = product()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const position = positions[cursor]!
      if (
        !/\s/.test(input[position - 1] ?? '') ||
        !/\s/.test(input[position + 1] ?? '')
      )
        throw new Error('Unsupported native calc expression.')

      const operator = tokens[cursor++]
      const right = product()
      if (value.length !== right.length)
        throw new Error(
          'Native calc requires compatible number and length operands.',
        )

      value = {
        amount:
          operator === '+'
            ? value.amount + right.amount
            : value.amount - right.amount,
        length: value.length,
      }
    }
    return value
  }

  const value = atom()
  if (
    cursor !== tokens.length ||
    !value.length ||
    !Number.isFinite(value.amount)
  )
    throw new Error('Native calc must resolve to one finite px or rem length.')

  return value.amount
}
