/** Encodes and decodes one source map segment of Base64 VLQ fields. @module */

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const digits = new Map(
  [...alphabet].map((character, index) => [character, index]),
)

/**
 * Reads every field of one segment.
 * @param segment - Base64 VLQ text between separators.
 * @returns Each signed field, in order.
 */
export function decode(segment: string): number[] {
  const fields: number[] = []
  let shift = 0
  let value = 0

  for (const character of segment) {
    const digit = digits.get(character)
    if (digit === undefined) throw new Error('Invalid source map segment.')

    value += (digit & 31) << shift

    if (digit & 32) {
      shift += 5
      continue
    }

    fields.push(value & 1 ? -(value >>> 1) : value >>> 1)
    shift = 0
    value = 0
  }

  return fields
}

/**
 * Writes the fields of one segment.
 * @param fields - Signed fields, in order.
 * @returns Base64 VLQ text without separators.
 */
export function encode(fields: readonly number[]): string {
  let output = ''

  for (const field of fields) {
    let value = field < 0 ? (-field << 1) | 1 : field << 1

    do {
      let digit = value & 31

      value >>>= 5
      if (value > 0) digit |= 32
      output += alphabet[digit]
    } while (value > 0)
  }

  return output
}
