/** Regenerates the compiler-literal theme from its authoritative raw token declaration. @module */
import * as Fs from 'node:fs/promises'
import * as Parser from 'oxc-parser'

const file = new URL('../src/themes/default.ts', import.meta.url)
const source = await Fs.readFile(file, 'utf8')
const program = Parser.parseSync('default.ts', source, {
  sourceType: 'module',
}).program
const declarations = program.body.flatMap((node) =>
  node.type === 'ExportNamedDeclaration' &&
  node.declaration?.type === 'VariableDeclaration'
    ? node.declaration.declarations
    : [],
)
const tokens = declarations.find(
  (node) => node.id.type === 'Identifier' && node.id.name === 'tokens',
)!.init!
const theme = declarations.find(
  (node) => node.id.type === 'Identifier' && node.id.name === 'theme',
)!.init!
if (tokens.type !== 'TSAsExpression' || theme.type !== 'CallExpression')
  throw new Error('Unexpected bundled theme source layout.')
const argument = theme.arguments[0]!
await Fs.writeFile(
  file,
  source.slice(0, argument.start) +
    source.slice(tokens.expression.start, tokens.expression.end) +
    source.slice(argument.end),
)
