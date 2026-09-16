/**
 * Shares interaction declarations and independent native CSS controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Native controls cover explicit values and fallback priority. */
export const controls = {
  disabled:
    'cursor:not-allowed;pointer-events:none!important;resize:none;user-select:none;visibility:visible;',
  editable:
    'cursor:text;pointer-events:auto;resize:both;user-select:text;visibility:visible;',
  hidden:
    'cursor:default;pointer-events:auto;resize:none;user-select:auto;visibility:hidden;',
} as const

/** Sources include root and configuration-bound authoring without theme tokens. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create();
export const disabled = style({
  cursor:'not-allowed',pointerEvents:['auto','none!','auto'],
  resize:'none',userSelect:'none',visibility:'visible'
})();
export const editable = zyzz.style({cursor:'text',pointerEvents:'auto',resize:'both',userSelect:'text',visibility:'visible'})();
export const hidden = style({cursor:'default',pointerEvents:'auto',resize:'none',userSelect:'auto',visibility:'hidden'})();
`

/** Declarations exercise logical resize axes and extended cursor keywords. */
export const styles = {
  horizontal: { cursor: 'ew-resize', resize: 'horizontal' },
  logical: { cursor: 'grab', resize: 'inline', userSelect: 'all' },
  vertical: { cursor: 'ns-resize', resize: 'block', visibility: 'collapse' },
} as const satisfies Record<string, Style.Properties>
