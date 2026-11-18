// Active OpenSpec changes (openspec/changes/<name>/, not archive/).

/**
 * True when a change's tasks.md has tasks and every one is checked: the
 * change is implemented and should be archived in the same PR, which moves
 * its specs into openspec/specs/ where the traceability check blocks.
 */
export function allTasksDone(tasksMarkdown: string): boolean {
  const boxes = [...tasksMarkdown.matchAll(/^\s*[-*] \[([ xX])\]/gm)]
  return boxes.length > 0 && boxes.every((b) => b[1] !== ' ')
}
