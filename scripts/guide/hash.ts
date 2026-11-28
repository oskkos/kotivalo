// The hash a guide page cites for a requirement (design.md, decision 2): the
// first 12 hex digits of the SHA-256 of the requirement's block with every
// run of whitespace turned into one space and the ends trimmed, so
// rewrapping a requirement changes nothing.
import { createHash } from 'node:crypto'

export function requirementHash(block: string): string {
  const text = block.replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}
