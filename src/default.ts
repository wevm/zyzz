/**
 * Opt-in default configuration with appearance controls and bundled design tokens.
 * @module
 */
import { Config } from 'zyzz'

/**
 * Raw bundled values, independent of portable references.
 *
 * Breakpoints, containers, spacing, radii, font sizes, weights, tracking, and
 * leading use the conventional named and quarter-rem scales. Fractional spacing
 * steps are omitted because token paths reserve the dot separator. Colors are
 * ten-step light/dark scales plus `background`, `grayAlpha`, `black`, and
 * `white`. `foreground` aliases `gray.1000` and `surface` aliases
 * `background.100`. Font stacks lead with the named faces and fall back to
 * system fonts. Typography sets use https://vercel.com/geist/typography,
 * with explicit zero tracking outside headings. No fonts are loaded.
 */
export const tokens = {
  borderRadius: {
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    '4xl': '2rem',
  },
  breakpoints: {
    sm: '40rem',
    md: '48rem',
    lg: '64rem',
    xl: '80rem',
    '2xl': '96rem',
  },
  color: {
    amber: {
      100: { dark: '#291800', light: '#fff6e5' },
      200: { dark: '#331b00', light: '#fff4d6' },
      300: { dark: '#4d2a00', light: '#fef0cd' },
      400: { dark: '#573300', light: '#ffdd8f' },
      500: { dark: '#6b4105', light: '#ffc96b' },
      600: { dark: '#e79d13', light: '#f5b047' },
      700: '#ffb224',
      800: '#ff990a',
      900: { dark: '#f2a20d', light: '#a35200' },
      1000: { dark: '#fef3dc', light: '#4e2009' },
    },
    background: {
      100: { dark: '#0a0a0a', light: '#fff' },
      200: { dark: '#000', light: '#fafafa' },
    },
    black: '#000',
    blue: {
      100: { dark: '#0f1c2e', light: '#f0f7ff' },
      200: { dark: '#10233d', light: '#ebf5ff' },
      300: { dark: '#0f2f57', light: '#e0f0ff' },
      400: { dark: '#0d3868', light: '#cce6ff' },
      500: { dark: '#0a4380', light: '#99ceff' },
      600: { dark: '#0091ff', light: '#52aeff' },
      700: '#0072f5',
      800: '#0062d1',
      900: { dark: '#52a8ff', light: '#0068d6' },
      1000: { dark: '#ebf6ff', light: '#00254d' },
    },
    foreground: { dark: '#ededed', light: '#171717' },
    gray: {
      100: { dark: '#1a1a1a', light: '#f2f2f2' },
      200: { dark: '#1f1f1f', light: '#ebebeb' },
      300: { dark: '#292929', light: '#e6e6e6' },
      400: { dark: '#2e2e2e', light: '#ebebeb' },
      500: { dark: '#454545', light: '#c9c9c9' },
      600: { dark: '#878787', light: '#a8a8a8' },
      700: '#8f8f8f',
      800: '#7d7d7d',
      900: { dark: '#a1a1a1', light: '#4d4d4d' },
      1000: { dark: '#ededed', light: '#171717' },
    },
    grayAlpha: {
      100: { dark: '#ffffff0f', light: '#0000000d' },
      200: { dark: '#ffffff17', light: '#00000014' },
      300: { dark: '#ffffff21', light: '#0000001a' },
      400: { dark: '#ffffff24', light: '#00000014' },
      500: { dark: '#ffffff3d', light: '#00000036' },
      600: { dark: '#ffffff82', light: '#00000057' },
      700: { dark: '#ffffff8a', light: '#00000070' },
      800: { dark: '#ffffff78', light: '#00000082' },
      900: { dark: '#ffffff9c', light: '#000000b3' },
      1000: { dark: '#ffffffeb', light: '#000000e8' },
    },
    green: {
      100: { dark: '#0b2212', light: '#effbef' },
      200: { dark: '#0f2e18', light: '#ebfaeb' },
      300: { dark: '#12361b', light: '#daf6da' },
      400: { dark: '#0c451b', light: '#c6f1c7' },
      500: { dark: '#126426', light: '#99e69e' },
      600: { dark: '#1a9338', light: '#6cda75' },
      700: '#45a557',
      800: '#398e4a',
      900: { dark: '#62c073', light: '#297a3a' },
      1000: { dark: '#e5fbea', light: '#1b311e' },
    },
    pink: {
      100: { dark: '#28151d', light: '#ffebf5' },
      200: { dark: '#3a1726', light: '#feecf2' },
      300: { dark: '#4f1c31', light: '#fce3ec' },
      400: { dark: '#551b33', light: '#f9d7e2' },
      500: { dark: '#6c1e3e', light: '#f5b8cc' },
      600: { dark: '#b31957', light: '#ee87a7' },
      700: '#ea3e83',
      800: '#df2670',
      900: { dark: '#f75f8f', light: '#bd2864' },
      1000: { dark: '#feecf4', light: '#430a23' },
    },
    purple: {
      100: { dark: '#231528', light: '#f9f0ff' },
      200: { dark: '#2e1938', light: '#f9f1fe' },
      300: { dark: '#422154', light: '#f4e8fc' },
      400: { dark: '#4f2768', light: '#eddcf9' },
      500: { dark: '#5f2e85', light: '#d5b1f1' },
      600: { dark: '#8e4ec6', light: '#bf89ec' },
      700: '#8e4ec6',
      800: '#763da9',
      900: { dark: '#bf7af0', light: '#7820bc' },
      1000: { dark: '#f8edfc', light: '#2e004d' },
    },
    red: {
      100: { dark: '#2a1314', light: '#fff0f0' },
      200: { dark: '#3c1618', light: '#ffebeb' },
      300: { dark: '#561a1e', light: '#ffe5e5' },
      400: { dark: '#671e21', light: '#fdd8d8' },
      500: { dark: '#832126', light: '#f8b9b9' },
      600: { dark: '#e5484d', light: '#f87275' },
      700: '#e5484d',
      800: { dark: '#d93036', light: '#da2f35' },
      900: { dark: '#ff6166', light: '#cb2a2f' },
      1000: { dark: '#feecee', light: '#391417' },
    },
    surface: { dark: '#0a0a0a', light: '#fff' },
    teal: {
      100: { dark: '#04201b', light: '#eefcf9' },
      200: { dark: '#062822', light: '#e5faf6' },
      300: { dark: '#083a33', light: '#d4f7f0' },
      400: { dark: '#053d35', light: '#bef4eb' },
      500: { dark: '#085e53', light: '#86ead9' },
      600: { dark: '#0c9784', light: '#45dec5' },
      700: '#12a594',
      800: '#0d8c7d',
      900: { dark: '#0ac7b4', light: '#067a6e' },
      1000: { dark: '#e0faf4', light: '#073c34' },
    },
    white: '#fff',
  },
  containers: {
    '3xs': '16rem',
    '2xs': '18rem',
    xs: '20rem',
    sm: '24rem',
    md: '28rem',
    lg: '32rem',
    xl: '36rem',
    '2xl': '42rem',
    '3xl': '48rem',
    '4xl': '56rem',
    '5xl': '64rem',
    '6xl': '72rem',
    '7xl': '80rem',
  },
  fontFamily: {
    mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    sans: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
    '7xl': '4.5rem',
    '8xl': '6rem',
    '9xl': '8rem',
  },
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  spacing: {
    0: '0rem',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
    px: '1px',
  },
  typography: {
    button: {
      '12': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0px',
        lineHeight: '16px',
      },
      '14': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0px',
        lineHeight: '20px',
      },
      '16': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '16px',
        fontWeight: 500,
        letterSpacing: '0px',
        lineHeight: '20px',
      },
    },
    copy: {
      '13': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '13px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '18px',
        mono: {
          fontFamily:
            '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '13px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '18px',
        },
      },
      '14': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '14px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '20px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 550,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
      },
      '16': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '16px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '24px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 550,
          letterSpacing: '0px',
          lineHeight: '24px',
        },
      },
      '18': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '18px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '28px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '18px',
          fontWeight: 550,
          letterSpacing: '0px',
          lineHeight: '28px',
        },
      },
      '20': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '20px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '36px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '20px',
          fontWeight: 550,
          letterSpacing: '0px',
          lineHeight: '36px',
        },
      },
      '24': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '24px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '36px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '24px',
          fontWeight: 550,
          letterSpacing: '0px',
          lineHeight: '36px',
        },
      },
    },
    heading: {
      '14': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '14px',
        fontWeight: 600,
        letterSpacing: '-.28px',
        lineHeight: '20px',
      },
      '16': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '16px',
        fontWeight: 600,
        letterSpacing: '-.32px',
        lineHeight: '24px',
        subtle: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 500,
          letterSpacing: '-.32px',
          lineHeight: '24px',
        },
      },
      '20': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '20px',
        fontWeight: 600,
        letterSpacing: '-.4px',
        lineHeight: '26px',
        subtle: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '20px',
          fontWeight: 500,
          letterSpacing: '-.4px',
          lineHeight: '26px',
        },
      },
      '24': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '24px',
        fontWeight: 600,
        letterSpacing: '-.96px',
        lineHeight: '32px',
        subtle: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '24px',
          fontWeight: 500,
          letterSpacing: '-.96px',
          lineHeight: '32px',
        },
      },
      '32': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '32px',
        fontWeight: 600,
        letterSpacing: '-1.28px',
        lineHeight: '40px',
        subtle: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '32px',
          fontWeight: 500,
          letterSpacing: '-1.28px',
          lineHeight: '40px',
        },
      },
      '40': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '40px',
        fontWeight: 600,
        letterSpacing: '-2.4px',
        lineHeight: '48px',
      },
      '48': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '48px',
        fontWeight: 600,
        letterSpacing: '-2.88px',
        lineHeight: '56px',
      },
      '56': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '56px',
        fontWeight: 600,
        letterSpacing: '-3.36px',
        lineHeight: '56px',
      },
      '64': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '64px',
        fontWeight: 600,
        letterSpacing: '-3.84px',
        lineHeight: '64px',
      },
      '72': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '72px',
        fontWeight: 600,
        letterSpacing: '-4.32px',
        lineHeight: '72px',
      },
    },
    label: {
      '12': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '12px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '16px',
        mono: {
          fontFamily:
            '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '12px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '16px',
        },
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '16px',
        },
      },
      '13': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '13px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '16px',
        mono: {
          fontFamily:
            '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '13px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '16px',
        },
      },
      '14': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '14px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '20px',
        mono: {
          fontFamily:
            '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
      },
      '16': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '16px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '20px',
        strong: {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
      },
      '18': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '18px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '20px',
      },
      '20': {
        fontFamily:
          'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        fontSize: '20px',
        fontWeight: 400,
        letterSpacing: '0px',
        lineHeight: '32px',
      },
    },
  },
} as const

/** Default appearance, restoration script, and authoring helpers with bundled light/dark tokens. */
// Generated from tokens by scripts/default-theme.ts; edit tokens and regenerate.
const config = Config.create({
  vars: {
    borderRadius: {
      xs: '0.125rem',
      sm: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      '4xl': '2rem',
    },
    breakpoints: {
      sm: '40rem',
      md: '48rem',
      lg: '64rem',
      xl: '80rem',
      '2xl': '96rem',
    },
    color: {
      amber: {
        100: { dark: '#291800', light: '#fff6e5' },
        200: { dark: '#331b00', light: '#fff4d6' },
        300: { dark: '#4d2a00', light: '#fef0cd' },
        400: { dark: '#573300', light: '#ffdd8f' },
        500: { dark: '#6b4105', light: '#ffc96b' },
        600: { dark: '#e79d13', light: '#f5b047' },
        700: '#ffb224',
        800: '#ff990a',
        900: { dark: '#f2a20d', light: '#a35200' },
        1000: { dark: '#fef3dc', light: '#4e2009' },
      },
      background: {
        100: { dark: '#0a0a0a', light: '#fff' },
        200: { dark: '#000', light: '#fafafa' },
      },
      black: '#000',
      blue: {
        100: { dark: '#0f1c2e', light: '#f0f7ff' },
        200: { dark: '#10233d', light: '#ebf5ff' },
        300: { dark: '#0f2f57', light: '#e0f0ff' },
        400: { dark: '#0d3868', light: '#cce6ff' },
        500: { dark: '#0a4380', light: '#99ceff' },
        600: { dark: '#0091ff', light: '#52aeff' },
        700: '#0072f5',
        800: '#0062d1',
        900: { dark: '#52a8ff', light: '#0068d6' },
        1000: { dark: '#ebf6ff', light: '#00254d' },
      },
      foreground: { dark: '#ededed', light: '#171717' },
      gray: {
        100: { dark: '#1a1a1a', light: '#f2f2f2' },
        200: { dark: '#1f1f1f', light: '#ebebeb' },
        300: { dark: '#292929', light: '#e6e6e6' },
        400: { dark: '#2e2e2e', light: '#ebebeb' },
        500: { dark: '#454545', light: '#c9c9c9' },
        600: { dark: '#878787', light: '#a8a8a8' },
        700: '#8f8f8f',
        800: '#7d7d7d',
        900: { dark: '#a1a1a1', light: '#4d4d4d' },
        1000: { dark: '#ededed', light: '#171717' },
      },
      grayAlpha: {
        100: { dark: '#ffffff0f', light: '#0000000d' },
        200: { dark: '#ffffff17', light: '#00000014' },
        300: { dark: '#ffffff21', light: '#0000001a' },
        400: { dark: '#ffffff24', light: '#00000014' },
        500: { dark: '#ffffff3d', light: '#00000036' },
        600: { dark: '#ffffff82', light: '#00000057' },
        700: { dark: '#ffffff8a', light: '#00000070' },
        800: { dark: '#ffffff78', light: '#00000082' },
        900: { dark: '#ffffff9c', light: '#000000b3' },
        1000: { dark: '#ffffffeb', light: '#000000e8' },
      },
      green: {
        100: { dark: '#0b2212', light: '#effbef' },
        200: { dark: '#0f2e18', light: '#ebfaeb' },
        300: { dark: '#12361b', light: '#daf6da' },
        400: { dark: '#0c451b', light: '#c6f1c7' },
        500: { dark: '#126426', light: '#99e69e' },
        600: { dark: '#1a9338', light: '#6cda75' },
        700: '#45a557',
        800: '#398e4a',
        900: { dark: '#62c073', light: '#297a3a' },
        1000: { dark: '#e5fbea', light: '#1b311e' },
      },
      pink: {
        100: { dark: '#28151d', light: '#ffebf5' },
        200: { dark: '#3a1726', light: '#feecf2' },
        300: { dark: '#4f1c31', light: '#fce3ec' },
        400: { dark: '#551b33', light: '#f9d7e2' },
        500: { dark: '#6c1e3e', light: '#f5b8cc' },
        600: { dark: '#b31957', light: '#ee87a7' },
        700: '#ea3e83',
        800: '#df2670',
        900: { dark: '#f75f8f', light: '#bd2864' },
        1000: { dark: '#feecf4', light: '#430a23' },
      },
      purple: {
        100: { dark: '#231528', light: '#f9f0ff' },
        200: { dark: '#2e1938', light: '#f9f1fe' },
        300: { dark: '#422154', light: '#f4e8fc' },
        400: { dark: '#4f2768', light: '#eddcf9' },
        500: { dark: '#5f2e85', light: '#d5b1f1' },
        600: { dark: '#8e4ec6', light: '#bf89ec' },
        700: '#8e4ec6',
        800: '#763da9',
        900: { dark: '#bf7af0', light: '#7820bc' },
        1000: { dark: '#f8edfc', light: '#2e004d' },
      },
      red: {
        100: { dark: '#2a1314', light: '#fff0f0' },
        200: { dark: '#3c1618', light: '#ffebeb' },
        300: { dark: '#561a1e', light: '#ffe5e5' },
        400: { dark: '#671e21', light: '#fdd8d8' },
        500: { dark: '#832126', light: '#f8b9b9' },
        600: { dark: '#e5484d', light: '#f87275' },
        700: '#e5484d',
        800: { dark: '#d93036', light: '#da2f35' },
        900: { dark: '#ff6166', light: '#cb2a2f' },
        1000: { dark: '#feecee', light: '#391417' },
      },
      surface: { dark: '#0a0a0a', light: '#fff' },
      teal: {
        100: { dark: '#04201b', light: '#eefcf9' },
        200: { dark: '#062822', light: '#e5faf6' },
        300: { dark: '#083a33', light: '#d4f7f0' },
        400: { dark: '#053d35', light: '#bef4eb' },
        500: { dark: '#085e53', light: '#86ead9' },
        600: { dark: '#0c9784', light: '#45dec5' },
        700: '#12a594',
        800: '#0d8c7d',
        900: { dark: '#0ac7b4', light: '#067a6e' },
        1000: { dark: '#e0faf4', light: '#073c34' },
      },
      white: '#fff',
    },
    containers: {
      '3xs': '16rem',
      '2xs': '18rem',
      xs: '20rem',
      sm: '24rem',
      md: '28rem',
      lg: '32rem',
      xl: '36rem',
      '2xl': '42rem',
      '3xl': '48rem',
      '4xl': '56rem',
      '5xl': '64rem',
      '6xl': '72rem',
      '7xl': '80rem',
    },
    fontFamily: {
      mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      sans: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem',
    },
    fontWeight: {
      thin: 100,
      extralight: 200,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
    spacing: {
      0: '0rem',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem',
      11: '2.75rem',
      12: '3rem',
      14: '3.5rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      28: '7rem',
      32: '8rem',
      36: '9rem',
      40: '10rem',
      44: '11rem',
      48: '12rem',
      52: '13rem',
      56: '14rem',
      60: '15rem',
      64: '16rem',
      72: '18rem',
      80: '20rem',
      96: '24rem',
      px: '1px',
    },
    typography: {
      button: {
        '12': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '16px',
        },
        '14': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
        '16': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 500,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
      },
      copy: {
        '13': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '13px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '18px',
          mono: {
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '13px',
            fontWeight: 400,
            letterSpacing: '0px',
            lineHeight: '18px',
          },
        },
        '14': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '14px',
            fontWeight: 550,
            letterSpacing: '0px',
            lineHeight: '20px',
          },
        },
        '16': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '24px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '16px',
            fontWeight: 550,
            letterSpacing: '0px',
            lineHeight: '24px',
          },
        },
        '18': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '18px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '28px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '18px',
            fontWeight: 550,
            letterSpacing: '0px',
            lineHeight: '28px',
          },
        },
        '20': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '20px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '36px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '20px',
            fontWeight: 550,
            letterSpacing: '0px',
            lineHeight: '36px',
          },
        },
        '24': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '24px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '36px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '24px',
            fontWeight: 550,
            letterSpacing: '0px',
            lineHeight: '36px',
          },
        },
      },
      heading: {
        '14': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '-.28px',
          lineHeight: '20px',
        },
        '16': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 600,
          letterSpacing: '-.32px',
          lineHeight: '24px',
          subtle: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '16px',
            fontWeight: 500,
            letterSpacing: '-.32px',
            lineHeight: '24px',
          },
        },
        '20': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '20px',
          fontWeight: 600,
          letterSpacing: '-.4px',
          lineHeight: '26px',
          subtle: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '20px',
            fontWeight: 500,
            letterSpacing: '-.4px',
            lineHeight: '26px',
          },
        },
        '24': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '24px',
          fontWeight: 600,
          letterSpacing: '-.96px',
          lineHeight: '32px',
          subtle: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '24px',
            fontWeight: 500,
            letterSpacing: '-.96px',
            lineHeight: '32px',
          },
        },
        '32': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '32px',
          fontWeight: 600,
          letterSpacing: '-1.28px',
          lineHeight: '40px',
          subtle: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '32px',
            fontWeight: 500,
            letterSpacing: '-1.28px',
            lineHeight: '40px',
          },
        },
        '40': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '40px',
          fontWeight: 600,
          letterSpacing: '-2.4px',
          lineHeight: '48px',
        },
        '48': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '48px',
          fontWeight: 600,
          letterSpacing: '-2.88px',
          lineHeight: '56px',
        },
        '56': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '56px',
          fontWeight: 600,
          letterSpacing: '-3.36px',
          lineHeight: '56px',
        },
        '64': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '64px',
          fontWeight: 600,
          letterSpacing: '-3.84px',
          lineHeight: '64px',
        },
        '72': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '72px',
          fontWeight: 600,
          letterSpacing: '-4.32px',
          lineHeight: '72px',
        },
      },
      label: {
        '12': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '12px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '16px',
          mono: {
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '12px',
            fontWeight: 400,
            letterSpacing: '0px',
            lineHeight: '16px',
          },
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0px',
            lineHeight: '16px',
          },
        },
        '13': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '13px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '16px',
          mono: {
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '13px',
            fontWeight: 400,
            letterSpacing: '0px',
            lineHeight: '20px',
          },
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0px',
            lineHeight: '16px',
          },
        },
        '14': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
          mono: {
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '14px',
            fontWeight: 400,
            letterSpacing: '0px',
            lineHeight: '20px',
          },
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0px',
            lineHeight: '20px',
          },
        },
        '16': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '16px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
          strong: {
            fontFamily:
              'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            fontSize: '16px',
            fontWeight: 500,
            letterSpacing: '0px',
            lineHeight: '20px',
          },
        },
        '18': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '18px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '20px',
        },
        '20': {
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          fontSize: '20px',
          fontWeight: 400,
          letterSpacing: '0px',
          lineHeight: '32px',
        },
      },
    },
  },
})

/** Default appearance helper. */
export const appearance: Config.create.ReturnType<{
  vars: typeof tokens
}>['appearance'] = config.appearance
/** Default script helper. */
export const script: Config.create.ReturnType<{
  vars: typeof tokens
}>['script'] = config.script
/** Default style helper. */
export const style: Config.create.ReturnType<{ vars: typeof tokens }>['style'] =
  config.style
/** Default vars helper. */
export const vars: Config.create.ReturnType<{ vars: typeof tokens }>['vars'] =
  config.vars
/** Default variants helper. */
export const variants: Config.create.ReturnType<{
  vars: typeof tokens
}>['variants'] = config.variants
