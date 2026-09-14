/** Describes property value domains. @module */
/** Property-specific name grammar. Quoted and escaped spellings remain separate. */
export type Options = {
  /** Whether custom names must begin with two hyphens. */
  readonly dashed?: boolean
  /** Additional reserved words excluded case-insensitively. */
  readonly excluded?: readonly string[]
  /** Literal keywords that are valid in this property. */
  readonly keywords: readonly string[]
  /** Separator for multi-name values. Omission permits one name. */
  readonly separator?: 'comma' | 'space'
  /** Keywords that cannot occur alongside another list component. */
  readonly standalone?: readonly string[]
}
