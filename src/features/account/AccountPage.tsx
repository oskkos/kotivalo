// /account (Design canvas: TiliKevyt): the display name and address, the
// language and signing out (openspec: account).
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useState, type ReactNode } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { locales, type Locale } from '#/paraglide/runtime.js'
import { colors, radii } from '#/theme/tokens'
import { AccountAvatar } from './AccountAvatar'
import { setAccountLanguage } from './functions'
import { NameDialog } from './NameDialog'

interface Props {
  name: string
  email: string
  locale: Locale
  /** The bottom navigation bar. */
  bottomNav?: ReactNode
  onSignOut: () => void
  /** Reloads the signed-in user after the name was changed. */
  onNameSaved: () => Promise<void>
  /** Loads the app again in the new language; it is already stored. */
  onLanguageChanged: (locale: Locale) => void
}

// Each language's name in itself.
const names: Record<Locale, () => string> = {
  fi: () => m.language_fi(),
  sv: () => m.language_sv(),
  en: () => m.language_en(),
}

function LanguageChoice({
  current,
  onChanged,
}: {
  current: Locale
  onChanged: (locale: Locale) => void
}) {
  const headingId = useId()
  const [saving, setSaving] = useState<Locale>()
  const [alert, setAlert] = useState<AlertReason>()

  async function choose(locale: Locale) {
    if (locale === current) {
      return
    }
    setAlert(undefined)
    setSaving(locale)
    try {
      await setAccountLanguage({ data: { locale } })
      // The page reloads; the buttons stay disabled until then.
      onChanged(locale)
    } catch (error) {
      clientLog.error('account.language_save_failed', {}, error)
      setAlert(failureReason(error))
      setSaving(undefined)
    }
  }

  return (
    <Stack component="section" sx={{ gap: 1 }}>
      <Typography id={headingId} variant="h3" component="h2">
        {m.account_language()}
      </Typography>
      <Box
        role="group"
        aria-labelledby={headingId}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${String(locales.length)}, minmax(0, 1fr))`,
          gap: 1,
        }}
      >
        {locales.map((locale) => {
          const pressed = locale === current
          return (
            <Button
              key={locale}
              type="button"
              variant="outlined"
              lang={locale}
              aria-pressed={pressed}
              disabled={saving !== undefined}
              loading={saving === locale}
              onClick={() => {
                void choose(locale)
              }}
              // Like ChoiceField: the pressed one in plum.
              sx={{
                minWidth: 0,
                minHeight: 48,
                paddingInline: 1,
                borderRadius: `${String(radii.input)}px`,
                fontSize: 15,
                fontWeight: 900,
                ...(pressed
                  ? {
                      bgcolor: 'primary.main',
                      borderColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.main' },
                    }
                  : {
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: colors.sand },
                    }),
              }}
            >
              {names[locale]()}
            </Button>
          )
        })}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {m.account_language_help()}
      </Typography>
      {alert === undefined ? null : <ReasonAlert reason={alert} />}
    </Stack>
  )
}

export function AccountPage(props: Props) {
  const [naming, setNaming] = useState(false)

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Box
        component="header"
        sx={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <span />
        <Typography
          variant="h3"
          component="h1"
          sx={{ fontSize: 18, textAlign: 'center' }}
        >
          {m.account_title()}
        </Typography>
      </Box>
      <Stack component="main" sx={{ gap: 2, px: 2.5, pt: 1.25, pb: 2.5 }}>
        <Stack
          component="section"
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1.75,
            bgcolor: 'background.paper',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: `${String(radii.card)}px`,
            py: 1.75,
            pl: 2,
            pr: 1,
          }}
        >
          <AccountAvatar name={props.name} size={52} />
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 900 }}>
              {props.name}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {props.email}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setNaming(true)
            }}
            sx={{ flexShrink: 0, bgcolor: 'background.paper' }}
          >
            {m.account_change_name()}
          </Button>
        </Stack>
        <LanguageChoice
          current={props.locale}
          onChanged={props.onLanguageChanged}
        />
        <Button
          variant="text"
          onClick={props.onSignOut}
          sx={{ alignSelf: 'center', textDecoration: 'underline' }}
        >
          {m.sign_out()}
        </Button>
      </Stack>
      {naming ? (
        <NameDialog
          name={props.name}
          onClose={() => {
            setNaming(false)
          }}
          onSaved={props.onNameSaved}
        />
      ) : null}
      {props.bottomNav}
    </Stack>
  )
}
