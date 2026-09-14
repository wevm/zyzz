/** Measures compilation and fixed-slot payload selection independently. @module */
import { bench, describe } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import { ConditionalRecipe, PayloadRecipe } from 'zyzz/runtime'

const options = {
  moduleId: 'payload.ts',
  source: `import {variants} from 'zyzz';export const button=variants({conditions:{wide:'@media (width >= 600px)'},variants:{size:{sm:{padding:'4px'},custom:(values:{padding:\`\${number}px\`})=>({padding:values.padding})}},defaultVariants:{size:{custom:{padding:'12px'}}}})`,
}
const extracted = Source.extract(options)
const output = Transform.compile({
  ...options,
  composition: 'independent',
  cssOutput: 'grouped',
})
const call = extracted.calls[0]!
const definition = call.recipe!
const select = ConditionalRecipe.create({
  ...definition,
  conditions: definition.conditions!,
  className: output.classes[call.name]!,
})
const button = PayloadRecipe.create({
  ...definition,
  payloads: definition.payloads!,
  select,
})

describe('variants / payloads', () => {
  bench('compile', () => {
    Transform.compile({
      ...options,
      composition: 'independent',
      cssOutput: 'grouped',
    })
  })
  bench('bind default', () => {
    button()
  })
  bench('bind base and conditional values', () => {
    button({
      size: { custom: { padding: '16px' } },
      conditions: { wide: { size: { custom: { padding: '24px' } } } },
    })
  })
  bench('remove payload', () => {
    button({ size: 'sm' })
  })
})
