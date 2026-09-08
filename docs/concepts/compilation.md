# Compilation and Platforms

| Boundary        | Responsibility                             |
| --------------- | ------------------------------------------ |
| Core            | Pure data, types, validation, and identity |
| Source adapters | Parse and rewrite modules                  |
| Target emitters | Produce CSS or native tables               |
| Hosts           | Files, discovery, watching, and delivery   |

CLI and build integrations share compiler semantics. Libraries distribute matching code, CSS, declarations, and required metadata. Standard downstream tooling handles minification.

> [!NOTE]
> CLI/plugins and native output are previews. Native will select precompiled styles and theme/scheme tables, with explicit errors for unsupported web selectors and stylesheet operations.
