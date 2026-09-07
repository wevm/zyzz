import { describe, expect, it } from 'vitest'
import { css } from './index.js'

describe('css', () => {
  it('fails clearly when a compiler integration is missing', () => {
    expect(() => css({ padding: 4 })).toThrow('css() must be compiled')
  })
})
