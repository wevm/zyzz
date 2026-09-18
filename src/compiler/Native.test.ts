/** Exercises shared authoring through native code generation and real module execution. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Esbuild from 'esbuild'
import * as Parser from 'oxc-parser'
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Native, Transform } from 'zyzz/compiler'
import { StyleSheet } from 'zyzz/react-native'
import { Native as Runtime } from 'zyzz/runtime'

const source = `import {variants,style,cx as mix} from 'zyzz';
export const card=variants({
  base:{fontSize:'10px',lineHeight:1.5,opacity:0.2},
  variants:{size:{small:{fontSize:'12px'},large:{fontSize:'20px'}},active:{true:{opacity:0.5},false:{opacity:0.8}}},
  defaultVariants:{size:'small',active:false},
  compoundVariants:[{when:{size:'large',active:true},style:{targets:{native:{transform:[{scale:2}]},ios:{opacity:0.7}}}}],
});
const overlay=style({opacity:0.9});
export const compose=(active:boolean)=>mix(card({size:'large',active:true}),active&&overlay());
export function shadow(mix:(value:number)=>number){return mix(2)}
`

async function execute(code: string) {
  const result = await Esbuild.build({
    stdin: { contents: code, loader: 'ts', resolveDir: process.cwd() },
    alias: {
      zyzz: `${process.cwd()}/src/index.ts`,
      'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts`,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  })
  return (await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0]!.text).toString('base64')}`
  )) as {
    results: unknown
    card: Runtime.Callable<{
      size: readonly ['small', 'large']
      active: readonly ['true', 'false']
    }>
    compose: (active: boolean) => Runtime.Props
    shadow: (fn: (value: number) => number) => number
  }
}

describe('compile', () => {
  test('executes static batches across independent theme contracts', async () => {
    const output = Graph.compile({
      modules: {
        'styles.ts': `import {Config,style} from 'zyzz';import {NativeContext} from 'zyzz/runtime';
          const {style:a}=Config.create({themes:{base:{spacing:{cell:'2px'}},alternate:{spacing:{cell:'6px'}}},defaultTheme:'base'});
          const {style:b}=Config.create({themes:{base:{spacing:{cell:'4px'}},alternate:{spacing:{cell:'8px'}}},defaultTheme:'base'});
          const a1=a({width:'cell'});const a2=a({height:'cell'});
          const b1=b({width:'cell'});const b2=b({height:'cell'});
          const plain1=style({fontSize:'10px',lineHeight:1.5});
          const plain2=style({opacity:0.2,targets:{ios:{opacity:0.7}}});
          export const results=[a1,a2,b1,b2,plain1,plain2].map(value=>NativeContext.resolve(value().style,{theme:'alternate',colorScheme:'dark'}));`,
      },
      native: {
        colorScheme: 'light',
        contextual: true,
        platform: 'ios',
        units: { px: 1 },
      },
    })
    const module = await execute(output.modules['styles.ts']!.code)

    expect(module.results).toMatchInlineSnapshot(`
      [
        {
          "width": 6,
        },
        {
          "height": 6,
        },
        {
          "width": 8,
        },
        {
          "height": 8,
        },
        {
          "fontSize": 10,
          "lineHeight": 15,
        },
        {
          "opacity": 0.7,
        },
      ]
    `)
  })

  test('retains individual error paths when a static batch fails', () => {
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        moduleId: 'styles.ts',
        source: `import {style} from 'zyzz';const first=style({opacity:0.2});const second=style({position:'fixed'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","0","position"]: Unsupported native keyword.
      ["default","dark","0","position"]: Unsupported native keyword.]
    `)
  })

  test('resolves compiled inputs while retaining context errors and ordinary callbacks', async () => {
    const output = Graph.compile({
      modules: {
        'styles.ts': `import {Config} from 'zyzz'; import {NativeContext} from 'zyzz/runtime';
          const {style}=Config.create({themes:{base:{color:{ink:'#112233'}},alternate:{color:{ink:'#0000ff'}}},defaultTheme:'base'});
          const meter=style((value:{width:string})=>({color:'ink',width:value.width}));
          const context={colorScheme:'dark',theme:'alternate'};
          function message(context) { try { NativeContext.resolve(meter,context,{width:'12px'}); return 'no error' } catch(error) { return error.message } }
          const callback=NativeContext.resolve((value)=>({opacity:value.opacity}),context);
          export const results={direct:NativeContext.resolve(meter,context,{width:'12px'}),callback:callback({opacity:0.4}),missing:message(undefined),unknown:message({colorScheme:'dark',theme:'missing'})};`,
      },
      native: { colorScheme: 'light', contextual: true },
    })
    const module = await execute(output.modules['styles.ts']!.code)
    expect(module.results).toMatchInlineSnapshot(`
      {
        "callback": {
          "opacity": 0.4,
        },
        "direct": {
          "color": "#0000ff",
          "width": 12,
        },
        "missing": "Compiled native styles require a Zyzz Provider.",
        "unknown": "Unknown native theme: missing.",
      }
    `)
  })

  test('reuses default native props while resolving independent themes and overrides', async () => {
    const source = `import {Config} from 'zyzz';
      import {NativeContext} from 'zyzz/runtime';
      const {style}=Config.create({themes:{base:{color:{ink:{light:'#112233',dark:'#ddeeff'}}},alternate:{color:{ink:{light:'#ff0000',dark:'#0000ff'}}}},defaultTheme:'base'});
      const ink=style({color:'ink'});
      const defaults=ink();
      const override={opacity:0.4};
      const applied=ink({style:override});
      const light={colorScheme:'light',theme:'base'} as const;
      const dark={colorScheme:'dark',theme:'alternate'} as const;
      const resolve=(value,context)=>NativeContext.resolve(value.style,context);
      const first=resolve(defaults,light);
      const second=resolve(defaults,dark);
      const overridden=resolve(applied,dark);
      override.opacity=0.8;
      export const results={same:defaults===ink(),frozen:Object.isFrozen(defaults)&&Object.isFrozen(defaults.style),first,second,again:resolve(defaults,light),override:overridden[1]===override,opacity:overridden[1].opacity,callerFrozen:Object.isFrozen(override)};`
    const output = Graph.compile({
      modules: { 'styles.ts': source },
      native: { colorScheme: 'light', contextual: true },
    })

    expect((await execute(output.modules['styles.ts']!.code)).results).toEqual({
      same: true,
      frozen: true,
      first: { color: '#112233' },
      second: { color: '#0000ff' },
      again: { color: '#112233' },
      override: true,
      opacity: 0.8,
      callerFrozen: false,
    })
  })

  test('shares identical scheme tables while retaining contextual selection', async () => {
    const output = Native.compile({
      moduleId: 'shared.ts',
      colorScheme: 'light',
      contextual: true,
      source: `import {style} from 'zyzz';
        import {NativeContext} from 'zyzz/runtime';
        const card=style({opacity:0.5});
        const props=card();
        const light=NativeContext.resolve(props.style,{colorScheme:'light'});
        const dark=NativeContext.resolve(props.style,{colorScheme:'dark'});
        let missing='';try{NativeContext.resolve(props.style,undefined)}catch(error){missing=error.message}
        export const results={light,dark,same:light===dark,frozen:Object.isFrozen(light),missing};`,
    })

    expect((await execute(output.code)).results).toEqual({
      light: { opacity: 0.5 },
      dark: { opacity: 0.5 },
      same: true,
      frozen: true,
      missing: 'Compiled native styles require a Zyzz Provider.',
    })
  })

  test('reuses static defaults without bypassing input validation', async () => {
    const output = Native.compile({
      moduleId: 'static.ts',
      colorScheme: 'light',
      source: `import {style} from 'zyzz';
        const card=style({opacity:0.5});
        const first=card();
        const override={opacity:0.8};
        let error='';try{card({unknown:true})}catch(value){error=value.message}
        export const results={same:first===card(),frozen:Object.isFrozen(first),empty:card({}),override:card({style:override}).style[1]===override,error};`,
    })

    expect((await execute(output.code)).results).toEqual({
      same: true,
      frozen: true,
      empty: { style: { opacity: 0.5 } },
      override: true,
      error: 'Unknown native recipe input: unknown.',
    })
  })

  test('executes dynamic scalars and selected variant payloads in authored order', async () => {
    const source = `import {style,variants} from 'zyzz';
      const bar=style((values:{width:string;alpha:number})=>({width:values.width,opacity:values.alpha,fontSize:'10px',lineHeight:1.5}));
      const card=variants({base:{padding:'2px',opacity:0.1},variants:{size:{custom:(values:{gap:string;alpha:number})=>({padding:values.gap,opacity:values.alpha}),small:{padding:'4px'}}},defaultVariants:{size:{custom:{gap:'3px',alpha:0.5}}},compoundVariants:[{when:{size:'custom'},style:{paddingLeft:'9px'}}]});
      export const results=[bar({width:'12px',alpha:0.8}),bar({width:'20px',alpha:0.2}),card(),card({size:{custom:{gap:'6px',alpha:0.7}}}),card({size:null})];`
    const output = Native.compile({
      moduleId: 'dynamic.ts',
      source,
      colorScheme: 'light',
      units: { px: 2 },
    })
    expect((await execute(output.code)).results).toMatchInlineSnapshot(`
      [
        {
          "style": {
            "fontSize": 20,
            "lineHeight": 30,
            "opacity": 0.8,
            "width": 24,
          },
        },
        {
          "style": {
            "fontSize": 20,
            "lineHeight": 30,
            "opacity": 0.2,
            "width": 40,
          },
        },
        {
          "style": {
            "opacity": 0.5,
            "paddingBottom": 6,
            "paddingLeft": 18,
            "paddingRight": 6,
            "paddingTop": 6,
          },
        },
        {
          "style": {
            "opacity": 0.7,
            "paddingBottom": 12,
            "paddingLeft": 18,
            "paddingRight": 12,
            "paddingTop": 12,
          },
        },
        {
          "style": {
            "opacity": 0.1,
            "paddingBottom": 4,
            "paddingLeft": 4,
            "paddingRight": 4,
            "paddingTop": 4,
          },
        },
      ]
    `)
  })

  test('executes imported and packed dynamic contracts without publisher source', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-native-payload-'))
    try {
      const source = `import {style,variants} from 'zyzz';export const bar=style((values:{alpha:number})=>({opacity:values.alpha}));export const card=variants({variants:{size:{custom:(values:{gap:string})=>({padding:values.gap})}},defaultVariants:{size:{custom:{gap:'3px'}}}});`
      const publisher = Graph.compile({ modules: { 'library.ts': source } })
      const invalid = JSON.parse(publisher.contracts['library.ts']!)
      invalid.version = 22
      expect(() =>
        Graph.compile({
          contracts: { 'invalid.js': JSON.stringify(invalid) },
          modules: {},
        }),
      ).toThrow('Dynamic native contracts require version 23')
      invalid.version = 23
      invalid.exports.bar.style.dynamic.slots.alpha.name = '--z-unknown'
      expect(() =>
        Graph.compile({
          contracts: { 'invalid.js': JSON.stringify(invalid) },
          modules: {},
        }),
      ).toThrow('Invalid packed dynamic slot')
      const file = Path.join(directory, 'library.js')
      const imported = Graph.compile({
        imports: {
          'app.ts': { [file]: 'library.ts' },
          'library.ts': { zyzz: null },
        },
        modules: {
          'library.ts': source,
          'app.ts': `import {bar,card} from ${JSON.stringify(file)};export const results=[bar({alpha:0.6}),card({size:{custom:{gap:'5px'}}})];`,
        },
        native: { colorScheme: 'light' },
      })
      await Fs.writeFile(
        file,
        (
          await Esbuild.transform(imported.modules['library.ts']!.code, {
            loader: 'ts',
            format: 'esm',
          })
        ).code,
      )
      expect((await execute(imported.modules['app.ts']!.code)).results).toEqual(
        [
          { style: { opacity: 0.6 } },
          {
            style: {
              paddingTop: 5,
              paddingRight: 5,
              paddingBottom: 5,
              paddingLeft: 5,
            },
          },
        ],
      )
      await Fs.writeFile(
        file,
        (
          await Esbuild.transform(publisher.modules['library.ts']!.code, {
            loader: 'ts',
            format: 'esm',
          })
        ).code,
      )
      const consumer = `import {bar,card} from ${JSON.stringify(file)};export const results=[bar({alpha:0.4}),card({size:{custom:{gap:'8px'}}}),card()];`
      const compiled = Graph.compile({
        contracts: { [file]: publisher.contracts['library.ts']! },
        imports: { 'app.ts': { [file]: file } },
        modules: { 'app.ts': consumer },
        native: { colorScheme: 'light' },
      })
      expect(
        JSON.parse(publisher.contracts['library.ts']!).version,
      ).toMatchInlineSnapshot('23')
      expect((await execute(compiled.modules['app.ts']!.code)).results)
        .toMatchInlineSnapshot(`
        [
          {
            "style": {
              "opacity": 0.4,
            },
          },
          {
            "style": {
              "paddingBottom": 8,
              "paddingLeft": 8,
              "paddingRight": 8,
              "paddingTop": 8,
            },
          },
          {
            "style": {
              "paddingBottom": 3,
              "paddingLeft": 3,
              "paddingRight": 3,
              "paddingTop": 3,
            },
          },
        ]
      `)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  })

  test('rejects invalid dynamic inputs and preserves caller overrides', async () => {
    const source = `import {style,variants} from 'zyzz';
      const bar=style((values:{width:string;alpha:number})=>({width:values.width,opacity:values.alpha,targets:{native:{transform:[{scale:2}]}}}));
      const card=variants({variants:{size:{custom:(values:{gap:string})=>({padding:values.gap})}}});
      const errors=[];
      for(const input of [{width:'4px'},{width:'4px',alpha:2},{width:'4px',alpha:0.5,unknown:1},{width:'calc(1px + 2px)',alpha:0.5}]){try{bar(input)}catch(error){errors.push(error.message)}}
      try{card({size:'custom'})}catch(error){errors.push(error.message)}
      const override={opacity:0.9};const output=bar({width:'8px',alpha:0.5,style:override});
      export const results={errors,identity:output.style[1]===override,callerFrozen:Object.isFrozen(override),staticFrozen:Object.isFrozen(output.style[0].transform)};`
    const output = Native.compile({
      source,
      moduleId: 'errors.ts',
      colorScheme: 'light',
    })
    expect((await execute(output.code)).results).toMatchInlineSnapshot(`
      {
        "callerFrozen": false,
        "errors": [
          "Missing or invalid native payload: alpha.",
          "Unsupported native numeric value.",
          "Unknown native recipe input: unknown.",
          "Use zero, px, or rem with an explicit rem conversion.",
          "Native payloads require scalar fields.",
        ],
        "identity": true,
        "staticFrozen": true,
      }
    `)
  })

  test('retains opaque values through dynamic calls, replacement and composition', async () => {
    const source = `import {style,variants,cx} from 'zyzz';
      const base=style({opacity:0.2});
      const bar=style((input:{alpha:number})=>({opacity:input.alpha}));
      const card=variants({variants:{size:{custom:(input:{gap:string})=>({padding:input.gap})}}});
      const first={}; const second={};
      Object.defineProperty(first,'inspect',{get(){throw new Error('Opaque values must not be traversed')}});
      const override={opacity:first,color:second,transform:[{translateX:first}]};
      const nested=[false,[override,null]];
      const applied=bar({alpha:0.3,style:nested});
      const replaced=bar({alpha:0.7,style:{opacity:second}});
      const selected=card({size:{custom:{gap:'8px'}},style:nested});
      const combined=cx(base(),applied,false,selected,replaced);
      first.current=0.9;
      export const results={nested:applied.style[1]===nested,selected:selected.style[1]===nested,first:applied.style[1][1][0].opacity===first,second:replaced.style[1].opacity===second,composed:combined.style[1]===applied.style&&combined.style[2]===selected.style&&combined.style[3]===replaced.style,updated:combined.style[1][1][1][0].opacity.current,frozen:[Object.isFrozen(first),Object.isFrozen(second),Object.isFrozen(override),Object.isFrozen(nested)]};`
    const compiled = Native.compile({
      source,
      moduleId: 'opaque.ts',
      colorScheme: 'light',
    })
    expect((await execute(compiled.code)).results).toEqual({
      nested: true,
      selected: true,
      first: true,
      second: true,
      composed: true,
      updated: 0.9,
      frozen: [false, false, false, false],
    })
  })

  test('invalidates a reused native context after scheme changes', () => {
    const compiler = Graph.create()
    const modules = {
      'card.ts': `import {Config} from 'zyzz';const {style}=Config.create({theme:{color:{ink:{light:'#000000',dark:'#ffffff'}}}});export const card=style({color:'ink'});`,
    }
    const native: NonNullable<Graph.compile.Options['native']> & {
      colorScheme: 'dark' | 'light'
    } = { colorScheme: 'light' }
    const light = compiler.compile({ modules, native })
    native.colorScheme = 'dark'
    const dark = compiler.compile({ modules, native })
    expect(
      light.modules['card.ts']!.code.includes('#000000'),
    ).toMatchInlineSnapshot('true')
    expect(
      dark.modules['card.ts']!.code.includes('#ffffff'),
    ).toMatchInlineSnapshot('true')
    expect(
      compiler.compile({ modules, native }) === dark,
    ).toMatchInlineSnapshot('true')
  })

  test('preserves explicit exports over packed star exports', () => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {style} from 'zyzz';export const card=style({opacity:0.5});`,
      },
    })
    for (const source of [
      `export const card=()=>({style:{opacity:0.2}});export * from 'library';`,
      `export const {card}={card:()=>({style:{opacity:0.2}})};export * from 'library';`,
      `export * from 'library';export * from 'library';`,
    ]) {
      const output = Graph.compile({
        contracts: { 'library.js': library.contracts['library.ts']! },
        imports: { 'app.ts': { library: 'library.js' } },
        modules: { 'app.ts': source },
        native: { colorScheme: 'light' },
      })
      expect(
        Parser.parseSync('app.ts', output.modules['app.ts']!.code).errors,
      ).toMatchInlineSnapshot('[]')
      if (source.startsWith('export const'))
        expect(
          output.modules['app.ts']!.code.includes('as "card"'),
        ).toMatchInlineSnapshot('false')
      else
        expect(
          output.modules['app.ts']!.code.match(/as "card"/g)?.length,
        ).toMatchInlineSnapshot('1')
    }
  })

  test('executes native callables with defaults, nulls and ordered composition', async () => {
    const result = Native.compile({
      moduleId: 'card.ts',
      source,
      platform: 'ios',
      colorScheme: 'light',
    })
    const module = await execute(result.code)
    expect(StyleSheet.flatten(module.card().style)).toMatchInlineSnapshot(`
      {
        "fontSize": 12,
        "lineHeight": 18,
        "opacity": 0.8,
      }
    `)
    expect(StyleSheet.flatten(module.card({ size: null, active: null }).style))
      .toMatchInlineSnapshot(`
      {
        "fontSize": 10,
        "lineHeight": 15,
        "opacity": 0.2,
      }
    `)
    expect(StyleSheet.flatten(module.compose(false).style))
      .toMatchInlineSnapshot(`
      {
        "fontSize": 20,
        "lineHeight": 30,
        "opacity": 0.7,
        "transform": [
          {
            "scale": 2,
          },
        ],
      }
    `)
    expect(
      StyleSheet.flatten(module.compose(true).style)?.opacity,
    ).toMatchInlineSnapshot('0.9')
    expect(
      module.card().style === module.card({ size: undefined }).style,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(module.card().style)).toMatchInlineSnapshot('true')
    expect(() =>
      Runtime.compose({ style: undefined, className: 'web' } as Runtime.Props),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Native.SelectionError: Native composition requires native style props.]',
    )
    expect(module.shadow((value) => value + 1)).toMatchInlineSnapshot('3')
    const override = { transform: [{ rotate: '45deg' as const }] }
    const props = module.card({ style: [false, [override]] })
    expect(
      StyleSheet.flatten(props.style)?.transform === override.transform,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(override.transform)).toMatchInlineSnapshot('false')
    expect(() =>
      module.card({ size: 'unknown' as 'small' }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Native.SelectionError: Unknown native recipe choice for size.]',
    )
    expect(
      Transform.compile({
        moduleId: 'card.ts',
        source: source.slice(0, source.indexOf('const overlay')),
      }).css.includes('data-size'),
    ).toMatchInlineSnapshot('true')
  })

  test.each([
    `export const compose=()=>props;const props=cx({style:{opacity:0.5}});import {cx} from 'zyzz';`,
    `"use client";const card=style({opacity:0.5});const props=mix(card());export const compose=()=>props;import {cx as mix,style} from 'zyzz';`,
  ])('preserves composition before its import: %s', async (source) => {
    const output = Native.compile({
      source,
      moduleId: 'hoisted.ts',
      colorScheme: 'light',
    })
    const module = await execute(output.code)

    expect(StyleSheet.flatten(module.compose(false).style))
      .toMatchInlineSnapshot(`
      {
        "opacity": 0.5,
      }
    `)
  })

  test.each([
    ['#!/usr/bin/env node\n', []],
    ['"use client"\n', ['use client']],
    [
      '#!/usr/bin/env node\n"use client";\n"use strict"\n',
      ['use client', 'use strict'],
    ],
  ] as const)(
    'preserves module prologues: %s',
    async (prologue, directives) => {
      const output = Native.compile({
        source: `${prologue}${source}`,
        moduleId: 'prologue.ts',
        platform: 'ios',
        colorScheme: 'light',
      })
      const parsed = Parser.parseSync('prologue.ts', output.code)

      expect(parsed.errors).toMatchInlineSnapshot('[]')
      expect(output.code.startsWith(prologue.trimEnd())).toMatchInlineSnapshot(
        'true',
      )
      expect(
        JSON.stringify(
          parsed.program.body
            .filter(
              (node) => node.type === 'ExpressionStatement' && node.directive,
            )
            .map(
              (node) => node.type === 'ExpressionStatement' && node.directive,
            ),
        ) === JSON.stringify(directives),
      ).toMatchInlineSnapshot('true')
      const module = await execute(output.code)
      expect(
        StyleSheet.flatten(module.compose(true).style)?.opacity,
      ).toMatchInlineSnapshot('0.9')
    },
  )

  test.each(['Z.cx', "Z['cx']"])('rejects namespace composition: %s', (cx) => {
    expect(() =>
      Native.compile({
        source: `import {style} from 'zyzz';import * as Z from 'zyzz';const card=style({opacity:0.5});export const composed=${cx}(card());`,
        moduleId: 'namespace.ts',
        colorScheme: 'light',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: namespace.ts:107: Import cx by name; namespace authoring calls are not supported yet.]`,
    )
  })

  test('compiles local configured tokens for explicit schemes', async () => {
    const source = `import {Config} from 'zyzz';
const config=Config.create({theme:{color:{ink:{light:'#000',dark:'#fff'}}}});
export const card=config.variants({base:{color:'ink'},variants:{tone:{quiet:{opacity:0.5}}},defaultVariants:{tone:'quiet'}});`
    const light = await execute(
      Native.compile({ source, moduleId: 'theme.ts', colorScheme: 'light' })
        .code,
    )
    const dark = await execute(
      Native.compile({ source, moduleId: 'theme.ts', colorScheme: 'dark' })
        .code,
    )
    expect(StyleSheet.flatten(light.card().style)?.color).toMatchInlineSnapshot(
      '"#000"',
    )
    expect(StyleSheet.flatten(dark.card().style)?.color).toMatchInlineSnapshot(
      '"#fff"',
    )
  })

  test.each([false, true])(
    'type-checks emitted callables with contextual=%s through published runtime declarations',
    async (contextual) => {
      const directory = await Fs.mkdtemp(
        Path.resolve('.fixture-native-callable-'),
      )
      try {
        await Fs.writeFile(
          Path.join(directory, 'compiled.ts'),
          Native.compile({
            source:
              source +
              `export const bar=style((value:{alpha:number})=>({opacity:value.alpha}));export const custom=variants({variants:{size:{custom:(value:{gap:string})=>({padding:value.gap})}},defaultVariants:{size:{custom:{gap:'2px'}}}});`,
            moduleId: 'compiled.ts',
            platform: 'ios',
            colorScheme: 'light',
            contextual,
          }).code,
        )
        const consumer = Path.join(directory, 'consumer.ts')
        await Fs.writeFile(
          consumer,
          `import {bar,card,compose,custom} from './compiled.js';
const opaque={tag:Symbol('host')};
const native={opacity:opaque,color:opaque};
bar({alpha:0.5,style:native});
card({style:[false,[native]]});
custom({size:{custom:{gap:'8px'}},style:native});
bar({alpha:0.5});
custom();
custom({size:{custom:{gap:'8px'}}});
// @ts-expect-error Dynamic styles require their values.
bar();
// @ts-expect-error Dynamic field types survive compilation.
bar({alpha:'bad'});
// @ts-expect-error Dynamic choices require scoped payloads.
custom({size:'custom'});
// @ts-expect-error Payload field types survive compilation.
custom({size:{custom:{gap:8}}});
card({size:'small',active:true});
card({size:null,style:[false,{opacity:0.5}]});
compose(false);
// @ts-expect-error Unknown choices remain rejected after transformation.
card({size:'missing'});
// @ts-expect-error Native callables reject class props.
card({className:'web'});
// @ts-expect-error Boolean axes retain their boolean input.
card({active:'true'});
// @ts-expect-error Native output has no className.
card().className;
`,
        )
        await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            Path.resolve('node_modules/typescript/bin/tsc'),
            '--noEmit',
            '--module',
            'nodenext',
            '--target',
            'esnext',
            '--strict',
            '--skipLibCheck',
            consumer,
          ],
          { timeout: 30000 },
        )
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    },
    35000,
  )

  test.each([0, 65_536])(
    'retains source mappings and helper names with %i characters of Unicode comments',
    async (length) => {
      const input = `/*${'😀'.repeat(length / 2)}*/const __zyzzNative=1;\n${source}`
      const output = Native.compile({
        source: input,
        moduleId: 'collision.ts',
        colorScheme: 'dark',
        platform: 'android',
      })
      const module = await execute(output.code)
      expect(
        StyleSheet.flatten(module.compose(false).style)?.opacity,
      ).toMatchInlineSnapshot('0.5')
      const position = output.code.indexOf('export function shadow')
      const prefix = output.code.slice(0, position).split('\n')
      const original = Trace.originalPositionFor(
        new Trace.TraceMap(output.map),
        {
          line: prefix.length,
          column: prefix.at(-1)!.length,
        },
      )
      expect(original.source).toMatchInlineSnapshot('"collision.ts"')
      expect(original.line).toMatchInlineSnapshot('11')
    },
  )

  test.each([0, 65_536])(
    'compiles asserted imported literals with %i characters of Unicode comments',
    async (length) => {
      const output = Graph.compile({
        modules: {
          'values.ts': `/*${'😀'.repeat(length / 2)}*/export const values = <{opacity: 0.25}>{opacity: 0.25};`,
          'styles.ts': `/*${'😀'.repeat(length / 2)}*/import {style} from 'zyzz';
          import {values} from './values';
          const card=style(values);
          export const results={style:card().style,number:123n.toString(),matched:/😀/u.test('😀')};`,
        },
        native: { colorScheme: 'light' },
      })
      const code = output.modules['styles.ts']!.code.replace(
        "import {values} from './values';",
        '',
      )

      expect((await execute(code)).results).toMatchInlineSnapshot(`
      {
        "matched": true,
        "number": "123",
        "style": {
          "opacity": 0.25,
        },
      }
    `)
    },
  )

  test('rejects native conditions and HTML output', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'native.ts',
        source:
          "import {style} from 'zyzz';export const card=style({opacity:1});",
        target: 'native',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: Use Native.compile for native source output.]',
    )
    for (const definition of [
      `variants({conditions:{wide:'@media (width > 0px)'},variants:{tone:{quiet:{opacity:0.5}}}})`,
    ])
      expect(() =>
        Native.compile({
          moduleId: 'bad.ts',
          colorScheme: 'light',
          source: `import {variants} from 'zyzz';export const card=${definition};`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Native.CompileError: Native source compilation does not support named conditions or HTML output.]',
      )
    expect(() =>
      Native.compile({
        moduleId: 'bad.ts',
        colorScheme: 'light',
        source: `import {style} from 'zyzz';export const card=style({':hover':{opacity:0.5}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["style-ucw0031385wid-45"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
  })
})
