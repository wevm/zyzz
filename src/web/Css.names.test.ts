/** Verifies readable atomic output through literal and source compilation. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Graph, Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('names common declarations and keeps repeated values shared', () => {
    const output = Css.compile({
      styles: Style.define({
        card: { display: 'flex', padding: '8px', color: 'red' },
        label: { color: 'red' },
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-flex{display:flex;}
      .z-p-8px{padding:8px;}
      .z-text-red{color:red;}"
    `)
    expect(output.classes).toMatchInlineSnapshot(`
      {
        "card": "z-flex z-p-8px z-text-red",
        "label": "z-text-red",
      }
    `)
  })

  test('names conditions, fallback sequences, and complex values distinctly', () => {
    const output = Css.compile({
      styles: Style.define({
        card: {
          width: 'calc(100% - 8px)',
          display: ['block', 'grid!'],
          '&:hover': { color: 'blue' },
          '&:focus': { color: 'blue' },
        },
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-w-7vhs9r1q1acs1-0{width:calc(100% - 8px);}
      .z-display-7vhs9r1q1acs1-1{display:block;display:grid!important;}
      .z-hover-text-blue-7vhs9r1q1acs1-2{&:hover{color:blue;}}
      .z-focus-text-blue-7vhs9r1q1acs1-3{&:focus{color:blue;}}"
    `)
    expect(output.classes.card).toMatchInlineSnapshot(
      `"z-w-7vhs9r1q1acs1-0 z-display-7vhs9r1q1acs1-1 z-hover-text-blue-7vhs9r1q1acs1-2 z-focus-text-blue-7vhs9r1q1acs1-3"`,
    )
  })

  test('retains separate identities for repeated overrides', () => {
    const output = Css.compile({
      styles: Style.define({
        first: { padding: '8px' },
        middle: { paddingLeft: '2px' },
        last: { padding: '8px' },
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-p-8px-k5oaqnkf68sf-0{padding:8px;}
      .z-pl-2px-1k726nwi16l60-0{padding-left:2px;}
      .z-p-8px-xo0jyl1my8x7z-0{padding:8px;}"
    `)
    expect(output.classes).toMatchInlineSnapshot(`
      {
        "first": "z-p-8px-k5oaqnkf68sf-0",
        "last": "z-p-8px-xo0jyl1my8x7z-0",
        "middle": "z-pl-2px-1k726nwi16l60-0",
      }
    `)
  })

  test('scopes separately delivered source modules and theme references', () => {
    const source = `import {Config} from 'zyzz';const {css}=Config.create({theme:{color:{brand:'red'}}});export const card=css({display:'flex',color:'brand'});`
    const first = Transform.compile({ moduleId: 'first.ts', source })
    const second = Transform.compile({ moduleId: 'second.ts', source })

    expect(first.css).toMatchInlineSnapshot(`
      ".z_theme-1mlrxl41f5va70-css-theme{--z-t1mlrxl41f5va70-css-color_2e_brand:red;}
      .z-flex-1mlrxl41po2lli{display:flex;}
      .z-text-1mlrxl41po2lli{color:var(--z-t1mlrxl41f5va70-css-color_2e_brand,red);}"
    `)
    expect(second.css).toMatchInlineSnapshot(`
      ".z_theme-1d6eq581s6owy-css-theme{--z-t1d6eq581s6owy-css-color_2e_brand:red;}
      .z-flex-1d6eq581xglbmk{display:flex;}
      .z-text-1d6eq581xglbmk{color:var(--z-t1d6eq581s6owy-css-color_2e_brand,red);}"
    `)
    expect(first.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      const {css}=({theme:{"className":"z_theme-1mlrxl41f5va70-css-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"red"}}}>);export const card=__zyzzProps.create({className:"z-flex-1mlrxl41po2lli z-text-1mlrxl41po2lli z-style-1mlrxl41f5va70-103"});"
    `)
  })

  test('invalidates graph output when development naming changes', () => {
    const compiler = Graph.create()
    const modules = {
      'card.ts': `import {css} from 'zyzz';export const card=css({color:'red',padding:'8px'});`,
    }
    const production = compiler.compile({ modules })
    const development = compiler.compile({ development: true, modules })
    const edited = compiler.compile({
      development: true,
      modules: { 'card.ts': modules['card.ts'].replace('red', 'tan') },
    })

    expect(production.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-red-1slxe421lywm48{color:red;}
      .z-p-8px-1slxe421lywm48{padding:8px;}"
    `)
    expect(development.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-7xn0yx1uzcjev-0{color:red;}
      .z-p-7xn0yx1uzcjev-1{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-7xn0yx1uzcjev-0{color:tan;}
      .z-p-7xn0yx1uzcjev-1{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-1slxe42dbli7u-43": "z-text-7xn0yx1uzcjev-0 z-p-7xn0yx1uzcjev-1 z-style-1slxe42dbli7u-43",
      }
    `)
    expect(compiler.compile({ modules }).modules['card.ts']!.css)
      .toMatchInlineSnapshot(`
        ".z-text-red-1slxe421lywm48{color:red;}
        .z-p-8px-1slxe421lywm48{padding:8px;}"
      `)
  })
})
