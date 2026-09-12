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
] as const satisfies readonly Case[]

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
