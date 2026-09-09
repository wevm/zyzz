/**
 * Validates absolute functional CSS colors while preserving authored color spaces.
 * @module
 */

/** Recognizes absolute color functions with finite literal channels and alpha. */
export function functional(value: string): boolean {
  const match =
    /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)$/i.exec(
      value,
    )
  if (!match) return false
  const name = match[1]!.toLowerCase()
  const body = match[2]!
  if (body.includes(',')) {
    if (!['rgb', 'rgba', 'hsl', 'hsla'].includes(name)) return false
    const channels = body.split(',').map(trim)
    if (channels.length < 3 || channels.length > 4) return false
    if (channels.length === 4 && !numeric(channels.pop()!)) return false
    if (name === 'rgb' || name === 'rgba')
      return (
        channels.every(numeric) &&
        channels.every(
          (channel) => channel.endsWith('%') === channels[0]!.endsWith('%'),
        )
      )
    return (
      hue(channels[0]!) &&
      channels
        .slice(1)
        .every((channel) => channel.endsWith('%') && numeric(channel))
    )
  }
  const sections = body.split('/').map(trim)
  if (
    sections.length > 2 ||
    (sections.length === 2 && !component(sections[1]!))
  )
    return false
  const channels = sections[0]!.split(/[ \t\n\r\f]+/)
  if (name === 'color') {
    if (
      ![
        'a98-rgb',
        'display-p3',
        'display-p3-linear',
        'prophoto-rgb',
        'rec2020',
        'srgb',
        'srgb-linear',
        'xyz',
        'xyz-d50',
        'xyz-d65',
      ].includes(channels.shift()!.toLowerCase())
    )
      return false
  }
  if (channels.length !== 3) return false
  return channels.every((channel, index) => {
    const angle =
      (['hsl', 'hsla', 'hwb'].includes(name) && index === 0) ||
      (['lch', 'oklch'].includes(name) && index === 2)
    return (
      channel.toLowerCase() === 'none' ||
      (angle ? hue(channel) : numeric(channel))
    )
  })
}

/** Separates shorthand colors without splitting functional channels. */
export function list(value: string): readonly string[] | undefined {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]!
    if (char === '(') depth++
    if (char === ')' && --depth < 0) return undefined
    if (depth === 0 && /[ \t\n\r\f]/.test(char)) {
      if (index > start) parts.push(value.slice(start, index))
      start = index + 1
    }
  }
  if (start < value.length) parts.push(value.slice(start))
  return depth === 0 && parts.length > 0 ? parts : undefined
}

function component(value: string): boolean {
  return value.toLowerCase() === 'none' || numeric(value)
}

function hue(value: string): boolean {
  const match =
    /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(?:deg|grad|rad|turn)?$/i.exec(
      value,
    )
  return match !== null && Number.isFinite(Number(match[1]))
}

function numeric(value: string): boolean {
  const match = /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(?:%)?$/.exec(value)
  return match !== null && Number.isFinite(Number(match[1]))
}

function trim(value: string): string {
  return value.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
}
