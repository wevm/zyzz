/**
 * Supplies aspect-ratio and transform declarations with independent native controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Individual transforms compose in CSS-defined order. */
export const styles = {
  aspect: { width: '160px', aspectRatio: '16 / 9' },
  individual: {
    width: '40px',
    height: '20px',
    translate: '30px 40px',
    rotate: '90deg',
    scale: '2 3',
  },
  list: {
    width: '40px',
    height: '20px',
    transform: 'translate(30px,40px) rotate(90deg) scale(2,3)',
  },
  spatial: { transform: 'perspective(400px) translateZ(30px) rotateY(20deg)' },
} as const satisfies Record<string, Style.LiteralProperties>

/** Native controls independently express the 2D and 3D matrix operations. */
export const controls = {
  list: 'width:40px;height:20px;transform:translate(30px,40px) rotate(90deg) scale(2,3)',
  spatial: 'transform:perspective(400px) translateZ(30px) rotateY(20deg)',
} as const

/** Canonical transform functions include dimensions, numeric axes, and matrix arity. */
export const functions = [
  'matrix(1,0,0,1,20,30)',
  'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,20,30,40,1)',
  'perspective(100px)',
  'perspective(none)',
  'rotate(0)',
  'rotate3d(0,1,0,45deg)',
  'rotateX(10deg)',
  'rotateY(20deg)',
  'rotateZ(30deg)',
  'scale(2)',
  'scale(2,3)',
  'scale3d(1,2,3)',
  'scaleX(50%)',
  'scaleY(-1)',
  'scaleZ(2)',
  'skew(10deg,20deg)',
  'skewX(10deg)',
  'skewY(20deg)',
  'translate(10px,20%)',
  'translate3d(10px,20%,30px)',
  'translateX(10%)',
  'translateY(-20px)',
  'translateZ(30px)',
  'translateX(calc(50% - 2px)) rotate(calc(1turn / 4))',
] as const

/** Source preserves function order and separate transform properties. */
export const source = `import { style } from 'zyzz';
export const aspect = style({width:'160px',aspectRatio:'16 / 9'})();
export const individual = style({width:'40px',height:'20px',translate:'30px 40px',rotate:'90deg',scale:'2 3'})();
export const list = style({width:'40px',height:'20px',transform:'translate(30px,40px) rotate(90deg) scale(2,3)'})();
export const spatial = style({transform:'perspective(400px) translateZ(30px) rotateY(20deg)'})();`
