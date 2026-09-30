/** Defines the landing-page example and its syntax theme. @module */
import type { ThemeRegistrationRaw } from 'shiki'

export const files = [
  {
    name: 'example.tsx',
    lang: 'tsx',
    code: `import { style } from './zyzz.config.js'

export function Example() {
  return <button {...styles.button()}>Get started</button>
}

namespace styles {
  export const button = style({
    backgroundColor: 'brand',
    borderRadius: '8px',
    color: 'white',
    paddingBlock: 'sm',
    paddingInline: 'md',
  })
}`,
  },
  {
    name: 'zyzz.config.ts',
    lang: 'ts',
    code: `import { defineConfig } from 'zyzz'

export const { style } = defineConfig({
  vars: {
    color: {
      brand: '#0072f5',
      white: '#fff',
    },
    spacing: {
      sm: '8px',
      md: '16px',
    },
  },
})`,
  },
] as const

/** Resolved from wevm/monoshot Theme.compose at 0a89eaa0415366bb79837ed17db2f200068f8d54. */
export const theme = {
  bg: '#000000e6',
  name: 'tempo',
  colors: {
    'editor.background': '#000000e6',
    'editor.foreground': '#d9dfe5',
  },
  displayName: 'Tempo',
  fg: '#d9dfe5',
  settings: [
    {
      settings: {
        background: '#000000e6',
        foreground: '#d9dfe5',
      },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#69737d',
      },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'keyword.control',
        'keyword.operator.new',
      ],
      settings: {
        foreground: '#7fbcff',
      },
    },
    {
      scope: [
        'string',
        'string.quoted',
        'constant.other.symbol',
        'markup.inserted',
      ],
      settings: {
        foreground: '#ffffff',
      },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: {
        foreground: '#78a0ff',
      },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'constant.character',
        'support.constant',
      ],
      settings: {
        foreground: '#e4e4e4',
      },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
      ],
      settings: {
        foreground: '#bdc3ff',
      },
    },
    {
      scope: ['variable', 'variable.other', 'support.variable'],
      settings: {
        foreground: '#d9dfe5',
      },
    },
    {
      scope: [
        'variable.parameter',
        'variable.other.property',
        'meta.object-literal.key',
      ],
      settings: {
        foreground: '#aab1ff',
      },
    },
    {
      scope: ['punctuation', 'meta.brace', 'keyword.operator'],
      settings: {
        foreground: '#94999e',
      },
    },
    {
      scope: ['entity.name.tag'],
      settings: {
        foreground: '#7fbcff',
      },
    },
    {
      scope: ['entity.other.attribute-name'],
      settings: {
        foreground: '#78a0ff',
      },
    },
  ],
  type: 'dark',
} satisfies ThemeRegistrationRaw

/** Light counterpart using the same Tempo syntax scopes. */
export const lightTheme = {
  ...theme,
  bg: '#fff',
  colors: {
    'editor.background': '#fff',
    'editor.foreground': '#25292e',
  },
  displayName: 'Tempo Light',
  fg: '#25292e',
  name: 'tempo-light',
  type: 'light',
  colorReplacements: {
    '#69737d': '#6b7280',
    '#7fbcff': '#0059a1',
    '#78a0ff': '#3a5cb8',
    '#94999e': '#5a5e63',
    '#aab1ff': '#4a48a8',
    '#bdc3ff': '#433f9f',
    '#d9dfe5': '#25292e',
    '#e4e4e4': '#4d4d4d',
    '#ffffff': '#4d4d4d',
  },
} satisfies ThemeRegistrationRaw
