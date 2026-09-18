/**
 * Shares text decoration sources and independent native CSS controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Independently authored CSS controls preserve fallback priority and line order. */
export const controls = {
  automatic:
    'text-decoration-line:underline;text-decoration-thickness:from-font;text-underline-offset:auto;text-decoration-skip-ink:auto;',
  decorated:
    'text-decoration-line:underline overline!important;text-decoration-color:#06c;text-decoration-style:wavy;text-decoration-thickness:2px;text-underline-offset:4px;text-decoration-skip-ink:none;',
  percentage:
    'text-decoration-line:line-through;text-decoration-thickness:10%;text-underline-offset:-10%;',
} as const

/** Source includes shared colors, explicit spacing references, and line fallbacks. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{color:{brand:'#06c'},textColor:{brand:'#f00'},spacing:{offset:'4px',stroke:'2px'}}});
export const automatic = style({textDecorationLine:'underline',textDecorationThickness:'from-font',textUnderlineOffset:'auto',textDecorationSkipInk:'auto'})();
export const decorated = zyzz.style({
  textDecorationLine:['underline','underline overline !important'],
  textDecorationColor:'brand',textDecorationStyle:'wavy',
  textDecorationThickness:zyzz.theme.tokens.spacing.stroke,textUnderlineOffset:'offset',textDecorationSkipInk:'none'
})();
export const percentage = style({textDecorationLine:'line-through',textDecorationThickness:'10%',textUnderlineOffset:'-10%'})();
`

/** Public declarations exercise finite combinations and explicit defaults. */
export const styles = {
  all: {
    textDecorationLine: 'overline underline line-through',
    textDecorationStyle: 'double',
  },
  plain: {
    textDecorationColor: 'currentColor',
    textDecorationLine: 'none',
    textDecorationThickness: 'auto',
    textUnderlineOffset: 0,
  },
} as const satisfies Record<string, Style.Properties>
