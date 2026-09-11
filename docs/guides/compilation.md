# Build & Delivery

Compile and publish matching artifacts, then deliver styles during server rendering. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Publish Libraries

Use compiler APIs when building a library pipeline or a custom integration. For application setup, start with [Getting Started](../introduction/getting-started.md).

#### Compile Styles

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: { display: 'flex', padding: '1rem' },
})
const output = Css.compile({ styles })
```

Load `output.css` as a stylesheet and apply `output.classes.card` to the element. The compiler has no filesystem or browser side effects. [Literal styles](../api/core/Style/literals.md) documents supported values; [themes](themes.md#compile-themes) adds token references and compatible scopes.

#### Transform Source

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'example/button.ts',
  source: `import { css } from 'zyzz';
export const styles = { button: css({ padding: '1rem' }) };`,
})
```

Bundle the returned `code` and load its matching `css`. Keep their source maps together. Apply the exported `styles.button()` props to an element. A stable package-relative module ID prevents unrelated modules sharing identities. Source extraction alone does not rewrite executable calls.

For filesystem builds, `await Host.create({ outDir, packageId, root })` from `zyzz/node` resolves to build/watch/close operations. It writes module and CSS sidecars; loading CSS and lowering TypeScript/JSX remain application build responsibilities.

#### Publish Matching Artifacts

- **Code:** publish transformed modules and declarations.
- **CSS:** publish the matching stylesheet and document its import path.
- **Identity:** keep modules, class maps, CSS, and source maps from the same compilation together.

Consumers load the stylesheet once. They do not need Zyzz compilation for already-transformed library code.

#### Standalone Output

```sh
npx zyzz build
```

The defaults compile `src` into `dist`, with CSS at `dist/styles.css`. Treat `dist` as compiler output, not an application import convention. Downstream tooling consumes the rewritten tree and lowers TypeScript/JSX. Original relative imports remain authored normally; the build selects its input root.

Libraries expose compiled modules through package exports and document stylesheet loading. Keep generated output separate from owned source files. A CSS-only scan cannot replace source rewriting for Zyzz's callable definitions.

### Server Rendering

Solid and Svelte fixtures verify server-rendered identities and hydration through the Vite adapter. React renderer fixtures use esbuild-compiled output for hydration checks. Plain HTML fixtures verify serialized attributes and client updates.

> [!NOTE]
> Streaming, route-specific stylesheet delivery, and the Next.js adapter remain separate implementation gates.

Apply compiled styles during server rendering and deliver their stylesheet before styled content paints. Use the same compiled identities on server and client.

```tsx
import { css } from './zyzz.config.js'

const styles = {
  card: css({ padding: 'md' }),
}

export function Card() {
  return <article {...styles.card()}>Content</article>
}
```

- **Delivery:** include scoped CSS and eager globals through the integration's output graph.
- **Hydration:** preserve theme, scheme, and variant selection across the initial render.
- **Runtime:** generated functions bind values without inserting stylesheets.

SSR, streaming, route splitting, and framework-specific delivery still require integration proof. Config importing does not provide that integration by itself.
