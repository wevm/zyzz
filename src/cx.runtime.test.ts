/** Verifies fixed-sequence composition of payloads and recipe attributes in Chromium. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

describe('cx', () => {
  test('merges bindings in argument order and clears repeated recipe ownership', async () => {
    const source = `import {css,cx,variants} from 'zyzz';
      namespace styles {
        export const dynamic=css((values:{padding:\`\${number}px\`})=>({padding:values.padding}));
        export const override=css({paddingLeft:'3px'});
        export const recipe=variants({base:{color:'black'},variants:{tone:{red:{color:'red'},custom:(values:{color:'red'|'blue'})=>({color:values.color})}}});
      }
      export const apply=(padding:\`\${number}px\`)=>cx(styles.dynamic({padding}),styles.override());
      export const optional=(enabled:boolean)=>cx(styles.dynamic({padding:'8px'}),enabled && styles.override());
      export const nestedOptional=(enabled:boolean)=>cx(styles.dynamic({padding:'7px'}),cx(enabled && styles.override()));
      export const inline=()=>cx(styles.dynamic({padding:'8px',style:{padding:'20px'},className:'external'}),styles.override({style:{paddingLeft:'9px'}}),styles.dynamic({padding:'12px',style:{padding:'24px'}}));
      export const repeat=()=>cx(styles.dynamic({padding:'8px'}),styles.override(),styles.dynamic({padding:'12px'}));
      export const clear=()=>cx(styles.recipe({tone:{custom:{color:'blue'}}}),styles.recipe({tone:null}));
      export const nested=()=>cx(cx(styles.dynamic({padding:'9px'}),styles.override()),styles.recipe({tone:'red'}));`
    const output = Transform.compile({ moduleId: 'runtime.ts', source })
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>button{padding:0}${output.css}</style><button>Button</button>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      const count = await page.evaluate(
        () => document.styleSheets[0]!.cssRules.length,
      )
      await page.evaluate(`window.read=(props)=>{
        const element=document.querySelector('button');
        for(const name of element.getAttributeNames()) element.removeAttribute(name);
        element.className=props.className;
        for(const [key,value] of Object.entries(props)) {
          if(key.startsWith('data-')) element.setAttribute(key,value);
          if(key==='style') for(const [name,bound] of Object.entries(value)) name.startsWith('--')?element.style.setProperty(name,String(bound)):element.style[name]=String(bound);
        }
        const style=getComputedStyle(element);
        return {padding:style.padding,color:style.color,keys:Object.keys(props).sort(),slots:Object.keys(props.style??{}).length};
      }`)
      expect(await page.evaluate("read(App.apply('16px'))")).toEqual({
        padding: '16px 16px 16px 3px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.optional(false))')).toEqual({
        padding: '8px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.optional(true))')).toEqual({
        padding: '8px 8px 8px 3px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.nestedOptional(false))')).toEqual({
        padding: '7px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.nestedOptional(true))')).toEqual({
        padding: '7px 7px 7px 3px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.inline())')).toEqual({
        padding: '24px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 3,
      })
      expect(
        await page.evaluate(
          "document.querySelector('button').classList.contains('external')",
        ),
      ).toBe(true)
      expect(await page.evaluate('read(App.repeat())')).toEqual({
        padding: '12px',
        color: 'rgb(0, 0, 0)',
        keys: ['className', 'style'],
        slots: 1,
      })
      expect(await page.evaluate('read(App.clear())')).toEqual({
        padding: '0px',
        color: 'rgb(0, 0, 0)',
        keys: ['className'],
        slots: 0,
      })
      expect(await page.evaluate('read(App.nested())')).toEqual({
        padding: '9px 9px 9px 3px',
        color: 'rgb(255, 0, 0)',
        keys: ['className', 'data-tone', 'style'],
        slots: 1,
      })
      expect(
        await page.evaluate(() => document.styleSheets[0]!.cssRules.length),
      ).toBe(count)
    } finally {
      await browser.close()
    }
  })

  test('composes HTML payloads without parsing serialized styles or leaking metadata', async () => {
    const source = `import {Config,cx} from 'zyzz';const {css,variants}=Config.create({output:'html'});
      namespace styles {
        export const value=css((values:{padding:\`\${number}px\`})=>({padding:values.padding}));
        export const fixed=css({paddingLeft:'3px'});
        export const recipe=variants({base:{color:'black'},variants:{tone:{custom:(values:{color:'red'|'blue'})=>({color:values.color})}}});
      }
      export const props=(enabled:boolean)=>cx(styles.value({padding:'16px'}),enabled && styles.fixed(),styles.recipe({tone:{custom:{color:'blue'}}}));
      export const clear=()=>cx(styles.recipe({tone:{custom:{color:'red'}}}),styles.recipe({tone:null}));
      export const nested=()=>cx(cx(styles.fixed(),styles.fixed()),styles.value({padding:'12px'}));`
    const output = Transform.compile({ moduleId: 'html.ts', source })
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-compose-html-'))
    try {
      const path = Path.join(directory, 'html.ts')
      await Fs.writeFile(path, output.code)
      await Util.promisify(ChildProcess.execFile)(process.execPath, [
        Path.resolve('node_modules/typescript/bin/tsc'),
        '--customConditions',
        'src',
        '--strict',
        '--module',
        'nodenext',
        '--target',
        'esnext',
        '--skipLibCheck',
        '--noEmit',
        path,
      ]).catch((error: unknown) => {
        throw new Error((error as { stdout: string }).stdout, { cause: error })
      })
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }

    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>button{padding:0}${output.css}</style><button>Button</button>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(
        `window.read=(props)=>{const element=document.querySelector('button');for(const name of element.getAttributeNames())element.removeAttribute(name);for(const [name,value] of Object.entries(props))element.setAttribute(name,value);const style=getComputedStyle(element);return [style.padding,style.color,element.getAttributeNames().sort()]}`,
      )
      expect(await page.evaluate('read(App.props(true))')).toEqual([
        '16px 16px 16px 3px',
        'rgb(0, 0, 255)',
        ['class', 'data-tone', 'style'],
      ])
      expect(await page.evaluate('read(App.props(false))')).toEqual([
        '16px',
        'rgb(0, 0, 255)',
        ['class', 'data-tone', 'style'],
      ])
      expect(await page.evaluate('read(App.clear())')).toEqual([
        '0px',
        'rgb(0, 0, 0)',
        ['class'],
      ])
      expect(await page.evaluate('read(App.nested())')).toEqual([
        '12px',
        'rgb(0, 0, 0)',
        ['class', 'style'],
      ])
    } finally {
      await browser.close()
    }
  }, 30000)

  test('bounds conditional expansion and rejects mixed renderer outputs', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'limit.ts',
        source: `import {css,cx} from 'zyzz';const a=css({color:'red'});export const props=(enabled:boolean)=>cx(${Array.from({ length: 9 }, () => 'enabled && a()').join(',')});`,
      }),
    ).toThrow('eight conditional arguments')
    expect(() =>
      Transform.compile({
        moduleId: 'mixed.ts',
        source: `import {css,cx,Config} from 'zyzz';const {css:html}=Config.create({output:'html'});const a=css({color:'red'});const b=html({color:'blue'});export const props=cx(a(),b());`,
      }),
    ).toThrow('mix HTML and React')
  })

  test('reports conflicting recipe attribute owners at compilation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {cx,variants} from 'zyzz';const a=variants({variants:{tone:{red:{color:'red'}}}});const b=variants({variants:{tone:{blue:{color:'blue'}}}});export const props=cx(a(),b());`,
      }),
    ).toThrow('conflicting owners')
  })
})
