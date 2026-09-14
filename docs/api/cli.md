# CLI

Compile a source tree into rewritten modules, CSS, source maps, and packed metadata. Commands use [Incur](https://github.com/wevm/incur).

```sh
npx zyzz build
npx zyzz dev
```

## Commands

| Command       | Behavior                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `build [src]` | Compile once; exit nonzero on failure                                  |
| `dev [src]`   | Compile immediately, then rebuild after changes within the source tree |

## Defaults and Options

| Argument / Flag | Default                                           | Contract                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------ |
| `[src]`         | `src`                                             | Authored JavaScript/TypeScript module tree |
| `--minify`      | Off                                               | Minify emitted CSS with Lightning CSS      |
| `--out-dir`     | `dist`                                            | Owned output directory                     |
| `--package-id`  | Working directory's package name, otherwise `app` | Stable identity for compiled modules       |

Paths resolve from the working directory. Both commands share these options. Browser syntax is preserved without compatibility targets. No configuration file is required; normal source imports provide configured authoring helpers.

```sh
npx zyzz build app --out-dir build --package-id my-library --minify
npx zyzz dev app --out-dir build
```

Use `--help` for command help and `--json` for a build result containing `changed` and `files`. `zyzz dev --format jsonl` streams `built` events with those lists and `error` events with a diagnostic message.

## Output and Watching

For `src/button.ts`, the host emits `dist/button.ts`, `button.ts.css`, maps, and packed metadata. Shared stylesheet contributions use `zyzz.shared.css`. Load shared CSS before module CSS. Downstream tooling lowers TypeScript/JSX and emits declarations; this command does not bundle the application or generate declarations.

Missing source directories and compilation failures produce a nonzero build exit. Watch compilation errors preserve the last successful output and allow subsequent edits to recover, including an invalid initial source tree. Ctrl-C and SIGTERM stop watching, drain pending publication, and release the output lock.

Output is excluded from source discovery. Cleanup only removes unchanged owned files; unrelated files remain. Each output directory has one active writer. Watching observes the source tree, not changes inside installed dependencies or outside that tree.

See [CLI Setup](../introduction/cli.md) for the application/build boundary.
