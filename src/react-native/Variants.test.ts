/** Verifies native recipe tables through shared source extraction and compilation. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { Variants } from 'zyzz/react-native'

const source = `import {variants} from 'zyzz';export const card=variants({
  base:{fontSize:'10px',lineHeight:1.5,targets:{native:{opacity:0.2}}},
  variants:{
    size:{small:{fontSize:'12px'},large:{fontSize:'20px'}},
    active:{true:{opacity:0.5},false:{opacity:0.8}},
  },
  defaultVariants:{size:'small',active:false},
  compoundVariants:[
    {when:{size:['small','large'],active:true},style:{targets:{native:{transform:[{scale:2}]},ios:{opacity:0.7}}}},
    {when:{size:'large',active:true},style:{targets:{native:{transform:[{rotate:'90deg'}]}}}},
  ],
});`

describe('compile', () => {
  test('compiles ordered choices, nulls, compounds and platform overrides', () => {
    const recipe = Source.extract({ moduleId: 'card.ts', source }).calls[0]!
      .staticRecipe!
    const result = Variants.compile({ recipe, platform: 'ios' })

    expect(
      Object.keys(result.styles.default!.light).length,
    ).toMatchInlineSnapshot('9')
    expect(result.styles.default!.light['1']).toMatchInlineSnapshot(`
      {
        "fontSize": 20,
        "lineHeight": 30,
        "opacity": 0.7,
        "transform": [
          {
            "rotate": "90deg",
          },
        ],
      }
    `)
    expect(result.styles.default!.light['8']).toMatchInlineSnapshot(`
      {
        "fontSize": 10,
        "lineHeight": 15,
        "opacity": 0.2,
      }
    `)
    expect(result.styles.default!.light['4']).toMatchInlineSnapshot(`
      {
        "fontSize": 20,
        "lineHeight": 30,
        "opacity": 0.8,
      }
    `)
    expect(result.defaults).toMatchInlineSnapshot(`
      {
        "active": "false",
        "size": "small",
      }
    `)
    expect(
      result.styles.default!.light['1'] === result.styles.default!.dark['1'],
    ).toMatchInlineSnapshot('true')
    expect(
      Object.isFrozen(result.styles.default!.light['1']),
    ).toMatchInlineSnapshot('true')
    const android = Variants.compile({ recipe, platform: 'android' })
    expect(android.styles.default!.light['1']!.opacity).toMatchInlineSnapshot(
      '0.5',
    )
  })

  test('compiles themes and schemes without retaining caller-owned metadata', () => {
    const theme = Theme.define({
      color: { ink: { light: '#000', dark: '#fff' } },
    })
    const axes = { tone: ['quiet'] }
    const result = Variants.compile({
      recipe: {
        axes,
        defaults: { tone: 'quiet' },
        rules: [
          {
            matches: [],
            value: Style.define({ text: { color: theme.tokens.color.ink } }),
          },
        ],
      },
      themes: { brand: theme },
    })
    expect(result.styles.brand!.light['0']!.color).toMatchInlineSnapshot(
      '"#000"',
    )
    expect(result.styles.brand!.dark['0']!.color).toMatchInlineSnapshot(
      '"#fff"',
    )
    axes.tone.push('loud')
    expect(result.axes.tone).toMatchInlineSnapshot(`
      [
        "quiet",
      ]
    `)
    expect(
      result.styles.brand!.light['0'] === result.styles.brand!.light['1'],
    ).toMatchInlineSnapshot('true')
  })

  test('rejects selection growth before allocating tables', () => {
    const axes = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [
        `axis${index}`,
        { on: { opacity: 1 } },
      ]),
    )
    const recipe = Source.extract({
      moduleId: 'limit.ts',
      source: `import {variants} from 'zyzz';export const card=variants(${JSON.stringify({ variants: axes })});`,
    }).calls[0]!.staticRecipe!
    expect(() =>
      Variants.compile({ recipe }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Variants.CompileError: Native recipes support at most 256 selections, including null choices.]',
    )
  })

  test('rejects native conditions and undeclared selections', () => {
    const recipe = Source.extract({
      moduleId: 'invalid.ts',
      source: `import {variants} from 'zyzz';export const card=variants({variants:{tone:{quiet:{':hover':{opacity:0.5}}}}});`,
    }).calls[0]!.staticRecipe!
    expect(() =>
      Variants.compile({ recipe }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["style-1snulh75pd83z-48-0"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
    expect(() =>
      Variants.compile({
        recipe: { ...recipe, defaults: { tone: 'missing' } },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Variants.CompileError: Defaults must select a declared axis and choice.]',
    )
  })
})
