import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import nunitoCss from '@fontsource-variable/nunito/wght.css?url'
import { getLocale } from '#/paraglide/runtime.js'
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
})

function RootDocument({ children }: { children: ReactNode }) {
  const locale = getLocale()
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
