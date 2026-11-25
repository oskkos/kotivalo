import { describe, expect, test } from 'vitest'
import {
  newPropertyInput,
  propertyDetailsInput,
  type PropertyDetailsInput,
} from './schemas'

const valid: PropertyDetailsInput = {
  streetAddress: ' Kuusikuja 3 B 12 ',
  postcode: '33100',
  city: 'Tampere',
  roomCount: 2,
  floorArea: '48,5',
}

/** The reason codes of the input's issues, by field. */
function reasons(input: Partial<Record<string, unknown>>) {
  const result = propertyDetailsInput.safeParse({ ...valid, ...input })
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      )
}

describe('propertyDetailsInput', () => {
  test('parses the details, trimmed, with the area in tenths', () => {
    expect(propertyDetailsInput.parse(valid)).toEqual({
      streetAddress: 'Kuusikuja 3 B 12',
      postcode: '33100',
      city: 'Tampere',
      roomCount: 2,
      floorArea: 485,
    })
  })

  test.each([
    [{ streetAddress: '  ' }, { streetAddress: 'street_address_required' }],
    [{ city: '' }, { city: 'city_required' }],
    [{ city: 'x'.repeat(101) }, { city: 'text_too_long' }],
    [{ postcode: '3310' }, { postcode: 'postcode_invalid' }],
    [{ postcode: '33 100' }, { postcode: 'postcode_invalid' }],
    [{ roomCount: 0 }, { roomCount: 'room_count_required' }],
    [{ roomCount: 5 }, { roomCount: 'room_count_required' }],
    [{ floorArea: '0' }, { floorArea: 'floor_area_invalid' }],
    [{ floorArea: '48,55' }, { floorArea: 'floor_area_invalid' }],
    [{ floorArea: 'abc' }, { floorArea: 'floor_area_invalid' }],
    [{ floorArea: '10000,1' }, { floorArea: 'floor_area_invalid' }],
  ])('%j gives %j', (input, expected) => {
    expect(reasons(input)).toEqual(expected)
  })

  test('accepts the limits of the floor area', () => {
    expect(reasons({ floorArea: '1' })).toEqual({})
    expect(reasons({ floorArea: '10 000' })).toEqual({})
  })
})

describe('The first ownership period', () => {
  const issue = (ownedSince: string) =>
    newPropertyInput.safeParse({ ...valid, ownedSince }).error?.issues[0]
      ?.message

  test('An ownership date in the future is refused', () => {
    expect(issue('31.12.2999')).toBe('ownership_date_in_future')
  })

  test('reads the date as typed, and leaves it out when empty', () => {
    expect(
      newPropertyInput.parse({ ...valid, ownedSince: '12.6.2022' }),
    ).toMatchObject({
      ownedSince: '2022-06-12',
    })
    expect(
      newPropertyInput.parse({ ...valid, ownedSince: '' }).ownedSince,
    ).toBeUndefined()
    expect(newPropertyInput.parse(valid).ownedSince).toBeUndefined()
  })

  test('refuses something that is not a date', () => {
    expect(issue('31.2.2026')).toBe('date_invalid')
  })
})

describe('Housing company details of a flat', () => {
  test('Spaces around the details are dropped', () => {
    expect(
      propertyDetailsInput.parse({
        ...valid,
        housingCompanyName: '  As Oy Kuusikuja 3 ',
        businessId: ' 2345678-0 ',
        apartmentNumber: '  B 12  ',
      }),
    ).toMatchObject({
      housingCompanyName: 'As Oy Kuusikuja 3',
      businessId: '2345678-0',
      apartmentNumber: 'B 12',
    })
  })

  test('A flat without housing company details', () => {
    const missing = propertyDetailsInput.parse(valid)
    expect(missing.housingCompanyName).toBeUndefined()
    expect(missing.businessId).toBeUndefined()
    expect(missing.apartmentNumber).toBeUndefined()

    const empty = propertyDetailsInput.parse({
      ...valid,
      housingCompanyName: '',
      businessId: '  ',
      apartmentNumber: '',
    })
    expect(empty.housingCompanyName).toBeUndefined()
    expect(empty.businessId).toBeUndefined()
    expect(empty.apartmentNumber).toBeUndefined()
  })

  test('A Business ID with a wrong check digit is not saved', () => {
    expect(reasons({ businessId: '2345678-9' })).toEqual({
      businessId: 'business_id_invalid',
    })
  })

  test('A Business ID in the wrong form is not saved', () => {
    for (const businessId of ['2345678', '23456780', '3141592-0']) {
      expect(reasons({ businessId })).toEqual({
        businessId: 'business_id_invalid',
      })
    }
  })

  test('limits the length of the name and the apartment number', () => {
    expect(reasons({ housingCompanyName: 'x'.repeat(101) })).toEqual({
      housingCompanyName: 'text_too_long',
    })
    expect(reasons({ apartmentNumber: 'x'.repeat(21) })).toEqual({
      apartmentNumber: 'text_too_long',
    })
    expect(
      reasons({
        housingCompanyName: 'x'.repeat(100),
        apartmentNumber: 'x'.repeat(20),
      }),
    ).toEqual({})
  })
})
