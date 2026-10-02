/**
 * Configures repository formatting, lint, integration tests, and coverage.
 * @module
 */
import * as Path from 'node:path'
import { defineConfig } from 'vite-plus'
import { BaseSequencer, type TestSpecification } from 'vite-plus/test/node'
import durations from './test/durations.json' with { type: 'json' }

type Shard = {
  duration: number
  files: TestSpecification[]
}

class Sequencer extends BaseSequencer {
  override async shard(files: readonly TestSpecification[]) {
    const { count, index } = this.ctx.config.shard!
    const shards = Array.from(
      { length: count },
      (): Shard => ({ duration: 0, files: [] }),
    )
    const timings: Readonly<Record<string, number>> = durations.files
    const sorted = files
      .map((file) => ({
        duration:
          timings[Path.relative(this.ctx.config.root, file.moduleId)] ?? 1,
        file,
      }))
      .toSorted(
        (a, b) =>
          b.duration - a.duration ||
          a.file.moduleId.localeCompare(b.file.moduleId),
      )

    for (const entry of sorted) {
      const shard = shards.reduce((shortest, current) =>
        current.duration < shortest.duration ? current : shortest,
      )
      shard.files.push(entry.file)
      shard.duration += entry.duration
    }

    return shards[index - 1]!.files
  }
}

export default defineConfig({
  fmt: {
    ignorePatterns: [
      '.fixture-*/**',
      'dist/**',
      'node_modules/**',
      'pnpm-lock.yaml',
      'src/internal/NativeProperties.ts',
      'src/react-native/internal/NativeSchema.ts',
    ],
    printWidth: 80,
    semi: false,
    singleQuote: true,
    sortPackageJson: false,
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: [
      '.fixture-*/**',
      'dist/**',
      'node_modules/**',
      'src/internal/NativeProperties.ts',
      'src/react-native/internal/NativeSchema.ts',
    ],
    // Formatting and linting stay syntax-only; check:types checks types.
    options: { typeAware: false, typeCheck: false },
    rules: { 'no-unused-vars': 'error' },
  },
  test: {
    benchmark: { exclude: ['bench/native/**', '**/node_modules/**'] },
    alias: {
      zyzz: Path.resolve(import.meta.dirname, 'src'),
    },
    coverage: {
      exclude: [
        'src/**/*.bench-d.ts',
        'src/**/*.bench.ts',
        'src/**/*.test-d.ts',
        'src/**/*.test.ts',
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['json', 'json-summary', 'text'],
      reportOnFailure: true,
    },
    globals: true,
    include: [
      'scripts/**/*.test.ts',
      'site/src/**/*.test.ts',
      'src/**/*.test.ts',
      'test/**/*.test.ts',
    ],
    maxConcurrency: 2,
    name: process.env.ZYZZ_TEST_PROJECT ?? 'integration',
    ...(process.env.ZYZZ_TEST_PROJECT === 'merge'
      ? {
          projects: [
            'css-types-7',
            'css-types-8',
            'integration',
            'next-atomic',
            'next-grouped',
          ].map((name) => ({
            extends: true as const,
            test: { name },
          })),
        }
      : {}),
    sequence: { sequencer: Sequencer },
    testTimeout: 30_000,
  },
})
