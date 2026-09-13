/** Measures compile-time composition over ordered conflicting declarations. @module */
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const options = {
  moduleId: 'compose.ts',
  source: `import {css,cx} from 'zyzz';const a=css({padding:'8px',color:'red'});const b=css({paddingLeft:'12px',color:'blue'});export const props=cx(a(),b(),a());`,
}

describe('cx / static composition', () => {
  bench('compile ordered groups', () => {
    Transform.compile(options)
  })
})
