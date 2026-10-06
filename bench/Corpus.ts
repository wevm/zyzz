/**
 * Defines deterministic component workloads shared by compiler and browser checks.
 * @module
 */
import type { Style } from 'zyzz'

/** A deterministic literal workload shared by every compiler and browser check. */
export type Case = {
  /** Number of authored component styles. */
  count: number
  /** Stable artifact and benchmark identifier. */
  name: string
  /** Workload distribution. */
  pattern:
    | 'app'
    | 'components'
    | 'independent'
    | 'palette'
    | 'partial'
    | 'repeated'
    | 'sparse'
    | 'unique'
}

/** Ordered from small baselines through sharing and complexity stress cases. */
export const cases = [
  { count: 3, name: 'small', pattern: 'repeated' },
  { count: 1000, name: 'repeated', pattern: 'repeated' },
  { count: 1000, name: 'unique', pattern: 'unique' },
  { count: 100, name: 'partial', pattern: 'partial' },
  { count: 100, name: 'palette', pattern: 'palette' },
  { count: 100, name: 'independent', pattern: 'independent' },
  { count: 100, name: 'sparse', pattern: 'sparse' },
  { count: 60, name: 'components', pattern: 'components' },
  { count: 300, name: 'app', pattern: 'app' },
] as const satisfies readonly Case[]

// A shared design scale: most values repeat across components, as in applications.
const scale = {
  colors: [
    '#111827',
    '#6b7280',
    '#ffffff',
    '#f3f4f6',
    '#e5e7eb',
    '#2563eb',
    '#1d4ed8',
    '#dc2626',
    '#16a34a',
    '#d97706',
  ],
  radius: ['4px', '8px', '12px', '9999px'],
  sizes: ['12px', '14px', '16px', '20px', '24px', '32px'],
  space: ['4px', '8px', '12px', '16px', '24px', '32px'],
  weights: [400, 500, 600, 700],
} as const

/** Picks a scale value from independent bits of one mixed seed. */
function pick<const value>(list: readonly value[], seed: number): value {
  return list[seed % list.length]!
}

/** Creates literal data; fixed integer mixing avoids clocks and random globals. */
export function styles(workload: Case): readonly Style.LiteralDeclarations[] {
  return Array.from({ length: workload.count }, (_, index) => {
    const value = Math.imul(index + 1, 2654435761) >>> 0
    const color = (seed: number) =>
      `#${(seed & 0xffffff).toString(16).padStart(6, '0')}` as const

    const base: Style.LiteralDeclarations = {
      backgroundColor: '#fff',
      borderColor: '#000',
      borderStyle: 'solid',
      borderWidth: '1px',
      boxSizing: 'border-box',
      color: '#000',
      display: 'block',
      padding: workload.pattern === 'unique' ? `${index}px` : '12px',
    }

    switch (workload.pattern) {
      case 'app':
        return (() => {
          const s = (shift: number) => value >>> shift
          const { colors, radius, sizes, space, weights } = scale
          // Twelve UI shapes: button, input, card, stack, row, heading, text,
          // badge, avatar, divider, link, and page container.
          const shapes: readonly (() => Style.LiteralDeclarations)[] = [
            () => ({
              alignItems: 'center',
              backgroundColor: pick(colors, s(1)),
              borderRadius: pick(radius, s(3)),
              color: pick(colors, s(5)),
              display: 'inline-flex',
              fontSize: pick(sizes.slice(0, 3), s(7)),
              fontWeight: pick(weights.slice(1), s(9)),
              gap: pick(space.slice(0, 3), s(11)),
              paddingBlock: pick(space.slice(0, 3), s(13)),
              paddingInline: pick(space.slice(1, 5), s(15)),
            }),
            () => ({
              backgroundColor: pick(colors, s(1)),
              borderColor: pick(colors, s(3)),
              borderRadius: pick(radius.slice(0, 3), s(5)),
              borderStyle: 'solid',
              borderWidth: '1px',
              boxSizing: 'border-box',
              color: pick(colors, s(7)),
              display: 'block',
              fontSize: pick(sizes.slice(1, 3), s(9)),
              paddingBlock: pick(space.slice(1, 3), s(11)),
              paddingInline: pick(space.slice(2, 4), s(13)),
              width: '100%',
            }),
            () => ({
              backgroundColor: pick(colors, s(1)),
              borderColor: pick(colors, s(3)),
              borderRadius: pick(radius.slice(1, 3), s(5)),
              borderStyle: 'solid',
              borderWidth: '1px',
              display: 'grid',
              gap: pick(space, s(7)),
              padding: pick(space.slice(3), s(9)),
            }),
            () => ({
              display: 'flex',
              flexDirection: 'column',
              gap: pick(space, s(1)),
            }),
            () => ({
              alignItems: 'center',
              display: 'flex',
              gap: pick(space, s(1)),
              justifyContent: pick(
                ['flex-start', 'space-between', 'center', 'flex-end'],
                s(3),
              ),
            }),
            () => ({
              color: pick(colors.slice(0, 2), s(1)),
              fontSize: pick(sizes.slice(3), s(3)),
              fontWeight: pick(weights.slice(2), s(5)),
              lineHeight: 1.25,
              margin: '0px',
            }),
            () => ({
              color: pick(colors, s(1)),
              fontSize: pick(sizes.slice(0, 3), s(3)),
              lineHeight: pick([1.25, 1.5], s(5)),
              margin: '0px',
            }),
            () => ({
              alignItems: 'center',
              backgroundColor: pick(colors, s(1)),
              borderRadius: '9999px',
              color: pick(colors, s(3)),
              display: 'inline-flex',
              fontSize: '12px',
              fontWeight: 500,
              paddingBlock: '4px',
              paddingInline: pick(space.slice(1, 3), s(5)),
            }),
            () => {
              const dimension = pick(['24px', '32px', '40px', '48px'], s(1))

              return {
                backgroundColor: pick(colors, s(3)),
                borderRadius: '9999px',
                height: dimension,
                overflow: 'hidden',
                width: dimension,
              }
            },
            () => ({
              backgroundColor: pick(colors.slice(3, 5), s(1)),
              height: '1px',
              marginBlock: pick(space.slice(1, 5), s(3)),
              width: '100%',
            }),
            () => ({
              color: pick(colors.slice(5, 7), s(1)),
              fontSize: pick(sizes.slice(1, 3), s(3)),
              fontWeight: pick(weights.slice(0, 3), s(5)),
              textDecoration: pick(['none', 'underline'], s(7)),
            }),
            () => ({
              marginInline: 'auto',
              maxWidth: pick(['640px', '768px', '1024px', '1280px'], s(1)),
              paddingInline: pick(space.slice(3), s(3)),
              width: '100%',
            }),
          ]
          const style = shapes[s(17) % shapes.length]!()

          // About 5% carry one off-scale value, as configured apps mark with !custom.
          return value % 20 === 0
            ? { ...style, minHeight: `${((value >>> 19) % 200) + 20}px` }
            : style
        })()
      case 'components':
        return [
          { ...base, borderRadius: '6px', fontSize: '14px', fontWeight: 600 },
          { ...base, display: 'flex', gap: '8px', alignItems: 'center' },
          { ...base, display: 'grid', gap: '16px', width: '100%' },
          { color: '#333', fontSize: '24px', fontWeight: 700, lineHeight: 1.5 },
          { ...base, borderWidth: '2px', height: '40px', width: '160px' },
          { ...base, borderRadius: '12px', margin: '8px', padding: '24px' },
        ][index % 6] as Style.LiteralDeclarations
      case 'independent':
        return {
          backgroundColor: color(value),
          borderColor: color(value >>> 3),
          borderStyle: index % 2 ? 'solid' : 'dashed',
          borderWidth: `${value % 9}px`,
          boxSizing: 'border-box',
          color: color(value >>> 5),
          display: index % 2 ? 'block' : 'flex',
          padding: `${value % 997}px`,
        }
      case 'palette':
        return {
          ...base,
          backgroundColor: color((value % 16) * 0x111111),
          padding: `${value % 16}px`,
        }
      case 'partial':
        return {
          ...base,
          backgroundColor: color(value),
          borderWidth: `${value % 8}px`,
          padding: `${index}px`,
        }
      case 'sparse':
        return (() => {
          if (index % 3 === 0) {
            return { color: color(value), padding: `${value % 31}px` }
          }

          if (index % 3 === 1) {
            return { display: 'flex', gap: `${value % 13}px` }
          }

          return {
            ...base,
            backgroundColor: color(value),
            margin: `${value % 17}px`,
          }
        })()
      default:
        return base
    }
  })
}
