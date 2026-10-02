/** Exercises compiled variable reads and subscriptions through real React rendering. @module */
import * as Ds from '../../test/fixtures/native/Ds.js'
import { Graph } from 'zyzz/compiler'
import * as Path from 'node:path'
import * as Packed from '../../test/fixtures/Packed.js'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'

const native = {
  colorScheme: 'light',
  contextual: true,
  fonts: {
    'Pilat, Arial, sans-serif': 'Pilat',
    'JetBrains Mono, monospace': 'JetBrainsMono',
  },
  platform: 'ios',
  units: { px: 1, rem: 16 },
} as const

describe('defineConfig', () => {
  test.each([false, true])(
    'selects returned providers and authoring helpers with packed=%s',
    async (packed) => {
      const modules = {
        'config.ts': `import {Vars} from 'zyzz';import {defineConfig as create} from 'zyzz/react-native';
        const base=Vars.define({color:{ink:{light:'#123456',dark:'#abcdef'}},spacing:{gap:'4px'}});
        const alternate=Vars.extend(base,{spacing:{gap:'8px'}});
        export const config=create({defaultVars:'alternate',vars:{base,alternate}});
        export const {Provider,style,vars}=config;`,
        'index.ts': `export {config,Provider,style,vars} from './config.js';`,
      }
      const publisher = packed ? Graph.compile({ modules, native }) : undefined
      const consumer = Graph.compile({
        ...(publisher ? { contracts: publisher.contracts } : {}),
        imports: {
          'app.ts': {
            './index.js': 'index.ts',
            react: null,
            'react-dom/client': null,
            'zyzz/react-native': null,
          },
          'config.ts': { zyzz: null, 'zyzz/react-native': null },
          'index.ts': { './config.js': 'config.ts' },
        },
        modules: {
          ...(!packed ? modules : {}),
          'app.ts': `import * as React from 'react';import {createRoot} from 'react-dom/client';
          import {useStyles,useVars} from 'zyzz/react-native';import {config,Provider,style,vars} from './index.js';
          const {Provider:OtherProvider}=config;const label=style({color:'ink',paddingTop:'gap'});
          function Value(props){const values=useVars(vars);const member=useVars(config.vars,values=>values.spacing.gap);const selected=useStyles().props(label());return React.createElement('pre',{id:props.id},JSON.stringify({ink:values.color.ink,gap:values.spacing.gap,member,style:selected.style}))}
          function App(){const [name,setName]=React.useState(undefined);const [scheme,setScheme]=React.useState('light');return React.createElement(Provider,{colorScheme:scheme,vars:name},
            React.createElement('button',{id:'vars',onClick:()=>setName('base')},'vars'),
            React.createElement('button',{id:'scheme',onClick:()=>setScheme('dark')},'scheme'),
            React.createElement(Value,{id:'values'}),
            React.createElement(OtherProvider,{colorScheme:'dark',vars:'alternate'},React.createElement(Value,{id:'nested'})))}
          createRoot(document.getElementById('app')).render(React.createElement(App));
          createRoot(document.getElementById('second')).render(React.createElement(config.Provider,{colorScheme:'light',vars:'base'},React.createElement(Value,{id:'independent'})));
          createRoot(document.getElementById('invalid'),{onUncaughtError:error=>{document.getElementById('invalid').textContent=error.message}}).render(React.createElement(Provider,{colorScheme:'light',vars:'missing'}));`,
        },
        native,
      })
      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: {
          ...Object.fromEntries(
            Object.entries(publisher?.modules ?? {}).map((entry) => [
              entry[0],
              entry[1].code,
            ]),
          ),
          ...Object.fromEntries(
            Object.entries(consumer.modules).map((entry) => [
              entry[0],
              entry[1].code,
            ]),
          ),
        },
      })
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent(
          '<div id="app"></div><div id="second"></div><div id="invalid"></div>',
        )
        await page.addScriptTag({ content: code })
        await expect
          .poll(() => page.locator('#values').textContent())
          .toBeTruthy()
        expect(
          JSON.parse((await page.locator('#values').textContent())!),
        ).toEqual({
          gap: 8,
          ink: '#123456',
          member: 8,
          style: { color: '#123456', paddingTop: 8 },
        })
        await expect
          .poll(() => page.locator('#invalid').textContent())
          .toBe('Unknown native vars: missing.')

        await page.locator('#vars').click()
        await expect
          .poll(() => page.locator('#values').textContent())
          .toContain('"gap":4')
        await page.locator('#scheme').click()
        await expect
          .poll(() => page.locator('#values').textContent())
          .toContain('#abcdef')
        expect(
          JSON.parse((await page.locator('#values').textContent())!),
        ).toEqual({
          gap: 4,
          ink: '#abcdef',
          member: 4,
          style: { color: '#abcdef', paddingTop: 4 },
        })
        expect(
          JSON.parse((await page.locator('#nested').textContent())!),
        ).toEqual({
          gap: 8,
          ink: '#abcdef',
          member: 8,
          style: { color: '#abcdef', paddingTop: 8 },
        })
        expect(
          JSON.parse((await page.locator('#independent').textContent())!),
        ).toEqual({
          gap: 4,
          ink: '#123456',
          member: 4,
          style: { color: '#123456', paddingTop: 4 },
        })
      } finally {
        await browser.close()
      }
    },
  )

  test('requires native compilation for native configuration authoring', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'config.ts': `import {defineConfig} from 'zyzz/react-native';export const {Provider}=defineConfig()`,
        },
      }),
    ).toThrow('Native defineConfig requires a native compilation target.')
  })
})

describe('useVars', () => {
  test.each([false, true])(
    'selects responsive native variables with adapter measurements and packed=%s',
    async (packed) => {
      const modules = {
        'config.ts': `import {Vars} from 'zyzz';import {defineConfig} from 'zyzz/react-native';
          const base=Vars.define({breakpoint:{md:'768px'},color:{ink:{light:'#112233',dark:'#334455'}},spacing:{gap:{default:'16px','@media md':'24px'}},typography:{body:{fontSize:{default:'16px','@media md':'20px'},lineHeight:1.5}}});
          const compact=Vars.extend(base,{spacing:{gap:{default:'8px','@media md':'12px'}}});
          export const {Provider,style,vars}=defineConfig({defaultVars:'base',vars:{base,compact}});`,
      }
      const publisher = packed ? Graph.compile({ modules, native }) : undefined
      const compiled = Graph.compile({
        ...(publisher ? { contracts: publisher.contracts } : {}),
        imports: {
          'app.ts': {
            './config.js': 'config.ts',
            react: null,
            'react-dom/client': null,
            'zyzz/react-native': null,
            [Path.resolve('src/react-native/internal/Viewport.ts')]: null,
          },
          'config.ts': { zyzz: null, 'zyzz/react-native': null },
        },
        modules: {
          ...(!packed ? modules : {}),
          'app.ts': `import * as React from 'react';import {createRoot} from 'react-dom/client';
            import {useStyles,useVars} from 'zyzz/react-native';import {Provider,style,vars} from './config.js';
            import {context as WindowContext} from ${JSON.stringify(Path.resolve('src/react-native/internal/Viewport.ts'))};
            const label=style({paddingTop:'gap',typography:'body'});
            let selectedRenders=0;
            const Selected=React.memo(function Selected(){const gap=useVars(vars,values=>values.spacing.gap);selectedRenders++;return React.createElement('pre',{id:'selected'},JSON.stringify({gap,renders:selectedRenders}))});
            const Value=React.memo(function Value(props){const values=useVars(vars);const selected=useStyles().props(label());return React.createElement('pre',{id:props.id},JSON.stringify({gap:values.spacing.gap,ink:values.color.ink,lineHeight:values.typography.body.lineHeight,style:selected.style}))});
            function App(){const [width,setWidth]=React.useState(767.5);const [scheme,setScheme]=React.useState('light');return React.createElement(WindowContext.Provider,{value:{width,height:800}},React.createElement(Provider,{colorScheme:scheme},
              React.createElement('button',{id:'within',onClick:()=>setWidth(767.75)},'within'),
              React.createElement('button',{id:'cross',onClick:()=>setWidth(768)},'cross'),
              React.createElement('button',{id:'scheme',onClick:()=>setScheme('dark')},'scheme'),
              React.createElement(Selected),React.createElement(Value,{id:'values'}),
              React.createElement(Provider,{colorScheme:'dark',vars:'compact'},React.createElement(Value,{id:'nested'}))))}
            createRoot(document.getElementById('app')).render(React.createElement(App));
            createRoot(document.getElementById('independent')).render(React.createElement(WindowContext.Provider,{value:{width:768,height:800}},React.createElement(Provider,{colorScheme:'light',vars:'compact'},React.createElement(Value,{id:'other'}))));`,
        },
        native,
      })
      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: {
          ...Object.fromEntries(
            Object.entries(publisher?.modules ?? {}).map(([id, value]) => [
              id,
              value.code,
            ]),
          ),
          ...Object.fromEntries(
            Object.entries(compiled.modules).map(([id, value]) => [
              id,
              value.code,
            ]),
          ),
        },
      })
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent(
          '<div id="app"></div><div id="independent"></div>',
        )
        await page.addScriptTag({ content: code })
        await expect
          .poll(() => page.locator('#values').textContent())
          .toBeTruthy()
        expect(JSON.parse((await page.locator('#values').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 16,
              "ink": "#112233",
              "lineHeight": 24,
              "style": {
                "fontSize": 16,
                "lineHeight": 24,
                "paddingTop": 16,
              },
            }
          `)

        await page.locator('#within').click()
        expect(JSON.parse((await page.locator('#selected').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 16,
              "renders": 1,
            }
          `)
        await page.locator('#cross').click()
        await expect
          .poll(() => page.locator('#selected').textContent())
          .toContain('"gap":24')
        expect(JSON.parse((await page.locator('#selected').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 24,
              "renders": 2,
            }
          `)
        await page.locator('#scheme').click()
        await expect
          .poll(() => page.locator('#values').textContent())
          .toContain('#334455')
        expect(JSON.parse((await page.locator('#values').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 24,
              "ink": "#334455",
              "lineHeight": 30,
              "style": {
                "fontSize": 20,
                "lineHeight": 30,
                "paddingTop": 24,
              },
            }
          `)
        expect(JSON.parse((await page.locator('#selected').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 24,
              "renders": 2,
            }
          `)
        expect(JSON.parse((await page.locator('#nested').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 12,
              "ink": "#334455",
              "lineHeight": 30,
              "style": {
                "fontSize": 20,
                "lineHeight": 30,
                "paddingTop": 12,
              },
            }
          `)
        expect(JSON.parse((await page.locator('#other').textContent())!))
          .toMatchInlineSnapshot(`
            {
              "gap": 12,
              "ink": "#112233",
              "lineHeight": 30,
              "style": {
                "fontSize": 20,
                "lineHeight": 30,
                "paddingTop": 12,
              },
            }
          `)
      } finally {
        await browser.close()
      }
    },
  )

  test('resolves namespace imports, aliased hooks, config members, and standalone definitions', async () => {
    const compiled = Graph.compile({
      native,
      modules: {
        'app.ts': `
          import * as React from 'react'
          import {createRoot} from 'react-dom/client'
          import {Config, Vars} from 'zyzz'
          import * as Adapter from 'zyzz/react-native'
          import {useVars as read} from 'zyzz/react-native'
          import {Provider} from 'zyzz/react-native/react'

          const config = Config.create({defaultVars:'base',vars:{base:{spacing:{gap:'4px'}},alternate:{spacing:{gap:'8px'}}}})
          const standalone = Vars.define({spacing:{gap:'2px'}})

          function Sample() {
            const values = read(config.vars)
            const fixed = Adapter.useVars(standalone)
            const [property, setProperty] = React.useState('gap')
            const selected = read(config.vars, values => property === 'gap' ? values.spacing.gap : values.spacing.gap * 2)
            return React.createElement('button', {id:'values', onClick:() => setProperty('double')}, JSON.stringify({gap:values.spacing.gap,fixed:fixed.spacing.gap,selected}))
          }

          createRoot(document.getElementById('app')).render(React.createElement(Provider,{colorScheme:'light',vars:'alternate'},React.createElement(Sample)))
        `,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': compiled.modules['app.ts']!.code },
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="app"></div>')
      await page.addScriptTag({ content: code })
      await expect
        .poll(() => page.locator('#values').textContent())
        .toBeTruthy()
      expect(JSON.parse((await page.locator('#values').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "fixed": 2,
          "gap": 8,
          "selected": 8,
        }
      `)

      await page.locator('#values').click()
      await expect
        .poll(() => page.locator('#values').textContent())
        .toBe('{"gap":8,"fixed":2,"selected":16}')
      expect(JSON.parse((await page.locator('#values').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "fixed": 2,
          "gap": 8,
          "selected": 16,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('reports invalid selections and unsupported reads through React', async () => {
    const compiled = Graph.compile({
      native,
      modules: {
        'app.ts': `
          import * as React from 'react'
          import {createRoot} from 'react-dom/client'
          import {Config} from 'zyzz'
          import {Provider,useVars} from 'zyzz/react-native/react'

          const {vars}=Config.create({defaultVars:'base',vars:{base:{color:{ink:'#123456'}},alternate:{color:{ink:'#abcdef'}}}})
          const {vars:web}=Config.create({vars:{color:{ink:'#123456'},spacing:{gap:{default:'8px','@media (min-width: 768px)':'16px'}}}})
          const {vars:font}=Config.create({vars:{typography:{body:{fontFamily:'Unmapped'}}}})
          const {vars:invalidLine}=Config.create({vars:{typography:{body:{fontSize:'16px',lineHeight:-1}}}})
          const {vars:responsive}=Config.create({vars:{typography:{body:{fontSize:'16px','@media (min-width: 768px)':{fontSize:'20px'}}}}})

          function Sample(props) {
            if(props.kind==='supported') return useVars(web).color.ink
            if(props.kind==='condition') return String(useVars(web).spacing.gap)
            if(props.kind==='font') return useVars(font).typography.body.fontFamily
            if(props.kind==='line') return String(useVars(invalidLine).typography.body.lineHeight)
            if(props.kind==='responsive') return String(useVars(responsive).typography.body['@media (min-width: 768px)'].fontSize)
            if(props.kind==='uncompiled') return useVars({}).color.ink
            return useVars(vars).color.ink
          }

          const scenarios = [
            ['missing', null],
            ['unknown', {colorScheme:'light',vars:'missing'}],
            ['inherited', {colorScheme:'light',vars:'toString'}],
            ['blank', {colorScheme:'light',vars:' '}],
            ['scheme', {colorScheme:'system'}],
            ['old', {colorScheme:'light',set:'base'}],
            ['uncompiled', {colorScheme:'light'}],
            ['condition', {colorScheme:'light'}],
            ['font', {colorScheme:'light'}],
            ['line', {colorScheme:'light'}],
            ['responsive', {colorScheme:'light'}],
            ['supported', {colorScheme:'light'}],
          ]

          for(const [kind,props] of scenarios) {
            const element = document.createElement('div')
            element.id=kind
            document.body.appendChild(element)
            const sample=React.createElement(Sample,{kind})
            createRoot(element,{onUncaughtError:error=>{element.textContent=error.message}}).render(props===null?sample:React.createElement(Provider,props,sample))
          }
        `,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': compiled.modules['app.ts']!.code },
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.addScriptTag({ content: code })
      await expect
        .poll(() => page.locator('#supported').textContent())
        .toBe('#123456')
      await expect.poll(() => page.locator('#line').textContent()).toBeTruthy()
      expect(
        await page.locator('#missing').textContent(),
      ).toMatchInlineSnapshot('"useVars requires a Zyzz Provider."')
      expect(
        await page.locator('#unknown').textContent(),
      ).toMatchInlineSnapshot('"Unknown native vars: missing."')
      expect(
        await page.locator('#inherited').textContent(),
      ).toMatchInlineSnapshot('"Unknown native vars: toString."')
      expect(await page.locator('#blank').textContent()).toMatchInlineSnapshot(
        '"Native appearance requires a resolved light/dark scheme and a nonempty vars name."',
      )
      expect(await page.locator('#scheme').textContent()).toMatchInlineSnapshot(
        '"Native appearance requires a resolved light/dark scheme and a nonempty vars name."',
      )
      expect(await page.locator('#old').textContent()).toMatchInlineSnapshot(
        '"Provider uses vars instead of set."',
      )
      expect(
        await page.locator('#uncompiled').textContent(),
      ).toMatchInlineSnapshot(
        '"useVars requires variables compiled by the native adapter."',
      )
      expect(
        await page.locator('#condition').textContent(),
      ).toMatchInlineSnapshot(
        '"Native variable spacing.gap: Native media-conditioned variables require the native Provider window dimensions."',
      )
      expect(await page.locator('#font').textContent()).toMatchInlineSnapshot(
        '"Native variable typography.body.fontFamily: Provide an explicit fonts mapping for this family."',
      )
      expect(await page.locator('#line').textContent()).toMatchInlineSnapshot(
        '"Native variable typography.body.lineHeight: Unsupported native numeric value."',
      )
      expect(
        await page.locator('#responsive').textContent(),
      ).toMatchInlineSnapshot(
        '"Native variable typography.body.@media (min-width: 768px).fontSize: Media-conditioned variables require a web target."',
      )
    } finally {
      await browser.close()
    }
  })

  test('filters selected updates and isolates nested and independent providers in Strict Mode', async () => {
    const compiled = Graph.compile({
      native,
      modules: {
        'app.ts': `import * as React from 'react';import {createRoot} from 'react-dom/client';
        import {Config} from 'zyzz';import {Provider,useStyles,useVars} from 'zyzz/react-native/react';
        const {vars,style}=Config.create({defaultVars:'base',vars:{base:{color:{ink:{light:'#123456',dark:'#abcdef'}},spacing:{gap:'8px'}},alternate:{color:{ink:{light:'#123456',dark:'#abcdef'}},spacing:{gap:'16px'}}}});
        const {vars:other}=Config.create({vars:{spacing:{gap:'4px'}}});
        const label=style({color:'ink',padding:'gap'});const renders={color:0,spacing:0,whole:0,nested:0,independent:0,styles:0};
        const Color=React.memo(function Color(){renders.color++;const color=useVars(vars,values=>values.color.ink);return React.createElement('span',{id:'color'},color)});
        const Spacing=React.memo(function Spacing(){renders.spacing++;const spacing=useVars(vars,values=>values.spacing);return React.createElement('span',{id:'spacing'},spacing.gap)});
        const Whole=React.memo(function Whole(){renders.whole++;const values=useVars(vars);return React.createElement('span',{id:'whole','data-frozen':Object.isFrozen(values)&&Object.isFrozen(values.color)},values.spacing.gap)});
        const Styled=React.memo(function Styled(){renders.styles++;const props=useStyles().props(label());return React.createElement('span',{id:'styled',...props},'styled')});
        const Nested=React.memo(function Nested(){return React.createElement(Provider,{colorScheme:'dark',vars:'base'},React.createElement(NestedValue))});
        function NestedValue(){renders.nested++;return React.createElement('span',{id:'nested'},useVars(vars,values=>values.color.ink))}
        function Independent(){renders.independent++;return React.createElement('span',{id:'independent'},useVars(other,values=>values.spacing.gap))}
        function App(){const [scheme,setScheme]=React.useState('light');const [name,setName]=React.useState('base');const [visible,setVisible]=React.useState(true);return React.createElement(Provider,{colorScheme:scheme,vars:name},
          React.createElement('button',{id:'theme',onClick:()=>setName(name==='base'?'alternate':'base')},'vars'),
          React.createElement('button',{id:'scheme',onClick:()=>setScheme(scheme==='light'?'dark':'light')},'scheme'),
          React.createElement('button',{id:'default',onClick:()=>setName(undefined)},'default'),
          React.createElement('button',{id:'visible',onClick:()=>setVisible(!visible)},'visible'),
          visible&&React.createElement(Color),React.createElement(Spacing),React.createElement(Whole),React.createElement(Styled),React.createElement(Nested))}
        const root=createRoot(document.getElementById('app'));const second=createRoot(document.getElementById('second'));
        root.render(React.createElement(React.StrictMode,null,React.createElement(App)));second.render(React.createElement(Provider,{colorScheme:'light'},React.createElement(Independent)));
        export const counts=()=>({...renders});export function unmount(){root.unmount();second.unmount()}`,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': compiled.modules['app.ts']!.code },
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="app"></div><div id="second"></div>')
      await page.addScriptTag({ content: code })
      await expect
        .poll(() => page.locator('#color').textContent())
        .toBe('#123456')
      await expect
        .poll(() => page.locator('#independent').textContent())
        .toBe('4')
      expect(
        await page.locator('#whole').getAttribute('data-frozen'),
      ).toMatchInlineSnapshot('"true"')

      await page.evaluate('window.before=Fixture.counts()')
      await page.locator('#theme').click()
      await expect.poll(() => page.locator('#spacing').textContent()).toBe('16')
      expect(
        await page.evaluate(
          `({color:Fixture.counts().color-window.before.color,nested:Fixture.counts().nested-window.before.nested,independent:Fixture.counts().independent-window.before.independent,spacing:Fixture.counts().spacing>window.before.spacing,whole:Fixture.counts().whole>window.before.whole,styles:Fixture.counts().styles>window.before.styles})`,
        ),
      ).toMatchInlineSnapshot(`
        {
          "color": 0,
          "independent": 0,
          "nested": 0,
          "spacing": true,
          "styles": true,
          "whole": true,
        }
      `)
      expect(
        await page
          .locator('#styled')
          .evaluate((element) => (element as HTMLElement).style.paddingTop),
      ).toMatchInlineSnapshot('"16px"')

      await page.evaluate('window.before=Fixture.counts()')
      await page.locator('#scheme').click()
      await expect
        .poll(() => page.locator('#color').textContent())
        .toBe('#abcdef')
      expect(
        await page.evaluate('Fixture.counts().spacing-window.before.spacing'),
      ).toMatchInlineSnapshot('0')
      expect(await page.locator('#nested').textContent()).toMatchInlineSnapshot(
        '"#abcdef"',
      )

      await page.locator('#default').click()
      await expect.poll(() => page.locator('#spacing').textContent()).toBe('8')
      await page.locator('#visible').click()
      await page.evaluate('window.before=Fixture.counts()')
      await page.locator('#scheme').click()
      expect(
        await page.evaluate('Fixture.counts().color-window.before.color'),
      ).toMatchInlineSnapshot('0')
      await page.locator('#visible').click()
      await expect
        .poll(() => page.locator('#color').textContent())
        .toBe('#123456')
      await page.evaluate('Fixture.unmount()')
      expect(await page.locator('#app').textContent()).toMatchInlineSnapshot(
        '""',
      )
    } finally {
      await browser.close()
    }
  })

  test.each([false, true])(
    'reads composed values and typography with packed=%s',
    async (packed) => {
      const modules = {
        'config.ts': `import {Config,Vars} from 'zyzz';const base=Vars.define({color:{ink:{light:'#123456',dark:'#abcdef'}},spacing:{gap:'1.5rem'},typography:{body:{fontFamily:'Pilat, Arial, sans-serif',fontSize:'1rem',fontWeight:500,lineHeight:1.25,letterSpacing:'0.01rem'}}},vars=>({spacing:{double:Vars.compose('spacing',['calc(',vars.spacing.gap,' * 2)'])}}));const alternate=Vars.extend(base,{spacing:{gap:'2rem'}});export const {vars}=Config.create({defaultVars:'base',vars:{base,alternate}});`,
        'index.ts': `export {vars} from './config.js';`,
      }
      const publisher = packed ? Graph.compile({ modules }) : undefined
      const consumer = Graph.compile({
        native,
        ...(publisher ? { contracts: publisher.contracts } : {}),
        imports: {
          'app.ts': {
            './index.js': 'index.ts',
            react: null,
            'react-dom/client': null,
            'zyzz/react-native/react': null,
          },
          'index.ts': { './config.js': 'config.ts' },
          'config.ts': { zyzz: null },
        },
        modules: {
          ...(!packed ? modules : {}),
          'app.ts': `import * as React from 'react';import {createRoot} from 'react-dom/client';import {Provider,useVars} from 'zyzz/react-native/react';import {vars} from './index.js';function App(){const values=useVars(vars);return React.createElement('pre',{id:'values'},JSON.stringify(values))}createRoot(document.getElementById('app')).render(React.createElement(Provider,{colorScheme:'dark',vars:'alternate'},React.createElement(App)));`,
        },
      })
      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: {
          ...Object.fromEntries(
            Object.entries(publisher?.modules ?? {}).map((entry) => [
              entry[0],
              entry[1].code,
            ]),
          ),
          ...Object.fromEntries(
            Object.entries(consumer.modules).map((entry) => [
              entry[0],
              entry[1].code,
            ]),
          ),
        },
      })
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent('<div id="app"></div>')
        await page.addScriptTag({ content: code })
        await expect
          .poll(() => page.locator('#values').textContent())
          .toBeTruthy()
        expect(JSON.parse((await page.locator('#values').textContent())!))
          .toMatchInlineSnapshot(`
        {
          "color": {
            "ink": "#abcdef",
          },
          "spacing": {
            "double": 64,
            "gap": 32,
          },
          "typography": {
            "body": {
              "fontFamily": "Pilat",
              "fontSize": 16,
              "fontWeight": 500,
              "letterSpacing": 0.16,
              "lineHeight": 20,
            },
          },
        }
      `)
      } finally {
        await browser.close()
      }
    },
  )

  test('reads DS typography and geometry for Tempro consumer patterns', async () => {
    const modules = await Ds.read()
    modules['app.ts'] =
      `import * as React from 'react';import {createRoot} from 'react-dom/client';import {Provider,useVars} from 'zyzz/react-native/react';import {vars} from './platform/zyzz.config.js';function App(){const values=useVars(vars);return React.createElement('pre',{id:'values'},JSON.stringify({background:values.color.background.secondary,body:values.typography.body.b2,radius:values.radius.full,spacing:values.spacing['24']}))}createRoot(document.getElementById('app')).render(React.createElement(Provider,{colorScheme:'light'},React.createElement(App)));`
    const compiled = Graph.compile({ modules, native })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: Object.fromEntries(
        Object.entries(compiled.modules).map((entry) => [
          entry[0],
          entry[1].code,
        ]),
      ),
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="app"></div>')
      await page.addScriptTag({ content: code })
      await expect
        .poll(() => page.locator('#values').textContent())
        .toBeTruthy()
      expect(JSON.parse((await page.locator('#values').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "background": "#ffffffff",
          "body": {
            "fontFamily": "Pilat",
            "fontSize": 14,
            "fontWeight": 500,
            "letterSpacing": 0.14000000059604645,
            "lineHeight": 20,
          },
          "radius": 999,
          "spacing": 24,
        }
      `)
    } finally {
      await browser.close()
    }
  })
})
