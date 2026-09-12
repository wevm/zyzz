/** Authors the ancestor relationship primitive for source compilation. @module */
import type * as Marker from '../runtime/Marker.js'
import type * as Relationships from './internal/Relationships.js'

/** Selects the styled element by a marked ancestor relationship with zero predicate specificity. */
export function ancestor<
  schema extends Marker.Schema,
  const condition extends string | Record<string, unknown> = {},
>(
  marker: Relationships.Handle<schema>,
  condition?: condition &
    NoInfer<
      condition extends string
        ? condition extends Relationships.Pseudo
          ? unknown
          : never
        : condition extends Relationships.Condition<schema>
          ? Relationships.Checked<schema, condition>
          : never
    >,
): Relationships.Key {
  void marker
  void condition
  throw new Error('Relationships require the Zyzz source transform.')
}
