/**
 * Builds the native addon with profile-guided optimization. An instrumented build compiles the
 * repository's authored modules through `scripts/train-binding.ts`, and the release build lays out
 * and inlines code for the paths that training exercised.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

const root = Path.resolve(import.meta.dirname, '..')
const profiles = Path.join(root, 'target/pgo')
const merged = Path.join(profiles, 'merged.profdata')
const napi = [
  'exec',
  'napi',
  'build',
  '--platform',
  '--package-json-path',
  'crates/binding/package.json',
  '--manifest-path',
  'crates/binding/Cargo.toml',
  '--output-dir',
  'binding',
  '--no-js',
]

// 1. Instrument a release build, since profiles match only code built with the same
// optimizations. Its own target directory keeps the release cache's flags.
Fs.rmSync(profiles, { force: true, recursive: true })
Fs.mkdirSync(profiles, { recursive: true })
build(['--release'], `-Cprofile-generate=${profiles}`, {
  CARGO_TARGET_DIR: Path.join(root, 'target/pgo-instrumented'),
})

// 2. Train in a separate process, which writes its profile when it exits.
ChildProcess.execFileSync(
  process.execPath,
  [Path.join(root, 'scripts/train-binding.ts')],
  { cwd: root, stdio: 'inherit' },
)

// 3. Merge the raw profiles and build the release addon from them.
ChildProcess.execFileSync(
  profdata(),
  [
    'merge',
    '-o',
    merged,
    ...Fs.readdirSync(profiles)
      .filter((file) => file.endsWith('.profraw'))
      .map((file) => Path.join(profiles, file)),
  ],
  { cwd: root, stdio: 'inherit' },
)
build(['--release'], `-Cprofile-use=${merged}`, {})

/** Runs `napi build` with extra rustc flags. */
function build(
  args: readonly string[],
  flags: string,
  env: Readonly<Record<string, string>>,
): void {
  // `RUSTFLAGS` replaces target flags from `.cargo/config.toml`, so the MSVC build restates its
  // static runtime.
  const rustflags = [
    process.env.RUSTFLAGS,
    process.platform === 'win32' ? '-Ctarget-feature=+crt-static' : undefined,
    flags,
  ]
    .filter(Boolean)
    .join(' ')

  ChildProcess.execFileSync('pnpm', [...napi, ...args], {
    cwd: root,
    env: { ...process.env, ...env, RUSTFLAGS: rustflags },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
}

/** Locates `llvm-profdata` from the toolchain's `llvm-tools` component. */
function profdata(): string {
  const rustc = (args: readonly string[]) =>
    ChildProcess.execFileSync('rustc', args, { cwd: root, encoding: 'utf8' })
  const host = /^host: (.+)$/m.exec(rustc(['-vV']))?.[1]
  const path = Path.join(
    rustc(['--print', 'sysroot']).trim(),
    'lib/rustlib',
    host ?? '',
    'bin',
    process.platform === 'win32' ? 'llvm-profdata.exe' : 'llvm-profdata',
  )

  if (!Fs.existsSync(path))
    throw new Error(
      `llvm-profdata is missing at ${path}. Install the toolchain's llvm-tools component.`,
    )

  return path
}
