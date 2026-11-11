/** Checks declared part inference through the opt-in public entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { part, type Part } from 'zyzz/base-ui/react'

describe('part', () => {
  test('types the component with the state domains its descriptor declares', () => {
    function ToolRoot(_props: { className?: string | undefined }) {
      return null
    }
    const Root = part(ToolRoot, {
      open: 'boolean',
      status: ['running', 'done', 'failed'],
    })

    expectTypeOf(Root).toExtend<
      typeof ToolRoot &
        Part<{ open: boolean; status: 'running' | 'done' | 'failed' }>
    >()
    expectTypeOf(Root).parameters.toEqualTypeOf<
      [{ className?: string | undefined }]
    >()
    // @ts-expect-error Value states list at least one value.
    part(ToolRoot, { status: [] })
    // @ts-expect-error Presence states use the 'boolean' descriptor.
    part(ToolRoot, { open: true })
    // @ts-expect-error Values are strings.
    part(ToolRoot, { index: [0, 1] })
  })
})
