/** Describes CSS geometric value types. @module */
/** Canonical CSS angle shapes. */
export type Angle = `${number}${'deg' | 'grad' | 'rad' | 'turn'}`
/** Transform functions available to typed authoring. */
export type FunctionName =
  | 'matrix'
  | 'matrix3d'
  | 'perspective'
  | 'rotate'
  | 'rotate3d'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'scale'
  | 'scale3d'
  | 'scaleX'
  | 'scaleY'
  | 'scaleZ'
  | 'skew'
  | 'skewX'
  | 'skewY'
  | 'translate'
  | 'translate3d'
  | 'translateX'
  | 'translateY'
  | 'translateZ'
/** Geometric property domain. */
export type Kind = 'ratio' | 'rotate' | 'scale' | 'transform' | 'translate'
