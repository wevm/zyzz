/** Preserves native source replacements for syntax-tree adapters. @module */
export const key = Symbol('native edits')

/** Babel lowers authored types and does not need generated callable annotations. */
export const runtime = Symbol('native runtime output')

/** A compiler-owned expression, statement replacement, or insertion. */
export type Edit = {
  readonly start: number
  readonly end: number
  readonly code: string
  readonly expression: boolean
}
