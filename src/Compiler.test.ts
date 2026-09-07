import { describe, expect, it } from 'vitest'
import * as Compiler from './Compiler.js'

const compile = (code: string) =>
  Compiler.compile({ id: '/fixture/Button.tsx', code })

describe('compile', () => {
  it('erases the macro and resolves tokens into static CSS', () => {
    const result = compile(
      `import { css } from 'typestyle'; export const button = css({ padding: 4, borderRadius: 'lg', color: 'gray.1000' });`,
    )
    expect(result.code).not.toContain('typestyle')
    expect(result.code).not.toContain('css(')
    expect(result.css).toMatch(
      /\.cp_[a-f0-9]{20}\{padding:1rem;border-radius:0.5rem;color:light-dark\(#171717, #ededed\)\}/,
    )
    expect(result.map.sources).toEqual(['/fixture/Button.tsx'])
    expect(result.map.sourcesContent?.[0]).toContain('css({')
  })

  it('resolves aliases by binding and leaves shadowed functions alone', () => {
    const result = compile(
      `import { css as c } from 'typestyle'; const a = c({ padding: 2 }); function f(c: (x: number) => number) { return c(3) }`,
    )
    expect(result.code).toContain('return c(3)')
    expect(result.css).toContain('padding:0.5rem')
  })

  it('compiles TSX calls and asserted literal objects', () => {
    const result = compile(
      `import { css, type Style } from 'typestyle'; export const Button = () => <button className={css({display:'flex'} satisfies Style)}>OK</button>;`,
    )
    expect(result.code).toContain('className={"cp_')
    expect(result.css).toContain('display:flex')
  })

  it('uses content hashes independent of filenames and deduplicates equal styles', () => {
    const code = `import { css } from 'typestyle'; const a = css({padding: 2}); const b = css({padding: 2});`
    const first = compile(code)
    expect(first.css.match(/padding/g)).toHaveLength(1)
    expect(Compiler.compile({ id: '/other.ts', code }).css).toBe(first.css)
  })

  it('sorts breakpoints and pseudos with deterministic precedence', () => {
    const result = compile(
      `import { css } from 'typestyle'; const a = css({ '@lg': {padding: 8}, ':active': {opacity: 0.8}, ':hover': {opacity: 0.9}, '@sm': {padding: 4, ':focus-visible': {outlineWidth: 2}}, '&[data-checked]': {color:'blue.900'} });`,
    )
    expect(result.css.indexOf(':hover')).toBeLessThan(
      result.css.indexOf(':active'),
    )
    expect(result.css.indexOf('min-width:40rem')).toBeLessThan(
      result.css.indexOf('min-width:64rem'),
    )
    expect(result.css).toContain('[data-checked]')
    expect(result.css).toContain(':focus-visible{outline-width:2px}')
  })

  it('expands Geist typography before explicit overrides and includes strong semantics', () => {
    const result = compile(
      `import { css } from 'typestyle'; const a = css({fontWeight:700, typography:'copy.14'});`,
    )
    expect(result.css).toContain(
      'font-size:14px;line-height:20px;font-weight:400;font-weight:700',
    )
    expect(result.css).toContain(
      '>strong{color:light-dark(#171717, #ededed);font-weight:550}',
    )
  })

  it('preserves literal ampersands in arbitrary content', () => {
    expect(
      compile(
        `import { css } from 'typestyle'; const a = css({'::before': {content:'["&"]'}});`,
      ).css,
    ).toContain('content:"&"')
  })

  it.each([
    [`css({ padding: props.size })`, 'must be a string, number'],
    [`css({ ...other })`, 'spreads, computed keys'],
    [`css({ [key]: 1 })`, 'computed keys'],
    [`css({ get color() { return 'red.900' } })`, 'explicit literal'],
    [`css({ padding: -1 })`, 'negative spacing'],
    [`css({ color: 'blue.123' })`, 'Unknown color token'],
    [`css({ paddding: 4 })`, 'Unknown CSS property'],
    [`css({ padding: 2, padding: 4 })`, 'Duplicate style key'],
    [`css({ color: '[red;display:none]' })`, 'Invalid arbitrary'],
    [`css({ '@bogus': { color: 'white' } })`, 'Unsupported condition'],
    [`css(dynamic())`, 'literal objects'],
  ])('rejects unsupported static input: %s', (expression, message) => {
    expect(() =>
      compile(`import { css } from 'typestyle'; const a = ${expression};`),
    ).toThrow(message)
  })

  it('rejects runtime aliases, re-exports, and namespace imports', () => {
    expect(() =>
      compile(`import { css } from 'typestyle'; const alias = css;`),
    ).toThrow('only be called directly')
    expect(() => compile(`export { css } from 'typestyle';`)).toThrow(
      'Re-exporting',
    )
    expect(() => compile(`import * as Css from 'typestyle';`)).toThrow(
      'named import',
    )
  })

  it('reports source locations for invalid declarations', () => {
    expect(() =>
      compile(`import { css } from 'typestyle';\ncss({color:'wrong'});`),
    ).toThrow('/fixture/Button.tsx:2:5:')
  })

  it('does not execute arbitrary application code', () => {
    expect(() =>
      compile(
        `import { css } from 'typestyle'; css({padding: (() => { throw new Error('executed') })()});`,
      ),
    ).toThrow('must be a string, number')
  })
})
