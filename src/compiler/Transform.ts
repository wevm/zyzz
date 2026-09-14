/**
 * Rewrites extracted style calls into executable modules with CSS and source maps.
 * @module
 */
import * as Applications from './internal/Applications.js'
import type * as Ast from '@oxc-project/types'
import * as Css from '../web/Css.js'
import * as Expression from './internal/Expression.js'
import MagicString from 'magic-string'
import * as Mapping from '@jridgewell/gen-mapping'
import * as Namespaces from './internal/Namespaces.js'
import * as Syntax from './internal/Syntax.js'
import * as Source from './Source.js'
import type * as Style from '../Style.js'
import * as Themes from './internal/Themes.js'
import * as Walker from 'oxc-walker'

/**
 * Rewrites literal web styles and local themes without evaluation or file access.
 * Direct no-argument applications become props; other definitions become callables.
 * CSS retains ordered composition and receives module-scoped class identities.
 * @param options - Source text and a stable package-relative module identity.
 * @returns Rewritten TypeScript/JSX and CSS with separate version-three maps.
 * @throws {Source.ExtractError} If the source is outside the supported literal subset.
 * @throws {Css.CompileError} If literal CSS compilation fails.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const extracted =
    options[Themes.context]?.extracted ?? Source.extract(options)

  const emitted = Css.compile({
    development: options.development,
    scope: options.moduleId,
    styles: extracted.styles,
    contributions: extracted.contributions,
    themes: Object.keys(extracted.themes).length ? extracted.themes : undefined,
  })

  const module = new MagicString(options.source)
  const program = Syntax.parse(options).program

  for (const call of extracted.contributionCalls ?? [])
    module.overwrite(
      call.start,
      call.end,
      (() => {
        const typed = /\.[cm]?tsx?$/.test(options.moduleId)
        if (call.kind === 'cssFunction')
          return `((...args${typed ? ': readonly (string | number)[]' : ''}) => ${JSON.stringify(call.name + '(')} + args.map(value => typeof value === 'string' && value.includes(',') && !value.trimStart().startsWith('{') ? '{' + value + '}' : value).join(',') + ')')${typed ? ` as import('zyzz/web').cssFunction.Reference<${JSON.stringify(call.function?.parameters ?? [])}, ${JSON.stringify(call.function?.returns ?? '*')}>` : ''}`
        if (call.kind === 'customMedia')
          return `${JSON.stringify(`@media (${call.name})`)}${typed ? ` as unknown as import('zyzz/web').customMedia.Reference` : ''}`
        if (!call.name) return 'void 0'
        return `${JSON.stringify(call.name)}${call.kind === 'keyframes' || !typed ? '' : ` as import('zyzz/web').${call.kind}.Reference`}`
      })(),
    )

  type Span = Pick<Ast.Node, 'end' | 'start'>

  const applications = new Map<number, { end: number; folded: boolean }>()
  const calls = new Map(extracted.calls.map((call) => [call.start, call]))
  const definitions = new Map<number, Ast.ObjectExpression>()
  const unusedSelections = new Set<number>()
  const identifiers = new Map<string, Span[]>()

  const localApplications = Applications.create(program, extracted.calls)

  Walker.walk(program, {
    enter(node, parent) {
      localApplications?.enter(node, parent)

      if (
        node.type === 'VariableDeclarator' &&
        node.init &&
        node.id.type === 'ObjectPattern' &&
        node.id.properties.every(
          (property) =>
            property.type === 'Property' &&
            (property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal'
                ? property.key.value
                : undefined) !== 'themes',
        )
      )
        unusedSelections.add(Expression.unwrap(node.init).start)

      if (node.type === 'Identifier') {
        const references = identifiers.get(node.name) ?? []

        references.push(node)
        identifiers.set(node.name, references)
      }

      if (node.type !== 'CallExpression') return

      const call = calls.get(node.start)
      if (!call || node.end !== call.end) return

      const folded =
        !!call.composition ||
        (!call.recipe &&
          !call.slots &&
          parent?.type === 'CallExpression' &&
          parent.callee === node &&
          !parent.optional &&
          parent.arguments.length === 0)

      applications.set(call.start, {
        end: folded && !call.composition ? parent!.end : call.end,
        folded,
      })

      let argument = node.arguments[0]
        ? Expression.unwrap(node.arguments[0])
        : undefined

      if (argument?.type === 'ArrowFunctionExpression')
        argument = Expression.unwrap(argument.body) as Ast.Expression

      if (call.body) definitions.set(call.start, call.body)
      else if (argument?.type === 'ObjectExpression')
        definitions.set(call.start, argument)
    },
  })

  let runtime = '__zyzzProps'

  while (identifiers.has(runtime)) runtime += '_'

  let html = '__zyzzHtml'

  while (identifiers.has(html)) html += '_'

  let usesHtml = false
  let conditionalRecipe = '__zyzzConditionalRecipe'
  while (identifiers.has(conditionalRecipe)) conditionalRecipe += '_'
  let usesConditionalRecipe = false
  let payloadRecipe = '__zyzzPayloadRecipe'
  while (identifiers.has(payloadRecipe)) payloadRecipe += '_'
  let usesPayloadRecipe = false
  let recipe = '__zyzzRecipe'
  while (identifiers.has(recipe)) recipe += '_'
  let usesRecipe = false
  let compositionHtml = '__zyzzCompositionHtml'
  while (identifiers.has(compositionHtml)) compositionHtml += '_'
  let usesCompositionHtml = false
  const preparedHtml = new Set(
    extracted.calls.flatMap((call) =>
      call.output === 'html'
        ? (call.runtimeComposition ?? []).map((input) => input.name)
        : [],
    ),
  )
  function prepareExport(link: Themes.Link) {
    if (link.style?.output === 'html') {
      const call = extracted.calls.find(
        (call) => call.identity === link.binding,
      )
      if (call) preparedHtml.add(call.name)
    }
    for (const member of Object.values(link.members ?? {}))
      prepareExport(member)
  }
  for (const link of Object.values(extracted.themeExports ?? {}))
    prepareExport(link)
  let composition = '__zyzzComposition'
  while (identifiers.has(composition)) composition += '_'
  let usesComposition = false
  const compositions: string[] = []
  const compositionArguments = new Map<string, string>()

  let appearance = '__zyzzAppearance'

  while (identifiers.has(appearance)) appearance += '_'

  let usesAppearance = false
  let selection = '__zyzzSelection'

  while (identifiers.has(selection)) selection += '_'

  let usesSelection = false

  let variables = '__zyzzVariable'

  while (identifiers.has(variables)) variables += '_'

  for (const call of extracted.variableCalls ?? [])
    module.overwrite(
      call.start,
      call.end,
      `${variables}.create(${JSON.stringify(call.slots.value)})`,
    )

  const identities = new Map(
    extracted.calls
      .filter((call) => call.identity)
      .map((call) => [call.name, call.identity!]),
  )

  const classes = Object.freeze(
    Object.fromEntries(
      Object.entries(emitted.classes).map(([name, value]) => [
        name,
        [
          ...new Set([
            ...value.split(' ').filter(Boolean),
            ...(identities.has(name) ? [identities.get(name)!] : []),
          ]),
        ].join(' '),
      ]),
    ),
  )

  let callable = false

  const composed = (node: Span) =>
    extracted.calls.some(
      (call) =>
        call.composition && call.start < node.start && node.end <= call.end,
    )
  // Rewrite contained expressions before their enclosing composition reads them.
  const rewrites = [...extracted.calls].sort((a, b) =>
    a.start < b.start && a.end >= b.end
      ? 1
      : b.start < a.start && b.end >= a.end
        ? -1
        : a.start - b.start,
  )
  for (const call of rewrites) {
    if (call.compositionCase || composed(call)) continue
    const application = applications.get(call.start)!
    const props = `{${call.output === 'html' ? 'class' : 'className'}:${JSON.stringify(classes[call.name])}}`

    const composeHtml = call.output === 'html' && preparedHtml.has(call.name)
    if (composeHtml) usesCompositionHtml = true
    const replacement = (() => {
      if (call.runtimeComposition) {
        const helper = call.output === 'html' ? compositionHtml : composition
        if (call.output === 'html') usesCompositionHtml = true
        else usesComposition = true
        let factory = `${composition}${call.start}`
        while (identifiers.has(factory)) factory += '_'
        const inputs = call.runtimeComposition.map((input) => ({
          className:
            classes[input.name] ??
            options[Themes.context]?.styleClasses?.[input.name] ??
            '',
          condition: input.condition,
          owners: input.owners,
        }))
        compositions.push(
          `const ${factory}=/*#__PURE__*/${helper}.create(${JSON.stringify({ className: classes[call.name], cases: call.compositionCases?.map((name) => classes[name]!), inputs })});`,
        )
        return `${factory}(${call.runtimeComposition
          .map((input) => {
            const key = `${input.start}:${input.end}`
            const value =
              compositionArguments.get(key) ??
              module.slice(input.start, input.end)
            compositionArguments.set(key, value)
            return value
          })
          .join(',')})`
      }
      if (call.composition)
        return call.composition.reduceRight(
          (result, guard) =>
            `((${guard}${/\.[cm]?tsx?$/.test(options.moduleId) ? ' as unknown' : ''})?${result}:${guard}())`,
          composeHtml
            ? `${compositionHtml}.from({className:${JSON.stringify(classes[call.name])}})`
            : `(${props})`,
        )
      if (call.recipe) {
        const helper = call.recipe.conditions?.length
          ? conditionalRecipe
          : recipe
        if (call.recipe.conditions?.length) usesConditionalRecipe = true
        else usesRecipe = true

        const payload = !!call.recipe.payloads?.length
        if (payload) usesPayloadRecipe = true
        const selection = `${helper}.create(${JSON.stringify({ axes: call.recipe.axes, defaults: call.recipe.defaults, conditions: call.recipe.conditions, className: classes[call.name], ...(!payload && call.output === 'html' && !composeHtml ? { html: true } : {}) })})`
        const value = payload
          ? `${payloadRecipe}.create({...${JSON.stringify({ ...call.recipe, html: call.output === 'html' && !composeHtml })},select:${selection}})`
          : selection
        const bound = composeHtml ? `${compositionHtml}.bind(${value})` : value
        const axes = Object.entries(call.recipe.axes)
          .map(
            ([axis, choices]) =>
              `${JSON.stringify(axis)}:{${choices.map((choice) => `${JSON.stringify(choice)}:${call.recipeTypes?.[axis]?.[choice] ? `(values:${call.recipeTypes[axis]![choice]})=>{}` : '{}'}`).join(';')}}`,
          )
          .join(';')
        const conditions = call.recipe.conditions
          ?.map((name) => `${JSON.stringify(name)}:unknown`)
          .join(';')
        const type = `import('zyzz').variants.ReturnType<{variants:{${axes}}${conditions ? `;conditions:{${conditions}}` : ''}}${call.output === 'html' ? ',"html"' : ''}>`
        return /\.[cm]?tsx?$/.test(options.moduleId)
          ? `(${bound} as ${type})`
          : bound
      }
      if (call.slots) {
        const type = `import('zyzz').css.Dynamic<${call.valuesType}${call.output === 'html' ? ',"html"' : ''}>`
        const typed = /\.[cm]?tsx?$/.test(options.moduleId)
        const slots = Object.entries(call.slots)

        const reads = slots
          .map(
            ([key], index) =>
              `const v${index}=input[${JSON.stringify(key)}]${typed ? ' as string | number' : ''};`,
          )
          .join('')

        const assignments = slots
          .map(
            ([, slot], index) =>
              `${JSON.stringify(slot.name)}:v${index}===''?' ':v${index}`,
          )
          .join(',')

        const className = JSON.stringify(classes[call.name])
        const value = `(input${typed ? `:Parameters<${type}>[0]` : ''})=>{${reads}const external=input.className;const style=input.style;return {className:external?${className}+" "+external:${className},style:{...input.variables,...style,${assignments}}}}`
        const result = composeHtml
          ? `${compositionHtml}.bind(${value})`
          : call.output === 'html'
            ? `${html}.bind(${value})`
            : `(${value})`

        if (call.output === 'html' && !composeHtml) usesHtml = true

        return typed ? `(${result} as ${type})` : result
      }

      if (application.folded)
        return composeHtml
          ? `${compositionHtml}.from({className:${JSON.stringify(classes[call.name])}})`
          : `(${props})`

      if (call.output === 'html') {
        if (composeHtml) {
          callable = true
          return `(${compositionHtml}.bind(${runtime}.create({className:${JSON.stringify(classes[call.name])}}))${/\.[cm]?tsx?$/.test(options.moduleId) ? " as import('zyzz').css.ReturnType<'html'>" : ''})`
        }
        usesHtml = true

        return `${html}.create({className:${JSON.stringify(classes[call.name])}})`
      }

      return `${runtime}.create(${props})`
    })()

    module.overwrite(call.start, application.end, replacement)

    if (
      !call.recipe &&
      !call.slots &&
      !call.runtimeComposition &&
      !application.folded &&
      call.output !== 'html'
    )
      callable = true
  }

  for (const application of localApplications?.find() ?? []) {
    if (
      extracted.calls.some(
        (call) =>
          call.output === 'html' &&
          call.runtimeComposition?.some(
            (input) => input.applicationStart === application.start,
          ),
      )
    )
      continue
    if (
      extracted.calls.some(
        (call) =>
          (call.composition || call.runtimeComposition) &&
          call.start < application.start &&
          application.end <= call.end,
      )
    )
      continue
    const className = JSON.stringify(classes[application.name])

    const key =
      extracted.calls.find((call) => call.name === application.name)?.output ===
      'html'
        ? 'class'
        : 'className'

    // Keep a callable guard so bundlers also retain failures before initialization.
    module.overwrite(
      application.start,
      application.end,
      `(${options.source.slice(application.start, application.calleeEnd)}?{${key}:${className}}:${options.source.slice(application.start, application.calleeEnd)}())`,
    )
  }

  for (const call of extracted.themeCalls) {
    const scope = (name: string) => ({ className: emitted.themes[name] })

    const props = (() => {
      if (!call.members)
        return `{className:${JSON.stringify(emitted.themes[call.name])}}`

      const script = extracted.themeScripts?.includes(call.name)

      if (script) usesAppearance = true

      if (call.options?.themes) {
        const catalog = Object.fromEntries(
          Object.entries(call.members)
            .filter(([key]) => (JSON.parse(key) as string[]).length === 2)
            .map(([key, name]) => [
              (JSON.parse(key) as string[])[1]!,
              emitted.themes[name],
            ]),
        )

        const entries = JSON.stringify(Object.entries(catalog))
        if (unusedSelections.has(call.start))
          return `{${script ? `script:${appearance}.create(${entries}),` : ''}theme:${JSON.stringify(scope(call.members['["theme"]']!))}}`

        usesSelection = true

        return `{${script ? `script:${appearance}.create(${entries}),` : ''}theme:${JSON.stringify(scope(call.members['["theme"]']!))},themes:/*#__PURE__*/${selection}.create(${entries},${call.options.output === 'html'})}`
      }

      if (Object.hasOwn(call.members, '["theme"]'))
        return `{${script ? `script:${appearance}.create([]),` : ''}theme:${JSON.stringify(scope(call.members['["theme"]']!))}}`

      return script ? `{script:${appearance}.create([])}` : '{}'
    })()

    const assertion = /\.[cm]?tsx?$/.test(options.moduleId)
      ? ` as ${call.type ?? `import('zyzz').Theme.Definition<${call.tokenType}>`}`
      : ''

    module.overwrite(call.start, call.end, `(${props}${assertion})`)
  }

  for (const alias of extracted.themeAliases) {
    if (alias.retained) {
      if (/\.[cm]?tsx?$/.test(options.moduleId))
        module.overwrite(
          alias.start,
          alias.end,
          `(${options.source.slice(alias.start, alias.end)} as ${alias.type ?? `import('zyzz').Theme.Definition<${alias.tokenType}>`})`,
        )

      continue
    }

    const member = alias.recipe ? 'variants' : 'css'
    const members = [...new Set(alias.bindings ?? [member])]
    const value = alias.destructured
      ? `{${members.map((member) => `${member}:undefined`).join(',')}}`
      : 'undefined'
    const type =
      alias.type ?? `import('zyzz').Theme.Definition<${alias.tokenType}>`
    const assertion = /\.[cm]?tsx?$/.test(options.moduleId)
      ? ` as unknown as ${alias.destructured ? `{${members.map((member) => `readonly ${member}:${type}['${member}']`).join(';')}}` : `${type}['${member}']`}`
      : ''

    module.overwrite(alias.start, alias.end, `(${value}${assertion})`)
  }

  const replacements = [
    ...extracted.calls.map((call) => ({
      end: applications.get(call.start)!.end,
      start: call.start,
    })),
    ...(extracted.contributionCalls ?? []),
    ...(extracted.variableCalls ?? []),
    ...extracted.themeAliases,
    ...extracted.themeCalls,
  ].sort((a, b) => a.start - b.start)

  function replaced(reference: Span) {
    let low = 0
    let high = replacements.length

    while (low < high) {
      const middle = (low + high) >>> 1

      if (replacements[middle]!.start <= reference.start) low = middle + 1
      else high = middle
    }

    const call = replacements[low - 1]

    return call !== undefined && reference.end <= call.end
  }

  for (const reference of extracted.staticThemeReferences ?? [])
    if (!replaced(reference))
      module.overwrite(
        reference.start,
        reference.end,
        JSON.stringify(reference.value),
      )

  for (const reference of extracted.themeReferences)
    if (!replaced(reference))
      module.overwrite(
        reference.start,
        reference.end,
        JSON.stringify(emitted.themes[reference.name]),
      )

  replacements.push(
    ...extracted.themeReferences,
    ...(extracted.staticThemeReferences ?? []),
  )
  replacements.sort((a, b) => a.start - b.start)

  for (const node of program.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      !['zyzz', 'zyzz/web'].includes(node.source.value)
    )
      continue

    const removed = new Set<Ast.ImportDeclaration['specifiers'][number]>()

    for (const specifier of node.specifiers) {
      if (
        node.importKind === 'type' ||
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type' ||
        !(
          node.source.value === 'zyzz'
            ? ['Config', 'css', 'cx', 'Theme', 'variable', 'variants']
            : [
                'Css',
                'cssFunction',
                'customMedia',
                'importCss',
                'namespace',
                'colorProfile',
                'counterStyle',
                'fontPaletteValues',
                'fontFeatureValues',
                'page',
                'property',
                'viewTransition',
                'global',
                'fontFace',
                'keyframes',
                'layers',
                'positionTry',
              ]
        ).includes(
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value,
        )
      )
        continue

      // Conservative retention also protects type queries and shadowed references.
      const remaining = identifiers
        .get(specifier.local.name)
        ?.some(
          (reference) =>
            !(reference.start >= node.start && reference.end <= node.end) &&
            !replaced(reference),
        )

      if (!remaining) removed.add(specifier)
    }

    if (!removed.size) continue

    const retained = node.specifiers.filter(
      (specifier) => !removed.has(specifier),
    )

    if (!retained.length) module.remove(node.start, node.end)
    else if (
      retained.every((specifier) => specifier.type !== 'ImportSpecifier')
    ) {
      module.overwrite(
        node.start,
        node.source.start,
        `import ${retained.map((specifier) => options.source.slice(specifier.start, specifier.end)).join(', ')} from `,
      )
    } else {
      // Preserve the import source, attributes, and untouched specifier spelling.
      for (let index = 0; index < node.specifiers.length; index++) {
        const specifier = node.specifiers[index]!
        if (!removed.has(specifier)) continue

        const next = node.specifiers[index + 1]
        const previous = node.specifiers[index - 1]

        if (next) module.remove(specifier.start, next.start)
        else if (previous) module.remove(previous.end, specifier.end)
      }
    }
  }

  if (
    callable ||
    usesRecipe ||
    usesComposition ||
    usesCompositionHtml ||
    usesConditionalRecipe ||
    usesPayloadRecipe ||
    usesHtml ||
    usesSelection ||
    usesAppearance ||
    extracted.variableCalls?.length
  ) {
    // Insertion after a hashbang keeps executable module syntax intact.
    let offset = options.source.startsWith('#!')
      ? options.source.indexOf('\n') + 1
      : 0

    for (const node of program.body) {
      if (node.type !== 'ExpressionStatement' || !node.directive) break

      offset = node.end
    }

    if (compositions.length)
      module.appendLeft(offset, '\n' + compositions.join('\n') + '\n')

    module.appendLeft(
      offset,
      `\nimport { ${[usesAppearance ? `Appearance as ${appearance}` : '', usesComposition ? `Composition as ${composition}` : '', usesCompositionHtml ? `CompositionHtml as ${compositionHtml}` : '', usesConditionalRecipe ? `ConditionalRecipe as ${conditionalRecipe}` : '', usesHtml ? `Html as ${html}` : '', usesPayloadRecipe ? `PayloadRecipe as ${payloadRecipe}` : '', callable ? `Props as ${runtime}` : '', usesRecipe ? `Recipe as ${recipe}` : '', usesSelection ? `Selection as ${selection}` : '', extracted.variableCalls?.length ? `Variable as ${variables}` : ''].filter(Boolean).join(', ')} } from 'zyzz/runtime';\n`,
    )
  }

  const cssMap = new Mapping.GenMapping({ file: `${options.moduleId}.css` })

  Mapping.setSourceContent(cssMap, options.moduleId, options.source)

  const lines = [0]

  for (let index = 0; index < options.source.length; index++)
    if (options.source[index] === '\n') lines.push(index + 1)

  function position(offset: number) {
    let low = 0
    let high = lines.length

    while (low + 1 < high) {
      const middle = (low + high) >>> 1

      if (lines[middle]! <= offset) low = middle
      else high = middle
    }

    return { column: offset - lines[low]!, line: low + 1 }
  }

  const owners = new Map<string, Source.Call>()

  for (const call of extracted.calls)
    for (const name of emitted.classes[call.name]!.split(' '))
      if (!owners.has(name)) owners.set(name, call)

  const styles = new Map(
    extracted.styles.styles.map((style) => [style.name, style]),
  )

  const themeOwners = new Map(
    extracted.themeCalls.flatMap((call) =>
      [...new Set([call.name, ...Object.values(call.members ?? {})])].map(
        (name) => [emitted.themes[name], { ...call, name }] as const,
      ),
    ),
  )

  const linkedOwners = new Map(
    Object.entries(options[Themes.context]?.owners ?? {}).map(
      ([key, owner]) => [emitted.themes[key], owner],
    ),
  )

  // Literal and scalar-theme rules each occupy one line at this boundary.
  const prefix = emitted.contributionCss ?? ''
  const contributions = (extracted.contributions ?? []).map(
    (definition, index) => ({
      definition,
      start: extracted.contributionStarts?.[index],
    }),
  )
  const rank = (kind: string) =>
    kind === 'import' ? 0 : kind === 'namespace' ? 1 : 2
  const layered = contributions.find(
    (value) =>
      value.definition.kind === 'layers' && value.definition.names.length > 0,
  )
  let contributionLine = 1
  if (layered) {
    if (layered.start !== undefined)
      Mapping.addMapping(cssMap, {
        generated: { line: contributionLine, column: 0 },
        original: position(layered.start),
        source: options.moduleId,
      })
    contributionLine++
  }
  for (const contribution of contributions.toSorted(
    (a, b) => rank(a.definition.kind) - rank(b.definition.kind),
  )) {
    if (contribution.definition.kind === 'layers') continue
    const rendered =
      Css.compile({
        styles: { styles: [] },
        contributions: [contribution.definition],
        themes: Object.keys(extracted.themes).length
          ? extracted.themes
          : undefined,
      }).contributionCss ?? ''
    if (!rendered) continue
    for (const _ of rendered.split('\n')) {
      if (contribution.start !== undefined)
        Mapping.addMapping(cssMap, {
          generated: { line: contributionLine, column: 0 },
          original: position(contribution.start),
          source: options.moduleId,
        })
      contributionLine++
    }
  }
  const scoped = emitted.scopedCss ?? emitted.css

  const css = [
    prefix,
    (scoped ? scoped.split('\n') : [])
      .map((rule, index) => {
        const line = index + 1 + (prefix ? prefix.split('\n').length : 0)
        const brace = rule.indexOf('{')
        const name = rule.slice(1, brace)
        const linkedOwner = linkedOwners.get(name)

        if (linkedOwner) {
          const lines = linkedOwner.source
            .slice(0, linkedOwner.call.start)
            .split('\n')

          Mapping.setSourceContent(
            cssMap,
            linkedOwner.moduleId,
            linkedOwner.source,
          )
          Mapping.addMapping(cssMap, {
            generated: { column: 0, line },
            name: linkedOwner.call.name,
            original: { line: lines.length, column: lines.at(-1)!.length },
            source: linkedOwner.moduleId,
          })

          return rule
        }

        const themeOwner = themeOwners.get(name)

        if (themeOwner) {
          Mapping.addMapping(cssMap, {
            generated: { column: 0, line },
            name: themeOwner.name,
            original: position(themeOwner.start),
            source: options.moduleId,
          })

          return rule
        }

        if (Object.values(emitted.themes).includes(name)) {
          // Packed theme declarations have no authored source in this graph.
          Mapping.addMapping(cssMap, { generated: { column: 0, line } })

          return rule
        }

        const selector = `.${name}`
        const call = owners.get(name)!

        Mapping.addMapping(cssMap, {
          generated: { column: 0, line },
          name: call.name,
          original: position(call.start),
          source: options.moduleId,
        })

        const body = rule.slice(brace)
        const style = styles.get(call.name)!

        function declarations(
          style: Style.NamedStyle,
        ): readonly Style.Declaration[] {
          return style.rules
            ? style.rules.flatMap((rule) => declarations(rule.style))
            : style.declarations
        }

        const conditionNodes: Extract<Ast.Node, { type: 'Property' }>[] = []

        function locations(node: Ast.ObjectExpression): readonly Ast.Node[] {
          return node.properties.flatMap((property) => {
            if (property.type !== 'Property') return []

            const value = Expression.unwrap(property.value)

            if (value.type === 'ObjectExpression') {
              conditionNodes.push(property)

              return locations(value)
            }

            const key =
              property.key.type === 'Identifier'
                ? property.key.name
                : property.key.type === 'Literal'
                  ? String(property.key.value)
                  : ''

            const authoredLocations: readonly Ast.Node[] =
              value.type === 'ArrayExpression'
                ? value.elements.filter(
                    (node): node is NonNullable<typeof node> => node !== null,
                  )
                : [property]

            return (call.shorthands?.[key] ?? [key]).flatMap(
              () => authoredLocations,
            )
          })
        }

        const ordered = declarations(style)
        const authored = locations(call.body ?? definitions.get(call.start)!)
        const conditionStarts = declarationStarts(body, true)
        const conditions: string[] = []

        function collectConditions(style: Style.NamedStyle) {
          for (const rule of style.rules ?? []) {
            if (rule.condition !== undefined) conditions.push(rule.condition)

            collectConditions(rule.style)
          }
        }

        collectConditions(style)
        let conditionCursor = 0

        for (const start of conditionStarts) {
          const condition = body.slice(start, body.indexOf('{', start))
          const index = conditions.indexOf(condition, conditionCursor)
          const node = conditionNodes[index]
          if (!node) continue

          conditionCursor = index + 1
          Mapping.addMapping(cssMap, {
            generated: { column: selector.length + start, line },
            name: options.source.slice(node.key.start, node.key.end),
            original: position(node.key.start),
            source: options.moduleId,
          })
        }

        const starts = declarationStarts(body)
        let cursor = 1

        for (
          let propertyIndex = 0;
          propertyIndex < ordered.length;
          propertyIndex++
        ) {
          const declaration = ordered[propertyIndex]!
          const text = `${declaration.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:`
          const start =
            starts.find(
              (start) => start >= cursor && body.startsWith(text, start),
            ) ?? -1
          if (start < 0) continue

          const location = authored[propertyIndex]!

          Mapping.addMapping(cssMap, {
            generated: { column: selector.length + start, line },
            name: declaration.property,
            original: position(location.start),
            source: options.moduleId,
          })
          cursor = start + text.length
        }

        return selector + body
      })
      .join('\n'),
  ]
    .filter(Boolean)
    .join('\n')

  const map = module.generateMap({
    hires: true,
    includeContent: true,
    source: options.moduleId,
  })

  const namespaced = Namespaces.rewrite(
    css,
    extracted.namespaces ?? [],
    Mapping.toEncodedMap(cssMap),
    true,
  )
  return Object.freeze({
    classes,
    code: module.toString(),
    css: namespaced.css,
    cssMap: namespaced.map ?? Mapping.toEncodedMap(cssMap),
    map: {
      file: options.moduleId,
      mappings: map.mappings,
      names: map.names,
      sources: map.sources,
      sourcesContent: map.sourcesContent!,
      version: 3 as const,
    },
    themes: emitted.themes,
  })
}

/** Source transform contracts. */
export declare namespace compile {
  /** Public failures from extraction and target compilation. */
  type ErrorType = Css.CompileError | Source.ExtractError
  /** Supplied module identity and source; no file loading occurs. */
  type Options = Source.extract.Options & {
    /** Stable declaration names for CSS-only development updates. */
    readonly development?: boolean | undefined
  }

  /** Executable module and stylesheet artifacts; TypeScript/JSX lowering belongs to the host. */
  type ReturnType = {
    /** Module-scoped class lists keyed by extracted definition identity. */
    readonly classes: Readonly<Record<string, string>>
    /** Rewritten source with imports for surviving props callables. */
    readonly code: string
    /** Ordered, unminified stylesheet text. */
    readonly css: string
    /** Standard stylesheet map with authored selector/declaration locations. */
    readonly cssMap: Mapping.EncodedSourceMap
    /** Standard rewritten-module map, including original source content. */
    readonly map: Mapping.EncodedSourceMap
    /** Stable scope classes keyed by local module/binding identity. */
    readonly themes: Readonly<Record<string, string>>
  }
}

/** Locates emitted declarations while skipping selectors, conditions, and quoted CSS data. */
function declarationStarts(
  body: string,
  conditions = false,
): readonly number[] {
  const starts: number[] = []
  let start = 0
  let depth = 0
  let blocks = 0
  let custom = false
  let quote = ''

  for (let index = 0; index < body.length; index++) {
    const char = body[index]!

    if (char === '\\') {
      index++
      continue
    }

    if (quote) {
      if (char === quote) quote = ''

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '/' && body[index + 1] === '*') {
      const end = body.indexOf('*/', index + 2)

      if (end < 0) break

      index = end + 1
      continue
    }

    if (char === '(' || char === '[') {
      depth++
      continue
    }

    if (char === ')' || char === ']') {
      depth--
      continue
    }

    if (depth) continue

    if (char === ':' && body.slice(start, index).trimStart().startsWith('--'))
      custom = true

    if (char === '{') {
      if (custom) blocks++
      else {
        if (conditions && index > start) starts.push(start)

        start = index + 1
      }
    } else if (char === '}') {
      if (blocks) blocks--
      else {
        start = index + 1
        custom = false
      }
    } else if (char === ';' && !blocks) {
      while (/\s/.test(body[start] ?? '') && start < index) start++

      if (!conditions) starts.push(start)

      start = index + 1
      custom = false
    }
  }

  return starts
}
