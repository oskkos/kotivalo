// PostToolUse hook: after an edit to the term bank, remind Claude that every
// term bank change ends with the term-critic review (the translate skill,
// step 6). Prints nothing for other files.
let input = ''
for await (const chunk of process.stdin) {
  input += chunk
}

let path = ''
try {
  path = JSON.parse(input).tool_input?.file_path ?? ''
} catch {
  process.exit(0)
}

if (path.replaceAll('\\', '/').endsWith('i18n/terms.json')) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          'i18n/terms.json changed. Follow the translate skill (.claude/skills/translate/SKILL.md): update every message that uses a changed term, run `pnpm test scripts/terms src/messages.test.ts`, then have the term-critic agent review `git diff -- i18n messages` before finishing.',
      },
    }),
  )
}
