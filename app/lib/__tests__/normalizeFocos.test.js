import { describe, it, expect } from 'vitest'
import { normalizeFocos } from '../utils'

describe('normalizeFocos', () => {
  // v9.x schema: already an array → pass through
  it('returns array input as-is', () => {
    const input = [{ focos: 'Pipeline', blocker: 'none', necesito: 'nada' }]
    expect(normalizeFocos(input)).toBe(input)
  })

  // v7.x legacy schema: single object with focos key → wrap in array
  it('wraps a legacy object with focos key into an array', () => {
    const input = { focos: 'Pipeline', blocker: 'Budget', necesito: 'Aprobacion' }
    expect(normalizeFocos(input)).toEqual([input])
  })

  // v7.x legacy: object with only blocker key
  it('wraps a legacy object with blocker key into an array', () => {
    const input = { blocker: 'Recurso' }
    expect(normalizeFocos(input)).toEqual([input])
  })

  // v7.x legacy: object with only necesito key
  it('wraps a legacy object with necesito key into an array', () => {
    const input = { necesito: 'Feedback' }
    expect(normalizeFocos(input)).toEqual([input])
  })

  // Falsy inputs → empty array
  it('returns empty array for null', () => {
    expect(normalizeFocos(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(normalizeFocos(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(normalizeFocos('')).toEqual([])
  })

  // Object without recognized keys → empty array
  it('returns empty array for object without focos/blocker/necesito keys', () => {
    expect(normalizeFocos({ random: 'data' })).toEqual([])
  })

  // Empty array → pass through (still an array)
  it('returns empty array as-is', () => {
    const input = []
    expect(normalizeFocos(input)).toBe(input)
  })

  // Multi-element array → pass through
  it('returns multi-element array as-is', () => {
    const input = [
      { focos: 'A', blocker: '', necesito: '' },
      { focos: 'B', blocker: 'X', necesito: 'Y' },
    ]
    expect(normalizeFocos(input)).toBe(input)
  })
})
