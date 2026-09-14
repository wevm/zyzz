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
      ".z-w-jsBWEs-0{width:calc(100% - 8px);}
      .z-display-YqAHgU-1{display:block;display:grid!important;}
      .z-hover-text-blue-766AnZ-2{&:hover{color:blue;}}
      .z-focus-text-blue-766AnZ-3{&:focus{color:blue;}}"
    `)
    expect(output.classes.card).toMatchInlineSnapshot(
      `"z-w-jsBWEs-0 z-display-YqAHgU-1 z-hover-text-blue-766AnZ-2 z-focus-text-blue-766AnZ-3"`,
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
      .z-text-tMJTE1{color:var(--z-t1mlrxl41f5va70-css-color_2e_brand,red);}"
    `)
    expect(second.css).toMatchInlineSnapshot(`
      ".z_theme-1d6eq581s6owy-css-theme{--z-t1d6eq581s6owy-css-color_2e_brand:red;}
      .z-display-flex-IjSBTf{display:flex;}
      .z-text-KGSrFk{color:var(--z-t1d6eq581s6owy-css-color_2e_brand,red);}"
    `)
    expect(first.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      const {css}=({theme:{"className":"z_theme-1mlrxl41f5va70-css-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"red"}}}>);export const card=__zyzzProps.create({className:"z-display-flex-QPs-Od z-text-tMJTE1 z-style-1mlrxl41f5va70-103"});"
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
      .z-flex-rMlNfJ{flex:1 1 auto;}"
    `)
    expect(grid.css).toMatchInlineSnapshot(`
      ".z-display-grid-0Q-Ceb{display:grid;}
      .z-grid-zoCb3f{grid:auto / 1fr;}"
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

  test('separates standalone and cached module identities for colliding scope hashes', async () => {
    const first = 'app/mn11i9-ftt50l.ts'
    const second = 'app/150xkc2-se2k3x.ts'
    const source = `import { css } from 'zyzz'; export const card = css({ color: '#000' });`
    const a = Transform.compile({ moduleId: first, source })
    const b = Transform.compile({
      moduleId: second,
      source: source.replace('#000', '#fff'),
    })
    const compiler = Graph.create()
    compiler.compile({ modules: { [first]: source } })
    for (const compile of [Graph.compile, compiler.compile]) {
      const output = compile({
        modules: { [first]: source, [second]: source.replace('#000', '#fff') },
      })
      expect(output.modules[first]!.css === a.css).toMatchInlineSnapshot('true')
      expect(output.modules[second]!.css === b.css).toMatchInlineSnapshot(
        'true',
      )
    }
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${a.css}${b.css}</style><div class="${Object.values(a.classes)[0]}"></div><div class="${Object.values(b.classes)[0]}"></div>`,
      )
      expect(
        await page
          .locator('div')
          .evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).color),
          ),
      ).toMatchInlineSnapshot(`
        [
          "rgb(0, 0, 0)",
          "rgb(255, 255, 255)",
        ]
      `)
    } finally {
      await browser.close()
    }
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
      ".z-text-td32HT-0{color:red;}
      .z-p-td32HT-0{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.css).toMatchInlineSnapshot(`
      ".z-text-td32HT-0{color:tan;}
      .z-p-td32HT-0{padding:8px;}"
    `)
    expect(edited.modules['card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-1slxe42dbli7u-43": "z-text-td32HT-0 z-p-td32HT-0 z-style-1slxe42dbli7u-43",
      }
    `)
    expect(compiler.compile({ modules }).modules['card.ts']!.css)
      .toMatchInlineSnapshot(`
        ".z-text-red-WdHWIJ{color:red;}
        .z-p-8px-WdHWIJ{padding:8px;}"
      `)
  })

  test('keeps custom property and value boundaries distinct', async () => {
    const output = Css.compile({
      styles: Style.define({ a: { '--a': 'b-c' }, b: { '--a-b': 'c' } }),
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div class="${output.classes.a} ${output.classes.b}"></div>`,
      )
      expect(
        await page
          .locator('div')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--a'),
          ),
      ).toMatchInlineSnapshot('"b-c"')
      expect(
        await page
          .locator('div')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--a-b'),
          ),
      ).toMatchInlineSnapshot('"c"')
    } finally {
      await browser.close()
    }
  })

  test('keeps mounted later styles after development source offsets change', async () => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped'] as const)
        for (const composition of ['ordered', 'independent'] as const)
          for (const compiler of [false, true]) {
            const source = `import {css} from 'zyzz'; export const a=css({color:'red',padding:'8px'},{id:'first'}); export const b=css({color:'blue',padding:'4px'},{id:'second'})`
            const options = {
              compiler,
              composition,
              cssOutput,
              development: true,
              moduleId: 'styles.ts',
            }
            const before = Transform.compile({ ...options, source })
            const after = Transform.compile({
              ...options,
              source: source.replace("'red'", "'purple'"),
            })
            await page.setContent(
              `<style>${before.css}</style><div class="${Object.values(before.classes)[1]}"></div>`,
            )
            await page.locator('style').evaluate((element, css) => {
              element.textContent = css
            }, after.css)
            expect(
              await page
                .locator('div')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
            expect(
              await page
                .locator('div')
                .evaluate((element) => getComputedStyle(element).paddingLeft),
            ).toMatchInlineSnapshot('"4px"')
          }
    } finally {
      await browser.close()
    }
  })

  test('ignores inherited output metadata while emitting authored declarations', () => {
    const original = Style.define({ card: { color: 'red', padding: '8px' } })
      .styles[0]!
    const inherited = Object.assign(
      Object.create({ cssOutput: 'invalid' }),
      original,
    )
    const output = Css.compile({ styles: { styles: [inherited] } })
    expect(output.css.includes('color:red;padding:8px;')).toMatchInlineSnapshot(
      'false',
    )
    expect(output.css.split('\n').length).toMatchInlineSnapshot('2')
  })

  test('retains empty selector identities in both output modes', async () => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped'] as const) {
        const output = Transform.compile({
          cssOutput,
          moduleId: 'references.ts',
          source:
            "import {css} from 'zyzz';export const parent=css();export const child=css({selectors:{[`${parent} &`]:{color:'blue'}}})",
        })
        const [parent, child] = Object.values(output.classes)
        await page.setContent(
          `<style>${output.css}</style><section class="${parent}"><div class="${child}"></div></section><div class="${child}"></div>`,
        )
        expect(
          await page
            .locator('section div')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
        expect(
          await page
            .locator('body > div')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(0, 0, 0)"')
      }
    } finally {
      await browser.close()
    }
  })
  test('checks packed atomic ownership before compiling colliding source scopes', () => {
    const source =
      "import {css} from 'zyzz';export const card=css({color:'red'})"
    const library = Graph.compile({
      modules: { 'app/mn11i9-ftt50l.ts': source },
    })
    expect(() =>
      Graph.compile({
        contracts: { 'library.js': library.contracts['app/mn11i9-ftt50l.ts']! },
        modules: { 'app/150xkc2-se2k3x.ts': source },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["app/150xkc2-se2k3x.ts"]: Atomic class z-text-red-QDY4MN is also owned by module library.js.]`,
    )
  })
})
