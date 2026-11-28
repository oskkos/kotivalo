// Prints the hash of each requirement in the main specs, in the frontmatter's
// format, for the guide pages: pnpm guide:hash [spec]
import { activeChanges, readSpecs, withChanges } from './traceability/files.ts'
import { requirementHash } from './guide/hash.ts'

const only = process.argv.at(2)
const main = readSpecs()
// The text a page should cite is the one the change will archive.
for (const r of withChanges(main, activeChanges())) {
  if (only === undefined || r.capability === only) {
    console.log(
      `- spec: ${r.capability}\n  name: ${JSON.stringify(r.name)}\n  hash: ${requirementHash(r.block)}`,
    )
  }
}
