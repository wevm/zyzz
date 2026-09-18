/** Regenerates the compiler-literal theme from its authoritative raw token declaration. @module */
import * as Fs from 'node:fs/promises'
import * as Parser from 'oxc-parser'

const file = new URL('../src/default.ts', import.meta.url)
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
const config = declarations.find(
  (node) => node.id.type === 'ObjectPattern',
)!.init!
if (tokens.type !== 'TSAsExpression' || config.type !== 'CallExpression')
  throw new Error('Unexpected bundled configuration source layout.')
const options = config.arguments[0]!
if (options.type !== 'ObjectExpression')
  throw new Error('Unexpected bundled configuration options.')
const property = options.properties.find(
  (node) =>
    node.type === 'Property' &&
    node.key.type === 'Identifier' &&
    node.key.name === 'theme',
)
if (!property || property.type !== 'Property')
  throw new Error('Missing bundled theme.')
const argument = property.value
await Fs.writeFile(
  file,
  source.slice(0, argument.start) +
    source.slice(tokens.expression.start, tokens.expression.end) +
    source.slice(argument.end),
)
