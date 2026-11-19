import { isReason, type Reason } from '#/lib/reasons'

/** A field's first error as a reason code. Zod issues carry it as `message`. */
export function firstReason(errors: unknown[]): Reason | undefined {
  for (const error of errors) {
    const code =
      typeof error === 'object' && error !== null && 'message' in error
        ? error.message
        : error
    if (isReason(code)) {
      return code
    }
  }
  return undefined
}
