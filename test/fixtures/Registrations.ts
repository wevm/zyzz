/** Native registration syntax productions and their independent initial values. @module */
export const values = [
  ['<length>', 'calc(1in + 2px)'],
  ['<number>', '1.5'],
  ['<percentage>', '25%'],
  ['<length-percentage>', 'calc(10px + 5%)'],
  ['<color>', 'color-mix(in srgb, red, blue)'],
  ['<image>', 'linear-gradient(red, blue)'],
  ['<url>', 'url(https://example.com/image.png)'],
  ['<integer>', '3'],
  ['<angle>', '45deg'],
  ['<time>', '250ms'],
  ['<resolution>', '2dppx'],
  ['<transform-function>', 'translateX(2px)'],
  ['<transform-list>', 'translateX(2px) rotate(45deg)'],
  ['<custom-ident>', '日本語'],
  ['small | BIG | <length>', 'BIG'],
  ['<length>+', '1px 2px'],
  ['<color>#', 'red, blue'],
  ['*', undefined],
  ['currentColor | <color>', 'currentColor'],
  ['foo\\|bar | <length>', 'foo\\|bar'],
] as const

/** Builds explicit registrations through an imported alias with conditional contexts. */
export function source(after = false): string {
  return (
    `import {property as register, global} from 'zyzz/web';\n` +
    values
      .map(
        ([syntax, initialValue], i) =>
          `register(${JSON.stringify({ name: `--entry-${i}`, syntax, inherits: after, ...(initialValue === undefined ? {} : { initialValue }) })},{within:['@layer registrations','@media screen']});`,
      )
      .join('\n') +
    `\nglobal({body:{'--entry-0':'2px',width:'var(--entry-0)'}});`
  )
}
