// Stands in for @tanstack/react-start/server in Workers tests (vitest.config
// alias). The real module needs the app's build-time entries, which exist
// only in a build. Tests set the "current request" here, and cookies set
// through it are kept for the test to read.

let current: Request | undefined
const cookies = new Map<string, string>()

/** Makes `request` the current request for getRequest(). */
export function setTestRequest(request: Request | undefined): void {
  current = request
  cookies.clear()
}

/** Cookies set with setCookie() since the last setTestRequest(). */
export function testCookies(): ReadonlyMap<string, string> {
  return cookies
}

export function getRequest(): Request {
  if (!current) {
    throw new Error('No current request: call setTestRequest() in the test')
  }
  return current
}

export function setCookie(name: string, value: string): void {
  cookies.set(name, value)
}
