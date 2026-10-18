/**
 * Generates attribute contracts from the pinned Base UI declarations without network access.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'

const require = Module.createRequire(import.meta.url)
const root = Path.resolve(import.meta.dirname, '..')
const upstream = Path.dirname(require.resolve('@base-ui/react/package.json'))
const version: string = JSON.parse(
  Fs.readFileSync(Path.join(upstream, 'package.json'), 'utf8'),
).version
if (version !== '1.8.0')
  throw new Error(
    `Review Base UI version ${version} before updating the generator`,
  )

const update = process.argv.includes('--update')
if (update === process.argv.includes('--check'))
  throw new Error('Specify exactly one of --update or --check')

const files = Fs.readdirSync(upstream, { recursive: true })
  .filter(
    (file): file is string =>
      typeof file === 'string' && file.endsWith('.d.ts'),
  )
  .sort()
const program = Ts.createProgram(
  files.map((file) => Path.join(upstream, file)),
  {
    module: Ts.ModuleKind.NodeNext,
    moduleResolution: Ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    target: Ts.ScriptTarget.ESNext,
  },
)
const checker = program.getTypeChecker()

type State = {
  attribute: string
  description: string
  url: string
  values: readonly string[] | null
}
type Entry = {
  member: string
  namespace: string
  source: string
  states: Record<string, State>
}
type Part = {
  entry: Entry
  identity: string
  props: Ts.InterfaceDeclaration | undefined
  reason: string | undefined
}
const parts: Part[] = []
const used = new Set<string>()
const deferred: Record<string, string> = {}
const resolve = (symbol: Ts.Symbol): Ts.Symbol =>
  symbol.flags & Ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol
const exportsOf = (file: Ts.SourceFile): readonly Ts.Symbol[] => {
  const symbol = checker.getSymbolAtLocation(file)
  return symbol ? checker.getExportsOfModule(symbol) : []
}

for (const file of files.filter(
  (file) => file.split(Path.sep).length === 2 && file.endsWith('/index.d.ts'),
)) {
  const sourceFile = program.getSourceFile(Path.join(upstream, file))
  if (!sourceFile) continue

  const directory = Path.dirname(file)
  const source = `@base-ui/react/${directory}`
  const valueExports = new Set(
    sourceFile.statements.flatMap((statement) => {
      if (
        !Ts.isExportDeclaration(statement) ||
        statement.isTypeOnly ||
        !statement.exportClause
      )
        return []
      return Ts.isNamespaceExport(statement.exportClause)
        ? [statement.exportClause.name.text]
        : statement.exportClause.elements
            .filter((element) => !element.isTypeOnly)
            .map((element) => element.name.text)
    }),
  )
  const publicExports = exportsOf(sourceFile).filter((symbol) =>
    valueExports.has(symbol.name),
  )
  for (const exported of publicExports) {
    const namespace = exported.name
    const symbol = resolve(exported)
    const isComponent =
      symbol.valueDeclaration &&
      checker
        .getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
        .getCallSignatures().length > 0
    const members =
      !isComponent && symbol.flags & Ts.SymbolFlags.Module
        ? checker.getExportsOfModule(symbol)
        : [exported]
    for (const member of members) {
      const target = resolve(member)
      const declaration = target.valueDeclaration
      if (!declaration || !/^[A-Z]/u.test(member.name)) continue

      const type = checker.getTypeOfSymbolAtLocation(target, declaration)
      if (!type.getCallSignatures().length) continue

      const identity =
        members[0] === exported ? namespace : `${namespace}.${member.name}`
      const componentFile = declaration.getSourceFile()
      const componentName = target.name
      const attributesPath = componentFile.fileName.replace(
        /\.d\.ts$/u,
        'DataAttributes.d.ts',
      )
      const attributesFile = program.getSourceFile(attributesPath)
      const props = componentFile.statements.find(
        (node): node is Ts.InterfaceDeclaration =>
          Ts.isInterfaceDeclaration(node) &&
          node.name.text === `${componentName}Props`,
      )
      const entry: Entry = {
        member: member.name,
        namespace,
        source,
        states: {},
      }
      const part: Part = { entry, identity, props, reason: undefined }
      if (!props) part.reason = 'No public mergeable component Props interface'
      if (props && !checker.getTypeAtLocation(props).getProperty('className'))
        part.reason =
          'No className contract (provider, root, or non-DOM component)'
      if (props?.typeParameters?.length)
        part.reason =
          'Generic Props interface requires explicit augmentation review'

      if (attributesFile) {
        used.add(Path.relative(upstream, attributesPath))
        for (const attributeExport of [...exportsOf(attributesFile)].sort(
          (a, b) => a.name.localeCompare(b.name, 'en'),
        )) {
          const attribute = resolve(attributeExport)
          const node = attribute.valueDeclaration
          if (!node) {
            part.reason = `Unresolved attribute ${attributeExport.name}`
            continue
          }

          const value = checker.getTypeOfSymbolAtLocation(attribute, node)
          const tags = attribute
            .getJsDocTags(checker)
            .filter((tag) => tag.name === 'type')
          const typeTags =
            Ts.getJSDocTypeTag(node) ?? Ts.getJSDocTypeTag(node.parent)
          const documentedType = typeTags?.typeExpression?.type
          const description = Ts.displayPartsToString(
            attribute.getDocumentationComment(checker),
          )
          if (
            !documentedType &&
            !tags.length &&
            !description.startsWith('Present')
          ) {
            part.reason = `Missing value domain for ${attributeExport.name}`
            continue
          }

          let values: readonly string[] | null = null
          if (tags.length || documentedType) {
            const types =
              documentedType && Ts.isUnionTypeNode(documentedType)
                ? documentedType.types.filter(
                    (type) =>
                      !(
                        Ts.isLiteralTypeNode(type) &&
                        type.literal.kind === Ts.SyntaxKind.NullKeyword
                      ),
                  )
                : documentedType
                  ? [documentedType]
                  : []
            if (
              !types.length ||
              types.some(
                (type) =>
                  !Ts.isLiteralTypeNode(type) ||
                  !Ts.isStringLiteral(type.literal),
              )
            ) {
              part.reason = `Unbounded or unhandled @type for ${attributeExport.name}`
              continue
            }

            values = types.flatMap((type) =>
              Ts.isLiteralTypeNode(type) && Ts.isStringLiteral(type.literal)
                ? [type.literal.text]
                : [],
            )
          }

          if (!value.isStringLiteral() || !value.value.startsWith('data-')) {
            part.reason = `Nonliteral data attribute ${attributeExport.name}`
            continue
          }

          const anchor = member.name.replace(
            /[A-Z]/gu,
            (letter, offset: number) =>
              `${offset ? '-' : ''}${letter.toLowerCase()}`,
          )
          entry.states[attributeExport.name] = {
            attribute: value.value,
            description,
            url: `https://base-ui.com/react/components/${directory}#${anchor}`,
            values,
          }
        }
      }

      parts.push(part)
    }
  }
}

// Follow declaration references, including utility types, before adding brands.
// Excluded descendants still inherit an augmented ancestor's optional property.
const ancestors = (props: Ts.InterfaceDeclaration): Set<Ts.Declaration> => {
  const found = new Set<Ts.Declaration>()
  const visit = (node: Ts.Node): void => {
    if (Ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node)
      for (const declaration of (symbol ? resolve(symbol).declarations : []) ??
        []) {
        if (found.has(declaration) || declaration === props) continue
        found.add(declaration)
        if (Ts.isInterfaceDeclaration(declaration))
          declaration.heritageClauses?.forEach((clause) => visit(clause))
        else if (Ts.isTypeAliasDeclaration(declaration)) visit(declaration.type)
      }
    }
    Ts.forEachChild(node, visit)
  }
  props.heritageClauses?.forEach((clause) => visit(clause))
  return found
}
for (const part of parts) {
  if (!part.props) continue
  const bases = ancestors(part.props)
  for (const other of parts) {
    if (!other.props || !bases.has(other.props)) continue
    part.reason = `Inherited Props identity is unsafe with ${other.identity}`
    other.reason = `Props identity inherited by ${part.identity}`
  }
}

// Aliases share an optional union brand only when their attribute contracts agree.
for (const part of parts) {
  if (
    part.props &&
    parts.some(
      (other) =>
        other !== part &&
        other.props === part.props &&
        JSON.stringify(
          Object.values(other.entry.states).map((state) => [
            state.attribute,
            state.values,
          ]),
        ) !==
          JSON.stringify(
            Object.values(part.entry.states).map((state) => [
              state.attribute,
              state.values,
            ]),
          ),
    )
  )
    part.reason = 'Shared Props declaration has different attribute contracts'
}
parts.sort((a, b) => a.identity.localeCompare(b.identity, 'en'))
const catalog: Record<string, Entry> = {}
for (const part of parts) {
  if (part.reason) deferred[part.identity] = part.reason
  else catalog[part.identity] = part.entry
}
for (const file of files.filter(
  (file) => file.endsWith('DataAttributes.d.ts') && !used.has(file),
))
  deferred[file] =
    'Attribute module not associated with a public component declaration'

const header =
  '/**\n * Generated by scripts/base-ui.ts. Do not edit.\n * @module\n */\n'
const metadata = { package: '@base-ui/react', version }
const catalogText = `${header}\n/** Pinned upstream package metadata. */\nexport const metadata = ${JSON.stringify(metadata, null, 2)} as const\n\n/** Public component attributes, independent of runtime and type adapters. */\nexport const catalog = ${JSON.stringify(catalog, null, 2)} as const\n`
const quote = (value: string): string => JSON.stringify(value)
const documentation = (state: State, indent: string): string =>
  `${indent}/** ${state.description.replaceAll('*/', '* /')}\n${indent} * Attribute: \`${state.attribute}\`. ${state.values ? `Values: ${state.values.map((value) => `\`${value}\``).join(', ')}. A null upstream state omits the attribute.` : 'Presence selector.'}\n${indent} * @see ${state.url}\n${indent} */\n`
let typesText = header
for (const source of [
  ...new Set(Object.values(catalog).map((entry) => entry.source)),
].sort())
  typesText += `import type * as ${Object.values(catalog).find((entry) => entry.source === source)!.namespace}Components from ${quote(source)}\n`
typesText +=
  '\n/** Optional, type-only component hint. Never attached at runtime. Structurally props-preserving wrappers retain this hint. */\nexport declare const part: unique symbol\n\n/** Public component types indexed by documented identity. */\nexport type Parts = {\n'
for (const [identity, entry] of Object.entries(catalog)) {
  const access = identity.includes('.') ? identity : entry.member
  const importNamespace = Object.values(catalog).find(
    (item) => item.source === entry.source,
  )!.namespace
  typesText += `  /** ${identity} component from \`${entry.source}\`.\n   * @see https://base-ui.com/react/components/${entry.source.split('/').at(-1)}\n   */\n  readonly ${quote(identity)}: typeof ${importNamespace}Components.${access}\n`
}
typesText += '}\n'
for (const kind of ['States', 'Selectors']) {
  typesText += `\n/** Explicit ${kind.toLowerCase()} hints for each supported public part. */\nexport type ${kind}<body> = {\n`
  for (const [identity, entry] of Object.entries(catalog)) {
    typesText += `  /** ${identity} attribute styles. */\n  readonly ${quote(identity)}: {\n`
    for (const [name, state] of Object.entries(entry.states)) {
      if (kind === 'States') {
        typesText += documentation(state, '    ')
        typesText += `    readonly ${quote(name)}?: ${state.values ? `{\n${state.values.map((value) => `${documentation(state, '      ')}      readonly ${quote(value)}?: body`).join('\n')}\n    }` : 'body'}\n`
      } else {
        const selectors = [
          `&[${state.attribute}]`,
          ...(state.values ?? []).map(
            (value) => `&[${state.attribute}="${value}"]`,
          ),
        ]
        for (const selector of selectors)
          typesText += `${documentation(state, '    ')}    readonly ${quote(selector)}?: body\n`
      }
    }
    typesText += '  }\n'
  }
  typesText += '}\n'
}
for (const source of [
  ...new Set(Object.values(catalog).map((entry) => entry.source)),
].sort()) {
  typesText += `\n// Importing this type module opts into identity augmentation.\ndeclare module ${quote(source)} {\n`
  const augmented = new Set<Ts.InterfaceDeclaration>()
  for (const item of parts.filter(
    (item) =>
      !item.reason &&
      item.props &&
      `@base-ui/react/${Path.relative(upstream, item.props.getSourceFile().fileName).split(Path.sep)[0]}` ===
        source,
  )) {
    if (!item.props || augmented.has(item.props)) continue
    augmented.add(item.props)
    const aliases = parts.filter(
      (other) => !other.reason && other.props === item.props,
    )
    typesText += `  interface ${item.props.name.text} {\n    /** Documented component or compatible alias hint, absent at runtime. Not an exact wrapper identity. */\n    readonly [part]?: ${aliases.map((alias) => quote(alias.identity)).join(' | ')}\n  }\n`
  }
  typesText += '}\n'
}

const inventory = {
  deferred,
  inputs: Object.fromEntries(
    files.map((file) => [
      file,
      Crypto.createHash('sha256')
        .update(Fs.readFileSync(Path.join(upstream, file)))
        .digest('hex'),
    ]),
  ),
  metadata,
  supported: Object.keys(catalog),
}
// Runtime authoring needs attribute spellings, not component implementations.
type Attribute = {
  attribute: string
  presence: boolean
  values: string[]
}
const attributes: Record<string, Attribute> = {}
for (const entry of Object.values(catalog)) {
  for (const [name, state] of Object.entries(entry.states)) {
    const attribute = (attributes[name] ??= {
      attribute: state.attribute,
      presence: false,
      values: [],
    })
    if (attribute.attribute !== state.attribute)
      throw new Error(`Conflicting Base UI attribute spelling: ${name}`)

    if (state.values === null) attribute.presence = true
    else
      for (const value of state.values)
        if (!attribute.values.includes(value)) attribute.values.push(value)
  }
}
const attributesText = `${header}\n/** Attribute spellings and domains for untransformed authoring. Component validation belongs to types and source extraction. */\nexport const attributes = ${JSON.stringify(Object.fromEntries(Object.entries(attributes).sort((a, b) => a[0].localeCompare(b[0], 'en'))), null, 2)} as const\n`

for (const [file, text] of [
  [
    'crates/compiler/src/generated/base_ui.json',
    `${JSON.stringify(catalog, null, 2)}\n`,
  ],
  ['src/base-ui/react/internal/Attributes.generated.ts', attributesText],
  ['src/base-ui/react/internal/Catalog.generated.ts', catalogText],
  ['src/base-ui/react/internal/Types.generated.ts', typesText],
  ['test/conformance/base-ui.json', `${JSON.stringify(inventory, null, 2)}\n`],
] as const) {
  const path = Path.join(root, file)
  const formatted = ChildProcess.execFileSync(
    Path.join(root, 'node_modules/.bin/oxfmt'),
    ['--stdin-filepath', path],
    { encoding: 'utf8', input: text, maxBuffer: 16 * 1024 * 1024 },
  )
  if (update) {
    Fs.mkdirSync(Path.dirname(path), { recursive: true })
    Fs.writeFileSync(path, formatted)
  } else if (
    !Fs.existsSync(path) ||
    Fs.readFileSync(path, 'utf8') !== formatted
  )
    throw new Error(
      `Base UI drift in ${file}. Review pinned declarations and run --update.`,
    )
}
console.log(
  `Base UI ${version}: ${Object.keys(catalog).length} supported parts, ${Object.keys(deferred).length} deferred entries`,
)
