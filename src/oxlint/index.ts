/** Exposes opt-in Oxlint rules for Zyzz web authoring. @module */
import type { Plugin } from '@oxlint/plugins'
import { noConflictingProps } from './rules/noConflictingProps.js'
import { noUnused } from './rules/noUnused.js'
import { restrictedProperties } from './rules/restrictedProperties.js'
import { useLogicalProperties } from './rules/useLogicalProperties.js'
import { validStyles } from './rules/validStyles.js'

/** Register through jsPlugins and enable individual zyzz/* rules in the lint configuration. */
const plugin: Plugin = {
  meta: { name: 'zyzz' },
  rules: {
    'no-conflicting-props': noConflictingProps,
    'no-unused': noUnused,
    'restricted-properties': restrictedProperties,
    'use-logical-properties': useLogicalProperties,
    'valid-styles': validStyles,
  },
}

export default plugin
