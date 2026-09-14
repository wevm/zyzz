# CLI Setup

Precompile source modules and CSS with one command:

```sh
npx zyzz build
npx zyzz dev
```

Both commands read `src` and write to `dist`, relative to the working directory. `build` runs once; `dev` builds immediately and watches the source tree. Changes rebuild dependent modules; failed compilations preserve the previous output until a valid edit recovers.

Override paths when needed:

```sh
npx zyzz build app --out-dir build --minify
```

Each rewritten module has an adjacent CSS file, source maps, and packed metadata. Shared stylesheet contributions use `zyzz.shared.css`; load shared CSS before module CSS. Point downstream tooling at the rewritten tree for TypeScript/JSX lowering and declaration generation. See [Build & Delivery](../guides/compilation.md#standalone-output).

Ctrl-C stops watching and releases the output directory. Cleanup only removes owned artifacts; output is excluded from source discovery.

See the [CLI reference](../api/cli.md) for flags and structured output. Authoring uses normal source imports; no configuration file is required.
