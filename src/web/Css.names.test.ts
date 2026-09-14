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
      ".z-w-766AnZ-0{width:calc(100% - 8px);}
      .z-display-766AnZ-1{display:block;display:grid!important;}
      .z-hover-text-blue-766AnZ-2{&:hover{color:blue;}}
      .z-focus-text-blue-766AnZ-3{&:focus{color:blue;}}"
    `)
    expect(output.classes.card).toMatchInlineSnapshot(
      `"z-w-766AnZ-0 z-display-766AnZ-1 z-hover-text-blue-766AnZ-2 z-focus-text-blue-766AnZ-3"`,
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
      ".z-p-8px-iap1nQ-0{padding:8px;}
      .z-pl-2px-OEzlf4-0{padding-left:2px;}
      .z-p-8px-ulqx3t-0{padding:8px;}"
    `)
    expect(output.classes).toMatchInlineSnapshot(`
      {
        "first": "z-p-8px-iap1nQ-0",
        "last": "z-p-8px-ulqx3t-0",
        "middle": "z-pl-2px-OEzlf4-0",
      }
    `)
  })

  test('scopes separately delivered source modules and theme references', () => {
    const source = `import {Config} from 'zyzz';const {css}=Config.create({theme:{color:{brand:'red'}}});export const card=css({display:'flex',color:'brand'});`
    const first = Transform.compile({ moduleId: 'first.ts', source })
    const second = Transform.compile({ moduleId: 'second.ts', source })

    expect(first.css).toMatchInlineSnapshot(`
      ".z_theme-1mlrxl41f5va70-css-theme{--z-t1mlrxl41f5va70-css-color_2e_brand:red;}
      .z-flex-QPs-Od{display:flex;}
      .z-text-QPs-Od{color:var(--z-t1mlrxl41f5va70-css-color_2e_brand,red);}"
    `)
    expect(second.css).toMatchInlineSnapshot(`
      ".z_theme-1d6eq581s6owy-css-theme{--z-t1d6eq581s6owy-css-color_2e_brand:red;}
      .z-flex-IjSBTf{display:flex;}
      .z-text-IjSBTf{color:var(--z-t1d6eq581s6owy-css-color_2e_brand,red);}"
    `)
    expect(first.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      const {css}=({theme:{"className":"z_theme-1mlrxl41f5va70-css-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"red"}}}>);export const card=__zyzzProps.create({className:"z-flex-QPs-Od z-text-QPs-Od z-style-1mlrxl41f5va70-103"});"
    `)
  })

  test('rejects colliding contextual hashes even when declarations match', () => {
    // These distinct owners have the same six-character hash.
    const styles = Style.define({
      collisionpybsvm1mvm: { color: 'red' },
      middle: { color: 'blue' },
      collision1gqwj5h1wwv: { color: 'red' },
    })

    expect(() => Css.compile({ styles })).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["collision1gqwj5h1wwv"]: Distinct rules produced the same class identifier.]`,
    )
    expect(() =>
      Css.compile({ development: true, styles }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["collision1gqwj5h1wwv"]: Distinct rules produced the same class identifier.]`,
    )
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
      ".z-text-red-WdHWIJ{color:red;}
      .z-p-8px-WdHWIJ{padding:8px;}"
    `)
    expect(development.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-79yxGv-0{color:red;}
      .z-p-79yxGv-1{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-79yxGv-0{color:tan;}
      .z-p-79yxGv-1{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-1slxe42dbli7u-43": "z-text-79yxGv-0 z-p-79yxGv-1 z-style-1slxe42dbli7u-43",
      }
    `)
    expect(compiler.compile({ modules }).modules['card.ts']!.css)
      .toMatchInlineSnapshot(`
        ".z-text-red-WdHWIJ{color:red;}
        .z-p-8px-WdHWIJ{padding:8px;}"
      `)
  })
})
