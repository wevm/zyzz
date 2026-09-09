/**
 * Shares background and color-control sources with native CSS references.
 * @module
 */
/** Source retains CSS keyword precedence and shared color-token references. */
export const source = `import { Config, css } from 'zyzz';
const zyzz=Config.create({theme:{color:{auto:'#06c',accent:'#090'}}});
export const background = css({backgroundAttachment:'local',backgroundBlendMode:'multiply',backgroundClip:'padding-box',backgroundOrigin:'content-box',backgroundPositionX:['left','25%!'],backgroundPositionY:'-4px',backgroundRepeat:'no-repeat',backgroundSize:'cover',mixBlendMode:'normal'})();
export const control = zyzz.css({accentColor:'accent',caretColor:zyzz.theme.tokens.color.auto,colorScheme:'only light',forcedColorAdjust:'none',printColorAdjust:'exact'})();
export const automatic = zyzz.css({accentColor:'auto',caretColor:'auto',colorScheme:'light dark'})();
`

/** Independent controls cover scalar background geometry and color keywords. */
export const controls = {
  automatic: 'accent-color:auto;caret-color:auto;color-scheme:light dark;',
  background:
    'background-attachment:local;background-blend-mode:multiply;background-clip:padding-box;background-origin:content-box;background-position-x:25%!important;background-position-y:-4px;background-repeat:no-repeat;background-size:cover;mix-blend-mode:normal;',
  control:
    'accent-color:#090;caret-color:#06c;color-scheme:only light;forced-color-adjust:none;print-color-adjust:exact;',
} as const
