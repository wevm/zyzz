/**
 * Shares logical box authoring across source, browser, and benchmark flows.
 * @module
 */
import type { Style } from 'zyzz'

/** Independently authored CSS controls for the supported box families. */
export const controls = {
  dimensions:
    'block-size:40px;inline-size:80px;max-block-size:100px;max-inline-size:120px;min-block-size:10px;min-inline-size:20px;',
  offsets:
    'position:relative;inset:1px;inset-block:2px;inset-block-start:-3px;inset-block-end:4px;inset-inline:5px;inset-inline-start:-6px;inset-inline-end:7px;top:8px;right:9px;bottom:10px;left:11px;',
  spacing:
    'margin-block:-2px;margin-block-start:3px;margin-block-end:4px;margin-inline:5px;margin-inline-start:6px;margin-inline-end:7px;padding-block:8px;padding-block-start:9px;padding-block-end:10px;padding-inline:11px;padding-inline-start:12px;padding-inline-end:13px;',
} as const

/** Complete scalar logical box vocabulary, with intentional shorthand order. */
export const styles = {
  dimensions: {
    blockSize: '40px',
    inlineSize: '80px',
    maxBlockSize: '100px',
    maxInlineSize: '120px',
    minBlockSize: '10px',
    minInlineSize: '20px',
  },
  offsets: {
    position: 'relative',
    inset: '1px',
    insetBlock: '2px',
    insetBlockStart: '-3px',
    insetBlockEnd: '4px',
    insetInline: '5px',
    insetInlineStart: '-6px',
    insetInlineEnd: '7px',
    top: '8px',
    right: '9px',
    bottom: '10px',
    left: '11px',
  },
  spacing: {
    marginBlock: '-2px',
    marginBlockStart: '3px',
    marginBlockEnd: '4px',
    marginInline: '5px',
    marginInlineStart: '6px',
    marginInlineEnd: '7px',
    paddingBlock: '8px',
    paddingBlockStart: '9px',
    paddingBlockEnd: '10px',
    paddingInline: '11px',
    paddingInlineStart: '12px',
    paddingInlineEnd: '13px',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Source preserves mixed-axis declaration order and token priority. */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{spacing:{space:'12px'}}});\nexport const logical = zyzz.style({\n  width:'[60px]',inlineSize:['[70px]','[80px] !important'],blockSize:'[40px]',\n  paddingLeft:'[2px]',paddingInlineStart:['[4px]',zyzz.vars.spacing.space],\n  marginInlineEnd:'space !important',position:'relative',insetInlineStart:'[-3px]'\n})();\nexport const physical = style({inlineSize:'30px',width:'50px',paddingInlineStart:'6px',paddingLeft:'8px'})();\nexport const scope = zyzz.vars().className;\n"
