/** Shared application graph for adapter and file-host measurements. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { Graph } from 'zyzz/compiler'

export function create(count: number) {
  const files: Record<string, string> = {
    'tokens.mjs':
      "import {Vars} from 'zyzz';export const tokens=Vars.define({color:{brand:'red'},space:{md:'8px',lg:'16px'}})",
    'config.mjs':
      "import {Config} from 'zyzz';import {tokens} from './tokens.mjs';export const {style,variants,vars}=Config.create({vars:tokens})",
    'globals.mjs': "import {global} from 'zyzz/web';global({body:{margin:0}})",
  }
  for (let i = 0; i < count; i++)
    files[`component${i}.mjs`] =
      `import {style,variants} from './config.mjs';${i ? `import {render as child} from './component${Math.floor((i - 1) / 4)}.mjs';` : ''}
const container=style({color:'brand',padding:'md',opacity:1});
const title=style({fontSize:'${16 + (i % 8)}px',lineHeight:1.5});
const button=variants({variants:{size:{sm:{padding:'md'},lg:{padding:'lg'}}},defaultVariants:{size:'sm'}});
export function render(){return {container:container(),title:title(),button:button(),${i ? 'child:child(),' : ''}label:'Component ${i}'}}`
  files['entry.mjs'] =
    `import '@workload/library';import './globals.mjs';${Array.from({ length: count }, (_, i) => `import {render as c${i}} from './component${i}.mjs';`).join('')}export function render(){return [${Array.from({ length: count }, (_, i) => `c${i}()`).join(',')}]}`
  return files
}

/** Publishes the same source-free library contract for every consumer. */
export async function pack(root: string) {
  const output = Graph.compile({
    modules: {
      'index.js':
        "import {global} from 'zyzz/web';global({body:{outlineWidth:'7px'}})",
    },
  })
  const directory = Path.join(root, 'node_modules/@workload/library')
  await Fs.mkdir(directory, { recursive: true })
  await Fs.writeFile(
    Path.join(directory, 'package.json'),
    JSON.stringify({
      name: '@workload/library',
      type: 'module',
      exports: './index.js',
      sideEffects: true,
    }),
  )
  const id = Path.join(directory, 'index.js')
  await Fs.writeFile(id, output.modules['index.js']!.code)
  await Fs.writeFile(id + '.zyzz.json', output.contracts['index.js']!)
  return { id, contract: output.contracts['index.js']! }
}
