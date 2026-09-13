# cx

Combines applied styles in argument order and returns one props object. Later declarations in matching contexts win at equal specificity and importance. Ordinary CSS semantics determine shorthand resets, fallback support, and importance.

```ts
import { css, cx } from 'zyzz'

namespace styles {
  export const base = css({ padding: '8px', color: 'red' })
  export const override = css({ paddingLeft: '12px', color: 'blue' })
}

const button = <button {...cx(styles.base(), styles.override())} />
```

The result keeps 8px padding on three sides and 12px on the left. `cx(styles.base(), styles.override(), styles.base())` restores all four sides to 8px. Compilation preserves declaration order inside one generated group; class-string ordering does not decide conflicts.

`false`, `null`, and `undefined` omit an entry. Bare class strings, unapplied definitions, and component props are invalid. HTML and React props cannot be mixed. Binding guards preserve errors when applications precede initialization, including after bundling. Generated declarations retain their original source locations.

> [!NOTE]
> Composition supports proven local applications, including dynamic CSS values, recipe selections, and `enabled && style()` arguments. Arbitrary props variables, ternary selections, and independently packed definitions remain unsupported. Conditional nesting must be flattened when an outer conditional wraps a conditional composition. Unsupported applications produce compiler diagnostics.

## Signature

`cx(...appliedStyles)`

## Parameters

### appliedStyles

Type: applied style objects or `false | null | undefined`. Inputs retain their authored order. Applied styles accept their normal styling overrides and recipe selections.

## Returns

### className

Type: `string`. The generated composition class for React-shaped props. HTML configurations return `class` instead. Dynamic compositions retain inline bindings and styling overrides.

## Errors

Untransformed calls throw `css.MissingTransformError`. Unsupported source applications and mixed renderer outputs produce compiler source diagnostics. Conflicting recipe attribute owners also produce source diagnostics.

## Runtime Inputs

```ts
const dynamic = css((values: { padding: `${number}px` }) => ({
  padding: values.padding,
}))
cx(dynamic({ padding: '12px' }), enabled && styles.override())
```

The compiler emits each conditional presence combination, preserving ordered shorthand and importance behavior. Up to eight conditional arguments produce at most 256 groups. Runtime calls only select a group and merge props; they do not validate authoring, parse CSS, or generate rules.

Repeated applications replace their private slots and recipe attributes together. Other live shared variables survive. Inline style keys follow argument order, including A/B/A shorthand resets. External classes supplied through styling overrides pass through with normal CSS cascade semantics. Ownership metadata stays in compiled initialization data and never enters DOM props.

HTML compositions retain canonical inputs in a nonenumerable property only on generated applications used by composition. The merged result serializes once, without parsing style strings. Normal HTML applications keep their existing representation; renderer spreads and HTML serialization receive only ordinary attributes.
