/** Exercises descriptor families through the public authoring surface. @module */
import { describe, test } from 'vite-plus/test'
import {
  colorProfile,
  counterStyle,
  fontFace,
  fontFeatureValues,
  fontPaletteValues,
  page,
  positionTry,
  viewTransition,
} from 'zyzz/web'

describe('stylesheet descriptors', () => {
  test('covers descriptor and nested block inventories without runtime validators', () => {
    fontFace({
      ascentOverride: '90%',
      descentOverride: '10%',
      fontDisplay: 'swap',
      fontFamily: 'Evidence',
      fontFeatureSettings: '"kern"',
      fontStretch: 'condensed',
      fontStyle: 'italic',
      fontVariationSettings: '"wght" 500',
      fontWeight: '400 700',
      lineGapOverride: '0%',
      sizeAdjust: '110%',
      src: 'url(/font.ttf)',
      unicodeRange: 'U+0000-00FF',
    })
    counterStyle({
      system: 'additive',
      additiveSymbols: '10 "X", 1 "I"',
      fallback: 'decimal',
      negative: '"(" ")"',
      pad: '2 "0"',
      prefix: '"["',
      range: '1 99',
      speakAs: 'numbers',
      suffix: '"]"',
      symbols: '"I"',
    })
    colorProfile({ renderingIntent: 'perceptual', src: 'url(/profile.icc)' })
    fontPaletteValues({
      basePalette: 'light',
      fontFamily: 'Evidence',
      overrideColors: '0 red, 1 blue',
    })
    positionTry({
      positionAnchor: '--target',
      positionArea: 'top',
      margin: '2px',
      inset: 'auto',
      width: '10px',
      maxHeight: '30px',
      alignSelf: 'center',
      justifySelf: 'center',
    })
    fontFeatureValues({
      families: ['Evidence', 'Fallback'],
      fontDisplay: 'swap',
      features: {
        '@annotation': { a: 1 },
        '@character-variant': { a: [1, 2] },
        '@ornaments': { a: 1 },
        '@styleset': { a: [1, 2, 3] },
        '@stylistic': { a: 1 },
        '@swash': { a: 1 },
      },
    })
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
    viewTransition({ navigation: 'auto', types: 'slide forwards' })
    // @ts-expect-error page descriptors do not belong in font-face bodies
    fontFace({ fontFamily: 'Evidence', src: 'url(/font.ttf)', size: 'A4' })
    counterStyle({
      system: 'cyclic',
      symbols: '"x"',
      // @ts-expect-error a palette reference cannot select a counter fallback
      fallback: fontPaletteValues({ fontFamily: 'Evidence', basePalette: 0 }),
    })
    fontFeatureValues({
      families: 'Evidence',
      // @ts-expect-error font feature blocks have distinct tuple domains
      features: { '@stylistic': { a: [1, 2] } },
    })
  })
})
