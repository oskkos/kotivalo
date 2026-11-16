import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kotivalo' },
    ],
  }),
  shellComponent: RootDocument,
})

// lang is fixed to Finnish until i18n (#10) sets it per user.
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fi">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
