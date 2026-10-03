/** Lowers target-neutral callback declarations to ordered native binding data. @module */
import type * as Recipe from '../../internal/Recipe.js'
import * as Binding from '../../internal/Binding.js'
import * as Token from '../../internal/Token.js'
import type * as Style from '../../Style.js'
import * as StyleSheet from '../../react-native/StyleSheet.js'
import * as Scalar from '../../react-native/internal/Scalar.js'
import * as Tokens from '../../react-native/internal/Tokens.js'
import type * as Runtime from '../../runtime/NativeDynamic.js'
import type * as Native from '../Native.js'
import type * as Source from '../Source.js'

type Step = Runtime.Program['rules'][number]['steps'][number]
type PreparedStep =
  | Extract<Step, { readonly style: string }>
  | {
      readonly property: keyof typeof Scalar.properties
      readonly parts: readonly (
        | string
        | number
        | Token.Reference
        | { readonly slot: string; readonly number?: true }
      )[]
    }
type PreparedRule = {
  readonly matches: Runtime.Program['rules'][number]['matches']
  readonly steps: readonly PreparedStep[]
}

/** Compiles static fragments and retains scalar assignments in authored order. */
export function compile(
  recipe: Recipe.Definition,
  call: Pick<Source.Call, 'slots' | 'recipe'>,
  options: Native.compile.Options,
  prepared = prepare(recipe, call, options),
): Runtime.create.Options {
  const selected = options.vars?.[options.set ?? 'default']
  const metadata =
    selected &&
    (Object.getOwnPropertyDescriptor(selected, Token.definition)?.value as
      | Token.Metadata
      | undefined)
  return {
    ...prepared,
    program: {
      slots: prepared.program.slots,
      rules: prepared.program.rules.map((rule) => ({
        ...rule,
        steps: rule.steps.map((step) =>
          'style' in step
            ? step
            : {
                ...step,
                parts: step.parts.map((part) =>
                  Token.is(part)
                    ? Tokens.resolve(part, {
                        ...options,
                        metadata,
                        resolution: { schemeIndependent: true },
                      })
                    : part,
                ),
              },
        ),
      })),
    },
    styles: StyleSheet.select(prepared.styles, {
      set: options.set ?? 'default',
      colorScheme: options.colorScheme,
    }),
  }
}

/** Prepares immutable programs and all set/scheme tables before selection. */
export function prepare(
  recipe: Recipe.Definition,
  call: Pick<Source.Call, 'slots' | 'recipe'>,
  options: Native.compile.Options,
) {
  const slots = Object.fromEntries(
    Object.entries(call.slots ?? {}).map(([name, slot]) => [name, slot.name]),
  )
  const available = new Set([
    ...Object.values(slots),
    ...(call.recipe?.payloads ?? []).flatMap((payload) =>
      Object.values(payload.slots[0]!),
    ),
  ])
  const fragments: Style.NamedStyle[] = []
  const rules: PreparedRule[] = []

  for (const rule of recipe.rules) {
    const steps: PreparedStep[] = []
    function fragment(style: Style.NamedStyle) {
      const name = String(fragments.length)
      fragments.push({ ...style, name })
      steps.push({ style: name })
    }
    function visit(style: Style.NamedStyle) {
      const declared = new Set<string>()
      let declarations: Style.Declaration[] = []
      function flush() {
        if (!declarations.length) return
        fragment({ name: style.name, declarations })
        declarations = []
      }
      for (const declaration of style.declarations) {
        if (declaration.important || declared.has(declaration.property))
          throw new Error(
            'Importance and fallback declarations are not supported on native.',
          )
        declared.add(declaration.property)
        const parts = Token.isExpression(declaration.value)
          ? declaration.value.parts
          : [declaration.value]
        const dynamic = parts.some((part) => Binding.is(part))
        if (!dynamic && declaration.property !== 'lineHeight') {
          declarations.push(declaration)
          continue
        }
        flush()
        const property = declaration.property as keyof typeof Scalar.properties
        if (
          !Object.hasOwn(Scalar.properties, property) ||
          [
            'transform',
            'origin',
            'shadow',
            'textShadow',
            'fontVariant',
          ].includes(String(Scalar.properties[property]))
        )
          throw new Error(
            `Dynamic native property is unsupported: ${property}.`,
          )
        const values = parts.map((part) => {
          if (typeof part === 'string' || typeof part === 'number') return part
          if (Token.is(part)) return part
          if (!Binding.is(part) || !available.has(part.name))
            throw new Error(
              'Native bindings require declared runtime scalar fields.',
            )
          return {
            slot: part.name,
            ...(part.type === 'number' ? { number: true as const } : {}),
          }
        })
        const calculation =
          typeof values[0] === 'string' && /^\s*calc\(/i.test(values[0])
        if (
          values.length > 1 &&
          !calculation &&
          !(
            values.length === 2 &&
            typeof values[0] === 'object' &&
            ['px', 'rem', '%'].includes(String(values[1]))
          )
        )
          throw new Error(
            'Native dynamic expressions support a scalar with a px, rem, or percent suffix.',
          )
        steps.push({ property, parts: values })
      }
      flush()
      if (style.targets)
        fragment({ name: style.name, declarations: [], targets: style.targets })
      for (const rule of style.rules ?? []) {
        if (rule.condition !== undefined)
          throw new Error(
            'Selectors, queries, and nested rules are not supported on native.',
          )
        visit(rule.style)
      }
    }
    for (const style of rule.value.styles) visit(style)
    rules.push({ matches: rule.matches, steps })
  }
  const compiled = StyleSheet.compile({
    styles: { styles: fragments },
    fonts: options.fonts,
    platform: options.platform,
    vars: options.vars,
    units: options.units,
  })
  return {
    axes: recipe.axes,
    defaults: recipe.defaults,
    ...(call.recipe?.payloads
      ? {
          payloads: call.recipe.payloads,
          defaultPayloads: call.recipe.defaultPayloads,
        }
      : {}),
    fonts: options.fonts,
    units: options.units,
    program: { slots, rules },
    styles: compiled.styles,
  }
}
