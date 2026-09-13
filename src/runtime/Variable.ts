/** Binds one compiler-assigned custom property to inline assignments. @module */
import type * as Binding from '../internal/Binding.js'
import type { variable } from '../variable.js'

/** Creates an immutable reference with no CSS generation or value validation. */
export function create<kind extends Binding.Domain>(
  slot: Binding.Reference<kind>,
): variable.Reference<kind> {
  const { name } = slot
  return Object.freeze({
    ...slot,
    [Symbol.toPrimitive]: () => name,
    set: (value: Binding.Value<kind>) => Object.freeze({ [name]: value }),
  }) as unknown as variable.Reference<kind>
}
