# Server Rendering

> [!NOTE]
> Preview API; not yet implemented.

Apply compiled styles during server rendering and deliver their stylesheet before styled content paints. Use the same compiled identities on server and client.

```tsx
import config from './zyzz.config.js'

const card = config.css({ padding: 'md' })

export function Card() {
  return <article {...card()}>Content</article>
}
```

- **Delivery:** include scoped CSS and eager globals through the integration's output graph.
- **Hydration:** preserve theme, scheme, and variant selection across the initial render.
- **Runtime:** generated functions bind values without inserting stylesheets.

SSR, streaming, route splitting, and framework-specific delivery still require integration proof. Config importing does not provide that integration by itself.
