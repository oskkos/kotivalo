import { describe, expect, test } from 'vitest'
import { sortByStreetAddress } from './property'

const addresses = (...streetAddresses: string[]) =>
  streetAddresses.map((streetAddress) => ({ streetAddress }))

const sorted = (locale: string, ...streetAddresses: string[]) =>
  sortByStreetAddress(addresses(...streetAddresses), locale).map(
    (p) => p.streetAddress,
  )

describe('sortByStreetAddress', () => {
  test('sorts house numbers by value', () => {
    expect(sorted('fi', 'Kuusikuja 12', 'Kuusikuja 3 B 12')).toEqual([
      'Kuusikuja 3 B 12',
      'Kuusikuja 12',
    ])
  })

  test('puts Å, Ä and Ö after Z in Finnish and Swedish', () => {
    const streets = ['Öljytie 1', 'Äijäläntie 2', 'Zetakatu 3', 'Åkervägen 4']
    const expected = ['Zetakatu 3', 'Åkervägen 4', 'Äijäläntie 2', 'Öljytie 1']
    expect(sorted('fi', ...streets)).toEqual(expected)
    expect(sorted('sv', ...streets)).toEqual(expected)
  })

  test('ignores case', () => {
    expect(sorted('fi', 'rantatie 15', 'Koivupolku 7')).toEqual([
      'Koivupolku 7',
      'rantatie 15',
    ])
  })

  test('leaves the input as it was', () => {
    const input = addresses('B', 'A')
    sortByStreetAddress(input, 'fi')
    expect(input.map((p) => p.streetAddress)).toEqual(['B', 'A'])
  })
})
