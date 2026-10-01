/** Illustrates compilation and variable inheritance for the concepts page. @module */
import { style } from 'zyzz/default'

/** Shows which work happens during compilation and rendering. */
export function Compilation() {
  return (
    <div
      {...conceptsDiagramsStyles.pipeline()}
      role="img"
      aria-label="Author typed definitions. Compile rules ahead of time. At render time, return styling props for an element without inserting CSS rules."
    >
      <svg
        viewBox="0 0 240 174"
        {...conceptsDiagramsStyles.stage()}
        aria-hidden="true"
      >
        <text x="20" y="30" {...conceptsDiagramsStyles.label()}>
          01 / Author
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="92"
          rx="8"
          {...conceptsDiagramsStyles.panel()}
        />
        <text x="36" y="81" {...conceptsDiagramsStyles.code()}>
          <tspan {...conceptsDiagramsStyles.functionName()}>style</tspan>({'{'}
        </text>
        <text x="48" y="102" {...conceptsDiagramsStyles.code()}>
          padding: <tspan {...conceptsDiagramsStyles.string()}>"1rem"</tspan>
        </text>
        <text x="36" y="123" {...conceptsDiagramsStyles.code()}>
          {'}'})
        </text>
        <text x="20" y="162" {...conceptsDiagramsStyles.detail()}>
          Typed, static definitions
        </text>
      </svg>
      <svg
        viewBox="0 0 240 174"
        {...conceptsDiagramsStyles.stage()}
        aria-hidden="true"
      >
        <text x="20" y="30" {...conceptsDiagramsStyles.label()}>
          02 / Compile
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="92"
          rx="8"
          {...conceptsDiagramsStyles.panel()}
        />
        <text x="36" y="81" {...conceptsDiagramsStyles.code()}>
          <tspan {...conceptsDiagramsStyles.functionName()}>.generated</tspan>{' '}
          {'{'}
        </text>
        <text x="48" y="102" {...conceptsDiagramsStyles.code()}>
          padding: <tspan {...conceptsDiagramsStyles.string()}>1rem</tspan>;
        </text>
        <text x="36" y="123" {...conceptsDiagramsStyles.code()}>
          {'}'}
        </text>
        <text x="20" y="162" {...conceptsDiagramsStyles.detail()}>
          CSS + executable styles
        </text>
      </svg>
      <svg
        viewBox="0 0 240 174"
        {...conceptsDiagramsStyles.stage()}
        aria-hidden="true"
      >
        <text x="20" y="30" {...conceptsDiagramsStyles.label()}>
          03 / Apply
        </text>
        <rect
          x="20"
          y="50"
          width="200"
          height="92"
          rx="8"
          {...conceptsDiagramsStyles.panel()}
        />
        <rect
          x="79"
          y="79"
          width="82"
          height="34"
          rx="6"
          {...conceptsDiagramsStyles.button()}
        />
        <text
          x="120"
          y="101"
          textAnchor="middle"
          {...conceptsDiagramsStyles.buttonText()}
        >
          Save
        </text>
        <text x="20" y="162" {...conceptsDiagramsStyles.detail()}>
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
      {...conceptsDiagramsStyles.scopes()}
    >
      <rect
        x="1"
        y="1"
        width="438"
        height="318"
        rx="12"
        {...conceptsDiagramsStyles.panel()}
      />
      <text x="24" y="34" {...conceptsDiagramsStyles.label()}>
        Base scope
      </text>
      <text x="24" y="60" {...conceptsDiagramsStyles.code()}>
        <tspan {...conceptsDiagramsStyles.functionName()}>vars</tspan>({'{'}{' '}
        set: <tspan {...conceptsDiagramsStyles.string()}>'base'</tspan> {'}'})
      </text>
      <rect
        x="24"
        y="81"
        width="392"
        height="54"
        rx="8"
        {...conceptsDiagramsStyles.blueCard()}
      />
      <text
        x="42"
        y="108"
        dominantBaseline="central"
        {...conceptsDiagramsStyles.code()}
      >
        styles.<tspan {...conceptsDiagramsStyles.functionName()}>card</tspan>()
      </text>
      <rect
        x="24"
        y="156"
        width="392"
        height="140"
        rx="10"
        {...conceptsDiagramsStyles.nested()}
      />
      <text x="42" y="187" {...conceptsDiagramsStyles.label()}>
        Alternate scope
      </text>
      <text x="42" y="213" {...conceptsDiagramsStyles.code()}>
        <tspan {...conceptsDiagramsStyles.functionName()}>vars</tspan>({'{'}{' '}
        set: <tspan {...conceptsDiagramsStyles.string()}>'alternate'</tspan>{' '}
        {'}'})
      </text>
      <rect
        x="42"
        y="231"
        width="356"
        height="45"
        rx="8"
        {...conceptsDiagramsStyles.purpleCard()}
      />
      <text
        x="60"
        y="253.5"
        dominantBaseline="central"
        {...conceptsDiagramsStyles.code()}
      >
        styles.<tspan {...conceptsDiagramsStyles.functionName()}>card</tspan>()
      </text>
    </svg>
  )
}

namespace conceptsDiagramsStyles {
  export const blueCard = style({
    fill: 'blue.100',
    stroke: 'blue.700',
    strokeWidth: 1,
  })

  export const button = style({ fill: 'foreground' })

  export const buttonText = style({
    fill: 'background.primary',
    typography: 'button.14',
  })

  export const code = style({
    fill: 'foreground',
    typography: 'label.14.mono',
  })

  export const detail = style({ fill: 'gray.900', fontSize: 'xs' })

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
