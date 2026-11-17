import { createFileRoute } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/')({ component: Home })

// Placeholder until the real screens land.
export function Home() {
  return (
    <main>
      <h1>kotivalo</h1>
      <p>{m.app_tagline()}</p>
    </main>
  )
}
