/** Verifies compiler dependency boundaries independently of Next's runtime module graph. @module */
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { expect, test } from 'vite-plus/test'
import * as Project from './Project.js'

test('watches runtime exports without compiling their component trees', async () => {
  const root = await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-next-inputs-'))
  const tracked = new Set<string>()
  const project = Project.create({ root })
  const source =
    "import {Component} from './component';export const props=Component()"
  const context: Project.Context = {
    addDependency(file) {
      tracked.add(Path.basename(file))
    },
    getResolve() {
      return (directory, specifier, callback) =>
        callback(null, Path.resolve(directory, specifier + '.ts'))
    },
    resourcePath: Path.join(root, 'page.ts'),
  }
  try {
    await Fs.writeFile(
      Path.join(root, 'config.ts'),
      "import {Config} from 'zyzz';export const {style}=Config.create({vars:{color:{brand:'red'}}})",
    )
    await Fs.writeFile(
      Path.join(root, 'component.ts'),
      "import {style} from './config';const heading=style({color:'brand'});export function Component(){return heading()}",
    )
    const runtime = await project.compile(context, source)

    expect(Object.keys(runtime.modules)).toEqual(['app/page.ts'])
    expect(tracked.has('component.ts')).toBe(true)
    expect(tracked.has('config.ts')).toBe(false)

    tracked.clear()
    await Fs.writeFile(
      Path.join(root, 'component.ts'),
      "import {style} from './config';export const Component=style({color:'brand'})",
    )
    const authored = await project.compile(context, source)

    expect(authored.modules['app/component.ts']!.css).toContain('red')
    const owner = { ...context, resourcePath: Path.join(root, 'component.ts') }
    const component = await Fs.readFile(owner.resourcePath, 'utf8')
    await project.compile(owner, component)
    expect(tracked.has('config.ts')).toBe(true)

    await Fs.writeFile(
      Path.join(root, 'config.ts'),
      "import {Config} from 'zyzz';export const {style}=Config.create({vars:{color:{brand:'blue'}}})",
    )
    const changed = await project.compile(owner, component)
    expect(changed.modules['app/component.ts']!.css).toContain('blue')
  } finally {
    await Fs.rm(root, { recursive: true, force: true })
  }
})
