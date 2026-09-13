/** Verifies immutable props bindings and aliases without repeating input evaluation. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

describe('cx', () => {
  for (const output of ['react', 'html']) {
    test(`retains ${output} props aliases, conditional bindings, and initializer order`, async () => {
      const source = `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'${output}'});
        namespace styles {export const value=css((values:{padding:\`\${number}px\`})=>({padding:values.padding}));export const fixed=css({paddingLeft:'3px'})}
        export let reads=0;
        function value(){reads++;return '12px' as const}
        export function apply(enabled:boolean){const props=styles.value({padding:value()});const alias=props;const optional=enabled && styles.fixed();return cx(alias,optional)};`
      const compiled = Transform.compile({ moduleId: 'bindings.ts', source })
      const bundled = await Esbuild.build({
        stdin: {
          contents: compiled.code,
          loader: 'ts',
          resolveDir: process.cwd(),
        },
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
        await page.setContent(`<style>${compiled.css}</style><div></div>`)
        await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
        expect(
          await page.evaluate(`{
          const values=[];
          for(const enabled of [false,true]) {
            const props=App.apply(enabled);const element=document.querySelector('div');
            for(const name of element.getAttributeNames())element.removeAttribute(name);
            if('class' in props) for(const [name,value]of Object.entries(props))element.setAttribute(name,value);
            else {element.className=props.className;for(const [name,value]of Object.entries(props.style??{}))element.style.setProperty(name,String(value))}
            values.push(getComputedStyle(element).padding);
          }
          [values,App.reads];
        }`),
        ).toEqual([['12px', '12px 12px 12px 3px'], 2])
      } finally {
        await browser.close()
      }
    })
  }

  test('rejects escaping or mutated props identities', () => {
    for (const use of [
      "p.className='changed';",
      'mutate(p);',
      'const alias=p;mutate(alias);',
    ]) {
      expect(() =>
        Transform.compile({
          moduleId: 'escape.ts',
          source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=a();${use}export const props=cx(p);`,
        }),
      ).toThrow('must not escape')
    }
    expect(() =>
      Transform.compile({
        moduleId: 'escape.ts',
        source: `import {css,cx}from'zyzz';const a=css({color:'red'});const p=a();export const props=cx(p,a(mutate(p)));`,
      }),
    ).toThrow('must not escape')
  })
})
