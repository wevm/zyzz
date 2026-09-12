/** Checks where relationship authoring with css definitions as interpolations. @module */
import { describe, test } from 'vite-plus/test'
import { css, Style } from 'zyzz'
import { global, where } from 'zyzz/web'

describe('where', () => {
  test('accepts css definitions and keeps property checking around them', () => {
    const card = css({ color: 'red' })
    const dynamic = css((values: { color: '#123' | '#456' }) => ({
      color: values.color,
    }))

    css({
      opacity: 0,
      [where`${card}:hover &`]: { color: 'red' },
      [where`&:has(${dynamic})`]: { color: 'blue' },
      [where`${card}:has(${dynamic}) &`]: { color: 'green' },
    })
    css((values: { color: '#123' | '#456' }) => ({
      [where`${card} &`]: { color: values.color },
    }))

    const arbitrary = Symbol()

    // @ts-expect-error arbitrary symbols are not relationship keys
    css({ [arbitrary]: { color: 'red' } })
    // @ts-expect-error relationship bodies keep property checking
    css({ [where`${card} &`]: { colr: 'red' } })
    // @ts-expect-error siblings keep property checking
    css({ [where`${card} &`]: { color: 'red' }, colr: 'red' })
    // @ts-expect-error strings are not definitions
    void where`${'.card'} &`
    // @ts-expect-error applied props are not definitions
    void where`${card()} &`
    // @ts-expect-error attribute objects are not definitions
    void where`${{ className: 'card' }} &`
  })
})

describe('global', () => {
  test('excludes relationships from global declarations', () => {
    const card = css({})

    // @ts-expect-error ordinary nested conditions cannot hide relationships
    global({ body: { ':hover': { [where`${card} &`]: { color: 'red' } } } })
    // @ts-expect-error global rules cannot contain relationship keys
    global({ body: { [where`${card} &`]: { color: 'red' } } })
  })
})

describe('define', () => {
  test('excludes source-only relationships from core definitions', () => {
    const card = css({})

    // @ts-expect-error core definitions do not compile relationships
    Style.define({ target: { [where`${card} &`]: { color: 'red' } } })
  })
})
