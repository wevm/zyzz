/** Shares the bordered documentation frame and appearance controls. @module */
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react'
import { appearance } from 'zyzz/default'
import MonitorIcon from '~icons/lucide/monitor'
import MoonIcon from '~icons/lucide/moon'
import SunIcon from '~icons/lucide/sun'
import { style } from '../zyzz.config.js'
import { Link } from './Link.js'

/** Renders the common Docs and Variables frame. */
export function DocumentationShell(props: DocumentationShell.Props) {
  const {
    children,
    contentRef,
    mobileMenu,
    headerRef,
    label,
    name,
    navigation,
    onSchemeChange,
    search,
    sidebar,
  } = props

  const [colorScheme, setColorScheme] = useState<
    'light' | 'dark' | 'light dark'
  >('light dark')

  const menuRef = useRef<HTMLDialogElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const closeMenu = () => {
    setMenuOpen(false)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(
      () => menuRef.current?.close(),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
    )
  }

  const menuIcon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      data-expanded={menuOpen}
      {...documentationShellStyles.menuIcon()}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="12" y2="12" />
    </svg>
  )

  useEffect(() => {
    if (!menuOpen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const media = window.matchMedia('(min-width: 1024px)')
    const close = () => {
      if (media.matches) menuRef.current?.close()
    }
    media.addEventListener('change', close)
    close()

    return () => {
      document.body.style.overflow = overflow
      media.removeEventListener('change', close)
    }
  }, [menuOpen])

  useEffect(() => {
    const scheme = appearance.get().colorScheme
    setColorScheme(
      scheme === 'light' || scheme === 'dark' ? scheme : 'light dark',
    )
  }, [])

  const schemeControl = (
    <div
      role="group"
      aria-label="Color scheme"
      {...documentationShellStyles.schemeControl()}
    >
      {(
        [
          {
            label: 'System',
            value: 'light dark',
            icon: MonitorIcon,
          },
          { label: 'Light', value: 'light', icon: SunIcon },
          { label: 'Dark', value: 'dark', icon: MoonIcon },
        ] as const
      ).map((scheme) => (
        <button
          aria-label={scheme.label}
          aria-pressed={colorScheme === scheme.value}
          key={scheme.value}
          onClick={() => {
            appearance.set({ colorScheme: scheme.value })
            setColorScheme(scheme.value)
            onSchemeChange?.(scheme.value)
          }}
          title={`${scheme.label} color scheme`}
          type="button"
          {...documentationShellStyles.schemeButton()}
        >
          <scheme.icon aria-hidden="true" height="14" width="14" />
        </button>
      ))}
    </div>
  )
  const brand = (
    <div {...documentationShellStyles.headerBrand()}>
      {name ? (
        <span title={name} {...documentationShellStyles.brandName()}>
          {name}
        </span>
      ) : (
        <Link
          aria-label="Zyzz home"
          href="/"
          {...documentationShellStyles.brand()}
        >
          <svg
            data-small={mobileMenu || undefined}
            {...documentationShellStyles.logo()}
            aria-hidden="true"
            width="80"
            height="24"
            viewBox="12 24 233 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256ZM101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88ZM127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687ZM183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z"
              fill="currentColor"
            />
          </svg>
        </Link>
      )}
      {label && <span {...documentationShellStyles.label()}>{label}</span>}
    </div>
  )

  return (
    <div {...documentationShellStyles.canvas()}>
      <div
        data-mobile-menu={mobileMenu || undefined}
        {...documentationShellStyles.page()}
      >
        <header ref={headerRef} {...documentationShellStyles.header()}>
          {brand}
          <div {...documentationShellStyles.headerTools()}>
            {search ?? <span />}
            <div {...documentationShellStyles.headerActions()}>
              {navigation}
            </div>
          </div>
          {mobileMenu && (
            <button
              aria-label="Open menu"
              aria-controls="docs-menu"
              aria-expanded={menuOpen}
              onClick={() => {
                clearTimeout(closeTimer.current)
                menuRef.current?.showModal()
                setMenuOpen(true)
              }}
              type="button"
              {...documentationShellStyles.menuToggle()}
            >
              {menuIcon}
            </button>
          )}
        </header>
        {mobileMenu && (
          <dialog
            id="docs-menu"
            aria-label="Documentation menu"
            ref={menuRef}
            onClose={() => {
              clearTimeout(closeTimer.current)
              setMenuOpen(false)
            }}
            {...documentationShellStyles.menu()}
          >
            <div {...documentationShellStyles.menuHeader()}>
              {brand}
              <button
                aria-label="Close menu"
                onClick={closeMenu}
                type="button"
                {...documentationShellStyles.menuClose()}
              >
                {menuIcon}
              </button>
            </div>
            <div {...documentationShellStyles.menuContent()}>
              {search}
              <div
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('a')
                  )
                    menuRef.current?.close()
                }}
              >
                {sidebar}
              </div>
              {schemeControl}
            </div>
          </dialog>
        )}
        <main>
          <div {...documentationShellStyles.layout()}>
            <aside {...documentationShellStyles.sidebar()}>
              <div {...documentationShellStyles.sidebarNavigation()}>
                {sidebar}
              </div>
              <div {...documentationShellStyles.sidebarFooter()}>
                {schemeControl}
              </div>
            </aside>
            <div ref={contentRef} {...documentationShellStyles.sections()}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export declare namespace DocumentationShell {
  /** Properties for the DocumentationShell component. */
  type Props = {
    children: ReactNode
    contentRef?: Ref<HTMLDivElement> | undefined
    headerRef?: Ref<HTMLElement> | undefined
    label?: string | undefined
    name?: string | undefined
    /** Collapses documentation navigation below the tablet breakpoint. */
    mobileMenu?: boolean | undefined
    navigation?: ReactNode
    onSchemeChange?:
      | ((scheme: 'light' | 'dark' | 'light dark') => void)
      | undefined
    search?: ReactNode
    sidebar: ReactNode
  }
}

namespace documentationShellStyles {
  export const brand = style({
    color: 'foreground',
    display: 'block',
    lineHeight: '0 !custom',
    textDecoration: 'none',
  })

  export const brandName = style({
    typography: 'heading.20',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  export const canvas = style({
    backgroundColor: 'background.primary',
    minHeight: '100vh !custom',
  })

  export const header = style({
    backgroundColor: 'background.surface',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'grid',
    gridTemplateColumns: '252px minmax(0, 1fr)',
    height: 16,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    '@media (max-width: 700px)': { gridTemplateColumns: 'auto minmax(0, 1fr)' },
  })

  export const headerActions = style({
    alignItems: 'center',
    display: 'flex',
    gap: 4,
    '@media (max-width: 700px)': { gap: 2 },
  })

  export const headerBrand = style({
    alignItems: 'center',
    display: 'flex',
    gap: 2,
    paddingInline: 4,
    '@media (max-width: 700px)': {
      paddingInline: 2,
    },
  })

  export const headerTools = style({
    alignItems: 'center',
    borderLeft: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    gap: 4,
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 6,
    '@media (max-width: 700px)': { gap: 2, paddingLeft: 2, paddingRight: 3 },
  })

  export const label = style({
    typography: 'label.12',
    backgroundColor: 'gray.200',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    fontSize: '11px !custom',
    paddingBlock: 1,
    paddingInline: 2,
    whiteSpace: 'nowrap',
  })

  export const layout = style({
    alignItems: 'start',
    display: 'grid',
    gridTemplateColumns: '252px minmax(0, 1fr)',
    '@media (max-width: 700px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  })

  export const logo = style({
    display: 'block',
    '&[data-small]': {
      '@media (max-width: 1023px)': {
        width: '68px !custom',
        height: '20px !custom',
      },
    },
  })

  export const menu = style({
    backgroundColor: 'background.surface',
    border: 'none',
    color: 'foreground',
    height: '100dvh !custom',
    inset: 0,
    margin: 0,
    maxHeight: 'none !custom',
    maxWidth: 'none !custom',
    padding: 0,
    width: '100% !custom',
    '&::backdrop': { backgroundColor: 'background.surface' },
  })

  export const menuClose = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'foreground',
    cursor: 'pointer',
    display: 'flex',
    height: 12,
    justifyContent: 'center',
    marginRight: 0,
    width: 12,
    ':focus-visible': { outline: '2px solid', outlineColor: 'blue.900' },
  })

  export const menuContent = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 'calc(100dvh - 56px) !custom',
    padding: 4,
    '& > div:first-child': { maxWidth: 'none !custom' },
    '& input': { fontSize: '16px !custom' },
    '& > div:last-child': {
      alignSelf: 'flex-start',
      marginTop: 'auto !custom',
    },
  })

  export const menuHeader = style({
    alignItems: 'center',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    height: 14,
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 2,
    '& > div:first-child': { paddingInline: 0 },
  })

  export const menuIcon = style({
    display: 'block',
    flexShrink: 0,
    '& line': {
      stroke: 'currentColor !custom',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      transformOrigin: '12px 12px',
      transition:
        'transform 160ms cubic-bezier(0.77, 0, 0.175, 1), opacity 160ms ease',
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    },
    '& line:first-child': { transform: 'translateY(-5px)' },
    '& line:last-child': { transform: 'translateY(5px)' },
    '&[data-expanded="true"] line:first-child': {
      transform: 'rotate(45deg)',
      '@starting-style': { transform: 'translateY(-5px)' },
    },
    '&[data-expanded="true"] line:nth-child(2)': {
      opacity: 0,
      '@starting-style': { opacity: 1 },
    },
    '&[data-expanded="true"] line:last-child': {
      transform: 'rotate(-45deg)',
      '@starting-style': { transform: 'translateY(5px)' },
    },
  })

  export const menuToggle = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'foreground',
    cursor: 'pointer',
    display: 'none',
    height: 12,
    justifyContent: 'center',
    marginRight: 0,
    width: 12,
    ':focus-visible': { outline: '2px solid', outlineColor: 'blue.900' },
    '@media (max-width: 1023px)': { display: 'flex' },
  })

  export const page = style({
    backgroundColor: 'background.surface',
    borderInline: '1px solid',
    borderColor: 'gray.400',
    color: 'foreground',
    fontFamily: 'sans',
    marginInline: 'auto !custom',
    maxWidth: '7xl',
    minHeight: '100vh !custom',
    width: 'calc(100% - 48px) !custom',
    '@media (max-width: 600px)': { width: '100% !custom' },
    '&[data-mobile-menu]': {
      '@media (max-width: 1023px)': {
        width: '100% !custom',
        borderInline: 'none',
        '& > header': {
          alignItems: 'center',
          display: 'flex',
          height: 14,
          justifyContent: 'space-between',
          paddingLeft: 4,
          paddingRight: 2,
          '& > div:first-child': { paddingInline: 0 },
        },
        '& > header > div:nth-child(2)': { display: 'none' },
        '& main > div': { gridTemplateColumns: 'minmax(0, 1fr)' },
        '& main > div > aside': { display: 'none' },
        '& main > div > div': {
          borderLeft: 'none',
          borderTop: 'none',
          minHeight: 'calc(100dvh - 56px) !custom',
        },
      },
    },
  })

  export const schemeButton = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: '1px solid transparent',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    height: 6,
    justifyContent: 'center',
    width: 6,
    ':hover': { color: 'foreground' },
    '&[aria-pressed="true"]': { borderColor: 'gray.400', color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const schemeControl = style({
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '9999px !custom',
    display: 'flex',
    padding: '2px !custom',
    flexShrink: 0,
  })

  export const sections = style({
    borderLeft: '1px solid',
    borderColor: 'gray.400',
    minHeight: 'calc(100dvh - 64px) !custom',
    minWidth: 0,
    '@media (max-width: 700px)': {
      borderLeft: 'none',
      borderTop: '1px solid',
      borderColor: 'gray.400',
    },
  })

  export const sidebarFooter = style({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    paddingInline: 3,
    paddingTop: 4,
  })

  export const sidebarNavigation = style({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  })

  export const sidebar = style({
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 64px) !custom',
    overflow: 'hidden',
    paddingBottom: 4,
    paddingInline: 2,
    paddingTop: 4,
    position: 'sticky',
    top: 16,
    '@media (max-width: 700px)': {
      height: 'auto !custom',
      position: 'static',
    },
  })
}
