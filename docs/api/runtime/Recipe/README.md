# Variant Selection

`Recipe` is the compiler-facing finite-variant serializer exported from `zyzz/runtime`. Application code normally uses [`variants`](../../core/variants.md).

| API          | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| `create`     | Bind compiled classes and finite selection metadata.                      |
| `Definition` | Share axis, default, condition, and payload metadata between serializers. |
| `Payload`    | Describe one dynamic choice's private variable slots.                     |

## create

```ts
import { Recipe } from 'zyzz/runtime'

const button = Recipe.create({
  axes: { size: ['small', 'large'] },
  className: 'button',
  defaults: { size: 'small' },
})
button({ size: 'large' }) // { className: 'button', 'data-size': 'large' }
```

### options.axes

Type: `Readonly<Record<string, readonly string[]>>`. Required ordered axes and their compiled choices, such as `{ size: ['small', 'large'] }`.

### options.className

Type: `string`. Required complete generated class list, such as `'button'`.

### options.defaults

Type: `Readonly<Record<string, string | null>>`. Required default selections; `{}` means no defaults. Missing and undefined input choices use these defaults; `null` suppresses an axis.

### options.html

Type: `boolean | undefined`. Optional; omitted or `false` returns React-shaped props. `{ html: true }` returns native HTML attributes.

### Returned callable

Signature: `(input?: Record<string, unknown> & css.Options) => css.Props | Html.Attributes`. Input defaults to `{}`. Own axis properties select compiled choices; styling overrides follow [`Props.create`](../Props/README.md).

#### className / class

Type: `string`. Generated and supplied classes appear as `className` for React output or `class` for HTML output.

#### data attributes

Type: ``Record<`data-${string}`, string>``. Selected axis values become strings, for example `'data-size': 'large'`. Suppressed axes have no attribute.

#### style

Type: `css.Props['style'] | string | undefined`. Supplied overrides remain an object for React or a serialized attribute for HTML. Omitted styling overrides add no style property.

### Effects and errors

Initialization records the fixed axis list. Calls allocate fresh props without retaining inputs, generating CSS, or executing authoring code. Compilation and TypeScript enforce valid selections; the serializer performs no runtime validation and introduces no dedicated error class.

## Definition

`axes` and `defaults` use the contracts above. Optional `conditions: readonly string[]` records ordered names. Optional `defaultPayloads: Record<string, Record<string, string | number>>` holds complete scalar defaults. Optional `payloads: readonly Payload[]` records dynamic choices. These fields are generated metadata, not an application authoring API.

## Payload

`axis: string` identifies the owning axis; `choice: string` names its dynamic choice. ``slots: readonly Record<string, `--${string}`>[]`` maps input fields to fixed private variables: base slots first, then slots for each condition in declaration order.
