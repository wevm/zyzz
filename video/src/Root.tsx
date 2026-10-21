/** @module Composition registry for the launch video. */
import { Composition } from 'remotion'
import { total } from './Theme.js'
import { Video } from './Video.js'

/** Registers the 1920×1080 launch video at 30 fps. */
export function Root() {
  return (
    <Composition
      component={Video}
      durationInFrames={total}
      fps={30}
      height={1080}
      id="Launch"
      width={1920}
    />
  )
}
