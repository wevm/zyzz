/** Describes property value domains. @module */
/** Rules supplied by the owning property map. */
export type Options = {
  /** Allowed component domains. */
  readonly atoms: readonly (
    | 'color'
    | 'integer'
    | 'length'
    | 'number'
    | 'percentage'
    | 'time'
  )[]
  /** Keywords allowed as individual components. */
  readonly keywords?: readonly string[]
  /** Optional marker accepted at most once. */
  readonly marker?: 'fill'
  /** Whether a marker must follow the numeric components. */
  readonly markerPosition?: 'any' | 'last'
  /** Maximum component count. */
  readonly max: number
  /** Minimum component count. */
  readonly min: 1 | 2
  /** Whether literal numeric components can be negative. */
  readonly negative: boolean
  /** Optional keyword prefix for each component. */
  readonly prefixes?: readonly string[]
  /** Keywords that must form the entire declaration. */
  readonly standalone?: readonly string[]
}
