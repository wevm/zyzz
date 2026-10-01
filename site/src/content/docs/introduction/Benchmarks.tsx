/** Displays the historical benchmark snapshot as labeled SVG delivery charts. @module */
import {
  Children,
  isValidElement,
  type ReactNode,
  useId,
  useState,
} from 'react'
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

/** Shades measured values relative to Zyzz while retaining the original table. */
export function Results(props: Results.Props) {
  const lines = text(props.children).trim().split('\n')
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim()),
  )
  const alignment = rows[1] ?? []
  const headings = rows[0] ?? []
  const measurements = rows.slice(2)
  const referenceColumn = headings.findIndex(
    (heading) => heading.toLowerCase() === 'zyzz',
  )
  const referenceRow = measurements.find(
    (row) => row[0]?.toLowerCase() === 'zyzz',
  )
  const comparison = referenceColumn >= 0 || referenceRow !== undefined

  return (
    <div {...styles.results()}>
      <div
        tabIndex={0}
        role="region"
        aria-label="Benchmark measurements"
        {...styles.tableScroll()}
      >
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  data-reference={index === referenceColumn || undefined}
                  style={{
                    textAlign:
                      comparison && index > 0
                        ? 'center'
                        : alignment[index]?.endsWith(':')
                          ? 'right'
                          : 'left',
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measurements.map((row) => (
              <tr
                key={row[0]}
                data-reference={row === referenceRow || undefined}
              >
                {row.map((cell, index) => {
                  const value = Number(cell)
                  const reference = Number(
                    referenceColumn >= 0
                      ? row[referenceColumn]
                      : referenceRow?.[index],
                  )
                  const measured =
                    index > 0 &&
                    comparison &&
                    Number.isFinite(value) &&
                    reference > 0
                  const baseline =
                    measured &&
                    (index === referenceColumn || row === referenceRow)
                  const ratio = value / reference
                  const values =
                    referenceColumn >= 0
                      ? row.slice(1).map(Number)
                      : measurements.map((entry) => Number(entry[index]))
                  const lowest = measured && value === Math.min(...values)
                  const intensity =
                    0.06 + Math.min(1, Math.abs(Math.log2(ratio)) / 2.5) * 0.22
                  const direction = baseline
                    ? 'baseline'
                    : ratio < 1
                      ? 'smaller'
                      : ratio > 1
                        ? 'larger'
                        : 'equal'

                  return (
                    <td
                      key={index}
                      data-comparison={measured ? direction : undefined}
                      data-lowest={lowest || undefined}
                      style={{
                        textAlign: measured
                          ? 'center'
                          : alignment[index]?.endsWith(':')
                            ? 'right'
                            : 'left',
                      }}
                    >
                      {measured && (
                        <span
                          aria-hidden="true"
                          data-tint=""
                          {...styles.tint()}
                          style={{ opacity: baseline ? 1 : intensity }}
                        />
                      )}
                      <span {...(measured ? styles.measurement() : {})}>
                        {cell}
                      </span>
                      {measured && (
                        <span {...styles.ratio()}>
                          {baseline ? 'reference' : `${ratio.toFixed(2)}× Zyzz`}
                          {lowest && (
                            <span {...styles.lowest()}> · lowest</span>
                          )}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison && (
        <footer {...styles.legend()}>
          <span>
            <i data-smaller="" {...styles.swatch()} />
            Lower
          </span>
          <span>
            <i data-baseline="" {...styles.swatch()} />
            Zyzz reference
          </span>
          <span>
            <i data-larger="" {...styles.swatch()} />
            Higher
          </span>
          <span {...styles.legendNote()}>Ratios use the displayed values.</span>
        </footer>
      )}
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

function Delivery(props: Delivery.Props) {
  const chart = props.chart
  const [active, setActive] = useState<number | null>(null)
  const tooltipId = useId()
  const row = active === null ? undefined : chart.rows[active]
  const scale = 205 / chart.maximum

  return (
    <figure {...styles.figure()}>
      <figcaption {...styles.caption()}>
        <span {...styles.eyebrow()}>{chart.subtitle}</span>
        <span {...styles.title()}>{chart.title}</span>
        <span {...styles.unit()}>Gzip bytes · lower is better</span>
      </figcaption>
      <div {...styles.plot()}>
        <svg
          aria-label={`${chart.subtitle}, ${chart.title}. CSS and client JavaScript gzip bytes.`}
          role="group"
          viewBox="0 0 360 450"
          {...styles.chart()}
        >
          <title>{`${chart.subtitle}: ${chart.title}`}</title>
          <desc>
            Each library has two bars on the same linear scale, starting at
            zero. CSS is above client JavaScript. Focus or hover a library for
            its exact bytes and total. Historical measurements from September 8,
            2026.
          </desc>
          {[0, chart.maximum / 2, chart.maximum].map((value) => (
            <g key={value}>
              <line
                x1={62 + value * scale}
                x2={62 + value * scale}
                y1="30"
                y2="416"
                {...styles.line()}
              />
              <text
                x={62 + value * scale}
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
          {chart.rows.map((entry, index) => (
            <g
              key={entry.name}
              tabIndex={0}
              role="img"
              aria-label={`${entry.name}: CSS ${entry.css} bytes, JavaScript ${entry.javascript} bytes, total ${entry.css + entry.javascript} gzip bytes.`}
              aria-describedby={active === index ? tooltipId : undefined}
              data-active={active === index || undefined}
              transform={`translate(20 ${46 + index * 76})`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActive(null)
              }}
              {...styles.chartRow()}
            >
              <rect
                x="-8"
                y="-16"
                width="336"
                height="70"
                rx="5"
                data-highlight=""
                {...styles.rowHighlight()}
              />
              <g
                {...(entry.name === 'Zyzz'
                  ? styles.zyzz()
                  : styles.competitor())}
              >
                <text {...styles.label()}>{entry.name}</text>
                <text y="21" {...styles.assetLabel()}>
                  CSS
                </text>
                <rect
                  x="42"
                  y="12"
                  height="9"
                  width={entry.css * scale}
                  fill="currentColor"
                />
                <text x="320" y="21" textAnchor="end" {...styles.value()}>
                  {entry.css.toLocaleString('en-US')} B
                </text>
                <text y="43" {...styles.assetLabel()}>
                  JS
                </text>
                <rect
                  x="42"
                  y="34"
                  height="9"
                  width={entry.javascript * scale}
                  fill="currentColor"
                  opacity="0.4"
                />
                <text
                  data-javascript=""
                  x="320"
                  y="43"
                  textAnchor="end"
                  {...styles.value()}
                >
                  {entry.javascript.toLocaleString('en-US')} B
                </text>
              </g>
            </g>
          ))}
          <text x="20" y="439" {...styles.tick()}>
            CSS above · client JavaScript below
          </text>
        </svg>
        {row && (
          <div
            id={tooltipId}
            role="tooltip"
            style={{ top: `${((104 + (active ?? 0) * 76) / 450) * 100}%` }}
            {...styles.tooltip()}
          >
            <strong>{row.name}</strong>
            <span>
              CSS <b>{row.css.toLocaleString('en-US')} B</b>
            </span>
            <span>
              JavaScript <b>{row.javascript.toLocaleString('en-US')} B</b>
            </span>
            <span {...styles.tooltipTotal()}>
              Total gzip{' '}
              <b>{(row.css + row.javascript).toLocaleString('en-US')} B</b>
            </span>
          </div>
        )}
      </div>
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
    maximum: 10000,
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
  export const assetLabel = style({
    fill: 'currentColor !custom',
    fontSize: '9px !custom',
  })

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

  export const chartRow = style({
    cursor: 'default',
    outline: 'none',
    '&[data-active] > [data-highlight]': { opacity: 1 },
    ':focus-visible > [data-highlight]': { opacity: 1, stroke: 'blue.900' },
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
    fontSize: '11px !custom',
    fontWeight: 'medium',
  })

  export const legend = style({
    typography: 'copy.13',
    fontSize: '12px !custom',
    color: 'gray.900',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
    '& > span': { alignItems: 'center', display: 'inline-flex', gap: 2 },
  })

  export const legendNote = style({ marginLeft: 'auto !custom' })

  export const line = style({
    color: 'gray.400',
    stroke: 'currentColor !custom',
    strokeDasharray: '2 4',
  })

  export const lowest = style({ color: 'green.900' })

  export const measurement = style({ display: 'block', fontWeight: 'medium' })

  export const plot = style({ position: 'relative' })

  export const ratio = style({
    display: 'block',
    fontSize: '10px !custom',
    marginTop: 1,
  })

  export const results = style({
    marginBlock: 6,
    '& table': {
      borderCollapse: 'collapse',
      fontSize: '13px !custom',
      minWidth: '760px !custom',
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
    '& td[data-comparison]': {
      isolation: 'isolate',
      position: 'relative',
      whiteSpace: 'nowrap',
    },
    '& td[data-comparison="baseline"]': { color: 'blue.900' },
    '& th[data-reference], & tr[data-reference] td:first-child': {
      color: 'blue.900',
      fontWeight: 'medium',
    },
    '& td[data-comparison="baseline"] > [data-tint]': {
      border: '1px dashed',
      borderColor: 'blue.500',
      backgroundColor: 'blue.100',
    },
    '& td[data-comparison="smaller"] > [data-tint]': {
      backgroundColor: 'green.700',
    },
    '& td[data-comparison="larger"] > [data-tint]': {
      backgroundColor: 'red.700',
    },
    '& td[data-comparison="equal"] > [data-tint]': {
      backgroundColor: 'gray.400',
    },
    '& tr:last-child td': { borderBottom: 'none' },
  })

  export const rowHighlight = style({ fill: 'gray.100', opacity: 0 })

  export const swatch = style({
    display: 'inline-block',
    height: 3,
    width: 5,
    '&[data-smaller]': { backgroundColor: 'green.200' },
    '&[data-larger]': { backgroundColor: 'red.200' },
    '&[data-baseline]': {
      backgroundColor: 'blue.100',
      border: '1px dashed',
      borderColor: 'blue.500',
    },
  })

  export const tableScroll = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    overflowX: 'auto',
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const tick = style({
    color: 'gray.900',
    fill: 'currentColor !custom',
    fontSize: '11px !custom',
    fontVariantNumeric: 'tabular-nums',
  })

  export const tint = style({
    inset: '3px !custom',
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: -1,
  })

  export const title = style({
    typography: 'label.16',
    color: 'foreground',
    fontWeight: 'medium',
  })

  export const tooltip = style({
    typography: 'copy.13',
    fontSize: '12px !custom',
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    boxShadow: 'md',
    color: 'foreground',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 3,
    pointerEvents: 'none',
    position: 'absolute',
    right: 4,
    transform: 'translateY(-100%)',
    width: '190px !custom',
    zIndex: 1,
    '& > span': { display: 'flex', justifyContent: 'space-between' },
    '& b': { fontVariantNumeric: 'tabular-nums', fontWeight: 'medium' },
  })

  export const tooltipTotal = style({
    borderTop: '1px solid',
    borderColor: 'gray.400',
    paddingTop: 2,
  })

  export const unit = style({ typography: 'copy.13', color: 'gray.900' })

  export const value = style({
    '&[data-javascript]': { fontSize: '10px !custom' },
    fill: 'currentColor !custom',
    fontFamily: 'Geist Mono !custom',
    fontSize: '12px !custom',
    fontVariantNumeric: 'tabular-nums',
  })

  export const zyzz = style({ color: 'blue.900' })
}
