/** @module The Zyzz wordmark with letters that spring in one at a time. */
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

// Glyph outlines from the Zyzz wordmark (.github/assets/logo-light.svg), one path per letter.
const letters = [
  'M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256Z',
  'M101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88Z',
  'M127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687Z',
  'M183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z',
]

/** The Zyzz wordmark, with each letter springing in after `delay` frames. */
export function Logo(props: Logo.Props) {
  return (
    <svg
      height={(props.width * 64) / 233}
      style={{ overflow: 'visible' }}
      viewBox="12 24 233 64"
      width={props.width}
    >
      {letters.map((d, i) => (
        <Letter
          d={d}
          delay={(props.delay ?? 0) + i * (props.stagger ?? 4)}
          fill={props.fill}
          key={i}
        />
      ))}
    </svg>
  )
}

export declare namespace Logo {
  type Props = {
    delay?: number | undefined
    fill: string
    stagger?: number | undefined
    width: number
  }
}

function Letter(props: { d: string; delay: number; fill: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = spring({
    config: { damping: 18, mass: 0.9 },
    fps,
    frame: frame - props.delay,
  })
  return (
    <path
      d={props.d}
      fill={props.fill}
      style={{
        opacity: Math.min(1, t * 1.6),
        transform: `translateY(${(1 - t) * 26}px)`,
        transformBox: 'fill-box',
        transformOrigin: 'center bottom',
      }}
    />
  )
}
