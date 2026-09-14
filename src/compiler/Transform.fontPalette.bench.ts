/** Measures font palette descriptor emission and packed identity validation. @module */
import { bench, describe } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

for (const count of [10, 100]) {
  const source = `import {fontPaletteValues,global} from 'zyzz/web';${Array.from({ length: count }, (_, index) => `export const p${index}=fontPaletteValues({fontFamily:'Evidence',basePalette:1,overrideColors:'0 red'});global({'.text${index}':{fontPalette:p${index}}});`).join('\n')}`
  const library = Graph.compile({
    cssOutput: 'grouped',
    modules: { 'palettes.ts': source },
  })
  describe(`font palette publication / ${count} palettes`, () => {
    bench(
      'source transform with maps',
      () => {
        Transform.compile({
          cssOutput: 'grouped',
          moduleId: 'palettes.ts',
          source,
        })
      },
      { iterations: 20, time: 1000 },
    )
    bench(
      'packed stylesheet consumption',
      () => {
        Graph.compile({
          cssOutput: 'grouped',
          contracts: { 'lib.js': library.contracts['palettes.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        })
      },
      { iterations: 20, time: 1000 },
    )
  })
}
