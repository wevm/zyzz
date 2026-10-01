/** Renders the Variants guide examples with their authored definitions. @module */
import type { ReactNode } from 'react'
import { cx, type Props as VariantProps, style, variants } from 'zyzz'
import { style as ui } from 'zyzz/default'

/** Shows the compact size with the default primary tone. */
export function Choices() {
  return (
    <Preview name="choices">
      <button
        type="button"
        {...variantsExamplesStyles.choices({ size: 'compact' })}
      >
        Save
      </button>
    </Preview>
  )
}

/** Shows a component forwarding its typed size and disabled props. */
export function Props() {
  return (
    <Preview name="props">
      <Button size="compact">Save</Button>
      <Button disabled>Save</Button>
    </Preview>
  )
}

/** Compares omitted, undefined, false, and null selections. */
export function Defaults() {
  return (
    <Preview name="defaults">
      <span {...variantsExamplesStyles.defaults()}>Omitted</span>
      <span {...variantsExamplesStyles.defaults({ muted: undefined })}>
        undefined
      </span>
      <span {...variantsExamplesStyles.defaults({ muted: false })}>false</span>
      <span {...variantsExamplesStyles.defaults({ muted: null })}>null</span>
    </Preview>
  )
}

/** Shows a quiet tone receiving its compound border. */
export function Compounds() {
  return (
    <Preview name="compounds">
      <button
        type="button"
        {...variantsExamplesStyles.compounds({ tone: 'quiet' })}
      >
        Save
      </button>
    </Preview>
  )
}

/** Lets the browser select the documented size at 768px. */
export function Conditions() {
  return (
    <Preview name="conditions">
      <button
        type="button"
        {...variantsExamplesStyles.conditions({
          conditions: { wide: { size: 'regular' } },
        })}
      >
        Save
      </button>
    </Preview>
  )
}

/** Binds the documented 20px padding payload. */
export function Dynamic() {
  return (
    <Preview name="dynamic">
      <button
        type="button"
        {...variantsExamplesStyles.dynamic({
          size: { custom: { padding: '20px' } },
        })}
      >
        Save
      </button>
    </Preview>
  )
}

/** Combines the compact choice with a keyboard focus ring. */
export function Composition() {
  return (
    <Preview name="composition">
      <button
        type="button"
        {...cx(
          variantsExamplesStyles.composition({ size: 'compact' }),
          variantsExamplesStyles.focusRing(),
        )}
      >
        Save
      </button>
    </Preview>
  )
}

function Button(props: Button.Props) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      {...variantsExamplesStyles.props({ size: props.size })}
    >
      {props.children}
    </button>
  )
}

declare namespace Button {
  type Props = Pick<
    VariantProps.Variants<typeof variantsExamplesStyles.props>,
    'size'
  > & {
    children: ReactNode
    disabled?: boolean | undefined
  }
}

function Preview(props: Preview.Props) {
  return (
    <div
      data-concept-example=""
      data-variant-example={props.name}
      {...variantsExamplesStyles.preview()}
    >
      {props.children}
    </div>
  )
}

declare namespace Preview {
  type Props = {
    children: ReactNode
    name: string
  }
}

namespace variantsExamplesStyles {
  export const choices = variants({
    base: {
      border: '1px solid currentColor',
      borderRadius: '6px',
      display: 'inline-flex',
    },
    defaultVariants: { size: 'regular', tone: 'primary' },
    variants: {
      size: {
        compact: { padding: '4px 8px' },
        regular: { padding: '8px 16px' },
      },
      tone: {
        primary: { backgroundColor: '#06c', color: 'white' },
        quiet: { backgroundColor: 'transparent', color: '#06c' },
      },
    },
  })

  export const props = variants({
    defaultVariants: { size: 'regular' },
    variants: {
      size: {
        compact: { padding: '4px 8px' },
        regular: { padding: '8px 16px' },
      },
    },
  })

  export const defaults = variants({
    base: { opacity: 1 },
    defaultVariants: { muted: true },
    variants: {
      muted: {
        true: { opacity: 0.5 },
        false: { opacity: 1 },
      },
    },
  })

  export const compounds = variants({
    base: { border: '1px solid transparent' },
    compoundVariants: [
      {
        when: { size: ['compact', 'regular'], tone: 'quiet' },
        style: { borderColor: 'currentColor' },
      },
    ],
    defaultVariants: { size: 'regular', tone: 'primary' },
    variants: {
      size: {
        compact: { padding: '4px 8px' },
        regular: { padding: '8px 16px' },
      },
      tone: {
        primary: { backgroundColor: '#06c', color: 'white' },
        quiet: { backgroundColor: 'transparent', color: '#06c' },
      },
    },
  })

  export const conditions = variants({
    base: { borderRadius: '6px' },
    conditions: { wide: '@media (width >= 768px)' },
    defaultVariants: { size: 'compact' },
    variants: {
      size: {
        compact: { padding: '4px 8px' },
        regular: { padding: '8px 16px' },
      },
    },
  })

  export const dynamic = variants({
    compoundVariants: [
      { when: { size: 'custom' }, style: { fontWeight: 600 } },
    ],
    defaultVariants: { size: { custom: { padding: '12px' } } },
    variants: {
      size: {
        compact: { padding: '4px' },
        custom: (values: {
          padding: `${number}px`
        }): { padding: `${number}px` } => ({
          padding: values.padding,
        }),
      },
    },
  })

  export const composition = variants({
    variants: { size: { compact: { padding: '4px 8px' } } },
  })

  export const focusRing = style({
    selectors: {
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px',
      },
    },
  })

  export const preview = ui({
    alignItems: 'center',
    color: '#f5f5f5 !custom',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: 6,
    typography: 'copy.16',
  })
}
