/** Defines typed ref identities for related elements. @module */
import type * as Marker from '../runtime/Marker.js'
import type * as Relationships from './internal/Relationships.js'

/** Defines a ref with finite data states; source compilation assigns its identity. */
export function ref(schema?: undefined): Relationships.Handle<{}>
export function ref<const schema extends Marker.Schema>(
  schema: schema & NoInfer<Relationships.Validated<schema>>,
): Relationships.Handle<schema>
export function ref(
  schema?: Marker.Schema,
): Relationships.Handle<Marker.Schema> {
  void schema
  throw new Error('Refs require the Zyzz source transform.')
}

/** Compiled ref handle retaining its finite schema. */
export declare namespace ref {
  type ReturnType<schema extends Marker.Schema = {}> =
    Relationships.Handle<schema>
}
