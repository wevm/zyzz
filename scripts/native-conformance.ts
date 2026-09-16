/** Audits pinned native declarations and reports unresolved parity obligations. @module */
import * as Babel from '@babel/core'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Ts from 'typescript'

const root = Path.resolve(import.meta.dirname, '..')
const directory = Path.join(root, 'test/conformance/native')

/** Reads upstream declarations without executing React Native or device code. */
export async function inventory() {
  const pin = JSON.parse(
    await Fs.readFile(Path.join(directory, 'pin.json'), 'utf8'),
  ) as {
    files: Record<string, string>
    revision: string
    version: string
  }
  const interfaces = new Map<string, Ts.InterfaceDeclaration>()
  const declarations: Record<string, string> = {}
  const api: Record<string, string> = {}
  const runtimeApi: Record<string, string> = {}

  for (const [file, hash] of Object.entries(pin.files)) {
    const text = await Fs.readFile(
      Path.join(directory, 'upstream', file),
      'utf8',
    )
    if (Crypto.createHash('sha256').update(text).digest('hex') !== hash)
      throw new Error(`Pinned native source changed: ${file}`)

    if (file === 'StyleSheetExports.js.txt') {
      // Babel's Flow parser predates the pinned runtime's variance spelling.
      // Erase only that type modifier, leaving every runtime member intact.
      const source = text.replace('create<out S extends', 'create<S extends')
      const ast = Babel.parseSync(source, {
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ['flow'] },
      })
      const statement = ast?.program.body.find((node) =>
        Babel.types.isExportDefaultDeclaration(node),
      )
      if (
        !statement ||
        !Babel.types.isExportDefaultDeclaration(statement) ||
        !Babel.types.isObjectExpression(statement.declaration)
      )
        throw new Error('Unknown native runtime export shape')

      for (const member of statement.declaration.properties) {
        if (
          Babel.types.isSpreadElement(member) ||
          member.computed ||
          !Babel.types.isIdentifier(member.key) ||
          member.start == null ||
          member.end == null
        )
          throw new Error('Unclassified native runtime export')
        runtimeApi[member.key.name] = source.slice(member.start, member.end)
      }
      continue
    }

    const source = Ts.createSourceFile(
      file,
      text,
      Ts.ScriptTarget.Latest,
      true,
      Ts.ScriptKind.TS,
    )
    for (const statement of source.statements) {
      if (Ts.isInterfaceDeclaration(statement))
        interfaces.set(statement.name.text, statement)
      if (
        Ts.isInterfaceDeclaration(statement) ||
        Ts.isTypeAliasDeclaration(statement)
      )
        declarations[statement.name.text] = statement.getText(source)
      if (
        !Ts.isModuleDeclaration(statement) ||
        statement.name.text !== 'StyleSheet'
      )
        continue
      if (!statement.body || !Ts.isModuleBlock(statement.body))
        throw new Error('Unknown StyleSheet namespace shape')

      for (const member of statement.body.statements) {
        if (
          !Ts.canHaveModifiers(member) ||
          !Ts.getModifiers(member)?.some(
            (modifier) => modifier.kind === Ts.SyntaxKind.ExportKeyword,
          )
        )
          continue
        if (Ts.isFunctionDeclaration(member) && member.name)
          api[member.name.text] = member.getText(source)
        else if (Ts.isVariableStatement(member)) {
          for (const declaration of member.declarationList.declarations)
            api[declaration.name.getText(source)] = declaration.getText(source)
        } else
          throw new Error(`Unclassified native API: ${member.getText(source)}`)
      }
    }
  }

  function properties(
    name: string,
    visiting = new Set<string>(),
  ): Record<string, string> {
    if (visiting.has(name))
      throw new Error(`Cyclic native inheritance: ${name}`)
    const node = interfaces.get(name)
    if (!node) throw new Error(`Missing native parent: ${name}`)
    const next = new Set(visiting).add(name)
    const result: Record<string, string> = {}

    for (const clause of node.heritageClauses ?? [])
      for (const parent of clause.types)
        Object.assign(result, properties(parent.expression.getText(), next))
    for (const member of node.members) {
      if (!Ts.isPropertySignature(member) || !member.type)
        throw new Error(`Unclassified native member: ${member.getText()}`)
      result[member.name.getText()] = member.type.getText()
    }
    return Object.fromEntries(
      Object.entries(result).sort(([a], [b]) => a.localeCompare(b)),
    )
  }

  if (!Object.keys(runtimeApi).length)
    throw new Error('Native runtime exports are missing from the pin')
  for (const [name, source] of Object.entries(runtimeApi)) api[name] ??= source

  return {
    api,
    declarations,
    revision: pin.revision,
    runtimeApi,
    styles: Object.fromEntries(
      ['ImageStyle', 'TextStyle', 'ViewStyle'].map((name) => [
        name,
        properties(name),
      ]),
    ),
    version: pin.version,
  }
}

/** Reproduces compiler-owned static contracts without importing React Native at runtime. */
async function generateStatic() {
  const pinned = await inventory()
  const declarations = Object.entries(pinned.declarations)
    .filter(
      ([name]) =>
        ![
          'ColorValue',
          'Falsy',
          'ImageResizeModeStatic',
          'MaximumOneOf',
          'OpaqueColorValue',
          'RecursiveArray',
          'StyleProp',
          'StyleSheetProperties',
        ].includes(name),
    )
    .map(([, declaration]) =>
      declaration
        .replace(/\bexport\s+/g, '')
        .replace(/Animated\.AnimatedNode/g, 'never'),
    )
    .join('\n')
  const source = `${declarations}
    type ColorValue = string;
    type MaximumOneOf<T, K extends keyof T = keyof T> = K extends keyof T
      ? { [P in K]: T[K] } & { [P in Exclude<keyof T, K>]?: never } : never;
    type Styles = ImageStyle | TextStyle | ViewStyle;
    type Keys<T> = T extends unknown ? keyof T : never;
    type Value<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? T[K] : never : never;
    type Output = { [K in Keys<Styles>]?: Value<Styles, K> };
    type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
    type Properties = Immutable<Output>;
  `
  const filename = Path.join(root, '.fixture-native-static.ts')
  const host = Ts.createCompilerHost({ strict: true })
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (file, version, onError, create) =>
    file === filename
      ? Ts.createSourceFile(file, source, version, true)
      : getSourceFile(file, version, onError, create)
  const program = Ts.createProgram(
    [filename],
    { strict: true, noEmit: true, skipLibCheck: true },
    host,
  )
  const errors = Ts.getPreEmitDiagnostics(program)
  if (errors.length)
    throw new Error(
      Ts.formatDiagnosticsWithColorAndContext(errors, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => root,
        getNewLine: () => '\n',
      }),
    )
  const checker = program.getTypeChecker()
  const file = program.getSourceFile(filename)!
  const declaration = file.statements.find(
    (node) =>
      Ts.isTypeAliasDeclaration(node) && node.name.text === 'Properties',
  ) as Ts.TypeAliasDeclaration

  function schema(type: Ts.Type): unknown {
    if (type.flags & Ts.TypeFlags.Never) return { kind: 'never' }
    if (type.isUnion()) return { kind: 'union', values: type.types.map(schema) }
    if (type.flags & Ts.TypeFlags.StringLiteral)
      return { kind: 'literal', value: (type as Ts.StringLiteralType).value }
    if (type.flags & Ts.TypeFlags.NumberLiteral)
      return { kind: 'literal', value: (type as Ts.NumberLiteralType).value }
    if (type.flags & Ts.TypeFlags.BooleanLiteral)
      return { kind: 'literal', value: checker.typeToString(type) === 'true' }
    if (type.flags & Ts.TypeFlags.String) return { kind: 'string' }
    if (type.flags & Ts.TypeFlags.Number) return { kind: 'number' }
    if (type.flags & Ts.TypeFlags.Undefined) return { kind: 'undefined' }
    if (type.flags & Ts.TypeFlags.Null) return { kind: 'literal', value: null }
    if (type.flags & Ts.TypeFlags.TemplateLiteral) {
      const template = type as Ts.TemplateLiteralType
      if (
        template.texts.join('|') !== '|%' ||
        template.types.length !== 1 ||
        !(template.types[0]!.flags & Ts.TypeFlags.Number)
      )
        throw new Error(
          `Unclassified native template: ${checker.typeToString(type)}`,
        )
      return { kind: 'percentage' }
    }
    if (checker.isArrayType(type))
      return {
        kind: 'array',
        value: schema(checker.getTypeArguments(type as Ts.TypeReference)[0]!),
      }
    if (type.flags & Ts.TypeFlags.Object || type.isIntersection()) {
      const properties = Object.fromEntries(
        checker.getPropertiesOfType(type).map((property) => [
          property.name,
          {
            optional: Boolean(property.flags & Ts.SymbolFlags.Optional),
            value: schema(
              checker.getTypeOfSymbolAtLocation(
                property,
                property.valueDeclaration ?? declaration,
              ),
            ),
          },
        ]),
      )
      return { kind: 'object', properties }
    }
    throw new Error(`Unclassified native type: ${checker.typeToString(type)}`)
  }
  const properties = checker.getTypeAtLocation(declaration)
  const validation = schema(properties)
  const nodes: unknown[] = []
  const ids = new Map<string, number>()
  function intern(input: unknown): number {
    const node = input as {
      kind: string
      properties?: Record<string, { optional: boolean; value: unknown }>
      value?: unknown
      values?: unknown[]
    }
    const value =
      node.kind === 'object'
        ? {
            ...node,
            properties: Object.fromEntries(
              Object.entries(node.properties!).map(([key, property]) => [
                key,
                { ...property, value: intern(property.value) },
              ]),
            ),
          }
        : node.kind === 'union'
          ? { ...node, values: node.values!.map(intern) }
          : node.kind === 'array'
            ? { ...node, value: intern(node.value) }
            : node
    const key = JSON.stringify(value)
    const existing = ids.get(key)
    if (existing !== undefined) return existing
    const id = nodes.length
    nodes.push(value)
    ids.set(key, id)
    return id
  }
  const schemaRoot = intern(validation)
  const printer = Ts.createPrinter({ removeComments: true })
  const types = printer.printFile(file)
  return {
    schema: JSON.stringify({ root: schemaRoot, nodes }, null, 2) + '\n',
    types: `/** Static projection of pinned React Native declarations. Animated and opaque host values are excluded. @module */\n// Copyright (c) Meta Platforms, Inc. and affiliates. MIT license: test/conformance/native/upstream/LICENSE.\n// Generated by scripts/native-conformance.ts --static from React Native ${pinned.version}.\n${types}\nexport type { Output, Properties }\n`,
  }
}

/** Verifies generated static contracts or explicitly updates both artifacts. */
export async function staticContracts(options: staticContracts.Options = {}) {
  const output = await generateStatic()
  for (const [file, value] of [
    ['src/internal/NativeProperties.ts', output.types],
    [
      'src/react-native/internal/NativeSchema.ts',
      '/** Validates static native domains from pinned upstream declarations. @module */\n// Generated by scripts/native-conformance.ts --static --update.\nexport default ' +
        output.schema.trim() +
        '\n',
    ],
  ] as const) {
    const path = Path.join(root, file)
    if (options.update) await Fs.writeFile(path, value)
    else if ((await Fs.readFile(path, 'utf8')) !== value)
      throw new Error(`Native static contract drift: ${file}`)
  }
}

/** Static contract generation options. */
export declare namespace staticContracts {
  /** Explicit artifact maintenance. */
  type Options = {
    /** Rewrite generated types and validation data after reviewing the pin. */
    readonly update?: boolean | undefined
  }
}

/** Fails on inventory drift and reports the full, unfiltered acceptance denominator. */
export async function check(options: check.Options = {}) {
  const actual = await inventory()
  const serialized = JSON.stringify(actual, null, 2) + '\n'
  const file = Path.join(directory, 'inventory.json')
  if (options.update) await Fs.writeFile(file, serialized)
  else if ((await Fs.readFile(file, 'utf8')) !== serialized)
    throw new Error(
      'Native inventory drift. Review the pinned declarations before updating.',
    )

  const properties = Object.values(actual.styles).reduce(
    (total, style) => total + Object.keys(style).length,
    0,
  )
  const apis = Object.keys(actual.api).length
  // The audit foundation has no device evidence. It cannot certify parity from a property allowlist.
  const report = `React Native ${actual.version}: ${properties} component/property pairs, ${apis} StyleSheet APIs. Complete parity: pending type/value-domain audit and iOS/Android evidence.`
  if (options.requireFull) throw new Error(report)
  return report
}

/** Inventory maintenance and strict acceptance modes. */
export declare namespace check {
  /** Explicit maintenance options, never inferred from CI state. */
  type Options = {
    /** Refuse completion while native acceptance evidence is missing. */
    readonly requireFull?: boolean | undefined
    /** Rewrite only the generated inventory after a reviewed pin change. */
    readonly update?: boolean | undefined
  }
}

if (
  process.argv[1] &&
  Path.resolve(process.argv[1]) === Url.fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2)
  for (const arg of args)
    if (!['--require-full', '--static', '--update'].includes(arg))
      throw new Error(`Unknown native audit option: ${arg}`)
  if (args.includes('--static'))
    await staticContracts({ update: args.includes('--update') })
  console.log(
    await check({
      requireFull: args.includes('--require-full'),
      update: args.includes('--update'),
    }),
  )
}
