/** Exercises packed marker identity, runtime state attributes, and where relationship selectors. @module */
import * as Esbuild from 'esbuild'
import * as Packed from '../../test/fixtures/Packed.js'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import { Marker } from 'zyzz/runtime'

const imports = `import {css} from 'zyzz';import {ref,where} from 'zyzz/web';`

describe('where', () => {
  function compile(key: string, declarations = '') {
    const result = Graph.compile({
      modules: {
        'flat.ts': `${imports}
const card=ref({state:['open','closed'],selected:[true,false],data:['loaded']});const choice=ref();${declarations}
export const style=css({[${key}]:{color:'red'}});`,
      },
    })

    return result.modules['flat.ts']!.css.replace(
      /^\.z-style-[a-z0-9-]+\{|\{color:red;\}\}$/g,
      '',
    )
  }

  test('lowers ref compounds inside :where() through every combinator', () => {
    expect(
      compile(
        'where`${card({state:"open",selected:false,data:"loaded"})}:hover &`',
      ),
    ).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-card-63-61-72-64-state="open"][data-z-3a68y9giv64x-card-63-61-72-64-selected="false"][data-z-3a68y9giv64x-card-63-61-72-64-data="loaded"]:hover) &"`,
    )
    expect(compile('where`${card} > &`')).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64]) > &"`,
    )
    expect(compile('where`&:has(${card}:checked)`')).toMatchInlineSnapshot(
      `"&:has(:where([data-z-3a68y9giv64x-card-63-61-72-64]:checked))"`,
    )
    expect(compile('where`${card}:checked ~ &`')).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64]:checked) ~ &"`,
    )
    expect(compile('where`&:has(~ ${card}:checked)`')).toMatchInlineSnapshot(
      `"&:has(~ :where([data-z-3a68y9giv64x-card-63-61-72-64]:checked))"`,
    )
    expect(
      compile('where`${card} ~ &, &:has(~ ${card})`'),
    ).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64]) ~ &, &:has(~ :where([data-z-3a68y9giv64x-card-63-61-72-64]))"`,
    )
    expect(
      compile('where`:root:has(${card({state:"open"})}) &`'),
    ).toMatchInlineSnapshot(
      `":root:has(:where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-card-63-61-72-64-state="open"])) &"`,
    )
    expect(
      compile('where`${card}:has(${choice}:checked) &`'),
    ).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64]:has(:where([data-z-3a68y9giv64x-choice-63-68-6f-69-63-65]:checked))) &"`,
    )
    expect(compile('where`:has(${choice})`')).toMatchInlineSnapshot(
      `"&:has(:where([data-z-3a68y9giv64x-choice-63-68-6f-69-63-65]))"`,
    )
    expect(compile('where`${card}${choice} &`')).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-choice-63-68-6f-69-63-65]) &"`,
    )
  })

  test('keeps presence while negating a state', () => {
    expect(
      compile('where`${card}:not(${card({state:"open"})}) &`'),
    ).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64]:not(:where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-card-63-61-72-64-state="open"]))) &"`,
    )
    expect(compile('where`:not(${card}) &`')).toMatchInlineSnapshot(
      `":not(:where([data-z-3a68y9giv64x-card-63-61-72-64])) &"`,
    )
  })

  test('moves only the subject ampersand outside the wrapper', () => {
    expect(compile('where`&${card({state:"closed"})}`')).toMatchInlineSnapshot(
      `"&:where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-card-63-61-72-64-state="closed"])"`,
    )
    expect(compile('where`&${card}:has(+ &.active)`')).toMatchInlineSnapshot(
      `"&:where([data-z-3a68y9giv64x-card-63-61-72-64]:has(+ &.active))"`,
    )
  })

  test('keeps pseudo-elements outside the wrapper', () => {
    expect(compile('where`&${card}::before`')).toMatchInlineSnapshot(
      `"&:where([data-z-3a68y9giv64x-card-63-61-72-64])::before"`,
    )
    expect(compile('where`&${card}:hover:after`')).toMatchInlineSnapshot(
      `"&:where([data-z-3a68y9giv64x-card-63-61-72-64]:hover):after"`,
    )
  })

  test('honors escaped separators when splitting compounds', () => {
    expect(compile('where`${card}.foo\\\\+bar > &`')).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64].foo\\+bar) > &"`,
    )
  })

  test('interpolates statically bound ref applications', () => {
    expect(
      compile('where`${open}:hover &`', "const open=card({state:'open'});"),
    ).toMatchInlineSnapshot(
      `":where([data-z-3a68y9giv64x-card-63-61-72-64][data-z-3a68y9giv64x-card-63-61-72-64-state="open"]:hover) &"`,
    )
    expect(() =>
      compile(
        'where`${open} &`',
        "const open=card({state:Math.random()>0.5?'open':'closed'});",
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:253: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
    expect(() =>
      compile('where`${open} &`', "let open=card({state:'open'});"),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:224: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
  })

  test('keeps quoted, commented, and bracketed text out of compound boundaries', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=ref();export const style=css({[where\`\${card}:has(a[href*="& )"]) /* ~ & */ > &\`]:{color:'red'}});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-96{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64]:has(a[href*="& )"])) /* ~ & */ > &{color:red;}}"`,
    )
  })

  test('combines nested relationship keys with native nesting', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=ref({state:['open']});const choice=ref();
export const style=css({[where\`\${card({state:'open'})} &\`]:{[where\`\${choice}:checked ~ &\`]:{color:'red'}},':hover':{[where\`\${card} &\`]:{opacity:1}}});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-132{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64][data-z-1e8a67z1uaws1j-card-63-61-72-64-state="open"]) &{:where([data-z-1e8a67z1uaws1j-choice-63-68-6f-69-63-65]:checked) ~ &{color:red;}}&:hover{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64]) &{opacity:1;}}}"`,
    )
  })

  test('rejects selectors browsers drop, never match, or cannot scope', () => {
    expect(() =>
      compile('where`${card}:hover`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: where selectors require & for the styled element.]`,
    )
    expect(() =>
      compile('where`${card}:hovr &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Unknown pseudo-class :hovr.]`,
    )
    expect(() =>
      compile('where`&:has(${card}:has(a))`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: CSS forbids nested :has().]`,
    )
    expect(() =>
      compile('where`&:has(${card}:visited)`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: :visited never matches inside :has().]`,
    )
    expect(() =>
      compile('where`${card} & {`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Unexpected end of input]`,
    )
    expect(() =>
      compile('where`${card} &, b`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Selector lists require explicit & selectors.]`,
    )
  })

  test('rejects interpolations that are not refs or leave selector data', () => {
    expect(() =>
      compile('where`${"[x]"} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:194: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
    expect(() =>
      compile('where`${card({state:"nope"})} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Invalid marker state: state]`,
    )
    expect(() =>
      compile('where`${card({data:{state:"open"}})} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Invalid marker state: data]`,
    )
    expect(() =>
      compile('where`${card({state:"open"},1)} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:194: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
    expect(() =>
      compile('where`${card?.()} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:194: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
    expect(() =>
      compile('where`[title="${card}"] &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Ref interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
    expect(() =>
      compile('where`[${card}] &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Ref interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
    expect(() =>
      compile('where`/* ${card} */ &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Ref interpolations cannot appear inside quoted, bracketed, or comment text.]`,
    )
  })

  test('requires a direct computed key without type arguments', () => {
    expect(() =>
      compile('where`${choice} &`.toString()'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Relationship selectors must be computed style keys.]`,
    )
    expect(() =>
      compile('where<never>`${card} &`'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: flat.ts:186: Relationship selectors do not accept type arguments.]`,
    )
  })

  test('requires refs declared before the selector', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `${imports}export const style=css({[where\`\${card} &\`]:{color:'red'}});const card=ref();`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:93: Relationship selectors interpolate previously declared refs or ref applications.]`,
    )
  })
})

describe('ref', () => {
  test('allows former predicate option names and rejects nested state wrappers', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=ref({pseudo:['open'],has:['a']});export const style=css({[where\`\${card({pseudo:'open',has:'a'})} &\`]:{color:'red'}});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-123{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64][data-z-1e8a67z1uaws1j-card-63-61-72-64-pseudo="open"][data-z-1e8a67z1uaws1j-card-63-61-72-64-has="a"]) &{color:red;}}"`,
    )

    for (const schema of ["{class:['open']}", "{Style:['open']}"])
      expect(() =>
        Source.extract({
          moduleId: 'reserved.ts',
          source: `import {ref} from 'zyzz/web';const card=ref(${schema});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: reserved.ts:40: Marker state names must be distinct data-name fragments without reserved keys.]`,
      )
  })

  test('resolves renamed direct helpers without capturing shadowed functions', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {css} from 'zyzz';
import {ref as identify, where as inside} from 'zyzz/web';
const card=identify({state:['open','closed']});
export const label=css({[inside\`\${card({state:'open'})} &\`]:{color:'blue'}});
export function unrelated(identify:()=>string){return identify()}
type Handle=import('zyzz/web').ref.ReturnType;
export const attrs=card({state:'open'});`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-152{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64][data-z-1e8a67z1uaws1j-card-63-61-72-64-state="open"]) &{color:blue;}}"`,
    )
    expect(
      result.modules['app.ts']!.code.includes('return identify()'),
    ).toMatchInlineSnapshot('true')
    expect(
      result.modules['app.ts']!.code.includes(
        "import('zyzz/web').ref.ReturnType",
      ),
    ).toMatchInlineSnapshot('true')
  })

  test('preserves statically computed non-marker namespace destructuring', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {Css} from 'zyzz/web';const {['compile']:compile}=Css;export {compile};`,
      },
    })

    expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(
      `"import {Css} from 'zyzz/web';const {['compile']:compile}=Css;export {compile};"`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `import {Css} from 'zyzz/web';const {['ref']:ref}=Css;export const card=ref();`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:35: Marker helpers require direct Css member calls.]`,
    )
  })

  test('rejects destructured factories and canonically sorts packed state domains', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `import {Css} from 'zyzz/web';const {ref}=Css;export const card=ref();`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:35: Marker helpers require direct Css member calls.]`,
    )

    const first = Graph.compile({
      modules: {
        'index.ts': `import {ref,where} from 'zyzz/web';export const card=ref({state:['é','é']});`,
      },
    })

    const second = Graph.compile({
      modules: {
        'index.ts': `import {ref,where} from 'zyzz/web';export const card=ref({state:['é','é']});`,
      },
    })

    const app = Graph.compile({
      contracts: {
        'a.js': first.contracts['index.ts']!,
        'b.js': second.contracts['index.ts']!,
      },
      imports: { 'app.ts': { a: 'a.js', zyzz: null, 'zyzz/web': null } },
      modules: {
        'app.ts': `import {card as target} from 'a';${imports}export namespace styles {
  export const card = css({[where\`\${target} &\`]:{color:'red'}})
}`,
      },
    })

    expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-141{:where([data-z-1wfnqsmu0q6os-card-63-61-72-64]) &{color:red;}}"`,
    )
  })

  test('captures the runtime marker identity before validation', () => {
    let reads = 0

    const definition = {
      get id() {
        return ++reads === 1 ? 'data-z-card' : 'className'
      },
      schema: {},
    }

    const card = Marker.create(definition as Marker.Definition)

    expect(card()).toMatchInlineSnapshot(`
      {
        "data-z-card": "",
      }
    `)
    expect(reads).toMatchInlineSnapshot(`1`)
  })

  test('compiles relationship keys through transparent TypeScript wrappers', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=ref();export namespace styles {
  export const a = css({[where\`\${card} &\` satisfies symbol]:{color:'red'}})

  export const b = css({[where\`&:has(\${card})\`!]:{color:'blue'}})
}`,
      },
    })

    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z-style-1e8a67z1uaws1j-122{:where([data-z-1e8a67z1uaws1j-card-63-61-72-64]) &{color:red;}}
      .z-style-1e8a67z1uaws1j-199{&:has(:where([data-z-1e8a67z1uaws1j-card-63-61-72-64])){color:blue;}}"
    `)
  })

  test('validates direct runtime schemas', () => {
    expect(() =>
      Marker.create({
        id: 'data-z-card',
        schema: { State: ['open'], state: ['closed'] },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Marker state names must be distinct data-name fragments without reserved keys.]`,
    )

    const input = { state: ['open'] }
    const ref = Marker.create({ id: 'data-z-card', schema: input })

    input.state.push('closed')

    expect(() => ref({ state: 'closed' })).toThrowErrorMatchingInlineSnapshot(
      `[Error: Invalid marker state: state]`,
    )
  })

  test('rejects namespace access to marker helpers', () => {
    for (const helper of ['ref', 'where'])
      for (const access of [`Web.${helper}`, `Web['${helper}']`])
        expect(() =>
          Source.extract({
            moduleId: 'app.ts',
            source: `import * as Web from 'zyzz/web';export const value=${access}();`,
          }),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Source.ExtractError: app.ts:51: Relationship helpers require direct named imports from zyzz/web.]`,
        )
  })

  test('removes direct and aliased helper imports from unbundled output', () => {
    const results = [false, true].map((aliased) => {
      const binding = (name: string) => (aliased ? `${name}Alias` : name)
      const names = ['ref', 'where']
        .map((name) => (aliased ? `${name} as ${binding(name)}` : name))
        .join(',')
      const result = Graph.compile({
        modules: {
          'app.js': `import {css} from 'zyzz';import {${names},Css} from 'zyzz/web';const card=${binding('ref')}();export const style=css({[${binding('where')}\`\${card} &\`]:{color:'red'}});export const compile=Css.compile;`,
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

  test('rejects indirect authoring factories and invalid runtime identities', () => {
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `import {ref,where} from 'zyzz/web';const factory=ref;export const card=factory();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:49: Marker helpers require direct calls.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `import {ref,where} from 'zyzz/web';const card=ref();const tag=where;export const key=tag\`\${card} &\`;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:62: Marker helpers require direct calls.]`,
    )
    expect(() =>
      Marker.create({ id: 'className', schema: Marker.schema({}) } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Marker identities require compiler-owned data-z attributes.]`,
    )
  })
  test('rejects conflicting schemas for one packed marker identity', () => {
    const first = Graph.compile({
      modules: {
        'marker.ts': `import {ref,where} from 'zyzz/web';export const card=ref({state:['open']});`,
      },
    })

    const second = Graph.compile({
      modules: {
        'marker.ts': `import {ref,where} from 'zyzz/web';export const card=ref({state:['closed']});`,
      },
    })

    expect(() =>
      Graph.compile({
        contracts: {
          'first.js': first.contracts['marker.ts']!,
          'second.js': second.contracts['marker.ts']!,
        },
        imports: { 'app.ts': { first: 'first.js', second: 'second.js' } },
        modules: {
          'app.ts': `import {card as first} from 'first';import {card as second} from 'second';export {first,second};`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second.js:0: Invalid library contract: Conflicting packed marker schema: data-z-1dwt1t61ri6uf4-card-63-61-72-64]`,
    )
  })

  const config = `import {ref,where} from 'zyzz/web';export const card=ref({state:['open','closed'],selected:[true,false]});`
  const app = `import {css} from 'zyzz';import {ref,where as w} from 'zyzz/web';import {card} from 'library';export {card};export namespace styles {
  export const ancestor = css({[w\`\${card({state:'open'})} &\`]:{color:'red'}})

  export const parent = css({[w\`\${card} > &\`]:{color:'rgb(1, 2, 3)'}})

  export const descendant = css({[w\`&:has(\${card({selected:false})})\`]:{color:'blue'}})

  export const before = css({[w\`\${card} ~ &\`]:{color:'green'}})

  export const after = css({[w\`&:has(~ \${card})\`]:{color:'purple'}})

  export const either = css({[w\`\${card} ~ &, &:has(~ \${card})\`]:{color:'orange'}})

  export const nested = css({[w\`\${card} &\`]:{[w\`&:has(\${card})\`]:{color:'rgb(4, 5, 6)'}}})
}`

  function compile() {
    const library = Graph.compile({
      modules: {
        'marker.ts': config,
        'index.ts': `export {card} from './marker.js';`,
      },
    })

    const output = Graph.compile({
      contracts: { 'library/index.js': library.contracts['index.ts']! },
      imports: {
        'app.ts': { library: 'library/index.js', zyzz: null, 'zyzz/web': null },
      },
      modules: { 'app.ts': app },
    })

    return { library, output }
  }

  async function bundle() {
    const { library, output } = compile()

    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': output.modules['app.ts']!.code },
      packages: {
        library: Object.fromEntries(
          Object.entries(library.modules).map(([name, module]) => [
            name,
            module.code,
          ]),
        ),
      },
    })

    return {
      code,
      css: output.modules['app.ts']!.css,
    }
  }

  test('retains mutable marker aliases used only at runtime', () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {ref,where} from 'zyzz/web';const card=ref();let active=card;export const attrs=active();`,
      },
    })

    expect(
      result.modules['app.ts']!.code.includes('active()'),
    ).toMatchInlineSnapshot('true')
  })
  test('links packed marker identities and validates runtime state subsets', async () => {
    const { code, css } = await bundle()
    const fixture = Vm.runInNewContext(`${code};Fixture;`) as {
      card: (input?: Record<string, unknown>) => Record<string, string>
    }

    expect(fixture.card({ selected: false, state: 'open' }))
      .toMatchInlineSnapshot(`
        {
          "data-z-1dwt1t61ri6uf4-card-63-61-72-64": "",
          "data-z-1dwt1t61ri6uf4-card-63-61-72-64-selected": "false",
          "data-z-1dwt1t61ri6uf4-card-63-61-72-64-state": "open",
        }
      `)
    expect(() =>
      fixture.card({ unknown: 'open' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown marker state: unknown]`,
    )
    expect(() =>
      fixture.card({ state: 'invalid' }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid marker state: state]`)
    expect(() =>
      fixture.card({ [Symbol('unknown')]: 'open' }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: Unknown marker state: symbol]',
    )
    expect(css).toMatchInlineSnapshot(`
      ".z-style-1e8a67z1uaws1j-160{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64][data-z-1dwt1t61ri6uf4-card-63-61-72-64-state="open"]) &{color:red;}}
      .z-style-1e8a67z1uaws1j-237{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) > &{color:rgb(1, 2, 3);}}
      .z-style-1e8a67z1uaws1j-313{&:has(:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64][data-z-1dwt1t61ri6uf4-card-63-61-72-64-selected="false"])){color:blue;}}
      .z-style-1e8a67z1uaws1j-398{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) ~ &{color:green;}}
      .z-style-1e8a67z1uaws1j-462{&:has(~ :where([data-z-1dwt1t61ri6uf4-card-63-61-72-64])){color:purple;}}
      .z-style-1e8a67z1uaws1j-533{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) ~ &, &:has(~ :where([data-z-1dwt1t61ri6uf4-card-63-61-72-64])){color:orange;}}
      .z-style-1e8a67z1uaws1j-617{:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64]) &{&:has(:where([data-z-1dwt1t61ri6uf4-card-63-61-72-64])){color:rgb(4, 5, 6);}}}"
    `)
  })
  test('preserves identities across offsets and rejects invalid schemas', () => {
    const before = Graph.compile({ modules: { 'marker.ts': config } })
    const malformed = JSON.parse(before.contracts['marker.ts']!)

    malformed.exports.card.binding = 'data-z-other'

    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(malformed) },
        imports: { 'app.ts': { lib: 'lib.js', zyzz: null, 'zyzz/web': null } },
        modules: {
          'app.ts': `import {card} from 'lib';${imports}export const style=css({[where\`\${card} &\`]:{color:'red'}});`,
        },
      }),
    ).toThrow()

    const after = Graph.compile({
      modules: { 'marker.ts': '// leading edit\n' + config },
    })

    expect(
      JSON.parse(before.contracts['marker.ts']!).exports.card.marker.id ===
        JSON.parse(after.contracts['marker.ts']!).exports.card.marker.id,
    ).toMatchInlineSnapshot('true')

    const invalid = [
      'ref({state:[]})',
      "ref({state:[false,'false']})",
      "ref({state:['open'],State:['closed']})",
    ]

    expect(
      invalid.map((expression) => {
        try {
          Graph.compile({
            modules: {
              'app.ts': `import {ref,where} from 'zyzz/web';export const target=${expression};`,
            },
          })

          return 'accepted'
        } catch (error) {
          return (error as Error).message
        }
      }),
    ).toMatchInlineSnapshot(`
      [
        "app.ts:55: Marker states require nonempty finite value arrays.",
        "app.ts:55: Marker values must be distinct strings or booleans, including their serialization.",
        "app.ts:55: Marker state names must be distinct data-name fragments without reserved keys.",
      ]
    `)
  })
  test('respects lexical aliases and compiles literal ampersands, undefined and dynamic relationships', () => {
    const output = Graph.compile({
      modules: {
        'app.ts': `${imports}const card=ref(undefined);const alias=card;function other(card:unknown){const alias=card;return alias}export {alias};export const style=css((values:{color:'#123'|'#456'})=>({[where\`\${card}:has([href*="&"]/* & */) &\`]:{color:values.color}}));`,
      },
    })

    expect(
      output.modules['app.ts']!.css.includes('[href*='),
    ).toMatchInlineSnapshot('true')
  })
  test('rejects uncompiled keys, null data, and NUL states', () => {
    for (const expression of [
      `const unused={[where\`\${card} &\`]:{color:'red'}}`,
      `const style=css({[where\`\${card({data:null})} &\`]:{color:'red'}})`,
      `const invalid=ref({state:['\\0']})`,
      `const invalid=ref({state:['\\r']})`,
      `const invalid=ref({state:['\\ud800']})`,
    ])
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `${imports}const card=ref();${expression}`,
          },
        }),
      ).toThrow()
  })
  test('unwraps factories and freezes their public rewrite spans', async () => {
    const source =
      "import {Css} from 'zyzz/web';export const card=(Css['ref']({state:[`open`]}))!"
    const extracted = Source.extract({ moduleId: 'marker.ts', source })

    expect(Object.isFrozen(extracted.markerCalls)).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(extracted.markerCalls![0])).toMatchInlineSnapshot(
      'true',
    )

    const result = Graph.compile({ modules: { 'marker.ts': source } })

    expect(
      (
        await Esbuild.transform(result.modules['marker.ts']!.code, {
          loader: 'ts',
        })
      ).code.includes('zyzz/web'),
    ).toMatchInlineSnapshot('false')
  })
  test('rejects inherited and class-instance schemas before creating attribute bindings', () => {
    class Schema {
      state = ['open']
    }

    for (const schema of [Object.create({ state: ['open'] }), new Schema()])
      expect(() =>
        Marker.create({ id: 'data-z-card', schema: Marker.schema(schema) })(),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Error: Marker schemas require a plain record.]',
      )
  })
  test('does not publish a marker through a type-only export', () => {
    const output = Graph.compile({
      modules: {
        'marker.ts': `import {ref,where} from 'zyzz/web';const card=ref();type card=typeof card;export type {card}`,
      },
    })

    expect(output.contracts['marker.ts']).toMatchInlineSnapshot('undefined')
  })
  test('observes ancestor, parent, descendant, sibling, and nested relationships in Chromium', async () => {
    const { code, css } = await bundle()
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${css}</style><main id="root"><span id="ancestor"></span><div><i id="deep"></i></div><div id="nested"><i id="inner"></i></div></main><div id="descendant"><input id="child"></div><div><i id="earlier"></i><b id="before"></b></div><div><b id="after"></b><i id="later"></i></div><div><i id="peer"></i><b id="either"></b></div>`,
      )
      await page.addScriptTag({ content: code })
      await page.evaluate(
        `for(const id of ['root','child','earlier','later','peer','inner'])for(const [key,value]of Object.entries(Fixture.card({state:'open',selected:false})))document.getElementById(id).setAttribute(key,value);for(const id of ['ancestor','descendant','before','after','either','nested'])document.getElementById(id).className=Fixture.styles[id]().className;for(const id of ['ancestor','deep'])document.getElementById(id).className+=' '+Fixture.styles.parent().className`,
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

      await page.locator('#earlier').evaluate((el) => el.remove())

      expect(await color('before')).toMatchInlineSnapshot(`"rgb(0, 0, 0)"`)
    } finally {
      await browser.close()
    }
  })
})
