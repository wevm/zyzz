/**
 * Shares border declarations and native controls across compiler and browser flows.
 * @module
 */
import type { Style } from 'zyzz'

/** Independent property/value cases for physical and logical border rendering. */
export const cases = [
  { property: 'borderBlockColor', css: 'border-block-color', value: '#06c' },
  {
    property: 'borderBlockEndColor',
    css: 'border-block-end-color',
    value: '#06c',
  },
  {
    property: 'borderBlockEndStyle',
    css: 'border-block-end-style',
    value: 'solid',
  },
  {
    property: 'borderBlockEndWidth',
    css: 'border-block-end-width',
    value: '3px',
  },
  {
    property: 'borderBlockStartColor',
    css: 'border-block-start-color',
    value: '#06c',
  },
  {
    property: 'borderBlockStartStyle',
    css: 'border-block-start-style',
    value: 'solid',
  },
  {
    property: 'borderBlockStartWidth',
    css: 'border-block-start-width',
    value: '3px',
  },
  { property: 'borderBlockStyle', css: 'border-block-style', value: 'solid' },
  { property: 'borderBlockWidth', css: 'border-block-width', value: '3px' },
  { property: 'borderBottomColor', css: 'border-bottom-color', value: '#06c' },
  {
    property: 'borderBottomLeftRadius',
    css: 'border-bottom-left-radius',
    value: '6px',
  },
  {
    property: 'borderBottomRightRadius',
    css: 'border-bottom-right-radius',
    value: '6px',
  },
  { property: 'borderBottomStyle', css: 'border-bottom-style', value: 'solid' },
  { property: 'borderBottomWidth', css: 'border-bottom-width', value: '3px' },
  {
    property: 'borderEndEndRadius',
    css: 'border-end-end-radius',
    value: '6px',
  },
  {
    property: 'borderEndStartRadius',
    css: 'border-end-start-radius',
    value: '6px',
  },
  { property: 'borderInlineColor', css: 'border-inline-color', value: '#06c' },
  {
    property: 'borderInlineEndColor',
    css: 'border-inline-end-color',
    value: '#06c',
  },
  {
    property: 'borderInlineEndStyle',
    css: 'border-inline-end-style',
    value: 'solid',
  },
  {
    property: 'borderInlineEndWidth',
    css: 'border-inline-end-width',
    value: '3px',
  },
  {
    property: 'borderInlineStartColor',
    css: 'border-inline-start-color',
    value: '#06c',
  },
  {
    property: 'borderInlineStartStyle',
    css: 'border-inline-start-style',
    value: 'solid',
  },
  {
    property: 'borderInlineStartWidth',
    css: 'border-inline-start-width',
    value: '3px',
  },
  { property: 'borderInlineStyle', css: 'border-inline-style', value: 'solid' },
  { property: 'borderInlineWidth', css: 'border-inline-width', value: '3px' },
  { property: 'borderLeftColor', css: 'border-left-color', value: '#06c' },
  { property: 'borderLeftStyle', css: 'border-left-style', value: 'solid' },
  { property: 'borderLeftWidth', css: 'border-left-width', value: '3px' },
  { property: 'borderRightColor', css: 'border-right-color', value: '#06c' },
  { property: 'borderRightStyle', css: 'border-right-style', value: 'solid' },
  { property: 'borderRightWidth', css: 'border-right-width', value: '3px' },
  {
    property: 'borderStartEndRadius',
    css: 'border-start-end-radius',
    value: '6px',
  },
  {
    property: 'borderStartStartRadius',
    css: 'border-start-start-radius',
    value: '6px',
  },
  { property: 'borderTopColor', css: 'border-top-color', value: '#06c' },
  {
    property: 'borderTopLeftRadius',
    css: 'border-top-left-radius',
    value: '6px',
  },
  {
    property: 'borderTopRightRadius',
    css: 'border-top-right-radius',
    value: '6px',
  },
  { property: 'borderTopStyle', css: 'border-top-style', value: 'solid' },
  { property: 'borderTopWidth', css: 'border-top-width', value: '3px' },
  { property: 'outlineColor', css: 'outline-color', value: '#06c' },
  { property: 'outlineOffset', css: 'outline-offset', value: '-2px' },
  { property: 'outlineStyle', css: 'outline-style', value: 'dashed' },
  { property: 'outlineWidth', css: 'outline-width', value: '2px' },
] as const

/** Every new scalar property is checked through the public authoring type. */
export const styles = {
  borderBlockColor: '#06c',
  borderBlockEndColor: '#06c',
  borderBlockEndStyle: 'solid',
  borderBlockEndWidth: '3px',
  borderBlockStartColor: '#06c',
  borderBlockStartStyle: 'solid',
  borderBlockStartWidth: '3px',
  borderBlockStyle: 'solid',
  borderBlockWidth: '3px',
  borderBottomColor: '#06c',
  borderBottomLeftRadius: '6px',
  borderBottomRightRadius: '6px',
  borderBottomStyle: 'solid',
  borderBottomWidth: '3px',
  borderEndEndRadius: '6px',
  borderEndStartRadius: '6px',
  borderInlineColor: '#06c',
  borderInlineEndColor: '#06c',
  borderInlineEndStyle: 'solid',
  borderInlineEndWidth: '3px',
  borderInlineStartColor: '#06c',
  borderInlineStartStyle: 'solid',
  borderInlineStartWidth: '3px',
  borderInlineStyle: 'solid',
  borderInlineWidth: '3px',
  borderLeftColor: '#06c',
  borderLeftStyle: 'solid',
  borderLeftWidth: '3px',
  borderRightColor: '#06c',
  borderRightStyle: 'solid',
  borderRightWidth: '3px',
  borderStartEndRadius: '6px',
  borderStartStartRadius: '6px',
  borderTopColor: '#06c',
  borderTopLeftRadius: '6px',
  borderTopRightRadius: '6px',
  borderTopStyle: 'solid',
  borderTopWidth: '3px',
  outlineColor: '#06c',
  outlineOffset: '-2px',
  outlineStyle: 'dashed',
  outlineWidth: '2px',
} as const satisfies Style.LiteralProperties

/** Token precedence, physical/logical conflicts, and repeated fallback source spans. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{color:{brand:'#fff'},borderColor:{brand:'#06c'},borderRadius:{round:'8px'}}});
export const box = zyzz.style({
  borderStyle:'solid',borderWidth:'2px',borderLeftWidth:'3px',borderInlineStartWidth:['4px','5px!'],
  borderColor:'brand',borderInlineEndColor:zyzz.theme.tokens.color.brand,
  borderRadius:'round',borderStartStartRadius:'10px',
  outlineColor:'brand',outlineStyle:'dashed',outlineWidth:'2px',outlineOffset:'-1px'
})();
export const physical = style({borderWidth:'2px',borderInlineStartWidth:'5px',borderLeftWidth:'3px',borderStyle:'solid'})();
`
