/** Verifies readable atomic output through literal and source compilation. @module */
import { describe, expect, test } from 'vite-plus/test'
import { chromium } from 'playwright'
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
      ".z-display-flex{display:flex;}
      .z-p-8px{padding:8px;}
      .z-text-red{color:red;}"
    `)
    expect(output.classes).toMatchInlineSnapshot(`
      {
        "card": "z-display-flex z-p-8px z-text-red",
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
      .z-display-flex-QPs-Od{display:flex;}
      .z-text-QPs-Od{color:var(--z-t1mlrxl41f5va70-css-color_2e_brand,red);}"
    `)
    expect(second.css).toMatchInlineSnapshot(`
      ".z_theme-1d6eq581s6owy-css-theme{--z-t1d6eq581s6owy-css-color_2e_brand:red;}
      .z-display-flex-IjSBTf{display:flex;}
      .z-text-IjSBTf{color:var(--z-t1d6eq581s6owy-css-color_2e_brand,red);}"
    `)
    expect(first.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      const {css}=({theme:{"className":"z_theme-1mlrxl41f5va70-css-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"red"}}}>);export const card=__zyzzProps.create({className:"z-display-flex-QPs-Od z-text-QPs-Od z-style-1mlrxl41f5va70-103"});"
    `)
  })

  test('distinguishes display values from flex and grid shorthands in the browser', async () => {
    const flex = Transform.compile({
      moduleId: 'flex.ts',
      source: `import { css } from 'zyzz';
export const flex = css({ display: 'flex', flex: '1 1 auto' })();`,
    })
    const grid = Transform.compile({
      moduleId: 'grid.ts',
      source: `import { css } from 'zyzz';
export const grid = css({ display: 'grid', grid: 'auto / 1fr' })();`,
    })

    expect(flex.css).toMatchInlineSnapshot(`
      ".z-display-flex-sQK2Wn{display:flex;}
      .z-flex-sQK2Wn{flex:1 1 auto;}"
    `)
    expect(grid.css).toMatchInlineSnapshot(`
      ".z-display-grid-0Q-Ceb{display:grid;}
      .z-grid-0Q-Ceb{grid:auto / 1fr;}"
    `)

    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const classes = [
        ...Object.values(flex.classes),
        ...Object.values(grid.classes),
      ]
      await page.setContent(
        `<style>${flex.css}${grid.css}</style><div class="${classes[0]}"></div><div class="${classes[1]}"></div>`,
      )

      expect(
        await page
          .locator('div')
          .nth(0)
          .evaluate((element) => getComputedStyle(element).display),
      ).toMatchInlineSnapshot('"flex"')
      expect(
        await page
          .locator('div')
          .nth(0)
          .evaluate((element) => getComputedStyle(element).flex),
      ).toMatchInlineSnapshot('"1 1 auto"')
      expect(
        await page
          .locator('div')
          .nth(1)
          .evaluate((element) => getComputedStyle(element).display),
      ).toMatchInlineSnapshot('"grid"')
      expect(
        await page
          .locator('div')
          .nth(1)
          .evaluate((element) => getComputedStyle(element).gridAutoFlow),
      ).toMatchInlineSnapshot('"row"')
    } finally {
      await browser.close()
    }
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

  test('rejects ownership collisions across fresh and cached modules', () => {
    const first = 'app/mn11i9-ftt50l.ts'
    const second = 'app/150xkc2-se2k3x.ts'
    const source = `import { css } from 'zyzz'; export const card = css({ color: '#000' });`
    const compiler = Graph.create()
    compiler.compile({ modules: { [first]: source, [second]: 'export {}' } })

    for (const compile of [Graph.compile, compiler.compile])
      for (const color of ['#fff', '#000'])
        expect(() =>
          compile({
            modules: {
              [first]: source,
              [second]: source.replace('#000', color),
            },
          }),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Css.CompileError: ["app/mn11i9-ftt50l.ts"]: Atomic class z-text-QDY4MN is also owned by module app/150xkc2-se2k3x.ts.]`,
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
