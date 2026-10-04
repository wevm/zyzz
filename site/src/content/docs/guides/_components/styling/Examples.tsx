/** Renders the Styling guide examples with their authored definitions. @module */
import { type CSSProperties, type ReactNode, useState } from 'react'
import { cx, style, variable } from 'zyzz'
import { style as ui } from 'zyzz/default'

/** Shows a card and its title styled by two definitions. */
export function Card() {
  // Plain elements keep the article's heading and paragraph styles out of the preview.
  return (
    <Preview name="card">
      <article {...styles.card()}>
        <div {...styles.title()}>Account</div>
        <div>Manage the name, email, and password for this account.</div>
      </article>
    </Preview>
  )
}

/** Shows hover, focus, busy, and viewport styles on one button. */
export function Button() {
  return (
    <Preview name="button">
      <button type="button" {...styles.button()}>
        Save
      </button>
      <button aria-busy="true" type="button" {...styles.button()}>
        Saving
      </button>
      <span {...styles.caption()}>
        Hover or focus the first button. The second is busy.
      </span>
    </Preview>
  )
}

/** Toggles a conditional compact style composed after the base style. */
export function Combine() {
  const [compact, setCompact] = useState(true)

  return (
    <Preview name="combine">
      <label {...styles.toggle()}>
        <input
          checked={compact}
          onChange={(event) => setCompact(event.currentTarget.checked)}
          type="checkbox"
        />
        compact
      </label>
      <button
        type="button"
        {...cx(styles.combined(), compact && styles.compact())}
      >
        Save
      </button>
    </Preview>
  )
}

/** Compares a button with and without a caller's inline padding override. */
export function Overrides() {
  return (
    <Preview name="overrides">
      <OverrideButton>Save</OverrideButton>
      <OverrideButton style={{ padding: '16px 32px' }}>Continue</OverrideButton>
    </Preview>
  )
}

/** Binds a slider value to the documented progress callback. */
export function Meter() {
  const [value, setValue] = useState(50)

  return (
    <Preview name="meter">
      <label {...styles.slider()}>
        Progress: {value}%
        <input
          max="100"
          min="0"
          onChange={(event) => setValue(Number(event.currentTarget.value))}
          type="range"
          value={value}
        />
      </label>
      <div
        aria-label="Upload progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value}
        role="progressbar"
        {...styles.track()}
      >
        <div {...styles.fill({ width: `${value}%` })} />
      </div>
    </Preview>
  )
}

/** Shows the default accent beside an inline accent assignment. */
export function Plans() {
  return (
    <Preview name="plans">
      <Plan />
      <Plan accent="#9333ea" />
    </Preview>
  )
}

function OverrideButton(props: OverrideButton.Props) {
  return (
    <button
      type="button"
      {...styles.overridable({
        className: props.className,
        style: props.style,
      })}
    >
      {props.children}
    </button>
  )
}

declare namespace OverrideButton {
  type Props = {
    children: ReactNode
    className?: string | undefined
    style?: CSSProperties | undefined
  }
}

function Plan(props: Plan.Props) {
  return (
    <section {...styles.plan({ vars: { [variables.accent]: props.accent } })}>
      <div {...styles.name()}>Pro</div>
      <button {...styles.choose()} type="button">
        Choose plan
      </button>
    </section>
  )
}

declare namespace Plan {
  type Props = { accent?: string | undefined }
}

function Preview(props: Preview.Props) {
  return (
    <div
      data-concept-example=""
      data-styling-example={props.name}
      {...styles.preview()}
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

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const button = style({
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    padding: '8px 16px',
    ':hover': { backgroundColor: '#0060df' },
    ':focus-visible': { outline: '2px solid #0070f3', outlineOffset: '2px' },
    '&[aria-busy="true"]': { cursor: 'progress', opacity: 0.6 },
    '@media (min-width: 48rem)': { padding: '12px 24px' },
  })

  export const caption = ui({ color: 'gray.900', typography: 'copy.14' })

  export const card = style({
    border: '1px solid #d4d4d4',
    borderRadius: '8px',
    display: 'grid',
    gap: '4px',
    padding: '1rem',
  })

  export const combined = style({
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    padding: '12px 20px',
  })

  export const compact = style({ padding: '4px 12px' })

  export const choose = style({
    backgroundColor: variables.accent,
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    padding: '8px 16px',
  })

  export const fill = style((values: { width: `${number}%` }) => ({
    backgroundColor: '#0070f3',
    height: '100%',
    width: values.width,
  }))

  export const name = style({ color: variables.accent, margin: 0 })

  export const overridable = style({
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    padding: '8px 16px',
  })

  export const plan = style({
    borderLeft: '4px solid',
    borderLeftColor: variables.accent,
    display: 'grid',
    gap: '8px',
    justifyItems: 'start',
    paddingLeft: '16px',
    vars: { [variables.accent]: '#0070f3' },
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

  export const slider = ui({
    display: 'grid',
    gap: 2,
    typography: 'copy.14',
    width: '100% !custom',
  })

  export const title = style({
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  })

  export const toggle = ui({
    alignItems: 'center',
    display: 'flex',
    gap: 2,
    typography: 'copy.14',
  })

  export const track = style({
    backgroundColor: '#e5e5e5',
    borderRadius: '4px',
    height: '8px',
    overflow: 'hidden',
    width: '100%',
  })
}
