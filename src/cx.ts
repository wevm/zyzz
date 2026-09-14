/** Declares ordered props composition for ahead-of-time resolution. @module */
import type { css } from './css.js'
import * as Authoring from './internal/Authoring.js'
import * as Html from './runtime/CompositionHtml.js'
import * as Identity from './internal/Identity.js'

/**
 * Combines applied styles in argument order, preserving CSS importance and conditions.
 * Static applications fold to props. Runtime applications select precompiled presence groups and merge bindings.
 * @param entries - Applied styling props or omitted conditional entries.
 * @returns One spreadable props object.
 */
export function cx<
  const entries extends readonly (
    | css.Props<css.Output>
    | false
    | null
    | undefined
  )[],
>(
  ...entries: entries &
    (Extract<entries[number], { class: string }> extends never
      ? unknown
      : Extract<entries[number], { className: string }> extends never
        ? unknown
        : never) & {
      readonly [index in keyof entries]: entries[index] extends object
        ? Record<
            Exclude<
              keyof entries[index],
              'class' | 'className' | 'style' | `data-${string}`
            >,
            never
          >
        : unknown
    }
): Extract<entries[number], { class: string }> extends never
  ? css.Props
  : css.Props<'html'> {
  const selected = entries.filter((entry) => !!entry) as readonly (css.Props & {
    readonly [Authoring.metadata]?: readonly Authoring.Owner[]
  })[]
  const html = selected.some((entry) => 'class' in entry)
  const owners = selected.flatMap((entry) => entry[Authoring.metadata] ?? [])
  const names = owners.map((owner) => owner.name)
  const result: Record<string, unknown> = {}
  const style: Record<string, string | number | undefined> = {}
  const external: string[] = []
  const previous = new Map<string, Authoring.Owner>()
  for (const source of selected) {
    const entry = html
      ? (source as unknown as Record<symbol, css.Props>)[
          Symbol.for('zyzz.composition.input.v1')
        ]!
      : source
    const owned = source[Authoring.metadata] ?? []
    for (const owner of owned) {
      for (const attribute of owner.attributes) delete result[attribute]
      for (const slot of previous.get(owner.name)?.slots ?? [])
        delete style[slot]
      for (const slot of owner.slots) delete style[slot]
      previous.set(owner.name, owner)
    }
    for (const name of entry.className.split(/\s+/))
      if (
        name &&
        !owned.some((owner) => owner.name === name) &&
        !name.startsWith('z-compose-')
      )
        external.push(name)
    for (const [key, value] of Object.entries(entry))
      if (key.startsWith('data-')) result[key] = value
    for (const [key, value] of Object.entries(entry.style ?? {})) {
      delete style[key]
      style[key] = value
    }
  }
  const className = [
    Identity.composition(names),
    ...new Set(names.filter((name) => name.startsWith('z-style-id-'))),
    ...external,
  ]
    .filter(Boolean)
    .join(' ')
  const props = {
    ...result,
    className,
    ...(Object.keys(style).length ? { style } : {}),
  }
  return Authoring.bind(html ? Html.from(props) : props, owners) as Extract<
    entries[number],
    { class: string }
  > extends never
    ? css.Props
    : css.Props<'html'>
}
