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
> This first composition slice supports proven local static applications and direct `css({...})()` applications. Dynamic payloads, recipe selections, conditional expressions, external class props, and packed composition follow in subsequent slices. Unsupported applications fail compilation rather than silently using class concatenation.

## Signature

`cx(...appliedStyles)`

## Parameters

### appliedStyles

Type: applied style objects or `false | null | undefined`. This slice accepts static local applications without overrides; all inputs retain their authored order.

## Returns

### className

Type: `string`. The generated composition class for React-shaped props. HTML configurations return `class` instead. Static compositions have no inline bindings.

## Errors

Untransformed calls throw `css.MissingTransformError`. Unsupported source applications and mixed renderer outputs produce compiler source diagnostics. Runtime payloads and recipe attribute ownership remain part of the following composition slices.
