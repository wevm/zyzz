/** Verifies distinct page, margin, feature, and view-transition descriptor contexts. @module */
import { describe, test } from 'vite-plus/test'
import { fontFeatureValues, page, viewTransition } from 'zyzz/web'

describe('document rules', () => {
  test('accepts document descriptors and rejects element or nested-context mistakes', () => {
    page({
      selector: ':first',
      descriptors: {
        size: 'A4',
        margin: '2cm',
        '@bottom-center': { content: 'counter(page)', color: 'red' },
      },
    })
    fontFeatureValues({
      families: ['Body'],
      features: {
        '@styleset': { editorial: [1, 2] },
        '@character-variant': { alternate: [1, 2] },
      },
    })
    viewTransition({ navigation: 'auto', types: 'slide' })
    // @ts-expect-error Page bodies cannot set element display.
    page({ descriptors: { display: 'flex' } })
    // @ts-expect-error Size belongs to the page, not a margin box.
    page({ descriptors: { '@bottom-center': { size: 'A4' } } })
    fontFeatureValues({
      families: 'Body',
      // @ts-expect-error Swash accepts one index.
      features: { '@swash': { flow: [1, 2] } },
    })
    // @ts-expect-error Navigation has a closed keyword domain.
    viewTransition({ navigation: 'always' })
  })
})
