/** Freezes compiler-generated binding data outside consumer lexical scopes. @module */
/** Preserves immutable compiler contracts without capturing consumer globals. */
export function create<const value extends object>(
  value: value,
): Readonly<value> {
  return Object.freeze(value)
}
