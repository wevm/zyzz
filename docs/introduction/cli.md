# CLI Setup

> [!NOTE]
> Preview API; not yet implemented.

Use the CLI to precompile source modules and CSS independently of a styling plugin. Authoring still uses the same the named `zyzz` instance and normal relative imports.

```sh
zyzz src --out-dir dist --css dist/styles.css
zyzz src --out-dir dist --css dist/styles.css --watch
zyzz src --out-dir dist --css dist/styles.css --minify
```

- **Application builds:** consume the rewritten output as the build's source tree; see [Publish Libraries](../guides/compilation.md#standalone-output) for output ownership.
- **CSS:** load the emitted stylesheet through the consuming build or a stylesheet link.
- **Libraries:** publish matching modules, CSS, and declarations.
- **Watching:** regenerate changed output and preserve the previous complete build after errors.

A config import does not replace this transformation. CSS-only compilation with untouched style calls is outside the current design. Applications needing transparent original-source imports should use a bundler integration.
