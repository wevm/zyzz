/** Binds compiler-assigned variable references to type-checked runtime assignments. @module */
import type * as Variables from '../Vars.js'

/** Creates an immutable variable contract; CSS values are checked by authoring types. */
export function create<const schema extends Variables.Schema>(
  slots: Variables.References<schema>,
): Variables.Definition<schema> {
  const references = Object.fromEntries(
    Object.entries(slots).map(([key, slot]) => [key, Object.freeze(slot)]),
  )

  Object.defineProperty(references, 'set', {
    value: (values: Variables.Values<schema>) =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            references[key]!.name,
            value,
          ]),
        ),
      ),
    enumerable: false,
  })

  return Object.freeze(references) as Variables.Definition<schema>
}
