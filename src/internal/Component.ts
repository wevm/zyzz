/**
 * Separates unquoted CSS component lists while preserving function arguments.
 * @module
 */

/** Splits nonempty unquoted comma lists, preserving nested function arguments. */
export function comma(value: string): readonly string[] | undefined {
  if (/[;{}!"'\\[\]]/.test(value)) return undefined
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (char === '(') depth++
    if (char === ')' && --depth < 0) return undefined
    if (char === ',' && depth === 0) {
      parts.push(trim(value.slice(start, index)))
      start = index + 1
    }
  }
  parts.push(trim(value.slice(start)))
  return depth === 0 && parts.every(Boolean) ? parts : undefined
}

/** Splits space-separated components or top-level slash axes, rejecting unbalanced functions. */
export function split(
  value: string,
  options: split.Options,
): readonly string[] | undefined {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]!
    if (char === '(') depth++
    if (char === ')' && --depth < 0) return undefined
    if (
      depth === 0 &&
      (options.separator === 'slash' ? char === '/' : /[ \t\n\r\f]/.test(char))
    ) {
      if (options.separator === 'slash' || index > start)
        parts.push(trim(value.slice(start, index)))
      start = index + 1
    }
  }
  if (options.separator === 'slash' || start < value.length)
    parts.push(trim(value.slice(start)))
  return depth === 0 && parts.length > 0 ? parts : undefined
}

/** Component delimiter selection. */
export declare namespace split {
  /** Parenthesized separators always remain inside their component. */
  type Options = {
    /** Space-delimited values or slash-delimited axes. */
    readonly separator: 'slash' | 'space'
  }
}

function trim(value: string): string {
  return value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
}
