// Entry point for the Vitest "workers" project. The app's real entry
// (@tanstack/react-start/server-entry) only exists after a Vite build, so
// server tests import the modules they test directly and this Worker only
// satisfies the pool. Bindings still come from wrangler.jsonc.
export default {
  fetch() {
    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler
