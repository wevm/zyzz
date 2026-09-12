/** Grammar-production corpus for CSS grouping rules at global and nested boundaries. @module */
export const rules = {
  container: [
    '@container (width > 1px)',
    '@container card (width >= 1px)',
    '@container style(--theme: dark)',
    '@container card style(--theme: dark)',
    '@container scroll-state(stuck: top)',
    '@container card scroll-state(scrollable: bottom)',
    '@container not (width > 1px)',
    '@container (width > 1px) and (height > 1px)',
    '@container (width > 1px) or (height > 1px)',
  ],
  layer: [
    '@layer',
    '@layer base',
    '@layer base.components',
    '@layer \\62 ase.图',
  ],
  media: [
    '@media all',
    '@media screen, print',
    '@media only screen and (color)',
    '@media not print',
    '@media (1px < width < 1000px)',
    '@media (width >= 1px) and (orientation: landscape)',
    '@media (color) or (monochrome)',
    '@media not (color)',
    '@media (future-feature: enabled)',
    '@media/**/screen',
  ],
  scope: [
    '@scope',
    '@scope (.root)',
    '@scope to (.limit)',
    '@scope (.root, .other) to (.limit)',
    '@scope (:is(.root, .other)) to (:not(.open))',
  ],
  startingStyle: ['@starting-style'],
  supports: [
    '@supports (display: grid)',
    '@supports not (display: grid)',
    '@supports (display: grid) and (color: red)',
    '@supports (display: grid) or (display: flex)',
    '@supports selector(:has(.child))',
    '@supports font-tech(color-COLRv1)',
    '@supports font-format(woff2)',
    '@supports (future: value)',
    '@supports ((display: grid) or (display: flex))',
  ],
} as const

/** Includes both eager global output and a retained nested style definition. */
export function source(header: string, color = 'red'): string {
  return `import {css} from 'zyzz';import {global} from 'zyzz/web';\nglobal({${JSON.stringify(header)}:{body:{color:${JSON.stringify(color)}}}});\nexport namespace styles {export const text=css({${JSON.stringify(header)}:{color:${JSON.stringify(color)}}});}`
}
