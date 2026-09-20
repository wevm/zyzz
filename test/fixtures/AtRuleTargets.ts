/** Independent native CSS controls for target retention probes. @module */
import * as FontFeatures from './FontFeatures.js'
import * as Named from './NamedDescriptors.js'

/** Public source and independently authored native rules for compatibility review. */
export const rules = {
  '@container': {
    css: '@container card style(--vars: dark){body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@container card style(--vars: dark)':{body:{color:'red'}}});`,
  },
  '@counter-style': {
    css: '@counter-style probe{system:additive;additive-symbols:10 "X",1 "I",0 "O";fallback:decimal;negative:"(" ")";pad:2 "0";prefix:"[";range:0 99;speak-as:numbers;suffix:"]";symbols:"I"}',
    source: Named.source('counter'),
  },
  '@custom-media': {
    css: '@custom-media --probe (width > 1px);',
    source: `import {customMedia} from 'zyzz/web';export const probe=customMedia('(width > 1px)');`,
  },
  '@document': {
    css: '@document url-prefix("https://example.com/"){body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@document url-prefix("https://example.com/")':{body:{color:'red'}}});`,
  },
  '@font-face': {
    css: '@font-face{font-family:Body;src:local("Body"),url(/body.woff2) format("woff2");font-display:swap;font-feature-settings:"kern" 1;font-variation-settings:"wght" 450;font-stretch:75% 125%;font-style:oblique 0deg 20deg;font-weight:100 900;unicode-range:U+0-7F,U+4??;ascent-override:90%;descent-override:20%;line-gap-override:5%;size-adjust:110%}',
    source: Named.source('font'),
  },
  '@font-feature-values': {
    css: '@font-feature-values Body,Fallback{font-display:swap;@annotation{alias0:1}@character-variant{alias1:1 2}@ornaments{alias2:1}@styleset{alias3:1 2 3}@stylistic{alias4:1}@swash{alias5:1}}',
    source: FontFeatures.source(1),
  },
  '@font-palette-values': {
    css: '@font-palette-values --probe{font-family:Body,"Other Body";base-palette:dark;override-colors:0 red,1 color(display-p3 0 1 0),1 #00f}',
    source: Named.source('palette'),
  },
  '@function': {
    css: '@function --probe(--x type(<length> | <percentage>): 2px) returns type(<length> | <percentage>){result:var(--x)}',
    source: `import {cssFunction} from 'zyzz/web';export const probe=cssFunction({parameters:[{name:'--x',syntax:'type(<length> | <percentage>)',default:'2px'}],returns:'type(<length> | <percentage>)',body:{result:'var(--x)'}});`,
  },
  '@import': {
    css: '@import url("data:text/css,body%7Bcolor%3Ared%7D") layer(probe) supports(display:grid) screen;',
    source: `import {importCss} from 'zyzz/web';importCss({url:'data:text/css,body%7Bcolor%3Ared%7D',layer:'probe',supports:'display:grid',media:'screen'});`,
  },
  '@keyframes': {
    css: '@keyframes probe{entry 0%,cover 10%{opacity:0}exit 100%{opacity:1}}',
    source: `import {keyframes} from 'zyzz/web';export const probe=keyframes({'entry 0%, cover 10%':{opacity:0},'exit 100%':{opacity:1}});`,
  },
  '@layer': {
    css: '@layer base.components{body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@layer base.components':{body:{color:'red'}}});`,
  },
  '@media': {
    css: '@media (1px < width < 1000px){body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@media (1px < width < 1000px)':{body:{color:'red'}}});`,
  },
  '@page': {
    css: '@page probe:left{size:A4 landscape;page-orientation:rotate-left}',
    source: `import {page} from 'zyzz/web';page({selector:'probe:left',descriptors:{size:'A4 landscape',pageOrientation:'rotate-left'}});`,
  },
  '@position-try': {
    css: '@position-try --probe{position-area:top;margin:4px}',
    source: `import {positionTry} from 'zyzz/web';export const probe=positionTry({positionArea:'top',margin:'4px'});`,
  },
  '@property': {
    css: '@property --probe{syntax:"<length>+ | auto";inherits:false;initial-value:4px 8px}',
    source: `import {property} from 'zyzz/web';property({name:'--probe',syntax:'<length>+ | auto',inherits:false,initialValue:'4px 8px'});`,
  },
  '@scope': {
    css: '@scope (.root) to (.limit){body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@scope (.root) to (.limit)':{body:{color:'red'}}});`,
  },
  '@starting-style': {
    css: '@starting-style{body{opacity:0}}',
    source: `import {global} from 'zyzz/web';global({'@starting-style':{body:{opacity:0}}});`,
  },
  '@supports': {
    css: '@supports selector(:has(.child)){body{color:red}}',
    source: `import {global} from 'zyzz/web';global({'@supports selector(:has(.child))':{body:{color:'red'}}});`,
  },
} as const
