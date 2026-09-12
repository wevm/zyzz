/** Defines typed marker identities for related elements. @module */
import type * as Marker from '../runtime/Marker.js'
import type * as Relationships from './internal/Relationships.js'

/** Defines a marker with finite data states; source compilation assigns its identity. */
export function marker(schema?: undefined): Relationships.Handle<{}>
export function marker<const schema extends Marker.Schema>(
  schema: schema & NoInfer<Relationships.Validated<schema>>,
): Relationships.Handle<schema>
export function marker(
  schema?: Marker.Schema,
): Relationships.Handle<Marker.Schema> {
  void schema
  throw new Error('Markers require the Zyzz source transform.')
}

/** Compiled marker handle retaining its finite schema. */
export declare namespace marker {
  type ReturnType<schema extends Marker.Schema = {}> =
    Relationships.Handle<schema>
}
