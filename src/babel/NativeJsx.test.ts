/** Verifies native JSX bindings through the Expo and Fast Refresh transforms. @module */
import * as Babel from '@babel/core'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Packed from '../../test/fixtures/Packed.js'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/babel'

const require = Module.createRequire(
  Path.resolve('examples/react-native/package.json'),
)
const expo = Module.createRequire(require.resolve('expo/package.json'))

describe('zyzz', () => {
  test.each([
    ['member', 'const applied=card().style;', 'applied', true],
    ['chain', 'const applied=card().style;const alias=applied;', 'alias', true],
    [
      'array',
      'const applied=card().style;const alias=[applied];',
      'alias',
      true,
    ],
    [
      'spread',
      'const applied=card().style;const props={style:applied};',
      '...props',
      true,
    ],
    ['scope', 'const applied={opacity:0.5};', 'outer', true],
    ['cycle', 'var applied=alias;var alias=applied;', 'alias', false],
    [
      'animated',
      'const applied=useAnimatedStyle(()=>({opacity:withTiming(0.5)}));const alias=[native.box,applied];',
      'alias',
      false,
    ],
  ] as const)(
    'resolves immutable %s aliases through the native Expo transform',
    async (_, setup, value, resolved) => {
      const source = `import Animated,{useAnimatedStyle,withTiming} from 'react-native-reanimated';
      import {StyleSheet} from 'react-native';import {card} from './Styles.js';
      const native=StyleSheet.create({box:{height:20}});const applied=card().style;const outer=applied;
      function App(){${setup}return <Animated.View ${value.startsWith('...') ? `{${value}}` : `style={${value}}`}/>}`
      const directory = await Fs.mkdtemp(Path.resolve('.fixture-native-alias-'))
      const filename = Path.join(directory, 'App.tsx')

      try {
        await Fs.writeFile(filename, source)
        const result = Babel.transformSync(source, {
          babelrc: false,
          configFile: false,
          filename,
          plugins: [
            [
              zyzz,
              {
                moduleId: 'App.tsx',
                modules: {
                  'App.tsx': source,
                  'Styles.ts':
                    "import {style} from 'zyzz';export const card=style({opacity:0.7});",
                },
                platform: 'ios',
                target: 'native',
              },
            ],
          ],
          presets: [
            [expo.resolve('babel-preset-expo'), { enableBabelRuntime: false }],
          ],
        })

        if (resolved)
          expect(result?.code?.includes('useStyles')).toMatchInlineSnapshot(
            'true',
          )
        else
          expect(result?.code?.includes('useStyles')).toMatchInlineSnapshot(
            'false',
          )
      } finally {
        await Fs.rm(directory, { force: true, recursive: true })
      }
    },
  )

  test.each(['named', 'namespace'])(
    'lets withStyles own class JSX and local recipe inputs with %s imports',
    async (kind) => {
      const source = `import * as React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'zyzz/react-native/react';
      ${kind === 'named' ? "import {withStyles as wrap} from 'zyzz/react-native/react';" : "import * as Native from 'zyzz/react-native/react';"}
      import {style,variants} from 'zyzz';
      const card=style({opacity:0.5});const button=variants({variants:{large:{true:{width:'20px'},false:{width:'10px'}}}});
      class Card extends React.Component {render(){return React.createElement('pre',{id:this.props.id},JSON.stringify({style:this.props.style,content:this.props.contentContainerStyle}))}}
      const Wrapped=${kind === 'named' ? 'wrap' : 'Native.withStyles'}(Card);
      class Sample extends React.Component {render(){return <Wrapped id="class" style={button({large:true}).style}/>}}
      function App(){return <Wrapped id="function" {...card()} style={card().style} contentContainerStyle={card().style}/>}
      createRoot(document.getElementById('app')).render(React.createElement(Provider,{colorScheme:'light'},React.createElement(React.Fragment,null,React.createElement(Sample),React.createElement(App))));`
      const result = Babel.transformSync(source, {
        babelrc: false,
        configFile: false,
        filename: 'App.tsx',
        plugins: [[zyzz, { platform: 'ios', units: { px: 1 } }]],
        presets: [
          [expo.resolve('babel-preset-expo'), { enableBabelRuntime: false }],
        ],
      })

      expect(result?.code?.includes('useStyles')).toMatchInlineSnapshot('false')
      expect(result?.code?.includes('useNativeStyles')).toMatchInlineSnapshot(
        'false',
      )
      const code = await Packed.bundle({
        entry: 'App.ts',
        modules: { 'App.ts': result!.code! },
      })
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent('<div id="app"></div>')
        await page.addScriptTag({ content: code })
        await expect
          .poll(() => page.locator('#class').textContent())
          .toBeTruthy()
        expect(JSON.parse((await page.locator('#class').textContent())!))
          .toMatchInlineSnapshot(`
          {
            "style": {
              "width": 20,
            },
          }
        `)
        expect(JSON.parse((await page.locator('#function').textContent())!))
          .toMatchInlineSnapshot(`
          {
            "content": {
              "opacity": 0.5,
            },
            "style": {
              "opacity": 0.5,
            },
          }
        `)
      } finally {
        await browser.close()
      }
    },
  )

  test('resolves style-suffixed props on third-party and generic components', async () => {
    const source = `import * as React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'zyzz/react-native/react';
      import {style} from 'zyzz';
      const card=style({opacity:0.5});const ink='#ff0000';
      function Scroll(props:{contentContainerStyle?:unknown;id:string;style?:unknown;tintColor?:string}){return <pre id={props.id}>{JSON.stringify({content:props.contentContainerStyle,style:props.style,tint:props.tintColor})}</pre>}
      function List<Item>(props:{columnWrapperStyle?:unknown;data:readonly Item[];ListHeaderComponentStyle?:unknown}){return <pre id="list">{JSON.stringify({column:props.columnWrapperStyle,count:props.data.length,header:props.ListHeaderComponentStyle})}</pre>}
      class Legacy extends React.Component {render(){return <Scroll id="legacy" contentContainerStyle={{padding:4}}/>}}
      function App(){return <><Scroll id="scroll" contentContainerStyle={card().style} style={card().style} tintColor={ink}/><List<{id:string}> columnWrapperStyle={[card().style,{width:10}]} data={[{id:'a'}]} ListHeaderComponentStyle={card().style}/><Legacy/></>}
      createRoot(document.getElementById('app')).render(React.createElement(Provider,{colorScheme:'light'},React.createElement(App)));`
    const result = Babel.transformSync(source, {
      babelrc: false,
      configFile: false,
      filename: 'App.tsx',
      plugins: [[zyzz, { platform: 'ios', units: { px: 1 } }]],
      presets: [
        [expo.resolve('babel-preset-expo'), { enableBabelRuntime: false }],
      ],
    })

    expect(result?.code?.includes('tintColor:ink')).toMatchInlineSnapshot(
      'true',
    )
    const code = await Packed.bundle({
      entry: 'App.ts',
      modules: { 'App.ts': result!.code! },
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="app"></div>')
      await page.addScriptTag({ content: code })
      await expect
        .poll(() => page.locator('#legacy').textContent())
        .toBeTruthy()
      expect(JSON.parse((await page.locator('#scroll').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "content": {
            "opacity": 0.5,
          },
          "style": {
            "opacity": 0.5,
          },
          "tint": "#ff0000",
        }
      `)
      expect(JSON.parse((await page.locator('#list').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "column": [
            {
              "opacity": 0.5,
            },
            {
              "width": 10,
            },
          ],
          "count": 1,
          "header": {
            "opacity": 0.5,
          },
        }
      `)
      expect(JSON.parse((await page.locator('#legacy').textContent())!))
        .toMatchInlineSnapshot(`
        {
          "content": {
            "padding": 4,
          },
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('resolves third-party style props above and outside a Provider with defaults', async () => {
    const source = `import * as React from 'react';import {createRoot} from 'react-dom/client';import {defineConfig} from 'zyzz/react-native/react';
      const {Provider,style}=defineConfig({defaultVars:'base',vars:{base:{color:{ink:{light:'#ff0000',dark:'#00ff00'}}},alternate:{color:{ink:{light:'#0000ff',dark:'#ffff00'}}}}});
      const root=style({backgroundColor:'ink',flexGrow:1});
      function Gesture(props){return <div id={props.id} data-style={JSON.stringify(props.style)}>{props.children}</div>}
      function Inner(){return <Gesture id="inner" style={root().style}/>}
      function Root(){return <Provider colorScheme="dark" vars="alternate"><Gesture id="root" {...root()}><Inner/></Gesture></Provider>}
      function Outside(){return <Gesture id="outside" style={root().style}/>}
      createRoot(document.getElementById('app')).render(<Root/>);
      createRoot(document.getElementById('plain')).render(<Outside/>);`
    const result = Babel.transformSync(source, {
      babelrc: false,
      configFile: false,
      filename: 'App.tsx',
      plugins: [[zyzz, { platform: 'ios', units: { px: 1 } }]],
      presets: [
        [expo.resolve('babel-preset-expo'), { enableBabelRuntime: false }],
      ],
    })

    const code = await Packed.bundle({
      entry: 'App.ts',
      modules: { 'App.ts': result!.code! },
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="app"></div><div id="plain"></div>')
      await page.addScriptTag({ content: code })
      await expect.poll(() => page.locator('[data-style]').count()).toBe(3)

      expect(
        await page.locator('#root').getAttribute('data-style'),
      ).toMatchInlineSnapshot(`"{"backgroundColor":"#ff0000","flexGrow":1}"`)
      expect(
        await page.locator('#inner').getAttribute('data-style'),
      ).toMatchInlineSnapshot(`"{"backgroundColor":"#ffff00","flexGrow":1}"`)
      expect(
        await page.locator('#outside').getAttribute('data-style'),
      ).toMatchInlineSnapshot(`"{"backgroundColor":"#ff0000","flexGrow":1}"`)
    } finally {
      await browser.close()
    }
  })

  test('keeps hook bindings inside memoized components through Fast Refresh and module lowering', () => {
    const source = `import {memo, useState} from 'react';
      import {View as Box} from 'react-native';
      import * as Native from 'react-native';
      import {card} from './Styles.js';
      const Sample=memo(function Sample(props) {
        const [value]=useState(0);
        return <><Box key={props.id} {...card()} ref={props.ref} style={[card().style,{opacity:value}]}/><Native.Text {...card()}/></>;
      });
      function App(){return <Box style={{opacity:0.5}}><Sample id="card"/></Box>}`
    const caller = { name: 'metro', platform: 'ios', supportsStaticESM: false }
    const result = Babel.transformSync(source, {
      babelrc: false,
      compact: false,
      configFile: false,
      filename: 'App.tsx',
      caller,
      plugins: [
        [
          zyzz,
          {
            target: 'native',
            platform: 'ios',
            moduleId: 'App.tsx',
            modules: {
              'App.tsx': source,
              'Styles.ts':
                "import {style} from 'zyzz';export const card=style({opacity:0.7});",
            },
          },
        ],
        [expo.resolve('react-refresh/babel'), { skipEnvCheck: true }],
      ],
      presets: [
        [expo.resolve('babel-preset-expo'), { enableBabelRuntime: false }],
      ],
    })
    expect(result?.code).toMatchInlineSnapshot(`
      "var _react = require("zyzz/react-native/react");
      var _react2 = require("react");
      var _reactNative = _interopRequireWildcard(require("react-native"));
      var Native = _reactNative;
      var _Styles = require("./Styles.js");
      var _jsxRuntime = require("react/jsx-runtime");
      var _s = $RefreshSig$();
      function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
      function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
      function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
      function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
      function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
      function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
      function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
      var Sample = _s((0, _react2.memo)(_c = _s(function Sample(props) {
        var _zyzzProps;
        _s();
        var _zyzzStyles = (0, _react.useNativeStyles)(),
          _zyzzview = _zyzzStyles.view,
          _zyzznativeStyle = _zyzzStyles.style;
        var _useState = (0, _react2.useState)(0),
          _useState2 = _slicedToArray(_useState, 1),
          value = _useState2[0];
        return (0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
          children: [(0, _react2.createElement)(_reactNative.View, Object.assign({}, _zyzzview(_zyzzProps = Object.assign({
            "key": props.id
          }, (0, _Styles.card)(), {
            "ref": props.ref,
            "style": _zyzznativeStyle([(0, _Styles.card)().style, {
              opacity: value
            }])
          })), {
            key: _zyzzProps.key
          })), (0, _jsxRuntime.jsx)(Native.Text, Object.assign({}, _zyzzview(Object.assign({}, (0, _Styles.card)()))))]
        });
      }, "hMeGOYDHwTuZt8ICyZR2ANpWEfs=")), "hMeGOYDHwTuZt8ICyZR2ANpWEfs=");
      _c2 = Sample;
      function App() {
        var _zyzzStyles2 = (0, _react.useNativeStyles)(),
          _zyzzview2 = _zyzzStyles2.view,
          _zyzznativeStyle2 = _zyzzStyles2.style;
        return (0, _jsxRuntime.jsx)(_reactNative.View, Object.assign({}, _zyzzview2({
          "style": _zyzznativeStyle2({
            opacity: 0.5
          })
        }), {
          children: (0, _jsxRuntime.jsx)(Sample, {
            id: "card"
          })
        }));
      }
      _c3 = App;
      var _c, _c2, _c3;
      $RefreshReg$(_c, "Sample$memo");
      $RefreshReg$(_c2, "Sample");
      $RefreshReg$(_c3, "App");"
    `)
  })
})
