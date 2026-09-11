/** Checks public page descriptor inference. @module */
import { describe, test } from 'vite-plus/test'
import { page } from 'zyzz/web'
describe('page', () => {
  test('accepts descriptor grammar and rejects context errors', () => {
    page({
      selector: ':first, :left',
      descriptors: {
        size: 'landscape JIS-B4',
        bleed: '1Q',
        '@top-center': { content: '"Page"' },
      },
    })
    page({
      descriptors: {
        size: '  a4 LANDSCAPE ',
        marks: 'CROP',
        pageOrientation: 'UPRIGHT',
      },
    })
    page({ descriptors: { size: '1pc 2Q' } })
    // @ts-expect-error element display does not apply to pages
    page({ descriptors: { display: 'flex' } })
    // @ts-expect-error table border collapse does not apply to pages
    page({ descriptors: { borderCollapse: 'collapse' } })
    // @ts-expect-error table border spacing does not apply to margin boxes
    page({ descriptors: { '@top-center': { borderSpacing: '1px' } } })
    // @ts-expect-error size is a page descriptor
    page({ descriptors: { '@top-center': { size: 'A4' } } })
  })
})

describe('page', () => {
  test('covers descriptor inventory and context errors', () => {
    page({
      descriptors: {
        bleed: '3mm',
        marks: 'crop cross',
        pageOrientation: 'upright',
        size: 'A4 landscape',
        margin: '1cm',
        '@top-left-corner': { content: '"x"' },
        '@top-left': { content: '"x"' },
        '@top-center': { content: '"x"' },
        '@top-right': { content: '"x"' },
        '@top-right-corner': { content: '"x"' },
        '@bottom-left-corner': { content: '"x"' },
        '@bottom-left': { content: '"x"' },
        '@bottom-center': { content: '"x"' },
        '@bottom-right': { content: '"x"' },
        '@bottom-right-corner': { content: '"x"' },
        '@left-top': { content: '"x"' },
        '@left-middle': { content: '"x"' },
        '@left-bottom': { content: '"x"' },
        '@right-top': { content: '"x"' },
        '@right-middle': { content: '"x"' },
        '@right-bottom': { content: '"x"' },
      },
    })
  })
})
