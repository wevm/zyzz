/**
 * Supplies compatible keyword combinations and independent native controls.
 * @module
 */

/** Public declarations combine independent font and containment choices. */
export const source = `import { style } from 'zyzz';
export const text=style({contain:'layout style paint',fontSynthesis:'style weight small-caps',fontVariantEastAsian:'jis78 full-width ruby',fontVariantLigatures:'no-common-ligatures contextual',fontVariantNumeric:['tabular-nums','oldstyle-nums tabular-nums slashed-zero!']})();`

/** Native declarations verify browser serialization of unordered groups. */
export const control =
  'contain:layout style paint;font-synthesis:style weight small-caps;font-variant-east-asian:jis78 full-width ruby;font-variant-ligatures:no-common-ligatures contextual;font-variant-numeric:oldstyle-nums tabular-nums slashed-zero!important'
