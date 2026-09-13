/** Exercises source-free variant packages, composition ownership, aliases, and CSS source tracing. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { zyzz } from 'zyzz/vite'
import * as Library from '../test/fixtures/VariantLibrary.js'

describe('variants', () => {
  test.each(['react', 'html'] as const)(
    'packs every alternative and composes imported %s callables',
    async (output) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-packed-variants-'))
      const browser = await chromium.launch()
      let server: Vite.PreviewServer | undefined
      try {
        const library = await Library.create(root, output)
        // Model independent dependency runtime copies, as dev optimization can produce.
        await Fs.cp(Path.join(root,'node_modules/zyzz'),Path.join(library.installed,'node_modules/zyzz'),{recursive:true})
        await Fs.writeFile(
          Path.join(root, 'package.json'),
          '{"type":"module","private":true}',
        )
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          `<style>
#native{padding:2px;opacity:.5}
#native[data-choice=sm]{padding:4px}
#native[data-choice=lg]{padding:12px}
#native[data-choice=custom]{padding:var(--padding)}
#native[data-active=true]{opacity:1}
#native[data-active=true]:is([data-choice=lg],[data-choice=custom]){border:3px solid}
@media(min-width:600px){#native[data-wide=true]{padding:12px}#native[data-wide=true][data-active=true]{border:3px solid}}
#native[data-override=true]{padding-left:3px}
</style><main><button id="actual">Variant</button><button id="native">Native</button></main><script type="module" src="/app.ts"></script>`,
        )
        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          `import {cx} from 'zyzz';
import {controls as imported,theme} from '@acme/variants';
const controls=imported;
const {button:buttonVariant}=controls;
import '@acme/variants/style.css';
const element=document.querySelector('button')!;
document.querySelector('main')!.className=theme.className;
export function apply(size?:'sm'|'lg'|null|{custom:{padding:\`\${number}px\`}},active=false,wide=false,override=true) {
  const props=cx(buttonVariant({size,active,conditions:{wide:{size:wide?'lg':undefined}}}),override && controls.override());
  for(const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  element.id='actual';
  for(const [name,value] of Object.entries(props)) {
    if(name==='style' && typeof value==='object') for(const [property,scalar] of Object.entries(value)) element.style.setProperty(property.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),String(scalar));
    else element.setAttribute(name==='className'?'class':name,String(value));
  }
  const native=document.querySelector('#native')! as HTMLElement;
  native.dataset.choice=size===undefined?'sm':size===null?'':typeof size==='object'?'custom':size;
  native.dataset.active=String(active);native.dataset.wide=String(wide);native.dataset.override=String(override);
  if(size && typeof size==='object') native.style.setProperty('--padding',size.custom.padding);else native.style.removeProperty('--padding');
  return props;
}
export function reset(){return cx(buttonVariant({size:{custom:{padding:'9px'}},active:true}),buttonVariant({size:null,active:null}))}
Object.assign(window,{apply,reset}); apply();`,
        )
        const types = Path.join(root, 'types.ts')
        await Fs.writeFile(
          types,
          `import {controls,variant} from '@acme/variants';
controls.button({size:{custom:{padding:'9px'}},conditions:{wide:{size:'lg'}}});
variant({base:{color:'brand'}});
// @ts-expect-error Dynamic choices require complete scoped payloads.
controls.button({size:'custom'});
// @ts-expect-error Unknown finite choice.
controls.button({size:'missing'});
// @ts-expect-error Unknown bound token.
variant({base:{color:'missing'}});`,
        )
        const checked = await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            Path.resolve('node_modules/typescript/bin/tsc'),
            '--module',
            'nodenext',
            '--target',
            'esnext',
            '--strict',
            '--skipLibCheck',
            '--noEmit',
            types,
          ],
        ).catch((error) => {
          throw new Error(error.stdout || error.message)
        })
        expect(checked.stdout).toMatchInlineSnapshot('""')
        await Fs.rm(types)
        const config: Vite.InlineConfig = {
          configFile: false,
          logLevel: 'silent',
          plugins: [zyzz()],
          root,
        }
        await Vite.build(config)
        server = await Vite.preview({
          ...config,
          preview: { host: '127.0.0.1', port: 0 },
        })
        const page = await browser.newPage({
          viewport: { width: 450, height: 700 },
        })
        await page.goto(server.resolvedUrls!.local[0]!)
        await page.waitForFunction("typeof window.apply === 'function'")
        expect(
          await page.evaluate(`{
        const results=[];const element=document.querySelector('button');
        for(const [size,active,wide,override] of [[undefined,false,false,true],['lg',true,false,true],[{custom:{padding:'20px'}},true,false,true],[null,false,false,false],['sm',false,false,false]]) {
          window.apply(size,active,wide,override);const style=getComputedStyle(element);
          const control=getComputedStyle(document.querySelector('#native'));
          if(['paddingLeft','paddingRight','opacity','borderTopWidth'].some(key=>style[key]!==control[key])) throw new Error('Packed composition differs from native CSS: '+JSON.stringify({size,left:style.paddingLeft,right:style.paddingRight}));
          results.push([style.paddingLeft,style.paddingRight,style.opacity,style.borderTopWidth,element.hasAttribute('style')]);
        } results;
      }`),
        ).toMatchInlineSnapshot(`
          [
            [
              "3px",
              "4px",
              "0.5",
              "2px",
              false,
            ],
            [
              "3px",
              "12px",
              "1",
              "3px",
              false,
            ],
            [
              "3px",
              "20px",
              "1",
              "3px",
              true,
            ],
            [
              "2px",
              "2px",
              "0.5",
              "2px",
              false,
            ],
            [
              "4px",
              "4px",
              "0.5",
              "2px",
              false,
            ],
          ]
        `)
        await page.evaluate("window.apply('sm',true,true,true)")
        await page.setViewportSize({ width: 900, height: 700 })
        expect(
          await page
            .locator('#actual')
            .evaluate((element) => getComputedStyle(element).paddingRight),
        ).toMatchInlineSnapshot('"12px"')
        await page.locator('main').evaluate((element) => {
          ;(element as HTMLElement).style.colorScheme = 'dark'
        })
        expect(
          await page
            .locator('#actual')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(153, 204, 255)"')
        expect(
          await page.evaluate("window.reset()['data-size']"),
        ).toMatchInlineSnapshot('undefined')
        expect(
          await page.evaluate("window.reset()['data-active']"),
        ).toMatchInlineSnapshot('undefined')
        expect(
          await page.evaluate('window.reset().style'),
        ).toMatchInlineSnapshot('undefined')
        const javascript = await Fs.readFile(
          Path.join(library.installed, 'styles.js'),
          'utf8',
        )
        const javascriptMap = new Trace.TraceMap(
          JSON.parse(
            await Fs.readFile(
              Path.join(library.installed, 'styles.js.map'),
              'utf8',
            ),
          ),
        )
        const prefix = javascript.slice(0, javascript.indexOf('button ='))
        const authored = Trace.originalPositionFor(javascriptMap, {
          line: prefix.split('\n').length,
          column: prefix.length - prefix.lastIndexOf('\n') - 1,
        })
        expect(authored.source?.endsWith('styles.ts')).toMatchInlineSnapshot(
          'true',
        )
        expect(authored.line).toMatchInlineSnapshot('3')
        const map = new Trace.TraceMap(
          library.compiled.modules['@acme/variants/styles.ts']!.cssMap!,
        )
        const css = library.compiled.modules['@acme/variants/styles.ts']!.css
        const before = css.slice(0, css.indexOf('padding'))
        const original = Trace.originalPositionFor(map, {
          line: before.split('\n').length,
          column: before.length - (before.lastIndexOf('\n') + 1),
        })
        expect(original.source).toMatchInlineSnapshot(
          '"@acme/variants/styles.ts"',
        )
        expect(original.line !== null).toMatchInlineSnapshot('true')
        expect(
          JSON.parse(
            await Fs.readFile(
              Path.join(library.installed, 'styles.js.zyzz.json'),
              'utf8',
            ),
          ).version,
        ).toMatchInlineSnapshot('16')
      } finally {
        await browser.close()
        if (server)
          await new Promise<void>((resolve, reject) =>
            server!.httpServer.close((error) =>
              error ? reject(error) : resolve(),
            ),
          )
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    120000,
  )

  test('rejects malformed packed ownership and mixed renderer composition', () => {
    const publisher = Graph.compile({ modules: Library.sources('html') })
    const contracts = { ...publisher.contracts }
    const data = JSON.parse(contracts['@acme/variants/index.ts']!)
    data.exports.controls.members.button.style.slots = ['onclick']
    contracts['@acme/variants/index.ts'] = JSON.stringify(data)
    expect(() =>
      Graph.compile({
        modules: { 'app.ts': "import {controls} from '@acme/variants'" },
        contracts,
        imports: { 'app.ts': { '@acme/variants': '@acme/variants/index.ts' } },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: @acme/variants/index.ts:0: Invalid library contract: Invalid packed style ownership.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts':
            "import {cx,css} from 'zyzz'; import {controls} from '@acme/variants'; const local=css({color:'red'}); export const props=cx(controls.button(),local());",
        },
        contracts: publisher.contracts,
        imports: {
          'app.ts': { '@acme/variants': '@acme/variants/index.ts', zyzz: null },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:121: Composition cannot mix HTML and React props.]`,
    )
  })
})
