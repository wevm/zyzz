# Selection

Select compiler-owned theme classes with optional color-scheme props. Generated modules import this helper through `zyzz/runtime`; it does not evaluate authoring code or generate CSS.

`Selection.create(entries, html?)` accepts compiled name/class pairs and an optional HTML output flag (default `false`). It returns the callable selector and compatible named catalog. Unknown names, fields, or schemes throw `TypeError`.
