import { describe, expect, test } from 'vitest'
import {
  duplicateShotIds,
  shotFor,
  shotIdsSaved,
  shotIdsShown,
} from './shots.ts'

const files = { '/docs/guide/src/assets/shots/fi/flat-form-filled.png': 'img' }

describe('Screenshots in the guide', () => {
  test('A captured screenshot', () => {
    expect(shotFor(files, 'flat-form-filled', 'fi', true)).toEqual({
      kind: 'image',
      src: 'img',
    })
  })

  test('A missing screenshot in CI', () => {
    expect(() => shotFor(files, 'flat-form-filed', 'fi', true)).toThrow(
      '"flat-form-filed"',
    )
  })

  test('A missing screenshot locally', () => {
    expect(shotFor(files, 'flat-form-filed', 'fi', false)).toEqual({
      kind: 'placeholder',
      id: 'flat-form-filed',
    })
  })

  test('The same id saved twice', () => {
    expect(
      duplicateShotIds({
        'asunnot.capture.ts': "await shot(page, 'flat-list')",
        'jakaminen.capture.ts': `await shot(page, "flat-list")\nawait shot(page, 'other')`,
      }),
    ).toEqual([
      {
        id: 'flat-list',
        scripts: ['asunnot.capture.ts', 'jakaminen.capture.ts'],
      },
    ])
  })

  test('A screenshot of another language is not found', () => {
    expect(shotFor(files, 'flat-form-filled', 'sv', false).kind).toBe(
      'placeholder',
    )
  })

  test('The ids on a page and in a script are scanned', () => {
    expect(
      shotIdsShown('<Shot id="a" alt="x" />\n<Shot alt="y" id=\'b\' />'),
    ).toEqual(['a', 'b'])
    expect(shotIdsSaved("await shot(page, 'a')")).toEqual(['a'])
  })
})
