/**
 * Builds the native addon with profile-guided optimization. An instrumented build compiles the
 * repository's authored modules through `scripts/train-binding.ts`, and the release build lays out
 * and inlines code for the paths that training exercised. Windows ARM64 uses an uninstrumented
 * release build until its toolchain emits valid profiles.
 *
 * `--target <triple>` selects one of the napi targets in `crates/binding/package.json`, and
 * defaults to the host. Training runs the instrumented addon, so the host must be able to load it.
 * Linux glibc targets link against the glibc 2.17 sysroot from `@napi-rs/cross-toolchain`, so the
 * addon also loads on distributions older than the build machine.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Util from 'node:util'

import { parseTriple } from '@napi-rs/cli'

const root = Path.resolve(import.meta.dirname, '..')
const profiles = Path.join(root, 'target/pgo')
const merged = Path.join(profiles, 'merged.profdata')

const { values } = Util.parseArgs({ options: { target: { type: 'string' } } })
const target = values.target ?? host()
const napi = [
  'exec',
  'napi',
  'build',
  '--platform',
  '--target',
  target,
  ...(target.endsWith('-linux-gnu') ? ['--use-napi-cross'] : []),
  '--package-json-path',
  'crates/binding/package.json',
  '--manifest-path',
  'crates/binding/Cargo.toml',
  '--output-dir',
  'binding',
  '--no-js',
]

// napi-rs names a cross linker for some targets, such as `aarch64-linux-musl-gcc`, even when the
// build runs on that target, so a native musl build links with the system compiler.
const linker =
  target.endsWith('-linux-musl') && target === host()
    ? {
        [`CARGO_TARGET_${target.toUpperCase().replaceAll('-', '_')}_LINKER`]:
          'cc',
      }
    : {}

// Windows ARM64 emits malformed profile names with the pinned Rust toolchain, even when
// training succeeds. Keep the native release addon, including LTO and the static CRT, without
// accepting corrupt profiles or falling back after arbitrary build failures.
// https://github.com/rust-lang/rust/issues/150123
// https://github.com/rust-lang/rust/issues/156675
if (target === 'aarch64-pc-windows-msvc') {
  console.warn(
    `Building ${target} without PGO because its profiles are malformed.`,
  )
  build(['--release'], '', {})
  process.exit(0)
}

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
  [
    Path.join(root, 'scripts/train-binding.ts'),
    Path.join(
      root,
      'binding',
      `zyzz.${parseTriple(target).platformArchABI}.node`,
    ),
  ],
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
    target.endsWith('-windows-msvc')
      ? '-Ctarget-feature=+crt-static'
      : undefined,
    flags,
  ]
    .filter(Boolean)
    .join(' ')

  ChildProcess.execFileSync('pnpm', [...napi, ...args], {
    cwd: root,
    env: { ...linker, ...process.env, ...env, RUSTFLAGS: rustflags },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
}

/** Reads the host triple from `rustc`. */
function host(): string {
  const triple = /^host: (.+)$/m.exec(rustc(['-vV']))?.[1]

  if (!triple) throw new Error('rustc -vV did not report a host triple.')

  return triple
}

/** Locates `llvm-profdata` from the toolchain's `llvm-tools` component. */
function profdata(): string {
  const path = Path.join(
    rustc(['--print', 'sysroot']).trim(),
    'lib/rustlib',
    host(),
    'bin',
    process.platform === 'win32' ? 'llvm-profdata.exe' : 'llvm-profdata',
  )

  if (!Fs.existsSync(path))
    throw new Error(
      `llvm-profdata is missing at ${path}. Install the toolchain's llvm-tools component.`,
    )

  return path
}

/** Runs `rustc` from the repository's pinned toolchain. */
function rustc(args: readonly string[]): string {
  return ChildProcess.execFileSync('rustc', args, {
    cwd: root,
    encoding: 'utf8',
  })
}
