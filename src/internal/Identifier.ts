/**
 * Validates unescaped CSS custom identifiers and property-specific name lists.
 * @module
 */

/** Checks lexical spelling, reserved words, and list boundaries without changing case. */
export function valid(value: unknown, options: valid.Options): boolean {
  if (typeof value !== 'string') return false
  const parts = (() => {
    if (options.separator === 'comma') return value.split(',')
    if (options.separator === 'space')
      return value
        .replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
        .split(/[ \t\n\r\f]+/)
    return [value]
  })()
  for (const part of parts) {
    const name = part.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
    const lower = name.toLowerCase()
    if (!name || (parts.length > 1 && options.standalone?.includes(lower)))
      return false
    if (options.keywords.includes(lower)) continue
    if (
      [
        'default',
        'inherit',
        'initial',
        'revert',
        'revert-layer',
        'unset',
        ...options.keywords,
        ...(options.excluded ?? []),
      ].includes(lower)
    )
      return false
    if (!/^(?:--|-?[_a-zA-Z\u0080-\uFFFF])[-\w\u0080-\uFFFF]*$/u.test(name))
      return false
    if (options.dashed && (!name.startsWith('--') || name.length === 2))
      return false
  }
  return true
}

export declare namespace valid {
  /** Property-specific name grammar; quoted and escaped spellings remain separate. */
  type Options = {
    /** Whether custom names must begin with two hyphens. */
    readonly dashed?: boolean
    /** Additional reserved words excluded case-insensitively. */
    readonly excluded?: readonly string[]
    /** Literal keywords that are valid in this property. */
    readonly keywords: readonly string[]
    /** Separator for multi-name values; omission permits one name. */
    readonly separator?: 'comma' | 'space'
    /** Keywords that cannot occur alongside another list component. */
    readonly standalone?: readonly string[]
  }
}
