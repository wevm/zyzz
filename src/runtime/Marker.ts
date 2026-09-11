/** Applies compiler-assigned marker identities and finite state domains as data attributes. @module */
/** Finite authored state domains. */
export type Schema = Readonly<Record<string, readonly (boolean | string)[]>>
/** Portable marker identity and state schema. */
export type Definition = {
  /** Compiler-assigned presence attribute name. */
  readonly id: string
  /** Finite state names and accepted values. */
  readonly schema: Schema
}
/** Copies and validates finite state schemas without reading accessors. */
export function schema(input: unknown): Schema {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== null &&
      Object.getPrototypeOf(input) !== Object.prototype)
  )
    throw new Error('Marker schemas require a plain record.')
  if (Object.getOwnPropertySymbols(input).length)
    throw new Error('Marker schemas require string keys.')
  const result: Record<string, readonly (boolean | string)[]> =
    Object.create(null)
  const names = new Set<string>()
  for (const [name, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(input),
  )) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) ||
      ['class', 'classname', 'style', 'key', 'ref', '__proto__'].includes(
        name.toLowerCase(),
      ) ||
      names.has(name.toLowerCase())
    )
      throw new Error(
        'Marker state names must be distinct data-name fragments without reserved keys.',
      )
    names.add(name.toLowerCase())
    const values: unknown = descriptor.value
    if (!('value' in descriptor) || !Array.isArray(values) || !values.length)
      throw new Error('Marker states require nonempty finite value arrays.')
    const serialized = new Set<string>()
    const domain: (boolean | string)[] = []
    for (let index = 0; index < values.length; index++) {
      const value: unknown = Object.getOwnPropertyDescriptor(
        values,
        String(index),
      )?.value
      if (
        (typeof value !== 'string' && typeof value !== 'boolean') ||
        (typeof value === 'string' &&
          (value.includes('\0') ||
            value.includes('\r') ||
            !value.isWellFormed())) ||
        serialized.has(String(value))
      )
        throw new Error(
          'Marker values must be distinct strings or booleans, including their serialization.',
        )
      serialized.add(String(value))
      domain.push(value)
    }
    result[name] = Object.freeze(domain)
  }
  return Object.freeze(result)
}
/** Creates a callable marker; emits only presence and selected state attributes. */
export function create(definition: Definition) {
  return (
    input: Readonly<Record<string, boolean | string | undefined>> = {},
  ) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Marker input must be a state record.')
    if (Object.getOwnPropertySymbols(input).length)
      throw new Error('Unknown marker state: symbol')
    const result: Record<string, string> = { [definition.id]: '' }
    for (const [name, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(input),
    )) {
      if (!('value' in descriptor) || !Object.hasOwn(definition.schema, name))
        throw new Error(`Unknown marker state: ${name}`)
      const value: unknown = descriptor.value
      if (value === undefined) continue
      if (
        (typeof value !== 'string' && typeof value !== 'boolean') ||
        !definition.schema[name]!.includes(value)
      )
        throw new Error(`Invalid marker state: ${name}`)
      result[`${definition.id}-${name.toLowerCase()}`] = String(value)
    }
    return Object.freeze(result)
  }
}
