/** Configures the site's shared styling theme. @module */
import { Config } from 'zyzz'
import { theme as defaultTheme } from 'zyzz/default'

/** Binds site styles and their scope to the bundled default theme. */
export const { style, theme } = Config.create({ theme: defaultTheme })
