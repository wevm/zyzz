/** Checks real native authoring pipelines before collecting comparison timings. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Compile from './Compile.js'
import * as Corpus from './Corpus.js'

describe('native compiler pipelines', () => {
  for (const library of Corpus.libraries)
    for (const platform of ['ios', 'android'] as const)
      for (const kind of Corpus.kinds)
        test(`${library}/${platform}/${kind}`, () => {
          const output = Compile.compile(library, { count: 10, kind }, platform)
          expect(!!output.code).toMatchInlineSnapshot(`true`)
          expect(!!output.map?.sourcesContent?.length).toMatchInlineSnapshot(
            `true`,
          )
          if (library === 'unistyles')
            expect(
              output.code!.includes(
                'react-native-unistyles/components/native/View',
              ),
            ).toMatchInlineSnapshot(`true`)
          else
            expect(
              output.code!.includes('react-native-unistyles'),
            ).toMatchInlineSnapshot(`false`)
          expect(
            Corpus.source(library, { count: 10, kind }, true) ===
              Corpus.source(library, { count: 10, kind }),
          ).toMatchInlineSnapshot(`false`)
          if (library === 'zyzz') {
            expect(
              output.code!.includes('__zyzzNativeContext.create'),
            ).toMatchInlineSnapshot(`true`)
            expect(
              output.code!.match(/__zyzzNativeContext\.create\(/g)?.length,
            ).toMatchInlineSnapshot(`10`)
          }
          expect(output.code!.includes(' as import(')).toMatchInlineSnapshot(
            `false`,
          )
        })
})
