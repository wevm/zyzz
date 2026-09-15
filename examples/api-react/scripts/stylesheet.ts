/** Derives the stylesheet index from the compiled entry's static import graph. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/**
 * Lists the shared stylesheet, then every non-empty module stylesheet with
 * dependencies before their consumers, so the cascade follows import order.
 * @param outDir - Compiled tree published by the Host.
 * @param entry - Compiled entry module relative to `outDir`.
 * @returns CSS `@import` statements relative to `outDir`.
 */
export async function stylesheet(outDir: string, entry = 'main.tsx') {
  const ordered: string[] = []
  const visited = new Set<string>()

  async function visit(file: string): Promise<void> {
    if (visited.has(file)) return

    visited.add(file)

    const source = await Fs.readFile(Path.join(outDir, file), 'utf8')

    for (const match of source.matchAll(
      /(?:from|import)\s+["'](\.{1,2}\/[^"']+)["']/g,
    )) {
      const target = await resolve(
        Path.posix.join(Path.posix.dirname(file), match[1]!),
      )

      if (target !== undefined) await visit(target)
    }

    ordered.push(file)
  }

  // Compiled imports keep the `.js` suffix while modules keep their authored extension.
  async function resolve(specifier: string) {
    const base = specifier.replace(/\.js$/, '')

    for (const candidate of [`${base}.tsx`, `${base}.ts`, specifier]) {
      if (!/\.[cm]?[jt]sx?$/.test(candidate)) continue

      const exists = await Fs.access(Path.join(outDir, candidate)).then(
        () => true,
        () => false,
      )

      if (exists) return candidate
    }

    return undefined
  }

  await visit(entry)

  const imports: string[] = []

  for (const file of [
    'zyzz.shared.css',
    ...ordered.map((file) => `${file}.css`),
  ]) {
    const content = await Fs.readFile(Path.join(outDir, file), 'utf8').catch(
      () => '',
    )

    if (content.trim()) imports.push(`@import "./${file}";`)
  }

  return imports.join('\n')
}
