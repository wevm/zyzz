/**
 * Supplies absolute color functions and independently authored native controls.
 * @module
 */

/** Values exercise legacy and modern channel grammar, alpha, and hue units. */
export const valid = [
  'rgb(255, 0, 0)',
  'rgba(100%, 0%, 0%, .5)',
  'rgb(255 0% none / 50%)',
  'rgb(-1 300 1e2 / 2)',
  'hsl(120, 50%, 50%)',
  'hsla(.5turn, 50%, 50%, 50%)',
  'hsl(120deg 50 50 / none)',
  'hwb(200grad 20% 30%)',
  'lab(50% 20 -30 / .5)',
  'lch(50 30 3.14rad)',
  'oklab(.5 .1 -.1)',
  'oklch(.5 .1 120)',
  'color(srgb .1 .2 .3 / .5)',
  'color(display-p3 10% 20% 30%)',
  'color(xyz-d50 .1 .2 .3)',
  'color(xyz-d65 none .2 .3 / none)',
] as const

/** Malformed arguments and unsupported nested forms cannot emit declarations. */
export const invalid = [
  'rgb(0, 0%, 0)',
  'rgb(0, 0, none)',
  'rgb(0 0)',
  'rgb(0 0 0 1)',
  'rgb(0 0 0 / .5 / .5)',
  'rgb(0 0 0 /)',
  'rgb(0 0 0);color:red',
  'rgb(0 0 0 / NaN)',
  'hsl(120, 50, 50)',
  'hsl(50% 50% 50%)',
  'hwb(0, 0%, 0%)',
  'lab(50 20 30deg)',
  'lch(50 20 30%)',
  'oklab(.5 .1)',
  'color(unknown 1 0 0)',
  'color(srgb 1 0 0 1)',
  'color(srgb 1 0 0 / 1px)',
  'rgb(from red r g b)',
] as const

/** Uses root, theme, fallbacks, importance, inheritance, and SVG declarations. */
export const source = `import { css, Theme } from 'zyzz';
const theme=Theme.define({color:{brand:'oklch(.5 .1 120)'}});
export const scope=theme.className;
export const box=theme.css({color:'brand',backgroundColor:['rgb(255, 0, 0)','hsl(120deg 50% 50% / .5)!'],borderColor:'hwb(120 20% 30%)',borderStyle:'solid',outlineColor:'color(display-p3 .1 .2 .3)'})();
export const svg=css({fill:'lab(50% 20 -30)',stroke:'oklab(.5 .1 -.1)'})();`

/** Native controls independently spell each compiled declaration. */
export const control =
  'color:oklch(.5 .1 120);background-color:hsl(120deg 50% 50% / .5)!important;border-color:hwb(120 20% 30%);border-style:solid;outline-color:color(display-p3 .1 .2 .3)'
