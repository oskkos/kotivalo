import { describe, expect, test } from 'vitest'
import { initialOf } from './initial'

describe('initialOf', () => {
  test.each([
    ['Annika', 'A'],
    ['  åke', 'Å'],
    ['élise', 'É'],
    ['😀 Ilo', '😀'],
    ['', ''],
  ])('%j gives %j', (name, initial) => {
    expect(initialOf(name)).toBe(initial)
  })
})
