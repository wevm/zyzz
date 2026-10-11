/**
 * Marks native compilation inside a host-owned graph context.
 * @module
 */

/**
 * Option key of `Native.compile` for an adapter that compiles a module as a member of its own
 * graph. Extraction then validates contributed CSS without relocating relative assets, and it
 * links no other module.
 */
export const key = Symbol('zyzz.source.graph')
