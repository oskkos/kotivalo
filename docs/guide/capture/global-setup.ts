// Before every capture run: the same id may not be saved by two steps, and
// the shots folder starts empty so a removed step leaves no stale image.
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { duplicateShotIds } from '../lib/shots.ts'
import { AUTH_DIR, SHOTS_DIR } from './paths.ts'

export default function globalSetup(): void {
  const dir = import.meta.dirname
  const scripts = Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.capture.ts'))
      .map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
  )
  const duplicates = duplicateShotIds(scripts)
  if (duplicates.length > 0) {
    throw new Error(
      duplicates
        .map(
          (d) =>
            `The screenshot id "${d.id}" is saved by ${d.scripts.join(' and ')}`,
        )
        .join('\n'),
    )
  }
  rmSync(SHOTS_DIR, { recursive: true, force: true })
  rmSync(AUTH_DIR, { recursive: true, force: true })
}
