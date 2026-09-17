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
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { Provider } from 'zyzz/react-native/react'
import { style, variants } from './Theme.js'

// Shared authoring types describe web props. Metro replaces these known fixtures with native styles.

/** Renders the native example with theme and appearance controls. */
export default function App() {
  const appearance = useColorScheme()
  const system = appearance === 'dark' ? 'dark' : 'light'
  const [scheme, setScheme] = useState<'system' | 'light' | 'dark'>('system')
  const [theme, setTheme] = useState<'blue' | 'green'>('blue')
  const resolved = scheme === 'system' ? system : scheme
  return (
    <Provider colorScheme={resolved} theme={theme}>
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
      style={styles.page().style as ViewStyle}
      indicatorStyle={colorScheme === 'dark' ? 'white' : 'black'}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={styles.content().style as ViewStyle}>
        <Text
          accessibilityRole="header"
          style={styles.title().style as TextStyle}
        >
          Zyzz native example
        </Text>
        <Text style={styles.description().style as TextStyle}>
          Expo SDK 57 · React Native 0.86.3 · {Platform.OS} {Platform.Version}
        </Text>
        <Text style={styles.description().style as TextStyle}>
          Explore themes, light and dark mode, variants, and dynamic styles.
        </Text>
        <Button
          color={accent}
          title={`Scheme: ${scheme} (${colorScheme})`}
          onPress={onScheme}
        />
        <Button color={accent} title={`Theme: ${theme}`} onPress={onTheme} />
        <View style={styles.toggle().style as ViewStyle}>
          <Text style={styles.label().style as TextStyle}>
            Larger variant and payload
          </Text>
          <Switch
            accessibilityLabel="Larger variant and payload"
            value={expanded}
            onValueChange={setExpanded}
          />
        </View>
        <Text
          accessibilityRole="header"
          style={styles.label().style as TextStyle}
        >
          Static style and platform override
        </Text>
        <View testID="zyzz-static" style={styles.box().style as ViewStyle} />
        <Text
          accessibilityRole="header"
          style={styles.label().style as TextStyle}
        >
          Variant padding
        </Text>
        <View
          testID="zyzz-variant"
          style={styles.card({ spacious: expanded }).style as ViewStyle}
        >
          <Text style={styles.foreground().style as TextStyle}>Sample</Text>
        </View>
        <Text
          accessibilityRole="header"
          style={styles.label().style as TextStyle}
        >
          Scalar callback width
        </Text>
        <View
          testID="zyzz-payload"
          style={styles.meter({ width: `${width}px` }).style as ViewStyle}
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
    width: values.width,
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
