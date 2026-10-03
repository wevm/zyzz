/** Illustrates variable inheritance for the concepts page. @module */
import { style } from 'zyzz/default'

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
        y="81"
        width="392"
        height="54"
        rx="8"
        {...styles.blueCard()}
      />
      <text x="42" y="108" dominantBaseline="central" {...styles.code()}>
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
      <text x="60" y="253.5" dominantBaseline="central" {...styles.code()}>
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

  export const code = style({
    fill: 'foreground',
    typography: 'label.14.mono',
  })

  export const functionName = style({ fill: 'blue.900' })

  export const label = style({
    fill: 'gray.900',
    fontSize: 'xs',
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

  export const string = style({ fill: 'green.900' })
}
