// How sure the term bank is of its translations: counts per status and
// language, then every term not yet verified, least certain first. The
// proposed ones are the list for a fluent speaker to check.
//
// Usage: pnpm terms:report
import {
  LANGUAGES,
  STATUSES,
  readTermBank,
  type Status,
} from './terms/term-bank.ts'

const bank = readTermBank()
const rows = Object.entries(bank).flatMap(([id, term]) =>
  LANGUAGES.map((language) => ({
    id,
    language,
    term: term[language].term,
    status: term[language].status,
    sources: (term[language].sources ?? []).map((ref) => ref.source),
  })),
)

const count = (status: Status, language: string) =>
  rows.filter((row) => row.status === status && row.language === language)
    .length

console.log(`Term bank: ${String(Object.keys(bank).length)} terms\n`)
console.log(['status'.padEnd(10), ...LANGUAGES].join('  '))
for (const status of STATUSES) {
  console.log(
    [
      status.padEnd(10),
      ...LANGUAGES.map((language) =>
        String(count(status, language)).padStart(language.length),
      ),
    ].join('  '),
  )
}

for (const status of ['proposed', 'derived'] as const) {
  const open = rows.filter((row) => row.status === status)
  if (open.length === 0) {
    continue
  }
  console.log(`\n${status}:`)
  for (const row of open) {
    const from = row.sources.length > 0 ? `  (${row.sources.join(', ')})` : ''
    console.log(`  ${row.id.padEnd(20)} ${row.language}  ${row.term}${from}`)
  }
}
