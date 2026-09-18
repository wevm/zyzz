/** Enables HTTP communication with the emulator host's collector in release builds. @module */
import { withAndroidManifest } from 'expo/config-plugins'
import type { ConfigPlugin } from 'expo/config-plugins'

const configure: ConfigPlugin = (config) =>
  withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0]
    if (!application) throw new Error('Missing benchmark Android application')
    application.$['android:usesCleartextTraffic'] = 'true'
    return config
  })
export default configure
