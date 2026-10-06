/** Links to the project's repository and community channels. @module */
import DiscordIcon from '~icons/simple-icons/discord'
import GitHubIcon from '~icons/simple-icons/github'
import XIcon from '~icons/simple-icons/x'
import { style } from '../zyzz.config.js'

/** Renders icon links to GitHub, X, and Discord, each opening in a new tab. */
export function Socials() {
  return (
    <ul aria-label="Community" {...styles.list()}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            aria-label={link.label}
            href={link.href}
            rel="noreferrer"
            target="_blank"
            title={link.label}
            {...styles.link()}
          >
            <link.icon aria-hidden="true" {...styles.icon()} />
          </a>
        </li>
      ))}
    </ul>
  )
}

// Display order, with the repository first.
const links = [
  { href: 'https://github.com/wevm/zyzz', icon: GitHubIcon, label: 'GitHub' },
  { href: 'https://x.com/wevm_dev', icon: XIcon, label: 'X' },
  {
    href: 'https://discord.gg/JUrRkGweXV',
    icon: DiscordIcon,
    label: 'Discord',
  },
] as const

namespace styles {
  export const icon = style({ height: 4, width: 4 })

  export const link = style({
    alignItems: 'center',
    borderRadius: 'sm',
    color: 'gray.900',
    display: 'flex',
    height: 7,
    justifyContent: 'center',
    transition: 'color 150ms',
    width: 7,
    ':hover': { color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })

  export const list = style({
    alignItems: 'center',
    display: 'flex',
    gap: 1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  })
}
