# CLI

> [!NOTE]
> Preview API; not yet implemented.

Compile a source tree into rewritten modules, declarations, and CSS.

```sh
zyzz src --out-dir dist --css dist/styles.css --watch
```

| Argument / Flag  | Contract                                                  |
| ---------------- | --------------------------------------------------------- |
| Source directory | Authored module tree to scan                              |
| `--css`          | Stylesheet path; defaults to `<out-dir>/styles.css`       |
| `--minify`       | Final CSS processing through the adapter                  |
| `--out-dir`      | Rewritten module/declaration output                       |
| `--targets`      | Planned Browserslist queries for compatibility processing |
| `--watch`        | Rebuild after source and dependency changes               |

One-shot errors exit nonzero. Watching reports errors and retains the previous complete output. Output ownership excludes unrelated files. See [CLI Setup](../introduction/cli.md) for the application/build boundary.
