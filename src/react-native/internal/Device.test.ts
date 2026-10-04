/** Runs compiled styles on installed iOS and Android Fabric apps. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Module from 'node:module'
import * as Net from 'node:net'
import * as Path from 'node:path'
import * as Timers from 'node:timers'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import type { Report as MotionErrorsReport } from '../../../test/fixtures/native/MotionErrors.js'
import type { Report as MotionReport } from '../../../test/fixtures/native/MotionUpdates.js'
import type { Report as UpdatesReport } from '../../../test/fixtures/native/Updates.js'
import type { Report as VariantsReport } from '../../../test/fixtures/native/VariantUpdates.js'
import { describe, expect, test } from 'vite-plus/test'

const exec = Util.promisify(ChildProcess.execFile)
const require = Module.createRequire(
  Path.resolve('examples/react-native/package.json'),
)
const application = 'xyz.wevm.zyzz.updates'
type Report = MotionErrorsReport | MotionReport | UpdatesReport | VariantsReport

describe('defineConfig', () => {
  for (const platform of ['ios', 'android'] as const) {
    const device = process.env[`ZYZZ_NATIVE_${platform.toUpperCase()}_DEVICE`]
    const app = process.env[`ZYZZ_NATIVE_${platform.toUpperCase()}_APP`]
    test
      .runIf(!!device && !!app)
      .each(['Updates', 'VariantUpdates', 'MotionUpdates', 'MotionErrors'])(
      `${platform}: updates native views for %s`,
      async (fixture) => {
        const root = await Fs.mkdtemp(Path.resolve('.fixture-native-render-'))
        const browser = await chromium.launch()
        const page = await browser.newPage()
        const frames: Report[] = []
        const colors: Record<string, string>[] = []
        let child: ChildProcess.ChildProcess | undefined
        let logs = ''
        let timeout: ReturnType<typeof Timers.setTimeout> | undefined
        const forwards: number[] = []
        const complete = Promise.withResolvers<void>()
        void complete.promise.catch(() => {})
        const server = Http.createServer(async (request, response) => {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of request) chunks.push(Buffer.from(chunk))
            const report = JSON.parse(
              Buffer.concat(chunks).toString(),
            ) as Report & { error?: string }
            if (report.error) throw new Error(report.error)
            frames.push(report)
            const file = Path.join(root, `${report.name}.png`)
            if (platform === 'ios')
              await exec('xcrun', ['simctl', 'io', device!, 'screenshot', file])
            else {
              const capture = await exec(
                'adb',
                ['-s', device!, 'exec-out', 'screencap', '-p'],
                { encoding: 'buffer', maxBuffer: 16_000_000 },
              )
              await Fs.writeFile(file, capture.stdout)
            }
            const image = (await Fs.readFile(file)).toString('base64')
            colors.push(
              await page.evaluate(
                async (input) => {
                  const image = new Image()
                  image.src = `data:image/png;base64,${input.image}`
                  await image.decode()
                  const canvas = document.createElement('canvas')
                  canvas.height = image.height
                  canvas.width = image.width
                  const context = canvas.getContext('2d')!
                  context.drawImage(image, 0, 0)
                  return Object.fromEntries(
                    input.report.geometry.map((view) => [
                      view.id,
                      '#' +
                        [
                          ...context.getImageData(
                            Math.floor(
                              (view.pageX + view.width / 2) *
                                input.report.scale,
                            ),
                            Math.floor(
                              (view.pageY + view.height / 2) *
                                input.report.scale,
                            ),
                            1,
                            1,
                          ).data,
                        ]
                          .map((value) => value.toString(16).padStart(2, '0'))
                          .join(''),
                    ]),
                  )
                },
                { image, report },
              ),
            )
            response.end('ok')
            if (report.name === (fixture === 'Updates' ? 'rebound' : 'commit'))
              complete.resolve()
          } catch (error) {
            response.writeHead(500).end(String(error))
            complete.reject(error)
          }
        })
        try {
          await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve),
          )
          const reportPort = (server.address() as Net.AddressInfo).port
          const port = await new Promise<number>((resolve) => {
            const probe = Net.createServer().listen(0, '127.0.0.1', () => {
              const port = (probe.address() as Net.AddressInfo).port
              probe.close(() => resolve(port))
            })
          })
          const source = await Fs.readFile(
            `test/fixtures/native/${fixture}.tsx`,
            'utf8',
          )
          await Fs.writeFile(
            Path.join(root, 'index.tsx'),
            source.replaceAll(
              '__REPORT_URL__',
              `http://localhost:${reportPort}/result`,
            ),
          )
          await Fs.writeFile(
            Path.join(root, 'package.json'),
            JSON.stringify({
              main: 'index.tsx',
              name: 'native-render-fixture',
              private: true,
              type: 'module',
            }),
          )
          await Fs.writeFile(
            Path.join(root, 'app.json'),
            JSON.stringify({
              expo: {
                experiments: { reactCompiler: true },
                name: 'Native render fixture',
                slug: 'native-render-fixture',
              },
            }),
          )
          await Fs.symlink(
            Path.resolve('examples/react-native/node_modules'),
            Path.join(root, 'node_modules'),
            'dir',
          )
          await Fs.writeFile(
            Path.join(root, 'metro.config.ts'),
            `/** Configures the real Expo fixture and its framework peers. @module */
          import * as Module from 'node:module'; import {getDefaultConfig} from 'expo/metro-config.js'; import {zyzz} from 'zyzz/metro';
          const require=Module.createRequire(import.meta.url);const config=getDefaultConfig(import.meta.dirname);
          config.maxWorkers=2;
          const peers=['react','react-native','react-native-reanimated','react-native-safe-area-context','react-native-worklets'];
          config.resolver.resolveRequest=(context,name,platform)=>context.resolveRequest(context,peers.some(peer=>name===peer||name.startsWith(peer+'/'))?require.resolve(name):name,platform);
          export default zyzz(config,{units:{px:1}});`,
          )
          child = ChildProcess.spawn(
            process.execPath,
            [
              require.resolve('expo/bin/cli'),
              'start',
              '--localhost',
              '--port',
              String(port),
            ],
            {
              cwd: root,
              env: { ...process.env, NODE_ENV: 'development' },
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          )
          child.stdout?.on('data', (value) => {
            logs += String(value)
          })
          child.stderr?.on('data', (value) => {
            logs += String(value)
          })
          child.once('error', complete.reject)
          await expect
            .poll(
              async () => {
                try {
                  return (await fetch(`http://localhost:${port}/status`)).status
                } catch {
                  return 0
                }
              },
              { timeout: 20_000 },
            )
            .toBe(200)
          const bundle = await fetch(
            `http://localhost:${port}/index.tsx.bundle?platform=${platform}&dev=true&minify=false`,
          )
          if (!bundle.ok) throw new Error(await bundle.text())
          await bundle.arrayBuffer()
          if (platform === 'ios') {
            await exec('xcrun', ['simctl', 'install', device!, app!])
            await exec('xcrun', [
              'simctl',
              'terminate',
              device!,
              application,
            ]).catch(() => {})
            await exec('xcrun', [
              'simctl',
              'launch',
              device!,
              application,
              '-RCT_jsLocation',
              `localhost:${port}`,
            ])
          } else {
            await exec('adb', ['-s', device!, 'install', '-r', app!])
            for (const forward of [port, reportPort]) {
              await exec('adb', [
                '-s',
                device!,
                'reverse',
                `tcp:${forward}`,
                `tcp:${forward}`,
              ])
              forwards.push(forward)
            }
            await exec('adb', [
              '-s',
              device!,
              'shell',
              'am',
              'force-stop',
              application,
            ])
            await exec('adb', [
              '-s',
              device!,
              'shell',
              'run-as',
              application,
              'mkdir',
              '-p',
              'shared_prefs',
            ])
            ChildProcess.execFileSync(
              'adb',
              [
                '-s',
                device!,
                'shell',
                'run-as',
                application,
                'tee',
                `shared_prefs/${application}_preferences.xml`,
              ],
              {
                input: `<map><string name="debug_http_host">localhost:${port}</string></map>`,
              },
            )
            await exec('adb', [
              '-s',
              device!,
              'shell',
              'am',
              'start',
              '-W',
              '-n',
              `${application}/.MainActivity`,
            ])
          }
          await Promise.race([
            complete.promise,
            new Promise<never>((_, reject) => {
              timeout = Timers.setTimeout(
                () => reject(new Error(`Native renderer timeout.\n${logs}`)),
                30_000,
              )
            }),
          ])
          if (fixture === 'MotionErrors') {
            expect((frames[0] as MotionErrorsReport).errors)
              .toMatchInlineSnapshot(`
              {
                "color": "useAnimatedStyleValue requires a numeric or color value for backgroundColor.",
                "cycle": "Animated selections cannot contain cycles.",
                "function": "Animated selections require finite, serializable native values.",
                "instance": "Animated selections require finite, serializable native values.",
                "missing": "useAnimatedStyleValue requires a numeric or color value for width.",
                "nonfinite": "useAnimatedStyleValue requires a numeric or color value for width.",
                "percentage": "useAnimatedStyleValue requires a numeric or color value for width.",
                "provider": "useAnimatedVars requires a Zyzz Provider.",
                "symbol": "Animated selections cannot contain symbol properties.",
              }
            `)
            return
          }
          if (fixture === 'MotionUpdates') {
            const motion = frames as MotionReport[]
            expect(motion.map((frame) => frame.name)).toMatchInlineSnapshot(`
              [
                "initial",
                "scheme",
                "choice",
                "vars",
                "override",
                "inputs",
                "unmount",
                "remount",
                "commit",
              ]
            `)
            expect(
              motion.map((frame) =>
                frame.geometry
                  .map(
                    (view) =>
                      `${view.id} ${Math.round(view.width)}x${Math.round(view.height)}`,
                  )
                  .sort(),
              ),
            ).toMatchInlineSnapshot(`
              [
                [
                  "alias 100x20",
                  "mixed 100x40",
                  "motion 100x40",
                  "nested 100x40",
                  "safe 100x40",
                ],
                [
                  "alias 100x20",
                  "mixed 100x40",
                  "motion 100x40",
                  "nested 100x40",
                  "safe 100x40",
                ],
                [
                  "alias 100x20",
                  "mixed 200x40",
                  "motion 200x40",
                  "nested 100x40",
                  "safe 100x40",
                ],
                [
                  "alias 160x20",
                  "mixed 200x60",
                  "motion 200x60",
                  "nested 100x40",
                  "safe 160x40",
                ],
                [
                  "alias 160x20",
                  "mixed 120x60",
                  "motion 120x60",
                  "nested 100x40",
                  "safe 160x40",
                ],
                [
                  "alias 160x20",
                  "mixed 160x36",
                  "motion 160x36",
                  "nested 100x40",
                  "safe 160x40",
                ],
                [
                  "alias 160x20",
                  "nested 100x40",
                  "safe 160x40",
                ],
                [
                  "alias 160x20",
                  "mixed 160x60",
                  "motion 160x60",
                  "nested 100x40",
                  "safe 160x40",
                ],
                [
                  "alias 160x20",
                  "mixed 160x60",
                  "motion 160x60",
                  "nested 100x40",
                  "safe 160x40",
                ],
              ]
            `)
            expect(motion.map((frame) => frame.renders.motion))
              .toMatchInlineSnapshot(`
                [
                  1,
                  1,
                  2,
                  2,
                  3,
                  4,
                  4,
                  5,
                  5,
                ]
              `)
            expect(motion.map((frame) => frame.renders.nested))
              .toMatchInlineSnapshot(`
                [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                ]
              `)
            expect(
              motion.every(
                (frame) => frame.identities.motion && frame.identities.nested,
              ),
            ).toMatchInlineSnapshot(`true`)
            expect(motion.map((frame) => frame.releases)).toMatchInlineSnapshot(
              `
              [
                0,
                0,
                0,
                0,
                0,
                0,
                2,
                2,
                2,
              ]
            `,
            )
            expect(
              motion.at(-1)!.reactions.motion ===
                motion.at(-2)!.reactions.motion,
            ).toMatchInlineSnapshot(`true`)
            expect(motion.at(-1)!.reactions.nested).toMatchInlineSnapshot(`1`)
            expect(motion.at(-1)!.targets).toMatchInlineSnapshot(`
              {
                "motion": {
                  "color": "#0000ff",
                  "height": 60,
                  "width": 160,
                },
                "nested": {
                  "color": "#ff0000",
                  "height": 40,
                  "width": 100,
                },
              }
            `)
            expect(colors).toMatchInlineSnapshot(`
              [
                {
                  "alias": "#ff0000ff",
                  "mixed": "#ff0000ff",
                  "motion": "#ff0000ff",
                  "nested": "#ff0000ff",
                  "safe": "#ff0000ff",
                },
                {
                  "alias": "#00ff00ff",
                  "mixed": "#00ff00ff",
                  "motion": "#00ff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#00ff00ff",
                },
                {
                  "alias": "#00ff00ff",
                  "mixed": "#00ff00ff",
                  "motion": "#00ff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#00ff00ff",
                },
                {
                  "alias": "#ffff00ff",
                  "mixed": "#ffff00ff",
                  "motion": "#ffff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#ffff00ff",
                },
                {
                  "alias": "#ffff00ff",
                  "mixed": "#ffff00ff",
                  "motion": "#ffff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#ffff00ff",
                },
                {
                  "alias": "#ffff00ff",
                  "mixed": "#ffff00ff",
                  "motion": "#ffff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#ffff00ff",
                },
                {
                  "alias": "#ffff00ff",
                  "nested": "#ff0000ff",
                  "safe": "#ffff00ff",
                },
                {
                  "alias": "#0000ffff",
                  "mixed": "#0000ffff",
                  "motion": "#0000ffff",
                  "nested": "#ff0000ff",
                  "safe": "#0000ffff",
                },
                {
                  "alias": "#0000ffff",
                  "mixed": "#0000ffff",
                  "motion": "#0000ffff",
                  "nested": "#ff0000ff",
                  "safe": "#0000ffff",
                },
              ]
            `)
            return
          }
          if (fixture === 'VariantUpdates') {
            expect(frames.map((frame) => frame.name)).toMatchInlineSnapshot(`
              [
                "initial",
                "choice",
                "scheme",
                "nulls",
                "vars",
                "defaults",
                "commit",
              ]
            `)
            expect(
              frames.map((frame) =>
                frame.geometry.map((view) => ({
                  height: Math.round(view.height),
                  width: Math.round(view.width),
                })),
              ),
            ).toMatchInlineSnapshot(`
              [
                [
                  {
                    "height": 40,
                    "width": 100,
                  },
                ],
                [
                  {
                    "height": 120,
                    "width": 240,
                  },
                ],
                [
                  {
                    "height": 120,
                    "width": 240,
                  },
                ],
                [
                  {
                    "height": 20,
                    "width": 100,
                  },
                ],
                [
                  {
                    "height": 20,
                    "width": 160,
                  },
                ],
                [
                  {
                    "height": 40,
                    "width": 160,
                  },
                ],
                [
                  {
                    "height": 40,
                    "width": 160,
                  },
                ],
              ]
            `)
            expect(frames.map((frame) => frame.renders)).toMatchInlineSnapshot(`
              [
                {
                  "button": 1,
                },
                {
                  "button": 2,
                },
                {
                  "button": 2,
                },
                {
                  "button": 3,
                },
                {
                  "button": 3,
                },
                {
                  "button": 4,
                },
                {
                  "button": 4,
                },
              ]
            `)
            expect(frames.map((frame) => frame.native)).toMatchInlineSnapshot(`
              [
                {
                  "batches": 0,
                  "bindings": 1,
                  "writes": 0,
                },
                {
                  "batches": 0,
                  "bindings": 1,
                  "writes": 0,
                },
                {
                  "batches": 1,
                  "bindings": 1,
                  "writes": 1,
                },
                {
                  "batches": 1,
                  "bindings": 1,
                  "writes": 1,
                },
                {
                  "batches": 2,
                  "bindings": 1,
                  "writes": 2,
                },
                {
                  "batches": 2,
                  "bindings": 1,
                  "writes": 2,
                },
                {
                  "batches": 2,
                  "bindings": 1,
                  "writes": 2,
                },
              ]
            `)
            expect(colors).toMatchInlineSnapshot(`
              [
                {
                  "button": "#ff0000ff",
                },
                {
                  "button": "#ff0000ff",
                },
                {
                  "button": "#00ff00ff",
                },
                {
                  "button": "#00ff00ff",
                },
                {
                  "button": "#ffff00ff",
                },
                {
                  "button": "#ffff00ff",
                },
                {
                  "button": "#ffff00ff",
                },
              ]
            `)
            return
          }

          const transitions = frames.splice(7)
          const transitionColors = colors.splice(7)
          expect(transitions.map((frame) => frame.name)).toEqual([
            'static',
            'unstyled',
            'rebound',
          ])
          expect(transitions.map((frame) => frame.native.bindings)).toEqual([
            2, 2, 3,
          ])
          expect(transitions.map((frame) => frame.releases)).toEqual([2, 2, 2])
          expect(transitionColors.map((frame) => frame.themed)).toEqual([
            '#0000ffff',
            '#ffffffff',
            '#ffff00ff',
          ])
          for (const index of [0, 2]) {
            const frame = transitions[index]!
            const width = frame.geometry.find(
              (view) => view.id === 'themed',
            )!.width
            expect(Math.round(width * frame.scale)).toBe(
              Math.round((index === 0 ? 60 : 160) * frame.scale),
            )
          }
          expect(frames.map((frame) => frame.name)).toMatchInlineSnapshot(`
            [
              "initial",
              "scheme",
              "commit",
              "height",
              "vars",
              "unmount",
              "remount",
            ]
          `)
          expect(frames.map((frame) => frame.native)).toMatchInlineSnapshot(`
            [
              {
                "batches": 0,
                "bindings": 3,
                "writes": 0,
              },
              {
                "batches": 1,
                "bindings": 3,
                "writes": 1,
              },
              {
                "batches": 1,
                "bindings": 3,
                "writes": 1,
              },
              {
                "batches": 1,
                "bindings": 3,
                "writes": 1,
              },
              {
                "batches": 2,
                "bindings": 3,
                "writes": 2,
              },
              {
                "batches": 2,
                "bindings": 1,
                "writes": 2,
              },
              {
                "batches": 2,
                "bindings": 3,
                "writes": 2,
              },
            ]
          `)
          expect(frames.map((frame) => frame.renders)).toMatchInlineSnapshot(`
            [
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 1,
                "values": 1,
              },
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 1,
                "values": 2,
              },
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 1,
                "values": 2,
              },
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 2,
                "values": 2,
              },
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 2,
                "values": 3,
              },
              {
                "fixed": 1,
                "free": 1,
                "nested": 1,
                "themed": 2,
                "values": 3,
              },
              {
                "fixed": 2,
                "free": 1,
                "nested": 2,
                "themed": 3,
                "values": 4,
              },
            ]
          `)
          expect(frames.map((frame) => frame.releases)).toMatchInlineSnapshot(`
            [
              0,
              0,
              0,
              0,
              0,
              2,
              2,
            ]
          `)
          expect(
            frames.map((frame) =>
              frame.geometry.map((view) => ({
                height: Math.round(view.height),
                id: view.id,
                width: Math.round(view.width),
              })),
            ),
          ).toMatchInlineSnapshot(`
            [
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 40,
                  "id": "themed",
                  "width": 100,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 40,
                  "id": "themed",
                  "width": 100,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 40,
                  "id": "themed",
                  "width": 100,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 64,
                  "id": "themed",
                  "width": 100,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 64,
                  "id": "themed",
                  "width": 160,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
              ],
              [
                {
                  "height": 40,
                  "id": "free",
                  "width": 100,
                },
                {
                  "height": 40,
                  "id": "nested",
                  "width": 160,
                },
                {
                  "height": 40,
                  "id": "themed",
                  "width": 160,
                },
              ],
            ]
          `)
          expect(colors).toMatchInlineSnapshot(`
            [
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#ff0000ff",
              },
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#00ff00ff",
              },
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#00ff00ff",
              },
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#00ff00ff",
              },
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#ffff00ff",
              },
              {
                "free": "#ff0000ff",
              },
              {
                "free": "#ff0000ff",
                "nested": "#ffff00ff",
                "themed": "#ffff00ff",
              },
            ]
          `)
        } catch (error) {
          console.error(logs)
          throw error
        } finally {
          if (timeout) Timers.clearTimeout(timeout)
          for (const forward of forwards)
            await exec('adb', [
              '-s',
              device!,
              'reverse',
              '--remove',
              `tcp:${forward}`,
            ])
          if (platform === 'ios')
            await exec('xcrun', [
              'simctl',
              'terminate',
              device!,
              application,
            ]).catch(() => {})
          else
            await exec('adb', [
              '-s',
              device!,
              'shell',
              'am',
              'force-stop',
              application,
            ]).catch(() => {})
          child?.kill('SIGTERM')
          server.closeAllConnections()
          await new Promise<void>((resolve) => server.close(() => resolve()))
          await browser.close()
          await Fs.rm(root, { force: true, recursive: true })
        }
      },
      90_000,
    )
  }
})
