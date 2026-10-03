/** Verifies native JSX bindings through the Expo and Fast Refresh transforms. @module */
import * as Babel from '@babel/core'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/babel'

const require = Module.createRequire(
  Path.resolve('examples/react-native/package.json'),
)
const expo = Module.createRequire(require.resolve('expo/package.json'))

describe('zyzz', () => {
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
