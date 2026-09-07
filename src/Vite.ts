import type { Plugin } from 'vite'
import * as Compiler from './Compiler.js'

/** Compiles css() in both dev and production and delegates CSS delivery to Vite.
 * Each plugin instance owns its module CSS. No runtime style engine is shipped.
 * @throws Compiler.CompileError, displayed by Vite's normal error overlay.
 */
export function typestyle(): Plugin {
  const styles = new Map<string, string>()
  const prefix = 'virtual:typestyle:'
  const resolved = (file: string) => `\0${prefix}${file}.css`
  const accepts = (id: string) =>
    !id.includes('/node_modules/') &&
    !id.includes('?') &&
    /\.[cm]?[jt]sx?$/.test(id)
  return {
    name: 'typestyle',
    enforce: 'pre',
    buildStart() {
      styles.clear()
    },
    resolveId(id) {
      if (id.startsWith(prefix)) return `\0${id}`
    },
    load(id) {
      if (id.startsWith(`\0${prefix}`)) return styles.get(id) ?? ''
    },
    transform(code, id) {
      if (!accepts(id)) return
      const result = Compiler.compile({ code, id })
      const cssId = resolved(id)
      styles.set(cssId, result.css)
      if (!result.changed) return
      return {
        code: `${result.code}\nimport ${JSON.stringify(`${prefix}${id}.css`)};`,
        map: result.map,
      }
    },
    async handleHotUpdate(context) {
      if (!accepts(context.file)) return
      const result = Compiler.compile({
        code: await context.read(),
        id: context.file,
      })
      const cssId = resolved(context.file)
      styles.set(cssId, result.css)
      const module = context.server.moduleGraph.getModuleById(cssId)
      if (module) {
        context.server.moduleGraph.invalidateModule(module)
        return [...context.modules, module]
      }
    },
    watchChange(id, change) {
      if (change.event === 'delete') styles.delete(resolved(id))
    },
  }
}
