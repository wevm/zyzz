# Getting Started

Define styles with `css`, call the definition, and spread its props onto a component. Choose one compilation path: a bundler plugin or the CLI.

> [!NOTE]
> Installation and integration examples target the planned release. The CLI and Vite adapter are not yet implemented; Vite setup shows a proposed API. To compile today, use the [compiler APIs](compilation.md).

## Style a Component

```tsx
// src/Button.tsx
import { css } from 'zyzz'

const button = css({
  backgroundColor: '#111',
  borderRadius: '0.5rem',
  color: '#fff',
  padding: '1rem',
})

export function Button() {
  return <button {...button()}>Save</button>
}
```

Root `css` has no built-in tokens. A definition can live beside its component or in an imported module. Compilation replaces authoring calls and emits the matching CSS.

## Choose a Setup

Install the package in the application:

```sh
pnpm add zyzz
```

### Vite

Add the adapter to the existing [Vite plugins array](https://vite.dev/guide/using-plugins). Keep the application's framework plugin alongside it.

```ts
// vite.config.ts — proposed integration
import { defineConfig } from 'vite'
import { Vite } from 'zyzz/vite'

export default defineConfig({
  plugins: [Vite.create()],
})
```

- **Development:** run the existing dev command; the adapter transforms styles and updates CSS after edits.
- **Production:** run the existing build command; the adapter emits and links CSS assets.
- **Source:** import components from `src` normally. No separate Zyzz compilation command or manual stylesheet import is needed.

### CLI

Compile the same source independently of a bundler plugin:

```sh
zyzz src --out-dir .zyzz --css .zyzz/styles.css --watch
```

Keep the app entry outside the generated directory. Import the rewritten component and its stylesheet:

```tsx
// app/main.tsx
import '../.zyzz/styles.css'
import { Button } from '../.zyzz/Button.js'

export const app = <Button />
```

- **Development:** run the app's bundler alongside the CLI watcher.
- **Generated files:** ignore `.zyzz/`; keep it outside the scanned `src` tree.
- **Inputs:** point the app build at rewritten modules. Importing original authoring modules bypasses compilation.
- **Rendering:** mount `app` through the framework's normal entrypoint. The app build handles TypeScript/JSX.

For production, compile before the app build:

```sh
zyzz src --out-dir .zyzz --css .zyzz/styles.css --minify
```

Libraries publish the matching modules, CSS, and declarations. A stylesheet link can replace a CSS import when the consuming environment loads CSS separately.

### Other Bundlers

Use the CLI path with an existing bundler. Dedicated adapters can share the same compiler; their public setup APIs remain undefined. No framework or bundler dependency belongs in the styling core.

## Next Steps

1. [Reuse styles and add overrides](styling.md).
2. [Define theme tokens](themes.md).
3. [Add typed variants](variants.md).
