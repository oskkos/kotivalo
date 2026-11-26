import { describe, expect, test } from 'vitest'
import { inChunks, MAX_IDS_PER_QUERY } from './chunks'

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `id-${String(i)}`)

describe('inChunks', () => {
  test('reads nothing for no ids', async () => {
    const calls: string[][] = []
    const rows = await inChunks([], (chunk) => {
      calls.push(chunk)
      return Promise.resolve(chunk)
    })
    expect(rows).toEqual([])
    expect(calls).toEqual([])
  })

  test('splits the ids into chunks of at most the limit, rows in order', async () => {
    const all = ids(2 * MAX_IDS_PER_QUERY + 1)
    const sizes: number[] = []
    const rows = await inChunks(all, (chunk) => {
      sizes.push(chunk.length)
      return Promise.resolve(chunk)
    })
    expect(sizes).toEqual([MAX_IDS_PER_QUERY, MAX_IDS_PER_QUERY, 1])
    expect(rows).toEqual(all)
  })
})
