/** Loads the isolated React preview independently of the playground interface. @module */
import { loadSandpackClient } from '@codesandbox/sandpack-client'
import type { SandboxSetup } from '@codesandbox/sandpack-client'
import assets from './assets.generated.json'
import type * as Compiler from './Compiler.js'

const prelude = `* { box-sizing: border-box; }
body { margin: 0; color: #18181b; background: white; font-family: system-ui, sans-serif; }
button { font: inherit; }
p { margin: 0; line-height: 1.6; }
`

/** Creates one preview client, disposed when its playground unmounts. */
export async function create(
  frame: HTMLIFrameElement,
  options: create.Options,
) {
  const client = await loadSandpackClient(
    frame,
    sandbox({
      css: '',
      files: { 'App.tsx': 'export default function App() { return null }' },
    }),
    {
      height: '100%',
      showErrorScreen: true,
      showLoadingScreen: true,
      showOpenInCodeSandbox: false,
      width: '100%',
    },
  )
  client.listen((message) => {
    if (message.type === 'start') options.onError('')
    if (message.type === 'done' && message.compilatonError)
      options.onError('Preview failed. Check the error in the preview.')
    if (message.type === 'action' && message.action === 'show-error')
      options.onError('Preview failed. Check the error in the preview.')
  })

  return {
    destroy: () => client.destroy(),
    update: (output: Compiler.Output) => client.updateSandbox(sandbox(output)),
  }
}

export declare namespace create {
  type Options = {
    /** Receives preview failures, or an empty string when a new build starts. */
    onError: (message: string) => void
  }
}

function sandbox(output: Compiler.Output): SandboxSetup {
  return {
    dependencies: assets.dependencies,
    entry: '/index.tsx',
    files: {
      ...assets.files,
      ...Object.fromEntries(
        Object.entries(output.files).map((entry) => [
          `/${entry[0]}`,
          { code: entry[1] },
        ]),
      ),
      '/index.html': {
        code: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
      },
      '/index.tsx': {
        code: `import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './App'; import './styles.css'; createRoot(document.getElementById('root')).render(<App />);`,
      },
      '/styles.css': { code: prelude + output.css },
      '/tsconfig.json': {
        code: JSON.stringify({
          compilerOptions: {
            esModuleInterop: true,
            jsx: 'react-jsx',
            target: 'ESNext',
          },
        }),
      },
    },
    template: 'create-react-app-typescript',
  }
}
