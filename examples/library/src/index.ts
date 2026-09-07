import { css } from 'typestyle'

/** A precompiled button class. Consumers import the library's styles.css once. */
export const button: string = css({
  typography: 'button.14',
  backgroundColor: 'blue.700',
  color: 'white',
  paddingInline: 4,
  paddingBlock: 2,
  borderRadius: 'md',
  ':hover': { backgroundColor: 'blue.800' },
})
