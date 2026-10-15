/** Loads the isolated framework preview independently of the playground interface. @module */
import { loadSandpackClient } from '@codesandbox/sandpack-client'
import type { SandboxSetup } from '@codesandbox/sandpack-client'
import type * as Compiler from './Compiler.js'
import * as Project from './Project.js'

type Assets = Required<Pick<SandboxSetup, 'dependencies' | 'files'>>

// Embedded documents inherit their preferred scheme from the host iframe.
const prelude = `* { box-sizing: border-box; }
:root { color-scheme: light dark; }
body { margin: 0; color: light-dark(#18181b, #ededed); background: light-dark(#fafafa, #0a0a0a); font-family: system-ui, sans-serif; }
button { font: inherit; }
p { margin: 0; line-height: 1.6; }
`

/** Creates one preview client, disposed when its playground unmounts. */
export async function create(
  frame: HTMLIFrameElement,
  options: create.Options,
) {
  const manifest = await fetch('/playground/manifest.json')
  if (!manifest.ok)
    throw new Error(`Could not load preview assets (${manifest.status}).`)
  const { runtime } = await manifest.json()
  const response = await fetch(runtime)
  if (!response.ok)
    throw new Error(`Could not load preview runtime (${response.status}).`)
  const assets: Assets = await response.json()

  const client = await loadSandpackClient(
    frame,
    sandbox(options.output, options.framework, assets),
    {
      height: '100%',
      showErrorScreen: true,
      showLoadingScreen: false,
      showOpenInCodeSandbox: false,
      width: '100%',
    },
  )
  client.listen((message) => {
    if (message.type === 'start') options.onError('')
    // The client can connect before the preview has evaluated its CSS.
    if (message.type === 'done') {
      if (message.compilatonError)
        options.onError('Preview failed. Check the error in the preview.')
      options.onReady()
    }
    if (message.type === 'action' && message.action === 'show-error') {
      options.onError('Preview failed. Check the error in the preview.')
      options.onReady()
    }
  })

  return {
    destroy: () => client.destroy(),
    update: (output: Compiler.Output) =>
      client.updateSandbox(sandbox(output, options.framework, assets)),
  }
}

export declare namespace create {
  type Options = {
    /** Runtime that mounts the project entrypoint. */
    framework: Project.Framework
    /** Receives preview failures, or an empty string when a new build starts. */
    onError: (message: string) => void
    /** Reveals the preview once its CSS or error screen is available. */
    onReady: () => void
    /** First successful compilation, avoiding a second mount during startup. */
    output: Compiler.Output
  }
}

function sandbox(
  output: Compiler.Output,
  framework: Project.Framework,
  assets: Assets,
): SandboxSetup {
  const entry = (() => {
    if (framework === 'vanilla')
      return `import App from './App'; import './styles.css'; document.getElementById('root').replaceChildren(App());`
    return `import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './App'; import './styles.css'; createRoot(document.getElementById('root')).render(<App />);`
  })()

  const files = Object.fromEntries(
    Object.entries(output.files).map((entry) => [
      `/${entry[0]}`,
      { code: entry[1] },
    ]),
  )
  // Sandpack does not resolve NodeNext's .js imports to TypeScript source files.
  // Forward the module exports without changing strings or source diagnostics.
  for (const path of Object.keys(output.files)) {
    const base = path.replace(/\.(?:tsx?|jsx?)$/, '')
    const alias = `/${base}.js`
    if (Object.hasOwn(files, alias)) continue
    const target = ['.ts', '.tsx', '.jsx']
      .map((extension) => base + extension)
      .find((name) => Object.hasOwn(output.files, name))
    if (target)
      files[alias] = {
        code: `module.exports = require(${JSON.stringify(`./${target}`)});`,
      }
  }

  return {
    dependencies: framework === 'react' ? assets.dependencies : {},
    entry: framework === 'react' ? '/index.tsx' : '/index.html',
    files: {
      ...assets.files,
      ...files,
      '/index.html': {
        code: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>${framework === 'react' ? '' : '<script src="./index.js"></script>'}</body></html>`,
      },
      [framework === 'react' ? '/index.tsx' : '/index.js']: {
        code: entry,
      },
      '/styles.css': { code: prelude + output.css },
      '/tsconfig.json': {
        code: JSON.stringify({
          compilerOptions: {
            esModuleInterop: true,
            jsx: framework === 'react' ? 'react-jsx' : 'react',
            target: 'ES2018',
          },
        }),
      },
    },
    template: framework === 'react' ? 'create-react-app-typescript' : 'parcel',
  }
}
