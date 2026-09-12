/**
 * Supplies a Next.js App Router application and drives its real processes for integration tests.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'

/** Pinned consumer dependencies installed into every fixture. */
export const dependencies = {
  '@types/node': '24.13.3',
  '@types/react': '19.2.18',
  '@types/react-dom': '19.2.7',
  next: '16.3.4',
  react: '19.2.4',
  'react-dom': '19.2.4',
  typescript: '5.9.3',
}

/** Application sources: Server Components, a client component, streaming, a second route, and config. */
export const files = {
  'app/Counter.tsx': `'use client';
import { useEffect, useState } from 'react';
import { styles, theme } from './styles';
declare global { interface Window { original?: Element | null } }
export function Counter() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.identity = String(window.original === document.querySelector('#card'));
    document.documentElement.dataset.ready = 'true';
  }, []);
  return <section className={theme.className} style={{ colorScheme: expanded ? 'dark' : 'light', width: '400px' }}>
    <div id="bar" {...styles.bar({ width: expanded ? '75%' : '25%', ...(expanded ? {} : { style: { marginTop: '12px' } }) })}>Bar</div>
    <button id="toggle" onClick={() => setExpanded((value) => !value)}>Toggle</button>
  </section>;
}
`,
  'app/Slow.tsx': `import { styles } from './styles';
export async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return <p id="streamed" {...styles.note()}>Streamed</p>;
}
`,
  'app/about/page.tsx': `import Link from 'next/link';
import { styles } from '../styles';
export default function About() {
  return <main><h1 id="about" {...styles.title()}>About</h1><Link id="home" href="/">Home</Link></main>;
}
`,
  'app/globals.ts': `import { global } from 'zyzz/web';
global({ body: { margin: 0 } });
`,
  'app/layout.tsx': `import Link from 'next/link';
import './globals';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    {children}
    <nav><Link id="about-link" href="/about">About</Link></nav>
    <script dangerouslySetInnerHTML={{ __html: 'window.original = document.querySelector("#card")' }} />
  </body></html>;
}
`,
  'app/page.tsx': `import { Suspense } from 'react';
import { Counter } from './Counter';
import { Slow } from './Slow';
import { styles } from './styles';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <main id="card" {...styles.card()}>
    <p id="env">{process.env.FIXTURE_FLAG}</p>
    <p id="composed">__BANNER__</p>
    <Counter />
    <Suspense fallback={<p id="pending">Loading</p>}><Slow /></Suspense>
  </main>;
}
`,
  'app/styles.ts': `import { css, theme } from '../zyzz.config';
export { theme };
export namespace styles {
  export const bar = css((values: { width: \`\${number}%\` }) => ({ backgroundColor: 'brand', color: 'text', height: '20px', width: values.width }));
  export const card = css({ color: 'brand', padding: 'md' });
  export const note = css({ fontWeight: 700 });
  export const title = css({ '@layer components': { color: 'brand' } });
}
`,
  'banner-loader.mjs': `export default function loader(source) {
  return source.replace('__BANNER__', 'composed');
}
`,
  'next.config.ts': `import type { NextConfig } from 'next';
import * as Path from 'node:path';
import { zyzz } from 'zyzz/next';
const banner = Path.join(process.cwd(), 'banner-loader.mjs');
const nextConfig: NextConfig = {
  agentRules: false,
  env: { FIXTURE_FLAG: 'kept' },
  reactStrictMode: true,
  turbopack: { rules: { '*.tsx': { loaders: [banner] } } },
  // Applied React style props do not yet satisfy React.CSSProperties; types.tsx checks the rest.
  typescript: { ignoreBuildErrors: true },
  webpack(config) {
    config.module.rules.push({ test: /page\\.tsx$/, use: [banner] });
    return config;
  },
};
export default zyzz(nextConfig);
`,
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      allowJs: true,
      esModuleInterop: true,
      incremental: true,
      isolatedModules: true,
      jsx: 'react-jsx',
      lib: ['dom', 'dom.iterable', 'esnext'],
      module: 'esnext',
      moduleResolution: 'bundler',
      noEmit: true,
      paths: { '@/*': ['./*'] },
      plugins: [{ name: 'next' }],
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: 'ES2017',
    },
    exclude: ['node_modules'],
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
  }),
  'types.tsx': `import type { NextConfig } from 'next';
import { zyzz } from 'zyzz/next';
import { styles } from './app/styles';
const config: NextConfig = zyzz({ reactStrictMode: true });
const props: { className: string } = styles.card();
const bar: { className: string } = styles.bar({ width: '25%' });
// @ts-expect-error The dynamic width requires CSS percentage units.
styles.bar({ width: 25 });
// @ts-expect-error Unknown value keys remain rejected.
styles.bar({ width: '25%', missing: true });
// @ts-expect-error Function-valued configurations remain unsupported.
zyzz(() => ({}));
export { bar, config, props };
`,
  'zyzz.config.ts': `import { Config } from 'zyzz';
export const { css, theme } = Config.create({
  layers: ['components'],
  theme: { color: { brand: '#0066cc', text: { light: '#000000', dark: '#ffffff' } }, spacing: { md: '16px' } },
});
`,
}

/**
 * Installs the pinned dependencies, links the built package, and writes the application.
 * @returns The fixture root.
 */
export async function create(root: string) {
  await Fs.mkdir(Path.join(root, 'app/about'), { recursive: true })
  // Native light-dark() needs final CSS targets that support it; Next.js reads browserslist.
  await Fs.writeFile(
    Path.join(root, 'package.json'),
    JSON.stringify({
      browserslist: ['chrome 123', 'firefox 128', 'safari 17.5'],
      dependencies,
      private: true,
      type: 'module',
    }),
  )
  await exec(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
    ],
    { cwd: root, timeout: 180000 },
  )
  await Fs.symlink(
    Path.resolve('.'),
    Path.join(root, 'node_modules/zyzz'),
    'dir',
  )

  for (const [name, content] of Object.entries(files))
    await Fs.writeFile(Path.join(root, name), content)

  return root
}

/**
 * Runs a Next.js command to completion.
 * @returns Combined standard output and error text.
 */
export async function run(root: string, args: readonly string[]) {
  const result = await exec(
    process.execPath,
    [Path.join(root, 'node_modules/next/dist/bin/next'), ...args],
    { cwd: root, env: environment(), maxBuffer: 64 * 1024 * 1024 },
  )

  return `${result.stdout}\n${result.stderr}`
}

/**
 * Starts a Next.js server on a free port and waits for its announced URL.
 * @returns The local URL, captured output, and an explicit stop operation.
 */
export function start(root: string, args: readonly string[]) {
  const child = ChildProcess.spawn(
    process.execPath,
    [
      Path.join(root, 'node_modules/next/dist/bin/next'),
      ...args,
      '--hostname',
      '127.0.0.1',
      '--port',
      '0',
    ],
    { cwd: root, env: environment(), stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const output: string[] = []
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => resolve()),
  )

  const url = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Next.js did not start:\n${output.join('')}`))
    }, 120000)

    function onData(chunk: Buffer) {
      const text = chunk.toString()

      output.push(text)

      const match = output.join('').match(/Local:\s+(http:\/\/\S+)/)
      if (!match) return

      clearTimeout(timer)
      resolve(match[1]!.replace(/\/$/, ''))
    }

    child.stdout!.on('data', onData)
    child.stderr!.on('data', onData)
    void exited.then(() => {
      clearTimeout(timer)
      reject(new Error(`Next.js exited:\n${output.join('')}`))
    })
  })

  return {
    output,
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM')

        const forced = setTimeout(() => child.kill('SIGKILL'), 10000)

        await exited
        clearTimeout(forced)
      }
    },
    url,
  }
}

const exec = Util.promisify(ChildProcess.execFile)

// Telemetry and colored logs are disabled so process output stays deterministic and offline.
function environment() {
  return { ...process.env, FORCE_COLOR: '0', NEXT_TELEMETRY_DISABLED: '1' }
}
