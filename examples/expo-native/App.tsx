/** Demonstrates Zyzz themes and styles in React Native. @module */
import { useState } from 'react'
import {
  Platform,
  Button,
  ScrollView,
  StyleSheet,
  StatusBar,
  Switch,
  Text,
  View,
  useColorScheme,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { Provider } from 'zyzz/react-native/react'
import { styles } from './Styles.js'

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
  const surface =
    theme === 'blue'
      ? colorScheme === 'light'
        ? '#dbeafe'
        : '#1e3a8a'
      : colorScheme === 'light'
        ? '#dcfce7'
        : '#14532d'

  return (
    <ScrollView
      style={styles.page().style as ViewStyle}
      contentContainerStyle={ui.page}
      indicatorStyle={colorScheme === 'dark' ? 'white' : 'black'}
    >
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <Text
        accessibilityRole="header"
        style={[ui.title, styles.foreground().style as TextStyle]}
      >
        Zyzz native example
      </Text>
      <Text style={[ui.description, styles.description().style as TextStyle]}>
        Expo SDK 57 · React Native 0.86.3 · {Platform.OS} {Platform.Version}
      </Text>
      <Text style={[ui.description, styles.description().style as TextStyle]}>
        Explore themes, light and dark mode, variants, and dynamic styles.
      </Text>
      <Button
        color={accent}
        title={`Scheme: ${scheme} (${colorScheme})`}
        onPress={onScheme}
      />
      <Button color={accent} title={`Theme: ${theme}`} onPress={onTheme} />
      <View style={ui.toggle}>
        <Text style={[ui.label, styles.foreground().style as TextStyle]}>
          Larger variant and payload
        </Text>
        <Switch
          accessibilityLabel="Larger variant and payload"
          value={expanded}
          onValueChange={setExpanded}
        />
      </View>
      <View style={ui.row}>
        <Text
          style={[ui.column, ui.label, styles.foreground().style as TextStyle]}
        >
          Zyzz
        </Text>
        <Text
          style={[ui.column, ui.label, styles.foreground().style as TextStyle]}
        >
          React Native
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={[ui.label, styles.foreground().style as TextStyle]}
      >
        Static style and platform override
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View testID="zyzz-static" style={styles.box().style as ViewStyle} />
        </View>
        <View style={ui.column}>
          <View
            testID="native-static"
            style={[control.box, { backgroundColor: accent }]}
          />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={[ui.label, styles.foreground().style as TextStyle]}
      >
        Variant padding
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View
            testID="zyzz-variant"
            style={styles.card({ spacious: expanded }).style as ViewStyle}
          >
            <Text style={styles.foreground().style as TextStyle}>Sample</Text>
          </View>
        </View>
        <View style={ui.column}>
          <View
            testID="native-variant"
            style={[
              control.card,
              { backgroundColor: surface, padding: expanded ? 20 : 8 },
            ]}
          >
            <Text style={styles.foreground().style as TextStyle}>Sample</Text>
          </View>
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={[ui.label, styles.foreground().style as TextStyle]}
      >
        Scalar callback width
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View
            testID="zyzz-payload"
            style={styles.meter({ width: `${width}px` }).style as ViewStyle}
          />
        </View>
        <View style={ui.column}>
          <View
            testID="native-payload"
            style={[control.meter, { width, backgroundColor: accent }]}
          />
        </View>
      </View>
    </ScrollView>
  )
}

const control = StyleSheet.create({
  box: {
    backgroundColor: '#2563eb',
    borderRadius: Platform.OS === 'ios' ? 16 : 4,
    height: 64,
    width: 96,
  },
  card: { backgroundColor: '#dbeafe', borderRadius: 8 },
  meter: { backgroundColor: '#2563eb', height: 16 },
})

const ui = StyleSheet.create({
  column: { flex: 1, minWidth: 0 },
  description: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 16, fontWeight: '600' },
  page: {
    flexGrow: 1,
    gap: 20,
    padding: 24,
    paddingTop: 72,
  },
  row: { flexDirection: 'row', gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
})
