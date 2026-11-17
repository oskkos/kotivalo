// Conventional Commits (https://www.conventionalcommits.org). develop uses
// rebase merges, so every commit lands as-is.
/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
}
