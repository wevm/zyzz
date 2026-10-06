/** Types the two independent native benchmark themes. @module */
import 'react-native-unistyles'

type Theme = {
  colors: Record<string, string>
  padding: number
  spacing: Record<string, number>
}

declare module 'react-native-unistyles' {
  interface UnistylesThemes {
    base: Theme
    alternate: Theme
  }
}
