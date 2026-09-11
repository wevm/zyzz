/** Measures complete stylesheet declaration compilation and packed consumption. @module */
import { bench, describe } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

for (const count of [10, 100]) {
  const source = `import {counterStyle,page,cssFunction,customMedia} from 'zyzz/web';\n${Array.from({ length: count }, (_, index) => `export const counter${index}=counterStyle({system:'cyclic',symbols:'"●"'});page({selector:':first',descriptors:{margin:'1cm','@top-center':{content:'"${index}"'}}});export const query${index}=customMedia('(width > ${index}px)');export const fn${index}=cssFunction({parameters:[{name:'--x',syntax:'<length>'}],returns:'<length>',body:{result:'calc(var(--x) * 2)'}});`).join('\n')}`
  const library = Graph.compile({ modules: { 'library.ts': source } })
  describe(`at-rule declarations / ${count} families`, () => {
    bench(
      'source transform with maps',
      () => {
        Transform.compile({ moduleId: 'library.ts', source })
      },
      { iterations: 20, time: 1000 },
    )
    bench(
      'packed stylesheet consumption',
      () => {
        Graph.compile({
          contracts: { 'lib/library.js': library.contracts['library.ts']! },
          imports: { 'app.ts': { lib: 'lib/library.js' } },
          modules: { 'app.ts': `import 'lib'` },
        })
      },
      { iterations: 20, time: 1000 },
    )
  })
}
