/**
 * Provides a shorthand-mapping configuration and its aliased consumers for integration and benchmark flows.
 * @module
 */
/** Configuration declaring ordered property aliases beside dedicated spacing groups. */
export const config = `import {Config} from 'zyzz';export const {css,theme}=Config.create({shorthands:{px:['paddingLeft','paddingRight'],paddingX:['paddingLeft','paddingRight'],space:['marginLeft','paddingLeft']},theme:{spacing:{sm:'4px'},margin:{sm:'-8px'},padding:{sm:'12px'}}});`

/** Aliased authoring consuming the packed configuration through static, bound, and dynamic calls. */
export const source = `import {css,theme} from 'library';export namespace styles {
  export const card = css({px:'sm',paddingLeft:'2px',':hover':{paddingX:'sm!'}})

  export const mixed = css({space:'sm'})

  export const handle = theme.css({px:'sm'})

  export const dynamic = css((values:{width:'10px'|'20px'})=>({px:values.width}))
}`
