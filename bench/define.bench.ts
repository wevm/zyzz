import { Style } from 'typestyle'
import { bench, describe } from 'vite-plus/test'
import { components, project } from '../test/fixtures/components.js'

const repeated = project(1000, false)
const unique = project(1000, true)

describe('public authoring and validation', () => {
  bench('component set', () => {
    Style.define(components)
  })
  bench('1000 repeated cards', () => {
    Style.define(repeated)
  })
  bench('1000 unique cards', () => {
    Style.define(unique)
  })
})
