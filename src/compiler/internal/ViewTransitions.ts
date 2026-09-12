/** Validates view-transition descriptors before a parser can discard invalid values. @module */
import * as Lightning from 'lightningcss'

/** Checks a token-preserving spelling of view-transition rules from source or packed CSS. */
export function validate(source: string, marker: string): void {
  Lightning.transform({
    filename: 'view-transitions.css',
    code: new TextEncoder().encode(source),
    visitor: {
      Rule(rule) {
        if (rule.type !== 'unknown' || rule.value.name !== marker) return
        if (rule.value.prelude.length || !rule.value.block)
          throw new Error(
            'View-transition rules require a descriptor block and no prelude.',
          )

        let declaration: Lightning.TokenOrValue[] = []
        const flush = () => {
          if (!declaration.length) return
          const [name, colon, ...values] = declaration
          if (
            name?.type !== 'token' ||
            name.value.type !== 'ident' ||
            colon?.type !== 'token' ||
            colon.value.type !== 'colon' ||
            !values.length ||
            values.some(
              (value) =>
                value.type !== 'dashed-ident' &&
                (value.type !== 'token' || value.value.type !== 'ident'),
            )
          )
            throw new Error('Invalid view-transition descriptor.')

          const names = values.map((value) =>
            value.type === 'dashed-ident'
              ? value.value
              : value.type === 'token' && value.value.type === 'ident'
                ? value.value.value
                : '',
          )
          const key = name.value.value.toLowerCase()
          if (key === 'navigation') {
            if (
              names.length !== 1 ||
              !['auto', 'none'].includes(names[0]!.toLowerCase())
            )
              throw new Error('Invalid view-transition navigation.')
          } else if (key === 'types') {
            if (
              names.some(
                (name) =>
                  [
                    'default',
                    'inherit',
                    'initial',
                    'revert',
                    'revert-layer',
                    'unset',
                  ].includes(name.toLowerCase()) ||
                  (name.toLowerCase() === 'none' && names.length !== 1),
              )
            )
              throw new Error('Invalid view-transition types.')
          } else throw new Error('Unknown view-transition descriptor.')
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
      },
    },
  })
}
