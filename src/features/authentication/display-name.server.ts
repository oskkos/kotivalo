// The display name: asked once after the first sign-in and shown to the
// people a user shares flats with (spec: "Asking for a display name").
import type { Logger } from '#/server/log/log'
import type { UserRepository } from './user.repository.server'

export interface DisplayNameDeps {
  /** The signed-in user. */
  userId: string
  users: UserRepository
  log: Logger
  now: () => Date
}

/** `name` is already validated and trimmed (schemas.ts). */
export async function setDisplayName(
  deps: DisplayNameDeps,
  name: string,
): Promise<{ ok: true }> {
  await deps.users.setName(deps.userId, name, deps.now())
  // No name on the line: it is personal data.
  deps.log.info('authentication.name_set')
  return { ok: true }
}
