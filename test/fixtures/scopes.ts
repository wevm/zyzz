/** Supplies equivalent variable scope applications for correctness and benchmarks. @module */

/** Creates a configured style with manual or compiled scope composition. */
export function source(output: 'html' | 'react', composition: 'manual' | 'cx') {
  const key = output === 'html' ? 'class' : 'className'
  const application =
    composition === 'cx'
      ? `return cx(vars({colorScheme:scheme}),root())`
      : `const scope=vars({colorScheme:scheme});const props=root();return {${key}:scope.${key}+' '+props.${key},style:scope.style}`
  return `import {Config,cx} from 'zyzz';const {vars,style}=Config.create({output:'${output}',vars:{color:{brand:'#123456'}}});const root=style({color:'brand'});export function apply(scheme:'light'|'dark'){${application}}`
}
