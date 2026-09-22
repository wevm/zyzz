/** Regenerates the compiler-literal theme from its authoritative raw token declaration. @module */
import * as Fs from 'node:fs/promises'
import * as Parser from 'oxc-parser'
import { keyframes } from 'zyzz/web'

const file = new URL('../src/default.ts', import.meta.url)
const source = await Fs.readFile(file, 'utf8')
const program = Parser.parseSync('default.ts', source, {
  sourceType: 'module',
}).program
const declarations = program.body.flatMap((node) =>
  node.type === 'ExportNamedDeclaration' &&
  node.declaration?.type === 'VariableDeclaration'
    ? node.declaration.declarations
    : node.type === 'VariableDeclaration'
      ? node.declarations
      : [],
)
const tokens = declarations.find(
  (node) => node.id.type === 'Identifier' && node.id.name === 'tokens',
)!.init!
const config = declarations.find(
  (node) => node.id.type === 'Identifier' && node.id.name === 'config',
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
    node.key.name === 'vars',
)
if (!property || property.type !== 'Property')
  throw new Error('Missing bundled theme.')
const argument = property.value
const animations = new Map<string, string>()
for (const declaration of declarations) {
  const call = declaration.init
  if (
    declaration.id.type !== 'Identifier' ||
    call?.type !== 'CallExpression' ||
    call.callee.type !== 'Identifier' ||
    call.callee.name !== 'keyframes'
  )
    continue
  const options = call.arguments[1]
  if (options?.type !== 'ObjectExpression')
    throw new Error('Default animations require explicit identities.')
  const id = options.properties.find(
    (property) =>
      property.type === 'Property' &&
      property.key.type === 'Identifier' &&
      property.key.name === 'id',
  )
  if (
    id?.type !== 'Property' ||
    id.value.type !== 'Literal' ||
    typeof id.value.value !== 'string'
  )
    throw new Error('Default animations require literal identities.')
  animations.set(declaration.id.name, keyframes({}, { id: id.value.value }))
}
if (tokens.expression.type !== 'ObjectExpression')
  throw new Error('Expected literal default tokens.')
const animate = tokens.expression.properties.find(
  (property) =>
    property.type === 'Property' &&
    property.key.type === 'Identifier' &&
    property.key.name === 'animate',
)
if (animate?.type !== 'Property' || animate.value.type !== 'ObjectExpression')
  throw new Error('Expected literal default animation tokens.')
let literal = source.slice(tokens.expression.start, tokens.expression.end)
for (const property of [...animate.value.properties].reverse()) {
  if (
    property.type !== 'Property' ||
    property.key.type !== 'Identifier' ||
    property.value.type !== 'Literal' ||
    typeof property.value.value !== 'string'
  )
    throw new Error('Expected literal default animation values.')
  const name = animations.get(property.key.name)
  if (!name) throw new Error(`Unknown default animation: ${property.key.name}`)
  const value =
    name + property.value.value.slice(property.value.value.indexOf(' '))
  const start = property.value.start - tokens.expression.start
  const end = property.value.end - tokens.expression.start
  literal = literal.slice(0, start) + JSON.stringify(value) + literal.slice(end)
}
await Fs.writeFile(
  file,
  source.slice(0, tokens.expression.start) +
    literal +
    source.slice(tokens.expression.end, argument.start) +
    literal +
    source.slice(argument.end),
)
