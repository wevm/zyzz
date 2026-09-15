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

| Argument / Flag | Default                                           | Contract                                                                         |
| --------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `[src]`         | `src`                                             | Authored JavaScript/TypeScript module tree                                       |
| `--css-only`    | Off                                               | Disable source transformation; emit CSS, CSS maps, and the initialization script |
| `--minify`      | Off                                               | Minify emitted CSS with Lightning CSS                                            |
| `--out-dir`     | `dist`                                            | Owned output directory                                                           |
| `--package-id`  | Working directory's package name, otherwise `app` | Stable identity for compiled modules                                             |
| `--script`      | `<out-dir>/zyzz.js`                               | Path of the saved-selection initialization script                                |

Paths resolve from the working directory. Both commands share these options. Browser syntax is preserved without compatibility targets. No configuration file is required; normal source imports provide configured authoring helpers.

```sh
npx zyzz build app --out-dir build --package-id my-library --minify
npx zyzz dev app --out-dir build
npx zyzz dev --script public/zyzz.js
```

Use `--help` for command help and `--json` for a build result containing `changed` and `files`. `zyzz dev --format jsonl` streams `built` events with those lists and `error` events with a diagnostic message.

## Output and Watching

For `src/button.ts`, the host emits `dist/button.ts`, `button.ts.css`, maps, and packed metadata. Shared stylesheet contributions use `zyzz.shared.css`. `dist/zyzz.css` is the complete stylesheet: shared contributions, then every module stylesheet with dependencies before their consumers. Applications load that one file; the per-module files remain for libraries that publish stylesheets beside their modules. Downstream tooling lowers TypeScript/JSX and emits declarations; this command does not bundle the application or generate declarations.

`zyzz.js` holds the initialization script of every `Config.create` in the tree, exported or local. Loaded as a classic script at the start of `<head>`, it restores the saved theme and scheme before paint. Inside the output directory it is an owned artifact. `--script` moves it elsewhere, such as a bundler's public directory that is served in development and copied into the site, where the host replaces only a file carrying its own leading `/* zyzz initialization */` comment.

```html
<script src="/zyzz.js"></script>
<link rel="stylesheet" href="/dist/zyzz.css" />
```

`--css-only` retains the original source and omits transformed modules, JavaScript/TypeScript maps, and packed module metadata. Runtime authoring requires explicit IDs for identity-bearing declarations. CSS maps, `zyzz.js`, and output ownership metadata remain.

Missing source directories and compilation failures produce a nonzero build exit. Watch compilation errors preserve the last successful output and allow subsequent edits to recover, including an invalid initial source tree. Ctrl-C and SIGTERM stop watching, drain pending publication, and release the output lock.

Output is excluded from source discovery. Cleanup only removes unchanged owned files; unrelated files remain. Each output directory has one active writer. Watching observes the source tree, not changes inside installed dependencies or outside that tree.

See [CLI Setup](../introduction/cli.md) for the application/build boundary.
