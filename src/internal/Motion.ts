/**
 * Validates literal easing functions and their numeric constraints.
 * @module
 */

/** Validates numeric easing arguments without evaluating the curve. */
export function easing(value: string): boolean {
  const match = /^(cubic-bezier|linear|steps)\(([^()]*)\)$/i.exec(value)
  if (!match) return false
  const args = match[2]!.split(',').map(trim)
  if (match[1]!.toLowerCase() === 'cubic-bezier')
    return (
      args.length === 4 &&
      args.every(
        (arg, index) =>
          number(arg) &&
          (index % 2 === 1 || (Number(arg) >= 0 && Number(arg) <= 1)),
      )
    )
  if (match[1]!.toLowerCase() === 'steps') {
    const count = args[0]!
    const position = args[1]?.toLowerCase()
    return (
      args.length <= 2 &&
      /^\+?\d+$/.test(count) &&
      Number.isSafeInteger(Number(count)) &&
      Number(count) > 0 &&
      (position === undefined ||
        [
          'end',
          'jump-both',
          'jump-end',
          'jump-none',
          'jump-start',
          'start',
        ].includes(position)) &&
      (position !== 'jump-none' || Number(count) > 1)
    )
  }
  // The published easing grammar requires at least two comma-separated stops.
  if (args.length < 2) return false
  for (const arg of args) {
    const parts = arg.split(/[ \t\n\r\f]+/)
    if (parts.length > 3) return false
    const output = number(parts[0]!) ? parts.shift() : parts.pop()
    if (
      !output ||
      !number(output) ||
      !parts.every((part) => part.endsWith('%') && number(part.slice(0, -1)))
    )
      return false
  }
  return true
}

function number(value: string): boolean {
  return (
    /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(value) &&
    Number.isFinite(Number(value))
  )
}

function trim(value: string): string {
  return value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
}
