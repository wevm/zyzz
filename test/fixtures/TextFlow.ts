/**
 * Shares text-flow authoring and native CSS controls for compiler verification.
 * @module
 */
import type { Style } from 'zyzz'

/** Native declarations independently describe each source export. */
export const controls = {
  breaks: 'width:65px;word-break:break-all;',
  letters: 'letter-spacing:2px;',
  paragraph:
    'width:200px;text-indent:12px;text-align-last:start;hyphens:manual;text-transform:uppercase;',
  truncate:
    'width:65px;overflow:hidden;white-space:nowrap!important;text-overflow:ellipsis;',
  words: 'word-spacing:3px;',
  wrap: 'width:65px;overflow-wrap:anywhere;white-space:normal;',
} as const

/** Source covers token indentation, bounded keywords, fallbacks, and importance. */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{spacing:{indent:'12px'}}});\nexport const breaks = style({width:'65px',wordBreak:'break-all'})();\nexport const letters = style({letterSpacing:['normal','2px']})();\nexport const paragraph = zyzz.style({width:'200px',textIndent:zyzz.vars.spacing.indent,textAlignLast:'start',hyphens:'manual',textTransform:'uppercase'})();\nexport const truncate = style({width:'65px',overflow:'hidden',whiteSpace:['pre','nowrap !important'],textOverflow:'ellipsis'})();\nexport const words = style({wordSpacing:'3px'})();\nexport const wrap = style({width:'65px',overflowWrap:'anywhere',whiteSpace:'normal'})();\n"

/** Public authoring covers negative lengths, percentages, and remaining keywords. */
export const styles = {
  heading: { letterSpacing: '-.02em', textTransform: 'capitalize' },
  paragraph: {
    hyphens: 'auto',
    textAlignLast: 'justify',
    textIndent: '-10%',
    wordSpacing: 'normal',
  },
  preformatted: {
    whiteSpace: 'break-spaces',
    overflowWrap: 'break-word',
    wordBreak: 'keep-all',
    textOverflow: 'clip',
  },
} as const satisfies Record<string, Style.Properties>
