/**
 * Supplies prefixed declarations and independently authored modern controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Legacy declarations retain their prefixes and participate in ordered overrides. */
export const styles = {
  borders: {
    WebkitBorderBefore: '2px solid red',
    borderBlockStartColor: 'blue',
    WebkitBorderStart: '3px dashed green',
  },
  text: {
    WebkitTextFillColor: 'rgb(10 20 30)',
    WebkitTextStrokeWidth: '2px',
    WebkitTextStrokeColor: 'red',
    WebkitUserSelect: 'none',
    userSelect: 'text',
  },
  legacy: {
    MozAppearance: 'button',
    MsAccelerator: 'true',
    MsScrollbar3dlightColor: 'red',
    MsContentZoomLimitMax: '200%',
    WebkitMaskComposite: 'source-over, xor',
    WebkitMaskPositionX: 'left, 20%',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** A modern logical-border control supplies the expected writing-mode behavior. */
export const control =
  'border-block-start:2px solid red;border-block-start-color:blue;border-inline-start:3px dashed green'

/** Source includes repeated aliases and literals used by delivery benchmarks. */
export const source = `import { style } from 'zyzz';
export const borders = style({WebkitBorderBefore:'2px solid red',borderBlockStartColor:'blue',WebkitBorderStart:'3px dashed green'})();
export const text = style({WebkitTextFillColor:'rgb(10 20 30)',WebkitTextStrokeWidth:'2px',WebkitTextStrokeColor:'red',WebkitUserSelect:'none',userSelect:'text'})();
export const legacy = style({MozAppearance:'button',MsAccelerator:'true',MsScrollbar3dlightColor:'red',MsContentZoomLimitMax:'200%',WebkitMaskComposite:'source-over, xor',WebkitMaskPositionX:'left, 20%'})();`
