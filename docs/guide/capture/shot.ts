// `shot(page, id)`: saves the page as the screenshot `<language>/<id>.png`
// that a guide page shows with `<Shot id="…" />`. The language is the
// running project's name.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, type Page } from '@playwright/test'
import { waitForHydration } from '../../../e2e/support/sign-in'
import { SHOTS_DIR } from './paths.ts'

export async function shot(page: Page, id: string): Promise<void> {
  const language = test.info().project.name
  await waitForHydration(page)
  await page.waitForLoadState('networkidle')
  const dir = join(SHOTS_DIR, language)
  mkdirSync(dir, { recursive: true })
  await page.screenshot({
    path: join(dir, `${id}.png`),
    animations: 'disabled',
    caret: 'hide',
  })
}
