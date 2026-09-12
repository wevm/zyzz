/** Composite function definitions with escaped parameters and nested references. @module */
export function source(after = false): string {
  return `import {cssFunction,global} from 'zyzz/web';
export const inner=cssFunction({parameters:[{name:'--日本語',syntax:'<length>',default:'${after ? '3px' : '2px'}'}],returns:'<length>',body:{result:'var(--日本語)'}});
export const outer=cssFunction({parameters:[{name:'--x',syntax:'<length>'}],returns:'<length>',body:{'--local':inner(),result:'var(--x)','@media (width > 1px)':{result:'var(--local)'},'@supports (width: 1px)':{result:'var(--x)'},'@container (width > 1px)':{result:'var(--local)'}}},{within:['@layer functions','@media screen']});
export const words=cssFunction({parameters:[{name:'--word',syntax:${JSON.stringify('type(日本語 | foo\\|bar | foo\\+bar | foo\\#bar)')},default:'日本語'}],returns:'<custom-ident>',body:{result:'var(--word)'}});
export const list=cssFunction({parameters:[{name:'--list',syntax:'type(<length>+ | auto)',default:'1px 2px'}],returns:'<length>+',body:{result:'var(--list)'}});
global({body:{width:outer(inner()),'--list':list('2px 4px')}});`
}
