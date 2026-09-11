/** Declares eager module-level cascade layer ordering. @module */
/** Contributes ordered layer names; compilation removes this authoring call. */
export function layers(names: readonly string[]): void {
  void names
  throw new MissingTransformError()
}

class MissingTransformError extends Error {
  constructor() {
    super(
      'layers requires a compile-time transform; do not execute untransformed authoring source.',
    )
  }
  override name = 'layers.MissingTransformError'
}
