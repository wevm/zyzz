/** Checks the public profile descriptor and reference contract. @module */
import { colorProfile } from 'zyzz/web'
import { style } from 'zyzz'

import { describe, expectTypeOf, test } from 'vite-plus/test'

describe('colorProfile', () => {
  test('accepts profile descriptors and retains the color-space identity domain', () => {
    const profile = colorProfile({
      '@media print': {
        '@layer color': {
          src: 'url(./print.icc)',
          components: 'c, m, y, k',
          renderingIntent: 'relative-colorimetric',
        },
      },
    })
    expectTypeOf(profile).toEqualTypeOf<colorProfile.Reference>()
    style({ color: `color(${profile} 0 1 1 0)` })
    for (const renderingIntent of [
      'absolute-colorimetric',
      'relative-colorimetric',
      'perceptual',
      'saturation',
    ] as const)
      colorProfile({ src: 'url(/profile.icc)', renderingIntent })
    colorProfile({ src: 'url(/profile.icc)', components: '图, \\72 ed, pi' })
    // @ts-expect-error a profile requires a source URL
    colorProfile({ components: 'r,g,b' })
    // @ts-expect-error descriptor fields are exact
    colorProfile({ src: 'url(/profile.icc)', unknown: 'value' })
    // @ts-expect-error rendering intent is a closed domain
    colorProfile({ src: 'url(/profile.icc)', renderingIntent: 'auto' })
    // @ts-expect-error components use CSS identifier-list text
    colorProfile({ src: 'url(/profile.icc)', components: 3 })
    // @ts-expect-error source uses CSS URL text
    colorProfile({ src: 3 })
    // @ts-expect-error descriptor rules cannot enclose a profile
    colorProfile({ '@page': { src: 'url(/profile.icc)' } })
    // @ts-expect-error profiles are color-space identities, not color values
    style({ color: profile })
  })
})

describe('colorProfile', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    colorProfile({
      '@layer definitions': { '@media screen': { src: 'url(/profile.icc)' } },
    })
    // @ts-expect-error selectors cannot enclose a declaration
    colorProfile({ '.card': { src: 'url(/profile.icc)' } })
    colorProfile(
      { src: 'url(/profile.icc)' },
      // @ts-expect-error enclosing groups belong in the definition
      { within: ['@layer definitions'] },
    )
  })
})
