/**
 * Validates unquoted variable-bearing declarations without resolving custom properties.
 * @module
 */

/** Checks balanced components and every var() name while preserving deferred value semantics. */
export function valid(value: string): boolean {
  if (/[;{}!"'\\]/.test(value) || value.includes('/*')) return false
  const stack: Frame[] = []
  let found = false
  for (let index = 0; index < value.length; index++) {
    const char = value[index]!
    const code = value.charCodeAt(index)
    if ((code < 32 && ![9, 10, 12, 13].includes(code)) || code === 127)
      return false
    if (char === '(' || char === '[') {
      let start = index
      while (start > 0 && /[\w\-\u0080-\uffff]/.test(value[start - 1]!)) start--
      const name = value.slice(start, index).toLowerCase()
      // URL tokens have separate quoting/escape rules, outside this bounded grammar.
      if (char === '(' && name === 'url') return false
      const variable =
        char === '(' &&
        name === 'var' &&
        value[start - 1] !== '#' &&
        value[start - 1] !== '@'
      stack.push({ open: char, start: index + 1, variable })
      if (stack.length > 128) return false
    } else if (char === ')' || char === ']') {
      const frame = stack.pop()
      if (!frame || frame.open !== (char === ')' ? '(' : '[')) return false
      if (frame.variable) {
        const name = value
          .slice(frame.start, frame.comma ?? index)
          .replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
        if (!/^--[\w\-\u0080-\uffff]+$/.test(name)) return false
        found = true
      }
    } else if (char === ',') {
      const frame = stack.at(-1)
      if (frame?.variable && frame.comma === undefined) frame.comma = index
    }
  }
  return found && stack.length === 0
}

type Frame = {
  comma?: number
  readonly open: '(' | '['
  readonly start: number
  readonly variable: boolean
}
