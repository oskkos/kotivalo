import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

// Placeholder until the real screens land. Shows only the brand name, so
// there is no copy to translate yet.
function Home() {
  return (
    <main>
      <h1>kotivalo</h1>
    </main>
  )
}
