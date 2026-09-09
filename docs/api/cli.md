# CLI

Compile a source tree into rewritten modules, declarations, and CSS.

```sh
npx zyzz build
npx zyzz watch
```

## Commands

| Command       | Behavior                                                              |
| ------------- | --------------------------------------------------------------------- |
| `build [src]` | Compile once; exit nonzero on failure                                 |
| `watch [src]` | Compile immediately, then rebuild after source and dependency changes |

## Defaults and Options

| Argument / Flag | Default                | Contract                                          |
| --------------- | ---------------------- | ------------------------------------------------- |
| `[src]`         | `src`                  | Authored module tree to scan                      |
| `--css`         | `<out-dir>/styles.css` | Emitted stylesheet path                           |
| `--minify`      | Off                    | Final CSS minification through the adapter        |
| `--out-dir`     | `dist`                 | Rewritten module/declaration output               |
| `--targets`     | Preserve modern CSS    | Browserslist queries for compatibility processing |

Paths resolve from the working directory. No config is required for token-free styles. Both commands share the same defaults and flags; `watch` replaces the `--watch` flag.

```sh
npx zyzz build app --out-dir build --minify
```

This override scans `app`, writes modules to `build`, and emits `build/styles.css`.

Missing source directories produce an error rather than falling back to a broader scan. Watching reports errors and retains the previous complete output. Output directories are excluded from discovery; cleanup preserves unrelated files.

See [CLI Setup](../introduction/cli.md) for the application/build boundary.
