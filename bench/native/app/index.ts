/** Registers the release-only native measurement app or its single-lane cold start probe. @module */
import { registerRootComponent } from 'expo'
import { Settings } from 'react-native'

// iOS launch arguments such as `-benchCold zyzz/theme/1000` select one cold start lane.
const lane = Settings.get('benchCold') as string | undefined
if (lane)
  registerRootComponent(
    (require('./Cold.js') as typeof import('./Cold.js')).create(lane),
  )
else {
  require('./Setup.js')
  registerRootComponent(
    (require('./App.js') as typeof import('./App.js')).default,
  )
}
