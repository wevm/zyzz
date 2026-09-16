/** Retains canonical inputs only for HTML applications used by compiled composition. @module */
import type { style } from '../styleFunction.js'
import * as Composition from './Composition.js'
import * as Html from './Html.js'

// A package may have distinct runtime copies in dependency optimization or SSR.
// This versioned protocol key preserves canonical props across those module graphs.
const input = Symbol.for('zyzz.composition.input.v1')
type Props = style.Props & {
  readonly [name: `data-${string}`]: string | undefined
}
type Prepared = Html.Attributes & { readonly [input]: Props }

/** Binds a generated React-shaped callable to composable HTML attributes. */
export function bind<const args extends readonly unknown[]>(
  fn: (...args: args) => Props | Html.Attributes,
) {
  // Generated callers bind the underlying callable with HTML output disabled.
  return (...args: args) => from(fn(...args) as Props)
}

/** Merges canonical props and serializes HTML once, without parsing style strings. */
export function create(options: Composition.create.Options) {
  const compose = Composition.create(options)
  return (
    ...entries: readonly (Html.Attributes | false | null | undefined)[]
  ) =>
    from(
      compose(
        ...entries.map((entry) => (entry ? (entry as Prepared)[input] : entry)),
      ),
    )
}

/** Converts props while retaining nonenumerable inputs for a surrounding composition. */
export function from(props: Props): Html.Attributes {
  return Object.defineProperty(Html.from(props), input, { value: props })
}
