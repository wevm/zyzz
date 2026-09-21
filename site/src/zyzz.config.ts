/** Configures the site's styling helpers and cascade layers. @module */
import { Config } from 'zyzz'

/** Shares the site's styling configuration. */
export const { style } = Config.create({
  layers: ['reset', 'base', 'components'],
})
