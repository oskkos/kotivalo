import { describe, expect, test } from 'vitest'
import { isReason, reasonText } from './reasons'

describe('reasons', () => {
  test('a field reason has text only', () => {
    expect(reasonText('email_invalid')).toEqual({
      text: 'Tarkista sähköpostiosoite, esimerkiksi nimi@esimerkki.fi.',
    })
  })

  test('an alert reason has a title and text', () => {
    expect(reasonText('email_quota')).toEqual({
      title: 'Koodeja ei voi lähettää juuri nyt',
      text: 'Päivän lähetysmäärä on täynnä. Kokeile uudelleen huomenna.',
    })
  })

  test('recognises reason codes only', () => {
    expect(isReason('code_wrong')).toBe(true)
    expect(isReason('Invalid email')).toBe(false)
    expect(isReason('toString')).toBe(false)
    expect(isReason(undefined)).toBe(false)
  })
})
