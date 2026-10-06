/** Checks native variable inference, Provider selection props, and style resolver types. @module */
import { Config, Vars } from 'zyzz'
import {
  defineConfig,
  useStyles,
  useVars,
  withStyles,
} from 'zyzz/react-native/react'
import { Provider } from 'zyzz/react-native/react'
import * as React from 'react'
import { FlatList, ScrollView, View } from 'react-native'
import type {
  FlatListProps,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { StyleSheet } from 'zyzz/react-native'
import { describe, expectTypeOf, test } from 'vite-plus/test'

type Row = { readonly id: string }

describe('withStyles', () => {
  test('preserves required component props, additional style names, and refs', () => {
    const Control = React.forwardRef<
      HTMLDivElement,
      {
        readonly bodyStyle?: object | undefined
        readonly label: string
        readonly style?: object | undefined
      }
    >(() => null)
    const Wrapped = withStyles(Control, { styleProps: ['bodyStyle'] })

    expectTypeOf<
      React.ComponentProps<typeof Wrapped>['label']
    >().toEqualTypeOf<string>()
    React.createElement(Wrapped, {
      label: 'value',
      ref: React.createRef<HTMLDivElement>(),
    })
    // @ts-expect-error Required component props remain required.
    React.createElement(Wrapped, {})
    React.createElement(Wrapped, {
      label: 'value',
      // @ts-expect-error Refs retain the wrapped component's instance type.
      ref: React.createRef<HTMLSpanElement>(),
    })
    // @ts-expect-error Additional names must belong to the component.
    withStyles(Control, { styleProps: ['missing'] })
    // @ts-expect-error Refs cannot be resolved as styles.
    withStyles(Control, { styleProps: ['ref'] })
  })

  test('preserves class instance refs', () => {
    const Wrapped = withStyles(ScrollView)

    React.createElement(Wrapped, { ref: React.createRef<ScrollView>() })
    // @ts-expect-error Refs retain the class instance type.
    React.createElement(Wrapped, { ref: React.createRef<View>() })
  })

  test('preserves animated component ref unions', () => {
    // Mirrors Reanimated's animated ref, whose declarations do not resolve under NodeNext.
    type AnimatedRef<instance> = {
      (instance?: instance | null): object
      current: instance | null
    }
    const AnimatedScrollView = (
      props: ScrollViewProps & {
        readonly ref?:
          | React.Ref<ScrollView>
          | AnimatedRef<ScrollView>
          | undefined
      },
    ) => props.children
    const animated = {} as AnimatedRef<ScrollView>
    const Wrapped = withStyles(AnimatedScrollView)

    expectTypeOf<React.ComponentProps<typeof Wrapped>['ref']>().toEqualTypeOf<
      React.Ref<ScrollView> | AnimatedRef<ScrollView> | undefined
    >()
    React.createElement(Wrapped, { ref: React.createRef<ScrollView>() })
    React.createElement(Wrapped, { ref: animated })
    // @ts-expect-error Refs retain the animated component's instance type.
    React.createElement(Wrapped, { ref: React.createRef<View>() })
  })

  test('preserves generic function component signatures', () => {
    function List<item>(props: {
      readonly data: readonly item[]
      readonly renderItem: (item: item) => React.ReactNode
      readonly style?: object | undefined
    }) {
      return props.data.map(props.renderItem)
    }
    const Wrapped = withStyles(List)

    Wrapped({
      data: [{ id: 'a' }],
      renderItem: (item) => {
        expectTypeOf(item).toEqualTypeOf<{ id: string }>()
        return item.id
      },
    })
    Wrapped<Row>({ data: [{ id: 'a' }], renderItem: (item) => item.id })
    // @ts-expect-error Callback parameters follow the inferred item type.
    Wrapped({ data: [{ id: 'a' }], renderItem: (item: { n: 1 }) => item.n })
  })

  test('types instantiated generic class components', () => {
    const Rows = withStyles(FlatList<Row>)

    React.createElement(Rows, {
      data: [{ id: 'a' }],
      getItemLayout: (data, index) => {
        expectTypeOf(data).toEqualTypeOf<ArrayLike<Row> | null | undefined>()
        return { index, length: 40, offset: 40 * index }
      },
      ref: React.createRef<FlatList<Row>>(),
      renderItem: (info) => {
        expectTypeOf(info.item).toEqualTypeOf<Row>()
        return null
      },
    })
    // @ts-expect-error Data follows the instantiated item type.
    React.createElement(Rows, { data: [{ name: 'a' }], renderItem: () => null })
  })

  test('keeps instantiated item types inside generic components', () => {
    function List<item>(props: FlatListProps<item>) {
      const ref = React.useRef<FlatList<item>>(null)
      const Styled = withStyles(FlatList<item>)

      return React.createElement(Styled, { ...props, ref })
    }

    expectTypeOf(List<Row>)
      .parameter(0)
      .toEqualTypeOf<FlatListProps<Row>>()
  })
})

describe('defineConfig', () => {
  test('returns a Provider with inferred catalog names and existing authoring helpers', () => {
    const { Provider, style, vars } = defineConfig({
      defaultVars: 'blue',
      vars: {
        blue: { color: { ink: '#123456' } },
        green: { color: { ink: '#abcdef' } },
      },
    })
    expectTypeOf<React.ComponentProps<typeof Provider>['vars']>().toEqualTypeOf<
      'blue' | 'green' | undefined
    >()
    Provider({ colorScheme: 'light' })
    Provider({ colorScheme: 'dark', vars: 'green' })
    // @ts-expect-error Provider names belong to its configuration.
    Provider({ colorScheme: 'light', vars: 'missing' })
    Provider({ colorScheme: 'system' })
    // @ts-expect-error Schemes are light, dark, or system.
    Provider({ colorScheme: 'auto' })
    style({ color: 'ink' })
    // @ts-expect-error Native configuration retains the shared style contract.
    style({ color: 'missing' })
    expectTypeOf(useVars(vars).color.ink).toEqualTypeOf<string>()
  })

  test('preserves unnamed and token-free configuration validation', () => {
    const { Provider } = defineConfig({ vars: { spacing: { gap: '8px' } } })
    expectTypeOf<
      React.ComponentProps<typeof Provider>['vars']
    >().toEqualTypeOf<undefined>()
    Provider({ colorScheme: 'light' })
    // @ts-expect-error An unnamed configuration has no selectable names.
    Provider({ colorScheme: 'light', vars: 'base' })
    defineConfig().Provider({ colorScheme: 'light' })
    // @ts-expect-error Native configuration validates defaults like shared configuration.
    defineConfig({
      defaultVars: 'missing',
      vars: { base: { spacing: { gap: '8px' } } },
    })
    // @ts-expect-error Configuration options are validated.
    defineConfig({ unknown: true })
    const standalone = Vars.define({ spacing: { gap: '4px' } })
    const { vars } = defineConfig({ vars: standalone })
    expectTypeOf(useVars(vars).spacing.gap).toEqualTypeOf<number>()
  })
})

describe('Provider', () => {
  test('accepts vars and light, dark, or system schemes', () => {
    const props: Provider.Props = { colorScheme: 'dark', vars: 'blue' }
    expectTypeOf(props.vars).toEqualTypeOf<string | undefined>()
    // @ts-expect-error The selection prop is vars.
    Provider({ colorScheme: 'light', set: 'blue' })
    // @ts-expect-error Schemes are light, dark, or system.
    Provider({ colorScheme: 'auto' })
    Provider({ colorScheme: 'system' })
    Provider({ colorScheme: 'light' })
  })
})

describe('useStyles', () => {
  test('resolves applied styles to React Native style props', () => {
    type ToastOptions = {
      readonly style: ViewStyle
      readonly titleStyle: TextStyle
    }
    const { style } = defineConfig({ vars: { color: { ink: '#123456' } } })
    const label = style({ color: 'ink' })
    const current = useStyles()

    const resolved = current.style(label().style)
    expectTypeOf(resolved).toEqualTypeOf<
      Readonly<Record<string, string | number | undefined>>
    >()
    const options: ToastOptions = { style: resolved, titleStyle: resolved }
    const view: StyleProp<ViewStyle> = current.style([
      label().style,
      { flex: 1 },
    ])
    const text: StyleProp<TextStyle> = current.style([label().style, false])
    expectTypeOf(current.props(label())).toEqualTypeOf<
      ReturnType<typeof label>
    >()
    // @ts-expect-error Resolved styles are not arbitrary values.
    const invalid: number = current.style(label().style)
    void [invalid, options, text, view]
  })

  test('preserves native style values and absent styles', () => {
    const bold: TextStyle = { fontWeight: '600' }
    const current = useStyles()
    const enabled = bold.fontSize === undefined

    expectTypeOf(current.style(bold)).toEqualTypeOf<TextStyle>()
    const view: ViewStyle = current.style({ flex: 1 })
    expectTypeOf(current.style(undefined)).toEqualTypeOf<undefined>()
    expectTypeOf(current.style(enabled && bold)).toEqualTypeOf<
      false | TextStyle
    >()
    expectTypeOf(
      current.style((state: { readonly pressed: boolean }) => ({
        opacity: state.pressed ? 0.5 : 1,
      })),
    ).toEqualTypeOf<
      (state: { readonly pressed: boolean }) => { opacity: number }
    >()
    expectTypeOf(current.props(null)).toEqualTypeOf<null>()
    // @ts-expect-error Native style values keep their declared types.
    const weight: TextStyle = current.style({ fontWeight: 'thick' })
    // @ts-expect-error Applied props are objects.
    current.props('label')
    void [view, weight]
  })
})

describe('useVars', () => {
  test('infers responsive scalar values and retains Provider props', () => {
    const { Provider, style, vars } = defineConfig({
      vars: {
        breakpoint: { md: '768px' },
        spacing: { gutter: { default: '16px', '@media md': '24px' } },
      },
    })
    expectTypeOf(useVars(vars).spacing.gutter).toEqualTypeOf<number>()
    expectTypeOf(useVars(vars, (values) => values.spacing)).toEqualTypeOf<{
      readonly gutter: number
    }>()
    style({ flexDirection: 'column', '@media md': { flexDirection: 'row' } })
    // @ts-expect-error Provider reads native window dimensions automatically.
    Provider({ colorScheme: 'light', viewport: { height: 800, width: 768 } })
    // @ts-expect-error Breakpoints are compiler metadata.
    expectTypeOf(useVars(vars).breakpoint)
  })

  test('infers unitless string typography line heights as native numbers', () => {
    const { vars } = Config.create({
      vars: {
        typography: {
          body: { fontSize: '16px', lineHeight: '1.25' },
        },
      },
    })

    expectTypeOf(
      useVars(vars).typography.body.lineHeight,
    ).toEqualTypeOf<number>()
    expectTypeOf(
      useVars(vars, (values) => values.typography.body.lineHeight),
    ).toEqualTypeOf<number>()
  })

  test('infers readonly native scalar domains and selected results', () => {
    const { vars } = Config.create({
      vars: {
        color: { ink: { light: '#123456', dark: '#abcdef' } },
        spacing: { gap: '1rem' },
        typography: {
          body: {
            fontFamily: 'Pilat',
            fontSize: '1rem',
            fontWeight: 500,
            lineHeight: 1.25,
          },
        },
      },
    })
    const values = useVars(vars)
    expectTypeOf(values.color.ink).toEqualTypeOf<string>()
    expectTypeOf(values.spacing.gap).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontSize).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontFamily).toEqualTypeOf<string>()
    expectTypeOf(values.typography.body.lineHeight).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontWeight).toEqualTypeOf<
      Exclude<StyleSheet.NativeStyle['fontWeight'], undefined>
    >()
    expectTypeOf(useVars(vars, undefined)).toEqualTypeOf<typeof values>()
    expectTypeOf(
      useVars(vars, (values) => values.color.ink),
    ).toEqualTypeOf<string>()
    expectTypeOf(useVars(vars, (values) => values.spacing)).toEqualTypeOf<{
      readonly gap: number
    }>()
    // @ts-expect-error Resolved values remain readonly.
    values.spacing.gap = 20
    // @ts-expect-error Selectors retain the authored paths.
    useVars(vars, (values) => values.spacing.missing)
    // @ts-expect-error A config is not its vars helper.
    useVars(Config.create({ vars: { spacing: { gap: '1px' } } }))
    // @ts-expect-error Plain objects are not portable variable definitions.
    useVars({ spacing: { gap: '1px' } })
  })

  test('preserves named configuration shape and standalone variables', () => {
    const { vars } = Config.create({
      defaultVars: 'blue',
      vars: {
        blue: { color: { ink: '#123456' } },
        green: { color: { ink: '#abcdef' } },
      },
    })
    expectTypeOf(useVars(vars)).toEqualTypeOf<{
      readonly color: { readonly ink: string }
    }>()
    const standalone = Vars.define({ spacing: { gap: '4px' } })
    expectTypeOf(useVars(standalone).spacing.gap).toEqualTypeOf<number>()
  })
})
