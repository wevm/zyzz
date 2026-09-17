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
    card: Runtime.Callable<{
      size: readonly ['small', 'large']
      active: readonly ['true', 'false']
    }>
    compose: (active: boolean) => Runtime.Props
    shadow: (fn: (value: number) => number) => number
  }
}

describe('compile', () => {
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

  test('type-checks emitted callables through published runtime declarations', async () => {
    const directory = await Fs.mkdtemp(
      Path.resolve('.fixture-native-callable-'),
    )
    try {
      await Fs.writeFile(
        Path.join(directory, 'compiled.ts'),
        Native.compile({
          source,
          moduleId: 'compiled.ts',
          platform: 'ios',
          colorScheme: 'light',
        }).code,
      )
      const consumer = Path.join(directory, 'consumer.ts')
      await Fs.writeFile(
        consumer,
        `import {card,compose} from './compiled.js';
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
  }, 35000)

  test('retains source mappings and avoids helper name collisions', async () => {
    const input = `const __zyzzNative=1;\n${source}`
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
    const original = Trace.originalPositionFor(new Trace.TraceMap(output.map), {
      line: prefix.length,
      column: prefix.at(-1)!.length,
    })
    expect(original.source).toMatchInlineSnapshot('"collision.ts"')
    expect(original.line).toMatchInlineSnapshot('11')
  })

  test('rejects dynamic recipes and native conditions instead of emitting web bindings', () => {
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
      `variants({variants:{size:{custom:(value:{opacity:number})=>({opacity:value.opacity})}}})`,
      `variants({conditions:{wide:'@media (width > 0px)'},variants:{tone:{quiet:{opacity:0.5}}}})`,
    ])
      expect(() =>
        Native.compile({
          moduleId: 'bad.ts',
          colorScheme: 'light',
          source: `import {variants} from 'zyzz';export const card=${definition};`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Native.CompileError: Native source compilation requires static recipes without dynamic payloads, named conditions, or HTML output.]',
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
