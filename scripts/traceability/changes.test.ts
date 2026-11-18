import { describe, expect, test } from 'vitest'
import { allTasksDone } from './changes.ts'

describe('allTasksDone', () => {
  test('is true when every task is checked', () => {
    expect(allTasksDone('## 1. A\n\n- [x] 1.1 One\n- [X] 1.2 Two\n')).toBe(true)
  })

  test('is false while a task is open', () => {
    expect(allTasksDone('- [x] 1.1 One\n- [ ] 1.2 Two\n')).toBe(false)
  })

  test('counts nested tasks', () => {
    expect(allTasksDone('- [x] 1.1 One\n  - [ ] detail\n')).toBe(false)
  })

  test('is false without tasks', () => {
    expect(allTasksDone('## 1. Nothing yet\n')).toBe(false)
  })
})
