import { describe, expect, test } from 'vitest'
import { supportAddress } from './support'

describe('supportAddress', () => {
  test('Finnish has tuki@', () => {
    expect(supportAddress('fi')).toBe('tuki@kotivalo.app')
  })

  test('Swedish and English have support@', () => {
    expect(supportAddress('sv')).toBe('support@kotivalo.app')
    expect(supportAddress('en')).toBe('support@kotivalo.app')
  })
})
