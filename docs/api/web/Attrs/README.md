# Attrs

Convert applied styles and themes to standard DOM attributes without generating CSS rules. React consumers continue spreading the original props.

```ts
import { Attrs } from 'zyzz/web'
import { styles } from './styles.js'

const attributes = Attrs.from(styles.card())
element.setAttribute('class', attributes.class)
element.setAttribute('style', attributes.style ?? '')
```

## from

`Attrs.from(props)` returns `class`, an optional serialized `style`, and supplied `data-*` attributes. Camel-case CSS names become dash-separated; custom properties keep their spelling. Values retain explicit CSS units, and inputs remain unchanged.

Attribute values are unescaped for framework spreads and `setAttribute`. Frameworks own HTML escaping. On updates, replace the previous style attribute with the complete new string, or remove it when absent, to clear obsolete values.

## serialize

`Attrs.serialize(attributes)` returns space-separated, quoted HTML attributes. It escapes attribute names and values for insertion inside an opening tag.

```ts
const html = `<div ${Attrs.serialize(attributes)}></div>`
```

This helper serializes styling attributes only. It does not serialize children or implement hydration. Inline CSS follows browser parsing; no runtime CSS validation is added.
