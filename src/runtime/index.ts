/**
 * Exposes the isolated helpers required by compiled callable styles.
 * @module
 */
/** Runtime props binding without parsing, compilation, or theme data. */
export * as Props from './Props.js'

/** Runtime scalar binding isolated from static props. */
export * as Dynamic from './Dynamic.js'
/** Compiler-generated variable contracts with typed assignments. */
export * as Vars from './Vars.js'

/** Compiler-owned HTML attribute binding. */
export * as Html from './Html.js'

/** Server-safe root appearance initialization script generation. */
export * as Appearance from './Appearance.js'

export * as Marker from './Marker.js'
