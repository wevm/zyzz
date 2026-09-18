/** Exercises explicit native host state through compiled tables and runtime callables. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Events from 'node:events'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Native as Compiler } from 'zyzz/compiler'
import { Host, StyleSheet } from 'zyzz/react-native'
import { Native, type NativeDynamic } from 'zyzz/runtime'

const initial = {
  colorScheme: 'light',
  density: 2,
  fontScale: 1,
  highContrast: false,
  platform: 'ios',
  reducedMotion: false,
  rtl: false,
  theme: 'base',
} as const

function tables(): StyleSheet.Tables<'card'> {
  const base = Theme.define({ color: { ink: { light: '#000', dark: '#fff' } } })
  const alternate = Theme.extend(base, {
    color: { ink: { light: '#f00', dark: '#00f' } },
  })
  return StyleSheet.compile({
    platform: 'ios',
    themes: { base, alternate },
    styles: Style.define({
      card: {
        color: base.tokens.color.ink,
        targets: { ios: { opacity: 0.8 }, android: { opacity: 0.4 } },
      },
    }),
  }).styles
}

describe('create', () => {
  test('updates precompiled themes and schemes before notification and cleans up the adapter', () => {
    const styles = tables()
    const device = new Events.EventEmitter()
    let cleanups = 0
    const host = Host.create({
      ...initial,
      watch(update) {
        device.on('appearance', update)
        return () => {
          cleanups++
          device.off('appearance', update)
        }
      },
    })
    const card = host.bind((context) =>
      Native.create({
        axes: {},
        defaults: {},
        styles: { 0: StyleSheet.select(styles, context).card },
      }),
    )
    const original = host.getSnapshot()
    const first = card().style
    const seen: unknown[] = []
    const unsubscribe = host.subscribe((snapshot) =>
      seen.push([snapshot.theme, snapshot.colorScheme, card().style]),
    )

    host.update({ colorScheme: 'light' })
    expect(host.getSnapshot() === original).toMatchInlineSnapshot('true')
    expect(card().style === first).toMatchInlineSnapshot('true')
    expect(seen).toMatchInlineSnapshot(`[]`)
    device.emit('appearance', { colorScheme: 'dark' })
    host.update({ theme: 'alternate' })
    expect(seen).toMatchInlineSnapshot(`
      [
        [
          "base",
          "dark",
          {
            "color": "#fff",
            "opacity": 0.8,
          },
        ],
        [
          "alternate",
          "dark",
          {
            "color": "#00f",
            "opacity": 0.8,
          },
        ],
      ]
    `)
    expect(Object.isFrozen(host.getSnapshot())).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(card().style)).toMatchInlineSnapshot('true')
    const committed = host.getSnapshot()
    expect(() =>
      host.update({ theme: 'missing' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.SelectionError: Select an existing theme label and light or dark colorScheme.]`,
    )
    expect(host.getSnapshot() === committed).toMatchInlineSnapshot('true')
    expect(card().style).toMatchInlineSnapshot(`
      {
        "color": "#00f",
        "opacity": 0.8,
      }
    `)

    unsubscribe()
    unsubscribe()
    host.update({ colorScheme: 'light' })
    expect(seen.length).toMatchInlineSnapshot('2')
    host.dispose()
    host.dispose()
    expect(cleanups).toMatchInlineSnapshot('1')
    expect(device.listenerCount('appearance')).toMatchInlineSnapshot('0')
    expect(host.getSnapshot().colorScheme).toMatchInlineSnapshot('"light"')
    expect(() => card()).toThrowErrorMatchingInlineSnapshot(
      `[Host.LifecycleError: The native host is disposed.]`,
    )
    expect(() =>
      host.update({ density: 3 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Host.LifecycleError: The native host is disposed.]`,
    )
    expect(() => host.subscribe(() => {})).toThrowErrorMatchingInlineSnapshot(
      `[Host.LifecycleError: The native host is disposed.]`,
    )
  })

  test('keeps host inputs isolated and processes values without registering global state', () => {
    const capabilities = { shadows: true }
    const host = Host.create({
      ...initial,
      capabilities,
      preprocessors: {
        borderWidth: (_value, context) => context.hairlineWidth,
        color: (value, context) => (context.highContrast ? '#fff' : value),
      },
    })
    const other = Host.create({ ...initial, platform: 'android' })
    const colors = { semantic: ['labelColor'] }
    const transform = [{ translateX: { current: 2 } }]
    const input = { borderWidth: 1, color: colors, transform }
    const first = host.preprocess(input)
    expect(first).toMatchInlineSnapshot(`
      {
        "borderWidth": 0.5,
        "color": {
          "semantic": [
            "labelColor",
          ],
        },
        "transform": [
          {
            "translateX": {
              "current": 2,
            },
          },
        ],
      }
    `)
    expect(first.color === colors).toMatchInlineSnapshot('true')
    expect(first.transform === transform).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(colors)).toMatchInlineSnapshot('false')
    expect(input.borderWidth).toMatchInlineSnapshot('1')
    capabilities.shadows = false
    expect(host.getSnapshot().capabilities.shadows).toMatchInlineSnapshot(
      'true',
    )

    const scales: number[] = []
    for (const density of [1, 1.5, 2, 3, 4]) {
      host.update({ density })
      scales.push(host.getSnapshot().hairlineWidth)
    }
    expect(scales).toMatchInlineSnapshot(`
      [
        1,
        0.6666666666666666,
        0.5,
        0.3333333333333333,
        0.5,
      ]
    `)
    host.update({
      fontScale: 1.5,
      highContrast: true,
      reducedMotion: true,
      rtl: true,
    })
    expect(host.preprocess(input).color).toMatchInlineSnapshot('"#fff"')
    expect(host.getSnapshot()).toMatchInlineSnapshot(`
      {
        "capabilities": {
          "shadows": true,
        },
        "colorScheme": "light",
        "density": 4,
        "fontScale": 1.5,
        "hairlineWidth": 0.5,
        "highContrast": true,
        "platform": "ios",
        "reducedMotion": true,
        "rtl": true,
        "theme": "base",
      }
    `)
    expect(other.getSnapshot()).toMatchInlineSnapshot(`
      {
        "capabilities": {},
        "colorScheme": "light",
        "density": 2,
        "fontScale": 1,
        "hairlineWidth": 0.5,
        "highContrast": false,
        "platform": "android",
        "reducedMotion": false,
        "rtl": false,
        "theme": "base",
      }
    `)
    host.dispose()
    other.dispose()
  })

  test('switches precompiled dynamic callables without losing runtime payloads or opaque overrides', async () => {
    const prepared = {} as Record<
      'dark' | 'light',
      NativeDynamic.Callable<{ alpha: number; gap: string }>
    >
    for (const colorScheme of ['dark', 'light'] as const) {
      const compiled = Compiler.compile({
        moduleId: 'host-dynamic.ts',
        colorScheme,
        source: `import {Config} from 'zyzz';const {style}=Config.create({theme:{color:{ink:{light:'#000',dark:'#fff'}}}});export const card=style((input:{alpha:number;gap:string})=>({color:'ink',opacity:input.alpha,padding:input.gap}));`,
      })
      const bundle = await Esbuild.build({
        stdin: {
          contents: compiled.code,
          loader: 'ts',
          resolveDir: process.cwd(),
        },
        alias: {
          zyzz: `${process.cwd()}/src/index.ts`,
          'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts`,
        },
        bundle: true,
        format: 'esm',
        platform: 'node',
        write: false,
      })
      prepared[colorScheme] = (
        await import(
          `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
        )
      ).card
    }
    const host = Host.create(initial)
    const card = host.bind((context) => prepared[context.colorScheme])
    const opaque = { semantic: ['labelColor'] }
    const override = { backgroundColor: opaque }
    const first = card({ alpha: 0.3, gap: '2px', style: override })
    host.update({ colorScheme: 'dark', reducedMotion: true })
    const second = card({ alpha: 0.7, gap: '8px', style: override })
    expect(StyleSheet.flatten(first.style)).toMatchInlineSnapshot(`
      {
        "backgroundColor": {
          "semantic": [
            "labelColor",
          ],
        },
        "color": "#000",
        "opacity": 0.3,
        "paddingBottom": 2,
        "paddingLeft": 2,
        "paddingRight": 2,
        "paddingTop": 2,
      }
    `)
    expect(StyleSheet.flatten(second.style)).toMatchInlineSnapshot(`
      {
        "backgroundColor": {
          "semantic": [
            "labelColor",
          ],
        },
        "color": "#fff",
        "opacity": 0.7,
        "paddingBottom": 8,
        "paddingLeft": 8,
        "paddingRight": 8,
        "paddingTop": 8,
      }
    `)
    expect(
      StyleSheet.flatten(second.style)?.backgroundColor === opaque,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(opaque)).toMatchInlineSnapshot('false')
    host.dispose()
  })

  test('rolls back all bindings on preparation failure and reports subscriber failures after commit', () => {
    const styles = tables()
    const host = Host.create(initial)
    const appearance = host.bind((context) =>
      Native.create({
        axes: {},
        defaults: {},
        styles: { 0: StyleSheet.select(styles, context).card },
      }),
    )
    const guarded = host.bind((context) => {
      if (context.density === 3) throw new Error('Unsupported density')
      return Native.create({
        axes: {},
        defaults: {},
        styles: { 0: { opacity: context.reducedMotion ? 1 : 0.5 } },
      })
    })
    const previous = host.getSnapshot()
    expect(() =>
      host.update({ density: 3, colorScheme: 'dark', reducedMotion: true }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Unsupported density]`)
    expect(host.getSnapshot() === previous).toMatchInlineSnapshot('true')
    expect(appearance().style).toMatchInlineSnapshot(`
      {
        "color": "#000",
        "opacity": 0.8,
      }
    `)
    expect(guarded().style).toMatchInlineSnapshot(`
      {
        "opacity": 0.5,
      }
    `)
    const seen: string[] = []
    host.subscribe(() => {
      throw new Error('Listener failed')
    })
    host.subscribe((context) => seen.push(context.colorScheme))
    expect(() =>
      host.update({ colorScheme: 'dark' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[AggregateError: Native host subscribers failed after the update committed.]`,
    )
    expect(seen).toMatchInlineSnapshot(`
      [
        "dark",
      ]
    `)
    expect(appearance().style).toMatchInlineSnapshot(`
      {
        "color": "#fff",
        "opacity": 0.8,
      }
    `)
    host.dispose()
  })

  test('owns synchronous adapter updates and remains disposed when cleanup fails', () => {
    const device = new Events.EventEmitter()
    const host = Host.create({
      ...initial,
      watch(update) {
        update({ colorScheme: 'dark' })
        device.on('change', update)
        return () => {
          device.off('change', update)
          throw new Error('Cleanup failed')
        }
      },
    })
    const card = host.bind(() =>
      Native.create({
        axes: {},
        defaults: {},
        styles: { 0: { opacity: 0.5 } },
      }),
    )
    expect(host.getSnapshot().colorScheme).toMatchInlineSnapshot('"dark"')
    expect(() => host.dispose()).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cleanup failed]`,
    )
    expect(device.listenerCount('change')).toMatchInlineSnapshot('0')
    host.dispose()
    expect(() => card()).toThrowErrorMatchingInlineSnapshot(
      `[Host.LifecycleError: The native host is disposed.]`,
    )
    expect(() =>
      host.preprocess({ opacity: 1 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Host.LifecycleError: The native host is disposed.]`,
    )
  })

  test('ignores device notifications already queued when disposal removes the subscription', async () => {
    const device = new Events.EventEmitter()
    const host = Host.create({
      ...initial,
      watch(update) {
        const listener = (patch: Partial<Host.Inputs>) =>
          queueMicrotask(() => update(patch))
        device.on('change', listener)
        return () => {
          device.off('change', listener)
        }
      },
    })
    const card = host.bind(() =>
      Native.create({
        axes: {},
        defaults: {},
        styles: { 0: { opacity: 0.5 } },
      }),
    )
    const snapshot = host.getSnapshot()
    expect(card().style).toMatchInlineSnapshot(`
      {
        "opacity": 0.5,
      }
    `)
    device.emit('change', { colorScheme: 'dark' })
    host.dispose()
    await Promise.resolve()
    expect(host.getSnapshot() === snapshot).toMatchInlineSnapshot('true')
    expect(device.listenerCount('change')).toMatchInlineSnapshot('0')
  })

  test('defers new subscribers and respects removal during notification', () => {
    const host = Host.create(initial)
    const card = host.bind(() =>
      Native.create({ axes: {}, defaults: {}, styles: { 0: {} } }),
    )
    const events: string[] = []
    let remove = () => {}
    host.subscribe(() => {
      events.push('first')
      remove()
      host.subscribe(() => events.push('new'))
    })
    remove = host.subscribe(() => events.push('removed'))
    host.update({ density: 3 })
    expect(events).toMatchInlineSnapshot(`
      [
        "first",
      ]
    `)
    host.update({ density: 4 })
    expect(events).toMatchInlineSnapshot(`
      [
        "first",
        "first",
        "new",
      ]
    `)
    expect(card().style).toMatchInlineSnapshot(`{}`)
    host.dispose()
  })

  test('executes the published host without compiler or device imports', async () => {
    const output = await Esbuild.build({
      stdin: {
        contents: `import {Host} from 'zyzz/react-native';const host=Host.create(${JSON.stringify(initial)});host.update({density:3});export const snapshot=host.getSnapshot();host.dispose();`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      write: false,
      metafile: true,
    })
    const bundled = output.outputFiles[0]!.text
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`
    )
    expect(module.snapshot.hairlineWidth === 1 / 3).toMatchInlineSnapshot(
      'true',
    )
    const included = Object.values(output.metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs)
        .filter(([, value]) => value.bytesInOutput > 0)
        .map(([name]) => name),
    )
    expect(
      included.some((name) => /compiler|node_modules/.test(name)),
    ).toMatchInlineSnapshot('false')
  })

  test('type-checks host-bound calls through published declarations', async () => {
    const directory = await Fs.mkdtemp(
      Path.resolve('.fixture-host-declarations-'),
    )
    try {
      const file = Path.join(directory, 'consumer.ts')
      await Fs.writeFile(
        file,
        `import {Host} from 'zyzz/react-native';
import {Native} from 'zyzz/runtime';
const host=Host.create(${JSON.stringify(initial)});
const card=host.bind(()=>Native.create({axes:{size:['small','large']},defaults:{},styles:{0:{opacity:0.5}}}));
const override={opacity:{current:0.5}};
const props:Native.Props<{readonly opacity:0.5}|typeof override>=card({size:'large',style:override});
// @ts-expect-error Bound callables retain choice types.
card({size:'missing'});
// @ts-expect-error Platform is fixed.
host.update({platform:'android'});
void props;
host.dispose();`,
      )
      await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.resolve('node_modules/typescript/bin/tsc'),
          '--ignoreConfig',
          '--noEmit',
          '--module',
          'nodenext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          file,
        ],
        { timeout: 30000 },
      )
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  }, 35000)

  test('rejects invalid and fixed inputs and prevents nested changes during notification', () => {
    const host = Host.create(initial)
    const previous = host.getSnapshot()
    for (const patch of [
      { density: 0 },
      { density: Infinity },
      { fontScale: -1 },
      { theme: '' },
      { colorScheme: 'system' },
      { rtl: 1 },
      { platform: 'android' },
      { capabilities: {} },
    ]) {
      expect(() =>
        host.update(patch as Partial<Host.Inputs>),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Host.InputError: Provide a theme, resolved scheme, positive finite scales, and boolean accessibility inputs.]`,
      )
      expect(host.getSnapshot() === previous).toMatchInlineSnapshot('true')
    }
    expect(() =>
      host.update({ density: Number.MIN_VALUE }),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Host.InputError: Density must produce a finite positive hairline width.]',
    )
    expect(() => host.preprocess([])).toThrowErrorMatchingInlineSnapshot(
      '[Host.InputError: Preprocessing requires a plain style object.]',
    )
    const errors: unknown[] = []
    host.subscribe(() => {
      for (const change of [
        () => host.update({ density: 3 }),
        () => host.dispose(),
        () =>
          host.bind(() =>
            Native.create({ axes: {}, defaults: {}, styles: { 0: {} } }),
          ),
      ]) {
        try {
          change()
        } catch (error) {
          errors.push(error)
        }
      }
    })
    host.update({ density: 4 })
    expect(errors.length).toMatchInlineSnapshot('3')
    expect(
      errors.every((error) => error instanceof Host.LifecycleError),
    ).toMatchInlineSnapshot('true')
    host.dispose()
  })
})
