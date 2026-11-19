import { useEffect, type ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import nunitoCss from '@fontsource-variable/nunito/wght.css?url'
import { getLocale } from '#/paraglide/runtime.js'
import { ErrorView } from '#/components/ErrorView'
import { installClientLogging } from '#/lib/client-log'
import { registerServiceWorker } from '#/lib/service-worker'
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
      // The name under the icon on an iPhone's home screen.
      { name: 'apple-mobile-web-app-title', content: 'Kotivalo' },
      { title: 'Kotivalo' },
    ],
    links: [
      // Nunito is self-hosted (bundled from npm), so no request goes to Google.
      { rel: 'stylesheet', href: nunitoCss },
      // Installable app (public/; icons from scripts/generate-icons.ts).
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: ErrorView,
})

function RootDocument({ children }: { children: ReactNode }) {
  const locale = getLocale()
  useEffect(() => {
    installClientLogging()
    registerServiceWorker()
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
