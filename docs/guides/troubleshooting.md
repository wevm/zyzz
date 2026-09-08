# Troubleshooting

## Missing Transform

`css.MissingTransformError` means authoring source reached execution. Confirm the build transforms that module; importing config or extracting CSS alone cannot fix it.

## Missing CSS

Ensure code and stylesheet come from the same compilation. Load the emitted CSS through the build integration or a stylesheet link.

## Unknown Tokens

Import the intended config and check the token's property domain. Root `css` has no built-in tokens. Optional themes must be narrowed before shorthand names can infer.

## Unexpected Overrides

Check layer, importance, condition, and rule order. Class-string order does not determine precedence. Use supported styling overrides or planned `cx` composition.

## Watch Failures

Inspect the located error and keep the last successful output. Do not delete unrelated output files; the host tracks ownership.

See [Compatibility](../introduction/compatibility.md) before assuming a preview API is executable.
