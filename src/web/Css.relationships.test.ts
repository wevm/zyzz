/** Exercises css definition identity, where relationship selectors, and packed style contracts. @module */
import * as Packed from '../../test/fixtures/Packed.js'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

const imports = `import {css} from 'zyzz';import {where} from 'zyzz/web';`

describe('where', () => {
  function compile(key: string, declarations = '') {
    const result = Graph.compile({
      modules: {
        'flat.ts': `${imports}
const card=css({padding:16});const toggle=css({});${declarations}
export const style=css({[${key}]:{color:'red'}});`,
      },
    })

    return result.modules['flat.ts']!.css.split('\n')
      .at(-1)!
      .replace(/^\.z-style-[a-z0-9-]+\{|\{color:red;\}\}$/g, '')
  }

  test('lowers definition compounds inside :where() through every combinator', () => {
    expect(compile('where`${card}:hover &`')).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68:hover) &"`,
    )
    expect(compile('where`${card} > &`')).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68) > &"`,
    )
    expect(compile('where`&:has(${toggle}:checked)`')).toMatchInlineSnapshot(
      `"&:has(:where(.z-style-3a68y9giv64x-99:checked))"`,
    )
    expect(compile('where`${toggle}:checked ~ &`')).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-99:checked) ~ &"`,
    )
    expect(compile('where`&:has(~ ${toggle}:checked)`')).toMatchInlineSnapshot(
      `"&:has(~ :where(.z-style-3a68y9giv64x-99:checked))"`,
    )
    expect(
      compile('where`${toggle} ~ &, &:has(~ ${toggle})`'),
    ).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-99) ~ &, &:has(~ :where(.z-style-3a68y9giv64x-99))"`,
    )
    expect(
      compile('where`:root:has(${card}[aria-expanded="true"]) &`'),
    ).toMatchInlineSnapshot(
      `":root:has(:where(.z-style-3a68y9giv64x-68[aria-expanded="true"])) &"`,
    )
    expect(
      compile('where`${card}:has(${toggle}:checked) &`'),
    ).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68:has(:where(.z-style-3a68y9giv64x-99:checked))) &"`,
    )
    expect(compile('where`:has(${toggle})`')).toMatchInlineSnapshot(
      `"&:has(:where(.z-style-3a68y9giv64x-99))"`,
    )
    expect(compile('where`${card}${toggle} &`')).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68.z-style-3a68y9giv64x-99) &"`,
    )
  })

  test('keeps presence while negating attribute state', () => {
    expect(
      compile('where`${card}:not([aria-expanded="true"]) &`'),
    ).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68:not([aria-expanded="true"])) &"`,
    )
    expect(compile('where`:not(${card}) &`')).toMatchInlineSnapshot(
      `":not(:where(.z-style-3a68y9giv64x-68)) &"`,
    )
  })

  test('moves only the subject ampersand outside the wrapper', () => {
    expect(compile('where`&${card}`')).toMatchInlineSnapshot(
      `"&:where(.z-style-3a68y9giv64x-68)"`,
    )
    expect(compile('where`&${card}:has(+ &.active)`')).toMatchInlineSnapshot(
      `"&:where(.z-style-3a68y9giv64x-68:has(+ &.active))"`,
    )
  })

  test('keeps pseudo-elements outside the wrapper', () => {
    expect(compile('where`&${card}::before`')).toMatchInlineSnapshot(
      `"&:where(.z-style-3a68y9giv64x-68)::before"`,
    )
    expect(compile('where`&${card}:hover:after`')).toMatchInlineSnapshot(
      `"&:where(.z-style-3a68y9giv64x-68:hover):after"`,
    )
  })

  test('honors escaped separators when splitting compounds', () => {
    expect(compile('where`${card}.foo\\\\+bar > &`')).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68.foo\\+bar) > &"`,
    )
  })

  test('keeps quoted, commented, and bracketed text out of compound boundaries', () => {
    expect(
      compile('where`${card}:has(a[href*="& )"]) /* ~ & */ > &`'),
    ).toMatchInlineSnapshot(
      `":where(.z-style-3a68y9giv64x-68:has(a[href*="& )"])) /* ~ & */ > &"`,
    )
  })

  test('resolves namespace members, object members, and later declarations', () => {
    expect(
      compile(
        'where`${styles.item} > &`',
        "export namespace styles { export const item = css({color:'red'}) }",
      ),
    ).toMatchInlineSnapshot(`":where(.z-style-3a68y9giv64x-153) > &"`)
    expect(
      compile(
        'where`${group.hint} ~ &`',
        'const group = { hint: css({margin:0}) };export { group };',
      ),
    ).toMatchInlineSnapshot(`":where(.z-style-3a68y9giv64x-129) ~ &"`)

    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}export const label=css({[where\`\${card} &\`]:{opacity:1}});const card=css({});export const attrs=card();`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-75{:where(.z-style-1e8a67z1uaws1j-124) &{opacity:1;}}"`,
    )
  })

  test('combines nested relationship keys with native nesting', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=css({});const toggle=css({});
export const style=css({[where\`\${card} &\`]:{[where\`\${toggle}:checked ~ &\`]:{color:'red'}},':hover':{[where\`\${card} &\`]:{opacity:1}}});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-116{:where(.z-style-1e8a67z1uaws1j-67) &{:where(.z-style-1e8a67z1uaws1j-88:checked) ~ &{color:red;}}&:hover{:where(.z-style-1e8a67z1uaws1j-67) &{opacity:1;}}}"`,
    )
  })

  test('rejects selectors browsers drop, never match, or cannot scope', () => {
    expect(() =>
      compile('where`${card}:hover`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: where selectors require & for the styled element.]`,
    )
    expect(() =>
      compile('where`${card}:hovr &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Unknown pseudo-class :hovr.]`,
    )
    expect(() =>
      compile('where`&:has(${card}:has(a))`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: CSS forbids nested :has().]`,
    )
    expect(() =>
      compile('where`&:has(${card}:visited)`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: :visited never matches inside :has().]`,
    )
    expect(() =>
      compile('where`${card} & {`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Unexpected end of input]`,
    )
    expect(() =>
      compile('where`${card} &, b`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Selector lists require explicit & selectors.]`,
    )
  })

  test('rejects interpolations that are not module-level css definitions', () => {
    expect(() =>
      compile('where`${".card"} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:141: Relationship selectors interpolate module-level css definitions.]`,
    )
    expect(() =>
      compile('where`${card()} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:141: Relationship selectors interpolate module-level css definitions.]`,
    )
    expect(() =>
      compile('where`${unknown} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:141: Relationship selectors interpolate module-level css definitions.]`,
    )
    expect(() =>
      compile('where`${other} &`', 'const other=Math.max(1);'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:157: Relationship selectors interpolate compiled css definitions.]`,
    )
    expect(() =>
      compile('where`${later} &`', 'let later=css({});'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:159: Relationship selectors interpolate module-level css definitions.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `${imports}const card=css({});export function make(card:unknown){return css({[where\`\${card} &\`]:{opacity:1}})}`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:131: Relationship selectors interpolate module-level css definitions.]`,
    )
    expect(() =>
      compile('where`[title="${card}"] &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Definition interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
    expect(() =>
      compile('where`[${card}] &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Definition interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
    expect(() =>
      compile('where`/* ${card} */ &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Definition interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
  })

  test('requires a direct computed key without type arguments', () => {
    expect(() =>
      compile('where`${toggle} &`.toString()'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Relationship selectors must be computed style keys.]`,
    )
    expect(() =>
      compile('where<never>`${card} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:133: Relationship selectors do not accept type arguments.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `${imports}const card=css({});const tag=where;export const key=tag\`\${card} &\`;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:85: Relationship selectors require direct where templates.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `import * as Web from 'zyzz/web';import {css} from 'zyzz';const card=css({});export const style=css({[Web.where\`\${card} &\`]:{opacity:1}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:101: Relationship helpers require direct named imports from zyzz/web.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `${imports}const card=css({});const unused={[where\`\${card} &\`]:{color:'red'}};export {unused};`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:90: Relationship keys require a compiled style definition.]`,
    )
  })

  test('removes direct and aliased where imports from unbundled output', () => {
    const results = [false, true].map((aliased) => {
      const binding = aliased ? 'whereAlias' : 'where'
      const result = Graph.compile({
        modules: {
          'app.js': `import {css} from 'zyzz';import {${aliased ? `where as ${binding}` : 'where'},Css} from 'zyzz/web';const card=css({});export const style=css({[${binding}\`\${card} &\`]:{color:'red'}});export const compile=Css.compile;`,
        },
      })
      return result.modules['app.js']!.code.match(
        /import[^;]+from ['"]zyzz\/web['"];?/g,
      )
    })
    expect(results).toMatchInlineSnapshot(`
      [
        [
          "import {Css} from 'zyzz/web';",
        ],
        [
          "import {Css} from 'zyzz/web';",
        ],
      ]
    `)
  })
})

describe('identity', () => {
  test('emits one class per definition even when declarations are shared or absent', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {css} from 'zyzz';export const a=css({padding:16});export const b=css({padding:16});export const marker=css({});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-1e8a67z1uaws1j-base0{padding:16;}"`,
    )
    expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      export const a=__zyzzProps.create({className:"z-1e8a67z1uaws1j-base0 z-style-1e8a67z1uaws1j-40"});export const b=__zyzzProps.create({className:"z-1e8a67z1uaws1j-base0 z-style-1e8a67z1uaws1j-73"});export const marker=__zyzzProps.create({className:"z-style-1e8a67z1uaws1j-111"});"
    `)
  })
})

describe('packed', () => {
  const library = `import {css} from 'zyzz';export const card=css({padding:16});export namespace styles { export const item = css({color:'red'}) }export const marker=css({});export const other=Math.max(1);`

  test('exports compiled definitions as style identities', () => {
    const result = Graph.compile({ modules: { 'lib.ts': library } })
    const contract = JSON.parse(result.contracts['lib.ts']!)

    expect(contract.version).toMatchInlineSnapshot(`13`)
    expect(contract.exports).toMatchInlineSnapshot(`
      {
        "card": {
          "binding": "style-1jnw2gv1nkhfi5-43",
          "kind": "style",
          "name": "style-1jnw2gv1nkhfi5-43",
        },
        "marker": {
          "binding": "style-1jnw2gv1nkhfi5-147",
          "kind": "style",
          "name": "style-1jnw2gv1nkhfi5-147",
        },
        "styles": {
          "binding": "1jnw2gv1nkhfi5-styles",
          "kind": "style",
          "members": {
            "item": {
              "binding": "style-1jnw2gv1nkhfi5-107",
              "kind": "style",
              "name": "style-1jnw2gv1nkhfi5-107",
            },
          },
        },
      }
    `)
    expect(result.modules['lib.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      export const card=__zyzzProps.create({className:"z-1jnw2gv1nkhfi5-base1 z-style-1jnw2gv1nkhfi5-43"});export namespace styles { export const item = __zyzzProps.create({className:"z-1jnw2gv1nkhfi5-base0 z-style-1jnw2gv1nkhfi5-107"}) }export const marker=__zyzzProps.create({className:"z-style-1jnw2gv1nkhfi5-147"});export const other=Math.max(1);"
    `)
  })

  test('interpolates imported definitions and namespace members', () => {
    const lib = Graph.compile({ modules: { 'lib.ts': library } })
    const app = Graph.compile({
      contracts: { 'lib/index.js': lib.contracts['lib.ts']! },
      imports: {
        'app.ts': { lib: 'lib/index.js', zyzz: null, 'zyzz/web': null },
      },
      modules: {
        'app.ts': `import {card, styles, marker} from 'lib';${imports}export const label=css({[where\`\${card}:hover &\`]:{opacity:1},[where\`\${styles.item} &\`]:{opacity:0.5},[where\`\${marker} > &\`]:{opacity:0.2}});export const apply=card();`,
      },
    })

    expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-116{:where(.z-style-1jnw2gv1nkhfi5-43:hover) &{opacity:1;}:where(.z-style-1jnw2gv1nkhfi5-107) &{opacity:0.5;}:where(.z-style-1jnw2gv1nkhfi5-147) > &{opacity:0.2;}}"`,
    )
    expect(app.modules['app.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      import {card, styles, marker} from 'lib';export const label=__zyzzProps.create({className:"z-style-1e8a67z1uaws1j-116"});export const apply=card();"
    `)
  })

  test('rejects malformed style identities', () => {
    const lib = Graph.compile({ modules: { 'lib.ts': library } })
    const malformed = JSON.parse(lib.contracts['lib.ts']!)

    malformed.exports.card.name = 'z-other'

    expect(() =>
      Graph.compile({
        contracts: { 'lib/index.js': JSON.stringify(malformed) },
        imports: {
          'app.ts': { lib: 'lib/index.js', zyzz: null, 'zyzz/web': null },
        },
        modules: {
          'app.ts': `import {card} from 'lib';${imports}export const style=css({[where\`\${card} &\`]:{color:'red'}});`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: lib/index.js:0: Invalid library contract: Invalid style identity.]`,
    )
  })

  const app = `import {css} from 'zyzz';import {where as w} from 'zyzz/web';import {card} from 'library';export {card};export namespace styles {
  export const ancestor = css({[w\`\${card}[aria-expanded="true"] &\`]:{color:'red'}})

  export const parent = css({[w\`\${card} > &\`]:{color:'rgb(1, 2, 3)'}})

  export const descendant = css({[w\`&:has(\${card})\`]:{color:'blue'}})

  export const before = css({[w\`\${card} ~ &\`]:{color:'green'}})

  export const after = css({[w\`&:has(~ \${card})\`]:{color:'purple'}})

  export const either = css({[w\`\${card} ~ &, &:has(~ \${card})\`]:{color:'orange'}})

  export const nested = css({[w\`\${card} &\`]:{[w\`&:has(\${card})\`]:{color:'rgb(4, 5, 6)'}}})
}`

  async function bundle() {
    const lib = Graph.compile({
      modules: {
        'marker.ts': `import {css} from 'zyzz';export const card=css({padding:16});`,
        'index.ts': `export {card} from './marker.js';`,
      },
    })

    const output = Graph.compile({
      contracts: { 'library/index.js': lib.contracts['index.ts']! },
      imports: {
        'app.ts': { library: 'library/index.js', zyzz: null, 'zyzz/web': null },
      },
      modules: { 'app.ts': app },
    })

    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': output.modules['app.ts']!.code },
      packages: {
        library: Object.fromEntries(
          Object.entries(lib.modules).map(([name, module]) => [
            name,
            module.code,
          ]),
        ),
      },
    })

    return {
      code,
      css: `${lib.modules['marker.ts']!.css}\n${output.modules['app.ts']!.css}`,
    }
  }

  test('links packed identities through re-exports', async () => {
    const { code, css } = await bundle()
    const fixture = Vm.runInNewContext(`${code};Fixture;`) as {
      card: () => { className: string }
    }

    expect(fixture.card()).toMatchInlineSnapshot(`
      {
        "className": "z-1dwt1t61ri6uf4-base0 z-style-1dwt1t61ri6uf4-43",
      }
    `)
    expect(css).toMatchInlineSnapshot(`
      ".z-1dwt1t61ri6uf4-base0{padding:16;}
      .z-style-1e8a67z1uaws1j-156{:where(.z-style-1dwt1t61ri6uf4-43[aria-expanded="true"]) &{color:red;}}
      .z-style-1e8a67z1uaws1j-239{:where(.z-style-1dwt1t61ri6uf4-43) > &{color:rgb(1, 2, 3);}}
      .z-style-1e8a67z1uaws1j-315{&:has(:where(.z-style-1dwt1t61ri6uf4-43)){color:blue;}}
      .z-style-1e8a67z1uaws1j-382{:where(.z-style-1dwt1t61ri6uf4-43) ~ &{color:green;}}
      .z-style-1e8a67z1uaws1j-446{&:has(~ :where(.z-style-1dwt1t61ri6uf4-43)){color:purple;}}
      .z-style-1e8a67z1uaws1j-517{:where(.z-style-1dwt1t61ri6uf4-43) ~ &, &:has(~ :where(.z-style-1dwt1t61ri6uf4-43)){color:orange;}}
      .z-style-1e8a67z1uaws1j-601{:where(.z-style-1dwt1t61ri6uf4-43) &{&:has(:where(.z-style-1dwt1t61ri6uf4-43)){color:rgb(4, 5, 6);}}}"
    `)
  })

  test('observes ancestor, parent, descendant, sibling, and nested relationships in Chromium', async () => {
    const { code, css } = await bundle()
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${css}</style><main id="root" aria-expanded="true"><span id="ancestor"></span><div><i id="deep"></i></div><div id="nested"><i id="inner"></i></div></main><div id="descendant"><input id="child"></div><div><i id="earlier"></i><b id="before"></b></div><div><b id="after"></b><i id="later"></i></div><div><i id="peer"></i><b id="either"></b></div>`,
      )
      await page.addScriptTag({ content: code })
      await page.evaluate(
        `for(const id of ['root','child','earlier','later','peer','inner'])document.getElementById(id).className=Fixture.card().className;for(const id of ['ancestor','descendant','before','after','either','nested'])document.getElementById(id).className=Fixture.styles[id]().className;for(const id of ['ancestor','deep'])document.getElementById(id).className+=' '+Fixture.styles.parent().className`,
      )

      const color = (id: string) =>
        page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).color)

      expect(
        await color('ancestor'),
        'parent wins over ancestor',
      ).toMatchInlineSnapshot(`"rgb(1, 2, 3)"`)
      expect(
        await color('deep'),
        'deep child is not a parent match',
      ).toMatchInlineSnapshot(`"rgb(0, 0, 0)"`)
      expect(await color('descendant'), 'descendant').toMatchInlineSnapshot(
        `"rgb(0, 0, 255)"`,
      )
      expect(await color('before'), 'before').toMatchInlineSnapshot(
        `"rgb(0, 128, 0)"`,
      )
      expect(await color('after'), 'after').toMatchInlineSnapshot(
        `"rgb(128, 0, 128)"`,
      )
      expect(await color('either'), 'either').toMatchInlineSnapshot(
        `"rgb(255, 165, 0)"`,
      )
      expect(await color('nested'), 'nested').toMatchInlineSnapshot(
        `"rgb(4, 5, 6)"`,
      )

      await page
        .locator('#root')
        .evaluate((el) => el.setAttribute('aria-expanded', 'false'))
      await page.locator('#earlier').evaluate((el) => el.remove())

      expect(await color('ancestor'), 'state left').toMatchInlineSnapshot(
        `"rgb(1, 2, 3)"`,
      )
      expect(await color('before'), 'sibling left').toMatchInlineSnapshot(
        `"rgb(0, 0, 0)"`,
      )
    } finally {
      await browser.close()
    }
  })
})
