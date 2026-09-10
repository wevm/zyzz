/**
 * Provides structured grid tracks and independent native CSS references.
 * @module
 */
export const valid = [
  '1fr 2fr',
  '0 minmax(min-content, 1fr) fit-content(40%)',
  '[start] repeat(3, [cell] minmax(0, 1fr)) [end]',
  'repeat(auto-fit, minmax(80px, 1fr))',
  '10px repeat(auto-fill, minmax(auto, 20px)) 30px',
  'repeat(2, 20px) repeat(auto-fill, 30px)',
  '[] 10px [middle] 2fr []',
] as const

export const invalid = [
  '1fr, 2fr',
  'minmax(1fr, 20px)',
  'minmax(0,)',
  'minmax(0, 1fr, 2fr)',
  'fit-content(1fr)',
  'repeat(0, 1fr)',
  'repeat(-1, 1fr)',
  'repeat(1.5, 1fr)',
  'repeat(2, repeat(2, 10px))',
  'repeat(auto-fit, 1fr)',
  '1fr repeat(auto-fill, 10px)',
  'repeat(auto-fill, 10px) repeat(auto-fit, 20px)',
  '[only-names]',
  '[a] [b] 10px',
  '[auto] 10px',
  '10px; color:red',
  'minmax(0, 1fr',
  'repeat(2, -1px)',
] as const

export const source = `import { css } from 'zyzz';
export const fixed=css({display:'grid',width:'300px',gridTemplateColumns:'[start] repeat(3, minmax(0, 1fr)) [end]',gridAutoRows:'20px 30px'})();
export const fluid=css({display:'grid',width:'300px',gridTemplateColumns:['1fr 2fr','repeat(auto-fit, minmax(80px, 1fr))!']})();`
