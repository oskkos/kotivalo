// Chooses the language before sign-in: Suomi, Svenska, English. Paraglide's
// setLocale() stores the choice in the kotivalo_locale cookie and reloads,
// so the server renders the page, and later a new account, in it. The choice
// is also remembered for this tab, so signing in stores it on an existing
// account too (spec: "Choosing the language before sign-in").
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useId, useState } from 'react'
import { rememberChosenLocale } from '#/lib/chosen-locale'
import { m } from '#/paraglide/messages.js'
import {
  getLocale,
  locales,
  setLocale,
  type Locale,
} from '#/paraglide/runtime.js'

// Each language's name in itself.
const names: Record<Locale, () => string> = {
  fi: () => m.language_fi(),
  sv: () => m.language_sv(),
  en: () => m.language_en(),
}

function GlobeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12 H21 M12 3 C15 6 15 18 12 21 C9 18 9 6 12 3" />
    </svg>
  )
}

export function LanguageMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()
  const current = getLocale()
  const currentName = names[current]()

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        aria-label={m.language_menu_label({ language: currentName })}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        startIcon={<GlobeIcon />}
        onClick={(e) => {
          setAnchor(e.currentTarget)
        }}
        sx={{ bgcolor: 'background.paper', fontSize: 13, px: 1.5 }}
      >
        {currentName}
      </Button>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null)
        }}
      >
        {locales.map((locale) => (
          <MenuItem
            key={locale}
            lang={locale}
            selected={locale === current}
            onClick={() => {
              setAnchor(null)
              // Choosing the current language counts too: it is a choice.
              rememberChosenLocale(locale)
              if (locale !== current) {
                void setLocale(locale)
              }
            }}
          >
            {names[locale]()}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
