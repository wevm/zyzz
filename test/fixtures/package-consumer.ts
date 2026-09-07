import * as Assert from 'node:assert/strict'
import { Style } from 'typestyle'

const output = Style.define({
  card: { display: 'flex', padding: 0, color: '#fff' },
})
Assert.deepEqual(output.styles, [
  {
    name: 'card',
    declarations: [
      { property: 'display', value: 'flex' },
      { property: 'padding', value: 0 },
      { property: 'color', value: '#fff' },
    ],
  },
])
Assert.equal(Object.isFrozen(output.styles[0]?.declarations), true)
console.log('packed consumer passed')
