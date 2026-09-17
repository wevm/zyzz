/** Compares compiled styles with independent React Native controls. @module */
import { useState } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { styles as android } from './generated/android.js'
import { styles as ios } from './generated/ios.js'

// These fixtures emit only View properties. Generated callables currently expose the broader native inventory type.
const compiled = Platform.OS === 'ios' ? ios : android

/** Renders paired samples with shared application inputs. */
export default function App() {
  const [expanded, setExpanded] = useState(false)
  const width = expanded ? 120 : 60

  return (
    <ScrollView contentContainerStyle={ui.page}>
      <Text accessibilityRole="header" style={ui.title}>
        Native comparisons
      </Text>
      <Text style={ui.description}>
        Expo SDK 57 · React Native 0.86.3 · {Platform.OS} {Platform.Version}
      </Text>
      <Text style={ui.description}>
        Each row pairs compiled Zyzz output with an independent native control.
        Matching samples are visual checks, not recorded conformance results.
      </Text>
      <View style={ui.toggle}>
        <Text style={ui.label}>Larger variant and payload</Text>
        <Switch
          accessibilityLabel="Larger variant and payload"
          value={expanded}
          onValueChange={setExpanded}
        />
      </View>
      <View style={ui.row}>
        <Text style={[ui.column, ui.label]}>Zyzz</Text>
        <Text style={[ui.column, ui.label]}>React Native</Text>
      </View>
      <Text accessibilityRole="header" style={ui.label}>
        Static style and platform override
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View
            testID="zyzz-static"
            style={compiled.box().style as ViewStyle}
          />
        </View>
        <View style={ui.column}>
          <View testID="native-static" style={control.box} />
        </View>
      </View>
      <Text accessibilityRole="header" style={ui.label}>
        Variant padding
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View
            testID="zyzz-variant"
            style={compiled.card({ spacious: expanded }).style as ViewStyle}
          >
            <Text style={ui.sample}>Sample</Text>
          </View>
        </View>
        <View style={ui.column}>
          <View
            testID="native-variant"
            style={[control.card, { padding: expanded ? 20 : 8 }]}
          >
            <Text style={ui.sample}>Sample</Text>
          </View>
        </View>
      </View>
      <Text accessibilityRole="header" style={ui.label}>
        Scalar callback width
      </Text>
      <View style={ui.row}>
        <View style={ui.column}>
          <View
            testID="zyzz-payload"
            style={compiled.meter({ width: `${width}px` }).style as ViewStyle}
          />
        </View>
        <View style={ui.column}>
          <View testID="native-payload" style={[control.meter, { width }]} />
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
  description: { color: '#475569', fontSize: 14, lineHeight: 21 },
  label: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  page: {
    backgroundColor: '#ffffff',
    flexGrow: 1,
    gap: 20,
    padding: 24,
    paddingTop: 72,
  },
  row: { flexDirection: 'row', gap: 16 },
  sample: { color: '#0f172a' },
  title: { color: '#0f172a', fontSize: 28, fontWeight: '700' },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
})
