/**
 * Shares standard length authoring across source, browser, and benchmark flows.
 * @module
 */
/** CSS unit families, independent of the compiler's validation table. */
export const units = [
  'px',
  'cm',
  'mm',
  'q',
  'Q',
  'in',
  'pc',
  'pt',
  'em',
  'ex',
  'cap',
  'ch',
  'ic',
  'lh',
  'rem',
  'rex',
  'rcap',
  'rch',
  'ric',
  'rlh',
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',
  'svw',
  'svh',
  'svi',
  'svb',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvi',
  'lvb',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvi',
  'dvb',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
  '%',
] as const

/** Literal source with token fallbacks and inherited relative lengths. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{space:'1lh'}}});
export const root = style({width:['50vw','50cqi !important'],height:'10dvh',marginLeft:'-1in',borderWidth:'1pc',borderStyle:'solid'})();
export const themed = zyzz.style({padding:['1rem',zyzz.theme.tokens.spacing.space],marginTop:'2rlh !important'})();
`
