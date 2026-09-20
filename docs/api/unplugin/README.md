# zyzz/unplugin

Compile web styles through [unplugin](https://unplugin.unjs.io/guide/) with Rollup, Webpack, or esbuild. The `vite` factory uses the existing [Vite adapter](../vite/README.md), including automatic CSS delivery and HMR.

| Export                   | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `zyzz.esbuild(options?)` | Create an esbuild plugin. Also exported as `zyzz` from `zyzz/esbuild`.    |
| `zyzz.rollup(options?)`  | Create a Rollup plugin. Also exported as `zyzz` from `zyzz/rollup`.       |
| `zyzz.vite(options?)`    | Create the existing Vite plugin with its [Vite options](../vite/zyzz.md). |
| `zyzz.webpack(options?)` | Create a Webpack plugin. Also exported as `zyzz` from `zyzz/webpack`.     |
| `Options`                | Configure the portable adapters' source root and compiler.                |

## Setup

### esbuild

```ts
import { build } from 'esbuild'
import { zyzz } from 'zyzz/esbuild'

await build({
  bundle: true,
  entryPoints: ['src/main.ts'],
  outdir: 'dist',
  plugins: [zyzz()],
})
```

esbuild requires `outdir` and `write: true`, which is the default. `outfile` and in-memory output are rejected because unplugin emits assets directly to the output directory.

### Rollup

```ts
import { zyzz } from 'zyzz/rollup'

export default {
  input: 'src/main.js',
  output: { dir: 'dist', format: 'es' },
  plugins: [zyzz()],
}
```

Keep the application's package-resolution and TypeScript/JSX plugins. Place Zyzz before source transforms. Zyzz uses Rollup's resolver for imported themes and packed compiler metadata.

### Webpack

```ts
import { zyzz } from 'zyzz/webpack'

export default {
  entry: './src/main.js',
  plugins: [zyzz()],
}
```

Keep the application's TypeScript/JSX loaders. Zyzz runs as a pre-loader and uses Webpack's configured module resolver, including aliases.

## CSS delivery

The portable adapters emit these files beside the JavaScript bundle:

| Output         | Purpose                                                             |
| -------------- | ------------------------------------------------------------------- |
| `zyzz.css`     | Shared contributions followed by module styles in dependency order. |
| `zyzz.css.map` | CSS mappings to authored source.                                    |
| `zyzz.js`      | Initialization script that restores saved theme selections.         |
| `zyzz-assets/` | Referenced local assets and recursively copied CSS imports.         |

Load the stylesheet and initialization script from the application's HTML or framework document:

```html
<link rel="stylesheet" href="/zyzz.css" />
<script src="/zyzz.js"></script>
```

Adjust URLs for the application's deployment base. These filenames are reserved for generated assets. The adapters do not modify HTML or inject runtime CSS. Imported library stylesheets still follow the library's documented setup.

## Options

### root

Type: `string`. Defaults to `process.cwd()`.

Directory containing physical JavaScript and TypeScript source. Use a source directory such as `src` to avoid compiling build configuration. Hidden directories, `node_modules`, `dist`, `build`, coverage, tests, and fixtures are excluded. Declaration, test, and benchmark modules are also excluded.

All supported modules under this root contribute to the stylesheet, including unimported global styles. Keep other generated output directories outside this root. Virtual modules and raw authoring from dependencies are not compiled. Packed libraries require adjacent `.zyzz.json` metadata.

### compiler

Type: `boolean`. Defaults to `true`.

Rewrite static authoring calls into compiled props. `false` preserves authoring calls while generating CSS and requires the compiler's explicit-identity contract.

## Rebuilds and errors

Each build scans the source root again. Imported themes, source modules, local assets, and discovered directories are watched. Edits, additions, and removals replace the aggregate stylesheet. Portable adapters rebuild output files; development servers own browser reload behavior.

Compilation rejects unsupported authoring, unresolved required dependencies, and assets escaping their owning package. Source transforms preceding Zyzz are rejected rather than replaced with stale source. Filesystem and bundler errors propagate through the build.

Vite, Next.js, and Metro retain their existing adapters. This entrypoint exposes only the verified Rollup, Webpack, esbuild, and Vite factories.
