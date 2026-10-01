/** Displays the historical benchmark snapshot as labeled SVG delivery charts. @module */
import { Children, isValidElement, type ReactNode } from 'react'
import { style } from '../../../zyzz.config.js'

/** Scopes typography for this page's nested benchmark sections. */
export function BenchmarkContent(props: BenchmarkContent.Props) {
  return <section {...styles.content()}>{props.children}</section>
}

export declare namespace BenchmarkContent {
  /** Properties for the page content. */
  type Props = {
    /** The benchmark prose, figures, and measurements. */
    children: ReactNode
  }
}

/** Charts CSS and JavaScript gzip bytes for the two literal workloads. */
export function LiteralDelivery() {
  return (
    <div {...styles.grid()}>
      {charts.slice(0, 2).map((chart) => (
        <Delivery key={chart.subtitle + chart.title} chart={chart} />
      ))}
    </div>
  )
}

/** Charts both theme workloads on the same byte scale. */
export function ThemeDelivery() {
  return (
    <div {...styles.grid()}>
      {charts.slice(2).map((chart) => (
        <Delivery key={chart.subtitle} chart={chart} />
      ))}
    </div>
  )
}

/** Keeps complete benchmark tables readable without widening the page. */
export function Results(props: Results.Props) {
  const lines = text(props.children).trim().split('\n')
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim()),
  )
  const headings = rows[0] ?? []
  const alignment = rows[1] ?? []

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Benchmark measurements"
      {...styles.results()}
    >
      <table>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th
                key={heading}
                scope="col"
                style={{
                  textAlign: alignment[index]?.endsWith(':') ? 'right' : 'left',
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(2).map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td
                  key={index}
                  style={{
                    textAlign: alignment[index]?.endsWith(':')
                      ? 'right'
                      : 'left',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export declare namespace Results {
  /** Properties for the benchmark table region. */
  type Props = {
    /** A pipe-delimited Markdown table, retained in the Markdown route. */
    children: ReactNode
  }
}

function Delivery(props: Delivery.Props) {
  const chart = props.chart
  const scale = 320 / chart.maximum

  return (
    <figure {...styles.figure()}>
      <figcaption {...styles.caption()}>
        <span {...styles.eyebrow()}>{chart.subtitle}</span>
        <span {...styles.title()}>{chart.title}</span>
        <span {...styles.unit()}>Gzip bytes · lower is better</span>
      </figcaption>
      <svg
        aria-label={`${chart.subtitle}, ${chart.title}. Gzip bytes for CSS plus client JavaScript.`}
        role="img"
        viewBox="0 0 360 330"
        {...styles.chart()}
      >
        <title>{`${chart.subtitle}: ${chart.title}`}</title>
        <desc>
          Solid bars are CSS. Pale bars are JavaScript. Values are total gzip
          bytes, from the September 8, 2026 snapshot. The linear scale starts at
          zero.
        </desc>
        {[0, chart.maximum / 2, chart.maximum].map((value) => (
          <g key={value}>
            <line
              x1={20 + value * scale}
              x2={20 + value * scale}
              y1="30"
              y2="276"
              {...styles.line()}
            />
            <text
              x={20 + value * scale}
              y="18"
              textAnchor={
                value === 0
                  ? 'start'
                  : value === chart.maximum
                    ? 'end'
                    : 'middle'
              }
              {...styles.tick()}
            >
              {value.toLocaleString('en-US')}
            </text>
          </g>
        ))}
        {chart.rows.map((row, index) => (
          <g
            key={row.name}
            transform={`translate(20 ${42 + index * 48})`}
            {...(row.name === 'Zyzz' ? styles.zyzz() : styles.competitor())}
          >
            <text y="0" {...styles.label()}>
              {row.name}
            </text>
            <text x="320" y="0" textAnchor="end" {...styles.value()}>
              {(row.css + row.javascript).toLocaleString('en-US')} B
            </text>
            <rect
              height="12"
              width={row.css * scale}
              y="12"
              fill="currentColor"
            />
            <rect
              height="12"
              width={row.javascript * scale}
              x={row.css * scale}
              y="12"
              fill="currentColor"
              opacity="0.28"
            />
          </g>
        ))}
        <g transform="translate(20 300)" {...styles.competitor()}>
          <rect height="8" width="8" fill="currentColor" />
          <text x="15" y="8" {...styles.tick()}>
            CSS
          </text>
          <rect
            height="8"
            width="8"
            x="70"
            fill="currentColor"
            opacity="0.28"
          />
          <text x="85" y="8" {...styles.tick()}>
            Client JavaScript
          </text>
        </g>
      </svg>
    </figure>
  )
}

declare namespace Delivery {
  type Props = { chart: (typeof charts)[number] }
}

function text(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (isValidElement<{ children?: ReactNode }>(child))
        return text(child.props.children)
      return String(child)
    })
    .join('')
}

// Values come from run 34204628141. Each asset is compressed independently.
const charts = [
  {
    maximum: 8000,
    rows: [
      { css: 436, javascript: 6478, name: 'Panda CSS' },
      { css: 181, javascript: 663, name: 'StyleX' },
      { css: 219, javascript: 1057, name: 'Tailwind' },
      { css: 2094, javascript: 2449, name: 'vanilla-extract' },
      { css: 111, javascript: 362, name: 'Zyzz' },
    ],
    subtitle: '1,000 components',
    title: 'Repeated styles',
  },
  {
    maximum: 16000,
    rows: [
      { css: 5287, javascript: 9320, name: 'Panda CSS' },
      { css: 7806, javascript: 6204, name: 'StyleX' },
      { css: 5026, javascript: 3508, name: 'Tailwind' },
      { css: 5640, javascript: 2449, name: 'vanilla-extract' },
      { css: 4669, javascript: 2606, name: 'Zyzz' },
    ],
    subtitle: '1,000 components',
    title: 'Unique padding',
  },
  {
    maximum: 7000,
    rows: [
      { css: 545, javascript: 5564, name: 'Panda CSS' },
      { css: 319, javascript: 461, name: 'StyleX' },
      { css: 298, javascript: 413, name: 'Tailwind' },
      { css: 203, javascript: 389, name: 'vanilla-extract' },
      { css: 256, javascript: 389, name: 'Zyzz' },
    ],
    subtitle: '10 components',
    title: 'Two theme scopes',
  },
  {
    maximum: 7000,
    rows: [
      { css: 945, javascript: 5928, name: 'Panda CSS' },
      { css: 1064, javascript: 1007, name: 'StyleX' },
      { css: 686, javascript: 661, name: 'Tailwind' },
      { css: 640, javascript: 596, name: 'vanilla-extract' },
      { css: 615, javascript: 603, name: 'Zyzz' },
    ],
    subtitle: '100 components',
    title: 'Two theme scopes',
  },
] as const

namespace styles {
  export const caption = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    paddingInline: 5,
    paddingTop: 5,
  })

  export const chart = style({
    display: 'block',
    height: 'auto !custom',
    width: '100% !custom',
  })

  export const competitor = style({ color: 'gray.900' })

  export const content = style({
    '& h3': { typography: 'heading.20', marginTop: 8, marginBottom: 4 },
    '& h4': {
      typography: 'label.16',
      fontWeight: 'medium',
      marginTop: 6,
      marginBottom: 3,
    },
  })

  export const eyebrow = style({ typography: 'label.12', color: 'gray.900' })

  export const figure = style({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    margin: 0,
    overflow: 'hidden',
  })

  export const grid = style({
    display: 'grid',
    gap: 4,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    marginBlock: 6,
    '@media (max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  })

  export const label = style({
    fill: 'currentColor !custom',
    fontSize: '13px !custom',
    fontWeight: 'medium',
  })

  export const line = style({
    color: 'gray.400',
    stroke: 'currentColor !custom',
    strokeDasharray: '2 4',
  })

  export const results = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginBlock: 6,
    overflowX: 'auto',
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
    '& table': {
      borderCollapse: 'collapse',
      fontSize: '13px !custom',
      minWidth: '680px !custom',
      width: '100% !custom',
    },
    '& th, & td': {
      borderBottom: '1px solid',
      borderColor: 'gray.400',
      padding: 3,
      whiteSpace: 'normal',
    },
    '& th': {
      backgroundColor: 'gray.100',
      color: 'foreground',
      fontWeight: 'medium',
    },
    '& td': { color: 'gray.900', fontVariantNumeric: 'tabular-nums' },
    '& tr:last-child td': { borderBottom: 'none' },
  })

  export const tick = style({
    color: 'gray.900',
    fill: 'currentColor !custom',
    fontSize: '11px !custom',
    fontVariantNumeric: 'tabular-nums',
  })

  export const title = style({
    typography: 'label.16',
    color: 'foreground',
    fontWeight: 'medium',
  })

  export const unit = style({ typography: 'copy.13', color: 'gray.900' })

  export const value = style({
    fill: 'currentColor !custom',
    fontFamily: 'Geist Mono !custom',
    fontSize: '12px !custom',
    fontVariantNumeric: 'tabular-nums',
  })

  export const zyzz = style({ color: 'blue.900' })
}
