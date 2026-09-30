/** Checks serialized configs and previews against real consumer data. @module */
import * as fs from 'node:fs'
import { describe, expect, test } from 'vite-plus/test'
import * as Module from 'node:module'
import * as Variables from '../site/src/Variables.js'

const LZString = Module.createRequire(import.meta.url)(
  '../site/node_modules/lz-string',
) as typeof import('../site/node_modules/lz-string/typings/lz-string.js')

const tempo = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/vars/tempo.json', import.meta.url),
    'utf8',
  ),
)

describe('variables page data', () => {
  test('reads an optional configuration name', () => {
    const value = `lz:${LZString.compressToEncodedURIComponent(JSON.stringify({ name: ' Tempo.xyz ', vars: {} }))}`
    expect(Variables.decode(value)?.name).toBe('Tempo.xyz')
    expect(Variables.decode('{"name":"  ","vars":{}}')?.name).toBeUndefined()
    expect(Variables.decode('{"name":"Token name"}')?.vars).toEqual({
      name: 'Token name',
    })
    expect(() => Variables.decode('{"name":123,"vars":{}}')).toThrow(/name/)
  })

  test('uses defaults only when no payload is supplied', () => {
    expect(Variables.decode(undefined)).toBeUndefined()
    expect(() => Variables.decode('')).toThrow()
  })

  test('reads compressed Tempo config without flattening responsive data', () => {
    const value = `lz:${LZString.compressToEncodedURIComponent(JSON.stringify(tempo))}`
    const config = Variables.decode(value)!
    expect(config.mappings).toBe(false)
    expect(config.vars.breakpoint).toMatchObject({
      '768': '768px',
      '1536': '1536px',
    })
    const typography = Variables.collect(
      config.vars.typography,
      ['typography'],
      config.mappings,
    )
    const heading = typography.filter(
      (entry) => entry.path.slice(0, 3).join('.') === 'typography.heading.h1',
    )
    expect(heading.map((entry) => entry.path.at(-1))).toEqual([
      'h1',
      '@media >=768',
      '@media >=1024',
      '@media >=1536',
    ])
    expect(heading[0]?.value).toMatchObject({
      fontSize: '32px',
      lineHeight: '36px',
      fontFamily: 'Pilat, Arial, sans-serif',
      fontWeight: 500,
    })
    expect(heading[3]?.value).toMatchObject({
      fontSize: '56px',
      lineHeight: '62px',
    })
    const columns = Variables.collect(config.vars.dimension, [
      'dimension',
    ]).filter((entry) => entry.kind === 'columns')
    expect(columns.map((entry) => entry.value)).toEqual(['4', '6', '12'])
    const fonts = Variables.collect(config.vars.editorial, [
      'editorial',
    ]).filter((entry) => entry.kind === 'fontFamily')
    expect(fonts.map((entry) => entry.path.at(-1))).toEqual(['sans', 'serif'])
  })

  test('reads raw JSON variables and uses CSS property mappings', () => {
    expect(Variables.decode('{"palette":{"brand":"#123456"}}')?.vars).toEqual({
      palette: { brand: '#123456' },
    })
    const config = Variables.decode(
      '{"vars":{"space":{"sm":"8px"},"corners":{"sm":"6px"}},"mappings":{"space":["padding"],"corners":["borderRadius"]}}',
    )!
    expect(
      Variables.collect(config.vars.space, ['space'], config.mappings)[0]?.kind,
    ).toBe('spacing')
    expect(
      Variables.collect(config.vars.corners, ['corners'], config.mappings)[0]
        ?.kind,
    ).toBe('radius')
  })

  test('keeps light/dark pairs together', () => {
    expect(
      Variables.collect({ brand: { light: '#fff', dark: '#000' } }, [
        'palette',
      ]),
    ).toEqual([
      {
        path: ['palette', 'brand'],
        kind: 'color',
        value: '#fff',
        dark: '#000',
      },
    ])
  })

  test('inherits typography values between media overrides', () => {
    const entries = Variables.collect(
      {
        heading: {
          fontSize: {
            default: '20px',
            '@media >=768': '28px',
            '@media >=1024': '36px',
          },
          lineHeight: { default: '24px', '@media >=768': '32px' },
        },
      },
      ['typography'],
    )
    expect(entries[2]?.value).toEqual({ fontSize: '36px', lineHeight: '32px' })
  })

  test('rejects malformed data and unsupported shapes', () => {
    for (const value of [
      'lz:invalid',
      '{',
      'null',
      '[]',
      '{"vars":[]}',
      '{"vars":{"size":true}}',
      '{"vars":{},"mappings":{"spacing":"padding"}}',
      '{"__proto__":{"x":"1px"}}',
      'x'.repeat(32001),
    ])
      expect(() => Variables.decode(value)).toThrow()
    expect(() =>
      Variables.decode(JSON.stringify({ vars: { a: Array(3) } })),
    ).toThrow()
    const nested = Array.from({ length: 25 }).reduce<unknown>(
      (value) => ({ nested: value }),
      '1px',
    )
    expect(() => Variables.decode(JSON.stringify({ vars: nested }))).toThrow(
      /nested/,
    )
  })
})
