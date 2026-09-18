/** Runs compiled native theme selection through actual React rendering and memoization. @module */
import * as Babel from '@babel/core'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/babel'

const require = Module.createRequire(
  Path.resolve('examples/expo-native/package.json'),
)
const preset = Module.createRequire(
  require.resolve('expo/package.json'),
).resolve('babel-preset-expo')

test('switches schemes and themes through imported styles in memoized consumers without remounting', async () => {
  const modules = {
    'Theme.ts': `import { Config } from 'zyzz'; export const config = Config.create({ themes: { base: { color: { ink: { light: '#112233', dark: '#ddeeff' } } }, alternate: { color: { ink: { light: '#ff0000', dark: '#0000ff' } } } }, defaultTheme: 'base' }); export const { style, variants } = config;`,
    'Styles.ts': `import { style, variants, config } from './Theme.js'; import {style as rawStyle} from 'zyzz'; export const plain = rawStyle({color:config.theme.tokens.color.ink}); export const ink = style({ color: 'ink' }); export const meter = style((v: { opacity: number }) => ({ color: 'ink', opacity: v.opacity })); export const cached = ink(); export const card = variants({ base: { color: 'ink' }, variants: { selected: { true: { opacity: 0.5 } } } });`,
    'App.tsx': `import * as React from 'react'; import {createRoot} from 'react-dom/client'; import {Provider} from 'zyzz/react-native/react'; import {ink, meter, card, cached, plain} from './Styles.js';
      import {style as localStyle, variants as localVariants} from './Theme.js'; const local = localStyle({color:'ink'});
      const localMeter = localStyle((values:{opacity:number}) => ({color:'ink',opacity:values.opacity}));
      const localCard = localVariants({base:{color:'ink'},variants:{active:{true:{opacity:0.8},false:{opacity:0.3}}}});
      let evaluations = 0; function input() { evaluations++; return {opacity:0.6} }
      let replaced = localStyle({color:'ink'}); replaced = () => ({style:{color:'#445566'}});
      function Shadow({local}) { return <span id="shadow" style={local().style}>shadow</span> }
      function Callback({style}) { const before = evaluations; const result = <><span id="local" style={local().style}>local</span><span id="local-meter" style={localMeter(input()).style}>meter</span><span id="local-card" style={localCard({active:true}).style}>card</span><span id="replaced" style={replaced().style}>replaced</span><Shadow local={() => ({style:{color:'#778899'}})} /><span id="callback" style={Object.assign({}, ...style({pressed:true}))}>callback</span></>; if (evaluations !== before + 1) throw new Error('Native input must evaluate once'); return result }
      const Sample = React.memo(() => { const [count, setCount] = React.useState(0); return <div><button id="count" onClick={() => setCount(count + 1)}>{count}</button><span id="ink" {...ink()}>ink</span><span id="cached" {...cached}>cached</span><span id="plain" {...plain()}>plain</span><span id="meter" style={meter({opacity:0.7}).style}>meter</span><span id="card" {...card({selected:true})}>card</span><Callback style={({pressed}) => [ink().style, {opacity: pressed ? 0.4 : 1}]} /></div> });
      function App() { const [scheme, setScheme] = React.useState('light'); const [theme,setTheme] = React.useState('base'); return <Provider colorScheme={scheme} theme={theme}><button id="scheme" onClick={() => setScheme(scheme === 'light' ? 'dark' : 'light')}>scheme</button><button id="theme" onClick={() => setTheme(theme === 'base' ? 'alternate' : 'base')}>theme</button><Sample /></Provider> }
      function Independent() { return <span id="independent" {...ink()}>independent</span> } createRoot(document.getElementById('root')!).render(<App />); createRoot(document.getElementById('second')!).render(<Provider colorScheme="light" theme="base"><Independent /></Provider>);`,
  }
  const root = await Fs.mkdtemp(Path.resolve('.fixture-native-context-'))
  const browser = await chromium.launch()
  try {
    for (const [moduleId, source] of Object.entries(modules)) {
      const result = Babel.transformSync(source, {
        babelrc: false,
        configFile: false,
        caller: { name: 'test', supportsStaticESM: true },
        filename: Path.join(root, moduleId),
        plugins: [
          [zyzz, { target: 'native', platform: 'ios', modules, moduleId }],
        ],
        presets: [
          [preset, { jsxRuntime: 'classic', enableBabelRuntime: false }],
        ],
      })!
      await Fs.writeFile(
        Path.join(root, moduleId.replace(/\.tsx?$/, '.js')),
        result.code!,
      )
    }
    const bundle = await Esbuild.build({
      entryPoints: [Path.join(root, 'App.js')],
      bundle: true,
      write: false,
      conditions: ['src'],
      format: 'iife',
      platform: 'browser',
      define: { 'process.env.NODE_ENV': '"development"' },
    })
    const page = await browser.newPage()
    await page.setContent('<div id="root"></div><div id="second"></div>')
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
    const color = () =>
      page
        .locator('#ink')
        .evaluate((element) => getComputedStyle(element).color)
    expect(await color()).toBe('rgb(17, 34, 51)')
    expect(
      await page
        .locator('#local')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot('"rgb(17, 34, 51)"')
    await page.locator('#count').click()
    await page.locator('#scheme').click()
    expect(await color()).toBe('rgb(221, 238, 255)')
    expect(
      await page
        .locator('#local')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot('"rgb(221, 238, 255)"')
    await page.locator('#theme').click()
    expect(await color()).toBe('rgb(0, 0, 255)')
    expect(
      await page
        .locator('#local')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
    expect(
      await page
        .locator('#meter')
        .evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element).opacity,
        ]),
    ).toEqual(['rgb(0, 0, 255)', '0.7'])
    expect(
      await page
        .locator('#card')
        .evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element).opacity,
        ]),
    ).toEqual(['rgb(0, 0, 255)', '0.5'])
    expect(
      await page
        .locator('#callback')
        .evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element).opacity,
        ]),
    ).toEqual(['rgb(0, 0, 255)', '0.4'])
    expect(
      await page
        .locator('#plain')
        .evaluate((element) => getComputedStyle(element).color),
    ).toBe('rgb(0, 0, 255)')
    expect(await page.locator('#count').textContent()).toBe('1')
    expect(
      await page
        .locator('#local-meter')
        .evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element).opacity,
        ]),
    ).toMatchInlineSnapshot(`
      [
        "rgb(0, 0, 255)",
        "0.6",
      ]
    `)
    expect(
      await page
        .locator('#local-card')
        .evaluate((element) => [
          getComputedStyle(element).color,
          getComputedStyle(element).opacity,
        ]),
    ).toMatchInlineSnapshot(`
      [
        "rgb(0, 0, 255)",
        "0.8",
      ]
    `)
    expect(
      await page
        .locator('#replaced')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot('"rgb(68, 85, 102)"')
    expect(
      await page
        .locator('#shadow')
        .evaluate((element) => getComputedStyle(element).color),
    ).toMatchInlineSnapshot('"rgb(119, 136, 153)"')
    expect(
      await page
        .locator('#cached')
        .evaluate((element) => getComputedStyle(element).color),
    ).toBe('rgb(0, 0, 255)')
    expect(
      await page
        .locator('#independent')
        .evaluate((element) => getComputedStyle(element).color),
    ).toBe('rgb(17, 34, 51)')
  } finally {
    await browser.close()
    await Fs.rm(root, { recursive: true, force: true })
  }
})
