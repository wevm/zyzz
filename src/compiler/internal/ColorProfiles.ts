/** Checks custom color-profile descriptors before source or packed publication. @module */
import * as Lightning from 'lightningcss'

/** Validates complete profile blocks, including decoded component and intent tokens. */
export function validate(source: string): void {
  Lightning.transform({
    filename: 'color-profiles.css',
    code: new TextEncoder().encode(source),
    visitor: {
      Rule(rule) {
        if (rule.type !== 'unknown' || rule.value.name !== 'color-profile')
          return
        const name = rule.value.prelude[0]
        if (
          rule.value.prelude.length !== 1 ||
          !rule.value.block ||
          !(
            name?.type === 'dashed-ident' ||
            (name?.type === 'token' &&
              name.value.type === 'ident' &&
              name.value.value.toLowerCase() === 'device-cmyk')
          )
        )
          throw new Error('Expected a color-profile name and descriptor block.')

        let declaration: Lightning.TokenOrValue[] = []
        let src = false
        const flush = () => {
          if (!declaration.length) return
          const [name, colon, ...values] = declaration
          if (
            name?.type !== 'token' ||
            name.value.type !== 'ident' ||
            colon?.type !== 'token' ||
            colon.value.type !== 'colon'
          )
            throw new Error('Invalid color-profile descriptor.')
          const key = name.value.value.toLowerCase()
          if (key === 'src') {
            if (values.length !== 1 || values[0]?.type !== 'url')
              throw new Error('Color-profile src requires one URL.')
            src = true
          } else if (key === 'rendering-intent') {
            const token = values[0]
            if (
              values.length !== 1 ||
              token?.type !== 'token' ||
              token.value.type !== 'ident' ||
              ![
                'absolute-colorimetric',
                'relative-colorimetric',
                'perceptual',
                'saturation',
              ].includes(token.value.value.toLowerCase())
            )
              throw new Error('Invalid color-profile rendering intent.')
          } else if (key === 'components') {
            if (
              values.length % 2 !== 1 ||
              values.some((token, index) => {
                if (index % 2)
                  return token.type !== 'token' || token.value.type !== 'comma'
                const name =
                  token.type === 'dashed-ident'
                    ? token.value
                    : token.type === 'token' && token.value.type === 'ident'
                      ? token.value.value
                      : undefined
                return name === undefined || name.toLowerCase() === 'none'
              })
            )
              throw new Error(
                'Color-profile components require comma-separated identifiers other than none.',
              )
          } else throw new Error('Unknown color-profile descriptor.')
          declaration = []
        }
        for (const token of rule.value.block) {
          if (
            token.type === 'token' &&
            ['white-space', 'comment'].includes(token.value.type)
          )
            continue
          if (token.type === 'token' && token.value.type === 'semicolon')
            flush()
          else declaration.push(token)
        }
        flush()
        if (!src) throw new Error('Color-profile requires a src descriptor.')
      },
    },
  })
}
