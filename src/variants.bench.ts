/** Measures recipe compilation and selection over real compiler output. @module */
import { bench, describe } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import { Recipe } from 'zyzz/runtime'

const source = `import {variants} from 'zyzz'; export const button=variants({
base:{display:'inline-flex'},
variants:{size:{sm:{padding:'4px'},lg:{padding:'12px'}},loading:{true:{opacity:0.5},false:{opacity:1}}},
defaultVariants:{size:'sm',loading:false},
compoundVariants:[{when:{size:'lg',loading:true},style:{color:'red'}}]
})`
const options = { moduleId: 'recipe.ts', source }
const extracted = Source.extract(options)
const output = Transform.compile(options)
const call = extracted.calls[0]!
const button = Recipe.create({
  ...call.recipe!,
  className: output.classes[call.name]!,
})

describe('variants', () => {
  bench('compile / defaults and compounds', () => Transform.compile(options))
  bench('select / defaults', () => button())
  bench('select / changed choices and overrides', () =>
    button({ size: 'lg', loading: true, style: { opacity: 0.75 } }))
})
