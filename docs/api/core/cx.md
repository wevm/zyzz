# cx

Combines applied styles in argument order and returns one props object. Later declarations in matching contexts win at equal specificity and importance. Ordinary CSS semantics determine shorthand resets, fallback support, and importance.

```ts
import { cx, style } from 'zyzz'

namespace styles {
  export const base = style({ padding: '8px', color: 'red' })
  export const override = style({ paddingLeft: '12px', color: 'blue' })
}

const button = <button {...cx(styles.base(), styles.override())} />
```

The result keeps 8px padding on three sides and 12px on the left. `cx(styles.base(), styles.override(), styles.base())` restores all four sides to 8px. Compilation preserves declaration order inside one generated group; class-string ordering does not decide conflicts.

`false`, `null`, and `undefined` omit an entry. Bare class strings, unapplied definitions, and component props are invalid. HTML and React props cannot be mixed. Binding guards preserve errors when applications precede initialization, including after bundling. Generated declarations retain their original source locations.

> [!NOTE]
> Composition supports proven local applications, including dynamic CSS values, variant selections, packed callables, and `enabled && style()` arguments. Immutable local props bindings and const aliases are supported. Escaping or mutated bindings, ternary selections remain unsupported. Conditional nesting must be flattened when an outer conditional wraps a conditional composition. Unsupported applications produce compiler diagnostics.

## Signature

`cx(...appliedStyles)`

## Parameters

### appliedStyles

Type: applied style objects or `false | null | undefined`. Inputs retain their authored order. Applied styles accept their normal styling overrides and variant selections.

## Returns

### className

Type: `string`. The generated composition class for React-shaped props. HTML configurations return `class` instead. Dynamic compositions retain inline bindings and styling overrides.

## Errors

Untransformed calls throw `style.MissingTransformError`. Unsupported source applications and mixed renderer outputs produce compiler source diagnostics. Conflicting variant attribute owners also produce source diagnostics.

## Runtime Inputs

```ts
const dynamic = style((values: { padding: `${number}px` }) => ({
  padding: values.padding,
}))
cx(dynamic({ padding: '12px' }), enabled && styles.override())
```

The compiler emits each conditional presence combination, preserving ordered shorthand and importance behavior. Up to eight conditional arguments produce at most 256 groups. Runtime calls only select a group and merge props; they do not validate authoring, parse CSS, or generate rules.

Repeated applications replace their private slots and variant attributes together. Other live shared variables survive. Inline style keys follow argument order, including A/B/A shorthand resets. External classes supplied through styling overrides pass through with normal CSS cascade semantics. Ownership metadata stays in compiled initialization data and never enters DOM props.

HTML compositions retain canonical inputs in a nonenumerable property on generated applications used by composition and exported HTML callables. The merged result serializes once, without parsing style strings. Normal HTML applications keep their existing representation; renderer spreads and HTML serialization receive only ordinary attributes.

## Variable Scopes

Pass `vars()` alongside applied styles to place a variable scope on the same element. Scope classes and optional `colorScheme` props are preserved, including conditional selections. Scope calls retain their normal runtime validation.

```tsx
import { Config, cx } from 'zyzz'

const { style, vars } = Config.create({
  vars: { color: { brand: '#06c' } },
  mappings: false,
})
const root = style({ color: 'color.brand' })

const page = <html {...cx(vars({ colorScheme: 'dark' }), root())} />
```

Scopes use the normal CSS cascade; argument order does not select a winning scope when multiple scopes define the same variables.

## Props Bindings

```ts
const props = dynamic({ padding: readPadding() })
const alias = props
const composed = cx(alias, enabled && styles.override())
```

The initializer runs once at its original location. Composition reads the existing props, preserving values and evaluation order. Bindings must be `const`, follow initialization, and remain within supported composition, alias, or JSX-spread uses. Passing them to arbitrary functions or mutating their fields produces a compiler diagnostic.

A conditional composition result must remain a direct argument; storing that result in a variable for another composition is not supported yet.

## Packed Libraries

A library compiled with the current compiler publishes version 16 metadata beside its JavaScript. Imported `style` and `variants` callables retain ordered style bodies and ownership through renamed imports, re-exports, namespaces, and immutable aliases. Import the library stylesheet as documented by its package.

```ts
import { cx } from 'zyzz'
import { button, override } from '@acme/ui'

cx(button({ size: 'lg' }), override())
```

The consumer emits the ordered composition group. Selection stays in the compiled library callable; metadata is compiler input and does not ship in the client bundle. Earlier contracts still support their existing operations, but composing their callables requires rebuilding the library. Publisher maps retain authored locations; composed imported declarations trace to their consumer application.
