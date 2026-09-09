/**
 * Checks literal CSS arithmetic using dimensional types without computing layout values.
 * @module
 */

/** Validates a complete math function against the property's numeric dimension. */
export function valid(value: string, options: valid.Options): boolean {
  const tokens = tokenize(value, options.units)
  if (!tokens || tokens[0]?.kind !== 'function') return false
  let index = 0
  function compatible(left: Unit, right: Unit): Unit | undefined {
    if (left === right) return left
    if (
      options.percentage &&
      [left, right].every(
        (unit) =>
          unit === 'length' ||
          unit === 'percentage' ||
          unit === 'length-percentage',
      )
    )
      return 'length-percentage'
    return undefined
  }
  function primary(depth: number): Unit | undefined {
    if (depth > 128) return undefined
    const token = tokens![index++]
    if (!token) return undefined
    if (token.kind === 'value') return token.unit
    if (token.kind === 'operator' && token.value === '(') {
      const result = sum(depth + 1)
      return consume(')') ? result : undefined
    }
    if (token.kind !== 'function') return undefined
    let result = sum(depth + 1)
    if (!result) return undefined
    let count = 1
    while (consume(',')) {
      const next = sum(depth + 1)
      if (!next) return undefined
      result = compatible(result, next)
      if (!result) return undefined
      count++
    }
    if (
      !consume(')') ||
      (token.name === 'calc' && count !== 1) ||
      (token.name === 'clamp' && count !== 3)
    )
      return undefined
    return result
  }
  function product(depth: number): Unit | undefined {
    let result = primary(depth)
    if (!result) return undefined
    while (true) {
      const token = tokens![index]
      if (
        token?.kind !== 'operator' ||
        (token.value !== '*' && token.value !== '/')
      )
        break
      index++
      const right = primary(depth)
      if (!right) return undefined
      if (token.value === '/') {
        if (right !== 'number') return undefined
      } else if (result === 'number') result = right
      else if (right !== 'number') return undefined
    }
    return result
  }
  function sum(depth: number): Unit | undefined {
    let result = product(depth)
    if (!result) return undefined
    while (true) {
      const token = tokens![index]
      if (
        token?.kind !== 'operator' ||
        (token.value !== '+' && token.value !== '-')
      )
        break
      index++
      const right = product(depth)
      if (!right) return undefined
      result = compatible(result, right)
      if (!result) return undefined
    }
    return result
  }
  function consume(value: string): boolean {
    const token = tokens![index]
    if (token?.kind !== 'operator' || token.value !== value) return false
    index++
    return true
  }
  const result = primary(0)
  return (
    index === tokens.length &&
    (result === options.kind ||
      (options.kind === 'length' &&
        options.percentage &&
        (result === 'percentage' || result === 'length-percentage')))
  )
}

/** Property dimensions and accepted length-unit vocabulary. */
export declare namespace valid {
  /** Numeric domain of the complete result; unit resolution belongs to the browser. */
  type Options = {
    /** Required result dimension. */
    readonly kind: 'length' | 'number' | 'time'
    /** Whether lengths may combine with percentage terms. */
    readonly percentage: boolean
    /** Supported length units, including any case-sensitive source spellings. */
    readonly units: readonly string[]
  }
}

type Token =
  | { readonly kind: 'value'; readonly unit: Unit }
  | { readonly kind: 'operator'; readonly value: string }
  | {
      readonly kind: 'function'
      readonly name: 'calc' | 'clamp' | 'max' | 'min'
    }
type Unit = 'length' | 'length-percentage' | 'number' | 'percentage' | 'time'

function tokenize(
  value: string,
  units: readonly string[],
): readonly Token[] | undefined {
  const lengths = new Set(
    units.map((unit) => unit.toLowerCase()).filter((unit) => unit !== '%'),
  )
  const tokens: Token[] = []
  let index = 0
  while (index < value.length) {
    if (/[ \t\n\r\f]/.test(value[index]!)) {
      index++
      continue
    }
    const rest = value.slice(index)
    const numeric =
      /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(%|[a-z]+)?/i.exec(rest)
    if (numeric) {
      if (!Number.isFinite(Number(numeric[1]))) return undefined
      const suffix = numeric[2]?.toLowerCase()
      const unit = (() => {
        if (!suffix) return 'number'
        if (suffix === '%') return 'percentage'
        if (suffix === 'ms' || suffix === 's') return 'time'
        if (lengths.has(suffix)) return 'length'
        return undefined
      })()
      if (!unit) return undefined
      tokens.push({ kind: 'value', unit })
      index += numeric[0].length
      continue
    }
    const fn = /^(calc|clamp|max|min)\(/i.exec(rest)
    if (fn) {
      const name = fn[1]!.toLowerCase() as 'calc' | 'clamp' | 'max' | 'min'
      tokens.push({ kind: 'function', name })
      index += fn[0].length
      continue
    }
    const char = value[index]!
    if (!'()+-*/,'.includes(char)) return undefined
    if (
      (char === '+' || char === '-') &&
      (!/[ \t\n\r\f]/.test(value[index - 1] ?? '') ||
        !/[ \t\n\r\f]/.test(value[index + 1] ?? ''))
    )
      return undefined
    tokens.push({ kind: 'operator', value: char })
    index++
  }
  return tokens
}
