/** Supplies the opt-in bundled authoring contract when a host keeps Zyzz imports external. @module */
import type * as Ast from '@oxc-project/types'
import * as Token from '../../internal/Token.js'
import * as Default from '../../themes/default.js'
import type * as Themes from './Themes.js'

const definition = Token.bind(
  Default.theme,
  Object.freeze({ [Token.identity]: 'zyzz-default-theme' }),
)
const call = Object.freeze({
  name: 'zyzz-default-theme',
  start: -1,
  end: -1,
  tokenType: JSON.stringify(Default.tokens),
})

/** Resolves only explicit named imports from the bundled public entrypoint. */
export function links(
  program: Ast.Program,
): Readonly<Record<string, Themes.Link>> {
  const result: Record<string, Themes.Link> = Object.create(null)
  for (const node of program.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      node.importKind === 'type' ||
      node.source.value !== 'zyzz/themes/default'
    )
      continue
    for (const specifier of node.specifiers) {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type'
      )
        continue
      const name =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value
      if (name !== 'css' && name !== 'theme') continue
      result[specifier.local.name] = {
        binding: name,
        call,
        definition,
        kind: name === 'css' ? 'css' : 'theme',
      }
    }
  }
  return result
}
