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
  selector?: string
  url: string
  values: readonly string[] | 'number' | 'string' | null
}
type Entry = {
  member: string
  namespace: string
  source: string
  states: Record<string, State>
}
type Part = {
  ancestors: readonly string[]
  entry: Entry
  identity: string
  marker: Ts.InterfaceDeclaration | undefined
  props: Ts.InterfaceDeclaration | undefined
  reason: string | undefined
}
const parts: Part[] = []
const used = new Set<string>()
const deferred: Record<string, string> = {}
const nonDom: string[] = []
// Reviewed against v1.8.0 SliderThumb.tsx, TabsPanel.tsx, and usePopupViewport.tsx.
// Upstream omits @type on these declarations. Child markers do not target the viewport.
const viewportStates: Record<string, Partial<State>> = {
  current: { selector: '& > [data-current]', values: null },
  previous: { selector: '& > [data-previous]', values: null },
  transitioning: { values: null },
}
const fieldStates: Record<string, Partial<State>> = {
  dirty: { values: null },
  disabled: { values: null },
  filled: { values: null },
  focused: { values: null },
  invalid: { values: null },
  touched: { values: null },
  valid: { values: null },
}
const orientation: Partial<State> = { values: ['horizontal', 'vertical'] }
const required: Partial<State> = {
  description:
    'Declared upstream, but Base UI 1.8.0 does not emit data-required on this part. Native required and aria-required are separate attributes.',
}
// Missing declarations are reviewed against the pinned component render paths and
// getStateAttributesProps, not inferred from callback State fields.
const supplements: Record<string, Record<string, Partial<State>>> = {
  'Accordion.Header': {
    closed: { values: null },
    hidden: { values: null },
    orientation,
  },
  'Accordion.Item': {
    closed: { values: null },
    hidden: { values: null },
    orientation,
  },
  'Accordion.Panel': { orientation },
  'Accordion.Root': { orientation },
  'Accordion.Trigger': {
    hidden: { values: null },
    index: {
      description:
        'The item index. Base UI 1.8.0 omits this attribute for index zero.',
      values: 'number',
    },
    orientation,
  },
  'Autocomplete.Input': { required },
  'Autocomplete.List': { empty: { values: null } },
  'Autocomplete.Trigger': { required },
  CheckboxGroup: fieldStates,
  'Collapsible.Panel': { disabled: { values: null } },
  'Collapsible.Root': { disabled: { values: null } },
  'Collapsible.Trigger': {
    disabled: {
      description:
        'Present when the Collapsible.Root is disabled. Base UI 1.8.0 does not reflect the trigger-local disabled override in this attribute.',
      values: null,
    },
  },
  'Combobox.Chip': { disabled: { values: null } },
  'Combobox.ChipRemove': { disabled: { values: null } },
  'Combobox.Input': { required },
  'Combobox.ItemIndicator': { selected: { values: null } },
  'Combobox.Label': fieldStates,
  'Combobox.List': { empty: { values: null } },
  'Combobox.Trigger': { required },
  'ContextMenu.CheckboxItemIndicator': { highlighted: { values: null } },
  'ContextMenu.Popup': { nested: { values: null } },
  'ContextMenu.Positioner': {
    instant: { values: ['click', 'dismiss', 'group', 'trigger-change'] },
    nested: { values: null },
  },
  'ContextMenu.RadioGroup': { disabled: { values: null } },
  'ContextMenu.RadioItemIndicator': { highlighted: { values: null } },
  'Drawer.Backdrop': {
    swipeDismiss: { values: null },
    swiping: { values: null },
  },
  'Drawer.Indent': { active: { values: null }, inactive: { values: null } },
  'Drawer.IndentBackground': {
    active: { values: null },
    inactive: { values: null },
  },
  'Fieldset.Legend': { disabled: { values: null } },
  'Fieldset.Root': { disabled: { values: null } },
  'Menu.CheckboxItemIndicator': { highlighted: { values: null } },
  'Menu.Popup': { nested: { values: null } },
  'Menu.Positioner': {
    instant: { values: ['click', 'dismiss', 'group', 'trigger-change'] },
    nested: { values: null },
  },
  'Menu.RadioGroup': { disabled: { values: null } },
  'Menu.RadioItemIndicator': { highlighted: { values: null } },
  'Menu.Viewport': viewportStates,
  'NavigationMenu.List': { open: { values: null } },
  'NavigationMenu.Root': { nested: { values: null }, open: { values: null } },
  'Popover.Positioner': {
    instant: { values: ['click', 'dismiss', 'focus', 'trigger-change'] },
  },
  'Popover.Viewport': viewportStates,
  'PreviewCard.Positioner': { instant: { values: ['dismiss', 'focus'] } },
  'PreviewCard.Viewport': viewportStates,
  RadioGroup: {
    ...fieldStates,
    readOnly: { attribute: 'data-readonly', values: null },
    required: { values: null },
  },
  'Select.Arrow': {
    side: {
      description:
        'The positioned side. The upstream declaration includes none, but Base UI 1.8.0 does not render the Arrow in that mode.',
    },
  },
  'Select.ItemIndicator': { selected: { values: null } },
  'Select.Label': fieldStates,
  'Slider.Control': { filled: { values: null } },
  'Slider.Indicator': { filled: { values: null } },
  'Slider.Label': { ...fieldStates, dragging: { values: null }, orientation },
  'Slider.Root': { filled: { values: null } },
  'Slider.Thumb': { filled: { values: null }, index: { values: 'number' } },
  'Slider.Track': { filled: { values: null } },
  'Slider.Value': { filled: { values: null } },
  'Tabs.Panel': { index: { values: 'number' } },
  'Tooltip.Positioner': {
    instant: { values: ['delay', 'dismiss', 'focus', 'tracking-cursor'] },
  },
  'Tooltip.Viewport': viewportStates,
}
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
      const originalPath = componentFile.fileName.replace(
        /\.d\.ts$/u,
        'DataAttributes.d.ts',
      )
      const aliasPath = Path.join(
        upstream,
        directory,
        member.name.replace(
          /[A-Z]/gu,
          (letter, offset: number) =>
            `${offset ? '-' : ''}${letter.toLowerCase()}`,
        ),
        `${namespace}${member.name}DataAttributes.d.ts`,
      )
      const attributesFile =
        program.getSourceFile(aliasPath) ?? program.getSourceFile(originalPath)
      const props = componentFile.statements.find(
        (node): node is Ts.InterfaceDeclaration =>
          Ts.isInterfaceDeclaration(node) &&
          node.name.text === `${componentName}Props`,
      )
      const marker =
        props ??
        componentFile.statements.find(
          (node): node is Ts.InterfaceDeclaration =>
            Ts.isInterfaceDeclaration(node) && node.name.text === componentName,
        )
      const entry: Entry = {
        member: member.name,
        namespace,
        source,
        states: {},
      }
      const part: Part = {
        ancestors: [],
        entry,
        identity,
        marker,
        props,
        reason: undefined,
      }
      const parameter = type.getCallSignatures()[0]?.parameters[0]
      if (
        !parameter ||
        !checker
          .getTypeOfSymbolAtLocation(parameter, declaration)
          .getProperty('className')
      ) {
        nonDom.push(identity)
        continue
      }
      if (!marker)
        part.reason = 'No public mergeable Props or component interface'

      if (attributesFile) {
        used.add(Path.relative(upstream, attributesFile.fileName))
        for (const attributeExport of [...exportsOf(attributesFile)].sort(
          (a, b) => a.name.localeCompare(b.name, 'en'),
        )) {
          const attribute = resolve(attributeExport)
          const node = attribute.valueDeclaration
          if (!node) {
            part.reason = `Unresolved attribute ${attributeExport.name}`
            continue
          }
          used.add(Path.relative(upstream, node.getSourceFile().fileName))

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
          const supplement = supplements[identity]?.[attributeExport.name]
          if (
            !supplement &&
            !documentedType &&
            !tags.length &&
            !description.startsWith('Present')
          ) {
            part.reason = `Missing value domain for ${attributeExport.name}`
            continue
          }

          let values: State['values'] = null
          if (documentedType) {
            const domain = checker.getTypeFromTypeNode(documentedType)
            const types = (domain.isUnion() ? domain.types : [domain]).filter(
              (type) =>
                !(type.flags & (Ts.TypeFlags.Null | Ts.TypeFlags.Undefined)),
            )
            if (types.every((type) => type.flags & Ts.TypeFlags.BooleanLike))
              values = null
            else if (types.every((type) => type.isStringLiteral()))
              values = types.map((type) => (type as Ts.StringLiteralType).value)
            else if (domain.flags & Ts.TypeFlags.Number) values = 'number'
            else if (domain.flags & Ts.TypeFlags.String) values = 'string'
            else {
              part.reason = `Unhandled @type for ${attributeExport.name}`
              continue
            }
          } else if (tags.length && !supplement) {
            part.reason = `Unresolved @type for ${attributeExport.name}`
            continue
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
            ...supplement,
          }
        }
      }

      for (const [name, supplement] of Object.entries(
        supplements[identity] ?? {},
      )) {
        if (entry.states[name]) continue

        entry.states[name] = {
          attribute: `data-${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`,
          description: `Supplemental ${name} hook emitted by Base UI ${version}, absent from its attribute declarations.`,
          url: `https://github.com/mui/base-ui/blob/v${version}/packages/react/src/${Path.relative(upstream, componentFile.fileName).replace(/\.d\.ts$/u, '.tsx')}`,
          values: null,
          ...supplement,
        }
      }
      entry.states = Object.fromEntries(
        Object.entries(entry.states).sort((a, b) =>
          a[0].localeCompare(b[0], 'en'),
        ),
      )

      parts.push(part)
    }
  }
}

// Retain ancestor keys as optional never properties so derived marker objects
// remain assignable to their parents without identifying as the parent part.
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
  part.ancestors = parts
    .filter((other) => other.props && bases.has(other.props))
    .map((other) => other.identity)
}

// Aliases share identity hints only when their attribute contracts agree.
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
            state.selector,
            state.values,
          ]),
        ) !==
          JSON.stringify(
            Object.values(part.entry.states).map((state) => [
              state.attribute,
              state.selector,
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
  if (!file.startsWith('utils/') && !file.startsWith('internals/'))
    deferred[file] =
      'Attribute module not associated with a public DOM component'

if (Object.keys(deferred).length)
  throw new Error(
    `Incomplete Base UI coverage:\n${JSON.stringify(deferred, null, 2)}`,
  )

const header =
  '/**\n * Generated by scripts/base-ui.ts. Do not edit.\n * @module\n */\n'
const metadata = { package: '@base-ui/react', version }
const catalogText = `${header}\n/** Pinned upstream package metadata. */\nexport const metadata = ${JSON.stringify(metadata, null, 2)} as const\n\n/** Public component attributes, independent of runtime and type adapters. */\nexport const catalog = ${JSON.stringify(catalog, null, 2)} as const\n`
const quote = (value: string): string => JSON.stringify(value)
const documentation = (state: State, indent: string): string => {
  const domain = (() => {
    if (state.values === null) return 'Presence selector.'
    if (typeof state.values === 'string') return `Values: ${state.values}.`
    return `Values: ${state.values.map((value) => `\`${value}\``).join(', ')}. A null upstream state omits the attribute.`
  })()
  return `${indent}/** ${state.description.replaceAll('*/', '* /')}\n${indent} * Attribute: \`${state.attribute}\`. ${domain}\n${indent} * @see ${state.url}\n${indent} */\n`
}
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
  typesText += `\n/** Explicit ${kind.toLowerCase()} domains for each supported public part. */\nexport type ${kind}${kind === 'States' ? '<body>' : ''} = {\n`
  for (const [identity, entry] of Object.entries(catalog)) {
    typesText += `  /** ${identity} attribute styles. */\n  readonly ${quote(identity)}: {\n`
    for (const [name, state] of Object.entries(entry.states)) {
      if (kind === 'States') {
        typesText += documentation(state, '    ')
        const body = (() => {
          if (state.values === null) return 'body'
          if (state.values === 'number')
            return 'Readonly<Partial<Record<number | `${number}`, body>>>'
          if (state.values === 'string') return 'Readonly<Record<string, body>>'
          return `{\n${state.values.map((value) => `${documentation(state, '      ')}      readonly ${quote(value)}?: body`).join('\n')}\n    }`
        })()
        typesText += `    readonly ${quote(name)}?: ${body}\n`
      } else {
        const selectors = [
          state.selector ?? `&[${state.attribute}]`,
          ...(typeof state.values === 'string' ? [] : (state.values ?? [])).map(
            (value) => `&[${state.attribute}="${value}"]`,
          ),
        ]
        for (const selector of selectors)
          typesText += `${documentation(state, '    ')}    readonly ${quote(selector)}?: true\n`
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
      item.marker &&
      `@base-ui/react/${Path.relative(upstream, item.marker.getSourceFile().fileName).split(Path.sep)[0]}` ===
        source,
  )) {
    if (!item.marker || augmented.has(item.marker)) continue
    augmented.add(item.marker)
    const aliases = parts.filter(
      (other) => !other.reason && other.marker === item.marker,
    )
    const parameters = item.marker.typeParameters
      ? `<${item.marker.typeParameters.map((parameter) => parameter.getText()).join(', ')}>`
      : ''
    const keys = [
      ...new Set(
        aliases.flatMap((alias) => [alias.identity, ...alias.ancestors]),
      ),
    ].sort()
    typesText += `  interface ${item.marker.name.text}${parameters} {\n    /** Documented part and inherited contracts, absent at runtime. */\n    readonly [part]?: {\n${keys.map((key) => `      /** ${key} identity hint. */\n      readonly ${quote(key)}?: ${aliases.some((alias) => alias.identity === key) ? 'true' : 'never'}`).join('\n')}\n    }\n  }\n`
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
  nonDom: nonDom.sort(),
  supplements,
  supported: Object.keys(catalog),
}
// Runtime authoring needs attribute spellings, not component implementations.
type Attribute = {
  attribute: string
  domain?: 'number' | 'string'
  presence: boolean
  selector?: string
  values: string[]
}
const attributes: Record<string, Attribute> = {}
for (const entry of Object.values(catalog)) {
  for (const [name, state] of Object.entries(entry.states)) {
    const attribute = (attributes[name] ??= {
      attribute: state.attribute,
      presence: false,
      ...(state.selector ? { selector: state.selector } : {}),
      values: [],
    })
    if (
      attribute.attribute !== state.attribute ||
      attribute.selector !== state.selector
    )
      throw new Error(`Conflicting Base UI attribute selector: ${name}`)

    if (state.values === null) attribute.presence = true
    else if (typeof state.values === 'string') attribute.domain = state.values
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
  `Base UI ${version}: ${Object.keys(catalog).length} supported DOM parts, ${nonDom.length} non-DOM parts, ${Object.keys(deferred).length} deferred entries`,
)
