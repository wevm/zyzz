/** Validates descriptor grammars independently of the output parser's error recovery. @module */
import * as Lightning from 'lightningcss'
import * as Tree from 'css-tree'

/** Checks one authored descriptor before it can introduce another CSS declaration. */
export function check(options: check.Options): void {
  const name = options.name.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  )
  const result = Tree.lexer.matchAtruleDescriptor(
    options.rule,
    name,
    options.value,
  )
  if (result.error)
    throw new Error(`Invalid @${options.rule} ${name}: ${result.error.message}`)
  if (
    options.rule === 'page' &&
    ['bleed', 'size'].includes(name) &&
    /(?:calc|min|max|clamp)\(/i.test(options.value)
  )
    Lightning.transform({
      filename: 'page.css',
      code: new TextEncoder().encode(
        `@property --page-length {syntax: "<length>${name === 'size' ? '+' : ''}"; inherits: false; initial-value: ${options.value};}`,
      ),
    })
}

/** Checks a native custom-media query before statement serialization. */
export function media(query: string): void {
  const result = Tree.lexer.matchAtrulePrelude('media', query)
  if (result.error)
    throw new Error(`Invalid custom-media query: ${result.error.message}`)
}

/** Authored descriptor grammar input. */
export declare namespace check {
  type Options = {
    readonly name: string
    readonly rule: string
    readonly value: string
  }
}

/** Reviews every declaration in standard named descriptor rules. */
export function validate(source: string): void {
  const sheet = Tree.parse(source)
  Tree.walk(sheet, {
    visit: 'Atrule',
    enter(rule) {
      const name = rule.name.toLowerCase()
      if (name === 'document') {
        if (!rule.block || !rule.prelude)
          throw new Error(
            'Document rules require matching functions and a block.',
          )
        const result = Tree.lexer.matchAtrulePrelude(
          'document',
          Tree.generate(rule.prelude),
        )
        if (result.error)
          throw new Error(
            `Invalid document matching functions: ${result.error.message}`,
          )
        return
      }
      if (name === 'custom-media') {
        if (rule.block || !rule.prelude)
          throw new Error(
            'Custom-media requires a name and query without a block.',
          )
        const prelude = Tree.generate(rule.prelude)
        let first: { type: number; start: number; end: number } | undefined
        Tree.tokenize(prelude, (type, start, end) => {
          if (
            !first &&
            type !== Tree.tokenTypes.WhiteSpace &&
            type !== Tree.tokenTypes.Comment
          )
            first = { type, start, end }
        })
        const name = first
          ? Tree.ident.decode(prelude.slice(first.start, first.end))
          : ''
        if (
          first?.type !== Tree.tokenTypes.Ident ||
          !name.startsWith('--') ||
          name.length <= 2
        )
          throw new Error('Custom-media requires a dashed name and query.')
        media(prelude.slice(first.end).trim())
        return
      }
      if (name === 'page') {
        const prelude = rule.prelude ? Tree.generate(rule.prelude) : ''
        const result = Tree.lexer.matchAtrulePrelude('page', prelude)
        if (result.error)
          throw new Error(`Invalid page selector: ${result.error.message}`)
        if (!rule.block) throw new Error('Page rules require a block.')
        rule.block.children.forEach((declaration) => {
          if (declaration.type !== 'Declaration') return
          if (
            ['bleed', 'marks', 'page-orientation', 'size'].includes(
              declaration.property,
            )
          )
            check({
              rule: 'page',
              name: declaration.property,
              value: Tree.generate(declaration.value),
            })
        })
        return
      }
      if (!['counter-style', 'font-face', 'font-palette-values'].includes(name))
        return
      if (!rule.block) throw new Error(`Expected @${name} descriptors.`)
      const prelude = rule.prelude ? Tree.generate(rule.prelude) : ''
      const match = Tree.lexer.matchAtrulePrelude(name, prelude)
      if (match.error)
        throw new Error(`Invalid @${name} prelude: ${match.error.message}`)
      const declarations = new Map<string, Tree.Value>()
      rule.block.children.forEach((declaration) => {
        if (declaration.type !== 'Declaration' || declaration.important)
          throw new Error(`Expected non-important @${name} descriptors.`)
        const value = Tree.generate(declaration.value)
        const parsed = Tree.parse(value, { context: 'value' }) as Tree.Value
        const result = Tree.lexer.matchAtruleDescriptor(
          name,
          declaration.property,
          parsed,
        )
        if (result.error)
          throw new Error(
            `Invalid @${name} ${declaration.property}: ${result.error.message}`,
          )
        declarations.set(declaration.property.toLowerCase(), parsed)
        if (name === 'font-face') {
          const key = declaration.property.toLowerCase()
          parsed.children.forEach((node) => {
            if (
              node.type === 'Percentage' &&
              [
                'size-adjust',
                'ascent-override',
                'descent-override',
                'line-gap-override',
                'font-stretch',
              ].includes(key) &&
              Number(node.value) < 0
            )
              throw new Error(`@font-face ${key} cannot be negative.`)
            if (
              key === 'font-weight' &&
              node.type === 'Number' &&
              (Number(node.value) < 1 || Number(node.value) > 1000)
            )
              throw new Error('Font weight must be between 1 and 1000.')
          })
        }

        if (
          name === 'font-palette-values' &&
          declaration.property === 'override-colors'
        )
          Tree.walk(parsed, (node) => {
            if (
              result
                .getTrace(node)
                ?.some(
                  (syntax) =>
                    'type' in syntax &&
                    'name' in syntax &&
                    typeof syntax.name === 'string' &&
                    ((syntax.type === 'Keyword' &&
                      syntax.name.toLowerCase() === 'currentcolor') ||
                      (syntax.type === 'Type' &&
                        [
                          'system-color',
                          'light-dark()',
                          'light-dark-color',
                          'contrast-color()',
                          'device-cmyk()',
                        ].includes(syntax.name))),
                )
            )
              throw new Error('Palette overrides require absolute colors.')
          })
      })
      if (name === 'counter-style') {
        const systemNode = declarations.get('system')?.children.first
        const system =
          systemNode?.type === 'Identifier'
            ? Tree.ident.decode(systemNode.name).toLowerCase()
            : 'symbolic'
        const symbols = declarations.get('symbols')?.children.size ?? 0
        if (system === 'numeric' || system === 'alphabetic') {
          if (symbols < 2)
            throw new Error(
              'Numeric and alphabetic counters require at least two symbols.',
            )
        } else if (system === 'additive') {
          if (!declarations.has('additive-symbols'))
            throw new Error('Additive counters require additive symbols.')
        } else if (system !== 'extends' && !symbols)
          throw new Error('Counter systems require at least one symbol.')
        const additive = declarations.get('additive-symbols')
        if (additive) {
          let previous = Infinity
          additive.children.forEach((node) => {
            if (node.type !== 'Number') return
            const weight = Number(node.value)
            if (weight >= previous)
              throw new Error('Additive symbol weights must strictly descend.')
            previous = weight
          })
        }
        const range = declarations.get('range')
        if (range) {
          const bounds: number[] = []
          range.children.forEach((node) => {
            if (node.type === 'Number') bounds.push(Number(node.value))
            else if (
              node.type === 'Identifier' &&
              Tree.ident.decode(node.name).toLowerCase() === 'infinite'
            )
              bounds.push(bounds.length % 2 ? Infinity : -Infinity)
          })
          for (let index = 0; index < bounds.length; index += 2)
            if (bounds[index]! > bounds[index + 1]!)
              throw new Error('Counter ranges must have increasing bounds.')
        }
      }
    },
  })
}
