import { join } from 'node:path'

const GUIDE = join(import.meta.dirname, '..')

/** The screenshots, by language; gitignored. */
export const SHOTS_DIR = join(GUIDE, 'src/assets/shots')
/** The demo accounts' signed-in browser states; gitignored. */
export const AUTH_DIR = join(GUIDE, '.auth')
export const ANNIKA = join(AUTH_DIR, 'annika.json')
export const JUSSI = join(AUTH_DIR, 'jussi.json')
