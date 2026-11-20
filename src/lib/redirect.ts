// Where to go after a step such as /welcome: a path in this app taken from
// the address bar, so it must never lead to another site.

/**
 * `target` if it is a path in this app, otherwise `/`. Rejects other
 * origins (`https://…`), protocol-relative (`//evil.example`) and backslash
 * (`/\evil.example`, which browsers read as `//`) forms, and `/welcome`
 * itself.
 */
export function safeRedirect(target: unknown): string {
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.startsWith('/\\') ||
    target === '/welcome' ||
    target.startsWith('/welcome?')
  ) {
    return '/'
  }
  return target
}
