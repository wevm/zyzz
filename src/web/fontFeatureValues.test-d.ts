/** Checks public fontFeatureValues descriptor inference. @module */
import { describe, test } from 'vite-plus/test'
import { fontFeatureValues } from 'zyzz/web'
describe('fontFeatureValues', () => {
  test('accepts descriptor grammar and rejects context errors', () => {
    // @ts-expect-error CSS keywords fold ASCII letters only
    fontFeatureValues({ families: 'Body', features: {}, fontDisplay: 'blocK' })
    const options: fontFeatureValues.Options = {
      families: 'Body',
      features: {},
      fontDisplay: 'swap',
    }
    fontFeatureValues(options)
    fontFeatureValues({
      families: ['Body'],
      fontDisplay: ' SWAP ',
      features: { '@styleset': { editorial: [1, 3] }, '@swash': undefined },
    })
    fontFeatureValues({
      families: 'Body',
      // @ts-expect-error unknown nested blocks are rejected
      features: { '@unknown': { flow: 1 } },
    })
    fontFeatureValues({
      families: 'Body',
      // @ts-expect-error swash accepts one index
      features: { '@swash': { flow: [1, 2] } },
    })
  })
})
