import { Style } from 'typestyle'

const definition = Style.define({
  card: { color: '#fff', display: 'flex', padding: 0 },
})
console.log(
  JSON.stringify({
    definition,
    frozen: Object.isFrozen(definition.styles[0]?.declarations),
  }),
)
