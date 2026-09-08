# Css

Pure web emission and typed stylesheet relationships.

```ts
import { Css } from 'zyzz/web'
```

## Methods

- [Css.ancestor](ancestor.md): A qualifying ancestor at any depth.
- [Css.anySibling](anySibling.md): A qualifying sibling in either direction.
- [Css.compile](compile.md): Compile ordered style data into CSS, class lists, and theme scopes.
- [Css.descendant](descendant.md): A qualifying descendant at any depth.
- [Css.layers](layers.md): Contribute an ordered set of cascade layer names.
- [Css.marker](marker.md): Define a typed identity and finite data states for element relationships.
- [Css.siblingAfter](siblingAfter.md): A qualifying marked sibling following the styled element.
- [Css.siblingBefore](siblingBefore.md): A qualifying marked sibling preceding the styled element.

## Types and Errors

`Diagnostic`; `compile.ErrorType`, `compile.Options`, `compile.ReturnType`; `CompileError`.

See the [public declarations](../../../../src/web/Css.ts) for complete generic signatures and documented type properties.

> [!NOTE]
> Layer and relationship helpers are previews; `compile` implements the documented literal/scalar boundary.
