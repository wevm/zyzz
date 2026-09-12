/** Serializes synchronous root appearance restoration from compiled scope names. @module */
import type * as Config from '../Config.js'

/**
 * Binds an HTML-safe script factory to compiled named theme classes.
 * The factory is server-safe; only its returned JavaScript accesses the DOM.
 * @param entries - Catalog names paired with compiled scope classes.
 * @returns A pure script factory that never reads or writes browser state itself.
 */
export function create(
  entries: readonly (readonly [string, string])[],
): (options?: Config.ScriptOptions) => string {
  return (options = {}) => {
    const catalog = serialize(entries)
    const key = serialize(options.storageKey ?? 'zyzz')

    return `(()=>{try{const value=JSON.parse(localStorage.getItem(${key})||"null");if(!value||typeof value!=="object"||Array.isArray(value))return;const root=document.documentElement;const catalog=new Map(${catalog});if(Object.hasOwn(value,"theme")&&typeof value.theme==="string"&&catalog.has(value.theme)){root.classList.remove(...catalog.values());root.classList.add(catalog.get(value.theme))}if(Object.hasOwn(value,"colorScheme")&&["light","dark","light dark"].includes(value.colorScheme))root.style.colorScheme=value.colorScheme}catch{}})();`
  }
}

function serialize(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
