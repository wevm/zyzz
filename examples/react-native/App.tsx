/** Demonstrates Zyzz themes and styles in React Native. @module */
import { useState } from 'react'
import {
  Platform,
  Button,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import { Provider } from 'zyzz/react-native/react'
import { style, variants } from './Theme.js'

/** Renders the native example with theme and appearance controls. */
export default function App() {
  const appearance = useColorScheme()
  const system = appearance === 'dark' ? 'dark' : 'light'
  const [scheme, setScheme] = useState<'system' | 'light' | 'dark'>('system')
  const [theme, setTheme] = useState<'blue' | 'green'>('blue')
  const resolved = scheme === 'system' ? system : scheme
  return (
    <Provider colorScheme={resolved} set={theme}>
      <Samples
        scheme={scheme}
        colorScheme={resolved}
        theme={theme}
        onScheme={() =>
          setScheme(
            scheme === 'system'
              ? 'light'
              : scheme === 'light'
                ? 'dark'
                : 'system',
          )
        }
        onTheme={() => setTheme(theme === 'blue' ? 'green' : 'blue')}
      />
    </Provider>
  )
}

function Samples({
  scheme,
  colorScheme,
  theme,
  onScheme,
  onTheme,
}: {
  scheme: string
  colorScheme: 'light' | 'dark'
  theme: 'blue' | 'green'
  onScheme: () => void
  onTheme: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const width = expanded ? 120 : 60
  const accent =
    theme === 'blue'
      ? colorScheme === 'light'
        ? '#2563eb'
        : '#93c5fd'
      : colorScheme === 'light'
        ? '#15803d'
        : '#86efac'

  return (
    <ScrollView
      {...styles.page()}
      indicatorStyle={colorScheme === 'dark' ? 'white' : 'black'}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View {...styles.content()}>
        <Text accessibilityRole="header" {...styles.title()}>
          Zyzz native example
        </Text>
        <Text {...styles.description()}>
          Expo SDK 57 · React Native 0.86.3 · {Platform.OS} {Platform.Version}
        </Text>
        <Text {...styles.description()}>
          Explore themes, light and dark mode, variants, and dynamic styles.
        </Text>
        <Button
          color={accent}
          title={`Scheme: ${scheme} (${colorScheme})`}
          onPress={onScheme}
        />
        <Button color={accent} title={`Theme: ${theme}`} onPress={onTheme} />
        <View {...styles.toggle()}>
          <Text {...styles.label()}>Larger variant and payload</Text>
          <Switch
            accessibilityLabel="Larger variant and payload"
            value={expanded}
            onValueChange={setExpanded}
          />
        </View>
        <Text accessibilityRole="header" {...styles.label()}>
          Static style and platform override
        </Text>
        <View testID="zyzz-static" {...styles.box()} />
        <Text accessibilityRole="header" {...styles.label()}>
          Variant padding
        </Text>
        <View testID="zyzz-variant" {...styles.card({ spacious: expanded })}>
          <Text {...styles.foreground()}>Sample</Text>
        </View>
        <Text accessibilityRole="header" {...styles.label()}>
          Scalar callback width
        </Text>
        <View
          testID="zyzz-payload"
          {...styles.meter({ width: `${width}px` })}
        />
      </View>
    </ScrollView>
  )
}

namespace styles {
  export const box = style({
    backgroundColor: 'accent',
    height: '64px',
    width: '96px',
    targets: { android: { borderRadius: 4 }, ios: { borderRadius: 16 } },
  })

  export const card = variants({
    base: { backgroundColor: 'surface', borderRadius: '8px', padding: '8px' },
    variants: {
      spacious: { false: { padding: '8px' }, true: { padding: '20px' } },
    },
    defaultVariants: { spacious: false },
  })

  export const content = style({
    gap: '20px',
    padding: '24px',
    paddingTop: '72px',
  })

  export const description = style({
    color: 'muted',
    fontSize: '14px',
    lineHeight: '21px',
  })

  export const foreground = style({ color: 'ink' })

  export const label = style({
    color: 'ink',
    fontSize: '16px',
    fontWeight: 600,
  })

  export const meter = style((values: { width: `${number}px` }) => ({
    backgroundColor: 'accent',
    height: '16px',
    width: `[${values.width}]`,
  }))

  export const page = style({ backgroundColor: 'page' })

  export const title = style({
    color: 'ink',
    fontSize: '28px',
    fontWeight: 700,
  })

  export const toggle = style({
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'space-between',
  })
}
