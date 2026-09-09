/** Describes static grid placement constraints. @module */
/** Refines concrete span counts in the static authoring contract. */
export type Checked<value> = value extends readonly unknown[]
  ? { [key in keyof value]: Checked<value[key]> }
  : value extends `${infer body}!important` | `${infer body}!`
    ? Checked<Trim<body>> extends never
      ? never
      : value
    : value extends `span ${infer count extends number}`
      ? `${count}` extends `${bigint}`
        ? `${count}` extends `-${string}` | '0'
          ? never
          : value
        : never
      : value

type Trim<value extends string> =
  value extends `${infer body}${' ' | '\n' | '\r' | '\t' | '\f'}`
    ? Trim<body>
    : value
