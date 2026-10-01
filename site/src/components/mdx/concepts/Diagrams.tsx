/** Illustrates compilation and variable inheritance for the concepts page. @module */
import { style } from 'zyzz/default'

/** Shows which work happens during compilation and rendering. */
export function Compilation() {
  return (
    <div
      {...styles.pipeline()}
      role="img"
      aria-label="Author typed definitions. Compile rules ahead of time. At render time, return styling props for an element without inserting CSS rules."
    >
      <svg viewBox="0 0 240 170" {...styles.stage()} aria-hidden="true">
        <text x="20" y="30" {...styles.label()}>
          01 / Author
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="68"
          rx="8"
          {...styles.panel()}
        />
        <text x="36" y="79" {...styles.code()}>
          <tspan {...styles.functionName()}>style</tspan>({'{'}
        </text>
        <text x="36" y="101" {...styles.code()}>
          padding: <tspan {...styles.string()}>"1rem"</tspan> {'}'})
        </text>
        <text x="20" y="148" {...styles.detail()}>
          Typed, static definitions
        </text>
      </svg>
      <svg viewBox="0 0 240 170" {...styles.stage()} aria-hidden="true">
        <text x="20" y="30" {...styles.label()}>
          02 / Compile
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="68"
          rx="8"
          {...styles.panel()}
        />
        <text x="36" y="79" {...styles.code()}>
          <tspan {...styles.functionName()}>.generated</tspan> {'{'}
        </text>
        <text x="36" y="101" {...styles.code()}>
          padding: <tspan {...styles.string()}>1rem</tspan>; {'}'}
        </text>
        <text x="20" y="148" {...styles.detail()}>
          CSS + executable styles
        </text>
      </svg>
      <svg viewBox="0 0 240 170" {...styles.stage()} aria-hidden="true">
        <text x="20" y="30" {...styles.label()}>
          03 / Apply
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="68"
          rx="8"
          {...styles.panel()}
        />
        <rect
          x="36"
          y="67"
          width="82"
          height="34"
          rx="6"
          {...styles.button()}
        />
        <text x="77" y="89" textAnchor="middle" {...styles.buttonText()}>
          Save
        </text>
        <text x="20" y="148" {...styles.detail()}>
          Render a styled element
        </text>
      </svg>
    </div>
  )
}

/** Shows nested scopes changing values while component classes stay stable. */
export function Scopes() {
  return (
    <svg
      viewBox="0 0 440 320"
      role="img"
      aria-label="A base variable scope contains a card. An alternate scope nested inside it contains the same card style with a different accent value."
      {...styles.scopes()}
    >
      <rect x="1" y="1" width="438" height="318" rx="12" {...styles.panel()} />
      <text x="24" y="34" {...styles.label()}>
        Base scope
      </text>
      <text x="24" y="60" {...styles.code()}>
        <tspan {...styles.functionName()}>vars</tspan>({'{'} set:{' '}
        <tspan {...styles.string()}>'base'</tspan> {'}'})
      </text>
      <rect
        x="24"
        y="79"
        width="392"
        height="54"
        rx="8"
        {...styles.blueCard()}
      />
      <text x="42" y="112" {...styles.code()}>
        styles.<tspan {...styles.functionName()}>card</tspan>()
      </text>
      <rect
        x="24"
        y="156"
        width="392"
        height="140"
        rx="10"
        {...styles.nested()}
      />
      <text x="42" y="187" {...styles.label()}>
        Alternate scope
      </text>
      <text x="42" y="213" {...styles.code()}>
        <tspan {...styles.functionName()}>vars</tspan>({'{'} set:{' '}
        <tspan {...styles.string()}>'alternate'</tspan> {'}'})
      </text>
      <rect
        x="42"
        y="231"
        width="356"
        height="45"
        rx="8"
        {...styles.purpleCard()}
      />
      <text x="60" y="260" {...styles.code()}>
        styles.<tspan {...styles.functionName()}>card</tspan>()
      </text>
    </svg>
  )
}

namespace styles {
  export const blueCard = style({
    fill: 'blue.100',
    stroke: 'blue.700',
    strokeWidth: 1,
  })

  export const button = style({ fill: 'foreground' })

  export const buttonText = style({
    fill: 'background.primary',
    fontSize: '14px !custom',
    fontWeight: 'medium',
  })

  export const code = style({
    fill: 'foreground',
    fontFamily: 'mono',
    fontSize: '14px !custom',
  })

  export const detail = style({ fill: 'gray.900', fontSize: '14px !custom' })

  export const functionName = style({ fill: 'blue.900' })

  export const label = style({
    fill: 'gray.900',
    fontSize: '12px !custom',
    fontWeight: 'semibold',
  })

  export const nested = style({
    fill: 'background.primary',
    stroke: 'gray.500',
    strokeDasharray: '4 4',
    strokeWidth: 1,
  })

  export const panel = style({
    fill: 'background.primary',
    stroke: 'gray.400',
    strokeWidth: 1,
  })

  export const pipeline = style({
    backgroundColor: 'gray.100',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    marginBlock: 6,
    padding: 3,
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr', padding: 2 },
  })

  export const purpleCard = style({
    fill: 'purple.100',
    stroke: 'purple.700',
    strokeWidth: 1,
  })

  export const scopes = style({
    display: 'block',
    marginBlock: 6,
    maxWidth: 'lg',
    width: '100% !custom',
  })

  export const stage = style({
    display: 'block',
    width: '100% !custom',
    '@media (max-width: 640px)': {
      maxWidth: 'xs',
      marginInline: 'auto !custom',
    },
  })

  export const string = style({ fill: 'green.900' })
}
