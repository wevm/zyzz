/** Verifies optimized applications through compiled executable modules. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import { Dynamic, Props } from 'zyzz/runtime'

async function execute(source: string) {
  const output = Transform.compile({ moduleId: 'performance.ts', source })

  const runtime = await Esbuild.build({
    entryPoints: [Path.resolve('src/runtime/index.ts')],
    bundle: true,
    format: 'esm',
    write: false,
  })

  const url = `data:text/javascript;base64,${Buffer.from(runtime.outputFiles[0]!.text).toString('base64')}`
  const lowered = await Esbuild.transform(
    output.code.replace("'zyzz/runtime'", JSON.stringify(url)),
    { loader: 'ts', format: 'esm', target: 'esnext' },
  )
  const consumer = await import(
    `data:text/javascript;base64,${Buffer.from(lowered.code).toString('base64')}`
  )

  return { consumer, output }
}

describe('compile', () => {
  test('folds local namespace applications and retains escaping namespaces', async () => {
    const { consumer, output } = await execute(`import {css} from 'zyzz';
      export function apply(){return style.card()}
      export let failed=false;
      try {apply()} catch(error){failed=error instanceof Error}
      namespace style {export const card=css({color:'red'});}`)

    expect(
      output.code.includes('(style.card?{className:'),
    ).toMatchInlineSnapshot('true')
    expect(consumer.failed).toMatchInlineSnapshot('true')
    expect(consumer.apply() === consumer.apply()).toMatchInlineSnapshot('false')

    for (const body of [
      `export namespace style {export const card=css({color:'red'});} export function apply(){return style.card()}`,
      `namespace style {export const card=css({color:'red'});} export {style}; export function apply(){return style.card()}`,
      `namespace style {export const card=css({color:'red'});} style.card=()=>({className:'replaced'}); export function apply(){return style.card()}`,
      `namespace style {export const card=css({color:'red'});} export function apply(style){return style.card()}`,
    ]) {
      const { output } = await execute(`import {css} from 'zyzz';${body}`)

      expect(output.code.includes('?{className:')).toMatchInlineSnapshot(
        'false',
      )
    }
  })

  test('folds local calls into fresh props while preserving initialization errors', async () => {
    const { consumer, output } = await execute(`import {css} from 'zyzz';
      export function early(){return card()}
      export let failed=false;
      try { early() } catch(error) { failed=error instanceof ReferenceError }
      const card=css({color:'red'});
      const styles={button:css({color:'blue'})};
      export function apply(){return [card(),styles.button()]}`)

    const first = consumer.apply()
    const second = consumer.apply()

    expect([
      consumer.failed,
      first[0] !== second[0],
      first[1] !== second[1],
      output.code.includes('(styles.button?{className:'),
    ]).toMatchInlineSnapshot(`
      [
        true,
        true,
        true,
        true,
      ]
    `)
  })

  test('bundled calls still fail when invoked before initialization', async () => {
    const output = Transform.compile({
      moduleId: 'early.ts',
      source: `import {css} from 'zyzz';
      export function early(){return card()}
      export let failed=false;
      try {early()} catch(error){failed=error instanceof Error}
      const card=css({color:'red'});`,
    })

    const bundle = await Esbuild.build({
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      bundle: true,
      format: 'esm',
      minify: true,
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      write: false,
    })

    const consumer = await import(
      `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
    )

    expect(consumer.failed).toMatchInlineSnapshot(`true`)
  })

  test('does not mistake immediately applied props for a callable definition', async () => {
    for (const source of [
      `const props=css({color:'red'})();export function apply(){return props()}`,
      `const styles={card:css({color:'red'})()};export function apply(){return styles.card()}`,
    ]) {
      const { consumer } = await execute(`import {css} from 'zyzz';${source}`)
      let failed = false

      try {
        consumer.apply()
      } catch (error) {
        failed = error instanceof TypeError
      }

      expect(failed).toMatchInlineSnapshot(`true`)
    }
  })

  test('retains escaping objects, shadowed bindings, overrides, and optional calls', async () => {
    for (const body of [
      `const styles={button:css({color:'red'})}; export {styles}; export function apply(){return styles.button()}`,
      `const card=css({color:'red'}); export function apply(card){return card()}`,
      `const card=css({color:'red'}); export function apply(){return card({className:'extra'})}`,
      `const card=css({color:'red'}); export function apply(){return card?.()}`,
    ]) {
      const { output } = await execute(`import {css} from 'zyzz'; ${body}`)

      expect(output.code.includes('?{className:')).toMatchInlineSnapshot(
        `false`,
      )
    }

    const { consumer } = await execute(`import {css} from 'zyzz';
      const styles={button:css({color:'red'})};
      styles.button=()=>({className:'replaced'});
      export function apply(){return styles.button()}`)

    expect(consumer.apply()).toMatchInlineSnapshot(`
      {
        "className": "replaced",
      }
    `)
  })

  test('specialized slots preserve getter order, empty values, precedence, and fresh styles', async () => {
    const source = `import {css} from 'zyzz'; export const apply=css((values:{width:string;alpha:number})=>({width:values.width,opacity:values.alpha}))`
    const { consumer, output } = await execute(source)
    const slots = Source.extract({ moduleId: 'performance.ts', source })
      .calls[0]!.slots!
    const generic = Dynamic.create({
      className: Object.values(output.classes)[0]!,
      slots,
    })
    const privateName = slots.width!.name

    for (const apply of [consumer.apply, generic]) {
      const reads: string[] = []
      const style = { color: 'red', [privateName]: 'wrong' }

      const input = {
        get width() {
          reads.push('width')

          return ''
        },
        get alpha() {
          reads.push('alpha')

          return 0
        },
        get className() {
          reads.push('className')

          return 'external'
        },
        get style() {
          reads.push('style')

          return style
        },
      }

      const props = apply(input)

      expect(reads).toMatchInlineSnapshot(`
        [
          "width",
          "alpha",
          "className",
          "style",
        ]
      `)
      expect([
        props.style[privateName],
        props.style !== style,
        style[privateName],
        props !== apply(input),
      ]).toMatchInlineSnapshot(`
        [
          " ",
          true,
          "wrong",
          true,
        ]
      `)
    }

    expect(output.code.includes('Dynamic as')).toMatchInlineSnapshot(`false`)
  })
})

describe('create', () => {
  test('returns fresh props and forwards unchanged styles with single getter reads', () => {
    for (const className of ['', 'generated']) {
      const apply = Props.create({ className })
      const style = { color: 'red' } as const
      const reads: string[] = []

      const result = apply({
        get className() {
          reads.push('className')

          return 'external'
        },
        get style() {
          reads.push('style')

          return style
        },
      })

      expect([
        apply() !== apply(),
        apply(undefined).className === className,
        result.style === style,
        result.className === (className ? 'generated external' : 'external'),
      ]).toMatchInlineSnapshot(`
        [
          true,
          true,
          true,
          true,
        ]
      `)
      expect(reads).toMatchInlineSnapshot(`
        [
          "className",
          "style",
        ]
      `)
    }
  })
})
