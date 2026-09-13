/** Measures fixed recipe compilation and conditional selection independently. @module */
import { bench, describe } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import { ConditionalRecipe, Recipe } from 'zyzz/runtime'

const body = `base:{padding:'2px'},
variants:{size:{sm:{padding:'4px'},lg:{padding:'12px'}},loading:{true:{opacity:0.5},false:{}}},
defaultVariants:{size:'sm',loading:false},
compoundVariants:[{when:{size:'lg',loading:true},style:{color:'blue'}}]`
const conditions = `conditions:{wide:'@media (width >= 600px)',short:'@media (height < 500px)',grid:'@supports (display: grid)'},`

for (const [name, prefix] of [
  ['static', ''],
  ['three conditions', conditions],
] as const) {
  const options = {
    moduleId: 'recipe.ts',
    source: `import {variants} from 'zyzz';export const button=variants({${prefix}${body}})`,
  }
  const extracted = Source.extract(options)
  const output = Transform.compile(options)
  const call = extracted.calls[0]!
  const button = (() => {
    const options = { ...call.recipe!, className: output.classes[call.name]! }
    return options.conditions
      ? ConditionalRecipe.create({ ...options, conditions: options.conditions })
      : Recipe.create(options)
  })()

  describe(`variants / ${name}`, () => {
    bench('compile', () => {
      Transform.compile(options)
    })
    bench('select defaults', () => {
      button()
    })
    bench('select overrides', () => {
      button({
        size: 'lg',
        conditions: {
          wide: { size: 'sm' },
          short: { size: null },
          grid: { loading: true },
        },
      })
    })
  })
}
