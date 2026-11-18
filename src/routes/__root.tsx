import { useEffect, type ReactNode } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import nunitoCss from '@fontsource-variable/nunito/wght.css?url'
import { getLocale } from '#/paraglide/runtime.js'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog, installClientLogging } from '#/lib/client-log'
import { colors } from '#/theme/tokens'
import { themeFor } from '#/theme/theme'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: colors.cream },
      { title: 'Kotivalo' },
    ],
    // Nunito is self-hosted (bundled from npm), so no request goes to Google.
    links: [{ rel: 'stylesheet', href: nunitoCss }],
  }),
  shellComponent: RootDocument,
  errorComponent: RootError,
})

/** A page failed to render or load: log it and say so. */
function RootError({ error }: ErrorComponentProps) {
  useEffect(() => {
    clientLog.error('app.render_error', {}, error)
  }, [error])
  return (
    <Box component="main" sx={{ px: 2.5, py: 7 }}>
      <ReasonAlert reason="unexpected" />
    </Box>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  const locale = getLocale()
  useEffect(() => {
    installClientLogging()
  }, [])
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider theme={themeFor(locale)}>
          <CssBaseline />
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
