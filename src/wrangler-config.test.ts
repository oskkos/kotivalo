import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

interface WranglerConfig {
  env: { production: { vars: Record<string, string> } }
}

/** wrangler.jsonc, read with TypeScript's JSON-with-comments parser. */
function wranglerConfig(): WranglerConfig {
  const text = readFileSync(
    new URL('../wrangler.jsonc', import.meta.url),
    'utf8',
  )
  const parsed: { config?: unknown; error?: ts.Diagnostic } =
    ts.parseConfigFileTextToJson('wrangler.jsonc', text)
  if (parsed.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'),
    )
  }
  return parsed.config as WranglerConfig
}

describe('Test inbox for end-to-end tests', () => {
  // The test inbox and x-test-client-ip are open only while capturing.
  test('Production does not capture emails', () => {
    expect(wranglerConfig().env.production.vars.EMAIL_TRANSPORT).toBe('resend')
  })
})
