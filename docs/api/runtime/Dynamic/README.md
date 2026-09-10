# Dynamic

Compiler-generated callbacks use `Dynamic` from `zyzz/runtime`. Applications normally author callbacks with `css` and use the resulting `css.Dynamic<values>` callable.

## create

`Dynamic.create(options)` accepts `create.Options` and returns `css.Dynamic<Record<string, string | number>>`. `options.className` is the complete generated class list. `options.slots` maps every required input name to a fixed custom-property `name` and scalar `type`. An optional `zero` flag permits numeric zero alongside string dimensions. The compiler supplies these fields.

Applying the callable requires all declared scalar inputs and accepts optional `className` and `style` overrides. It returns `css.Props` containing the generated classes and inline private-variable assignments. Empty strings are encoded as whitespace so CSSOM retains an explicit empty value. It generates no CSS rules and does not execute the authoring callback.

Input shapes and CSS values are checked by TypeScript. The runtime helper binds values and merges styling props without validation. Private assignments take precedence over inline overrides. See [css](../../core/css.md) for the authoring and application contracts.
