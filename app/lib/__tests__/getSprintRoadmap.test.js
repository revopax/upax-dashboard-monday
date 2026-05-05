import { describe, it, expect } from 'vitest'
import { getSprintRoadmap } from '../utils'

const makeItem = (id, phase, deadline, squad, timeline, person) => ({
  id,
  name: `Project ${id}`,
  column_values: {
    color_mkz09na: phase,
    date_mm1b10rx: deadline,
    color_mkz0s203: squad,
    timerange_mkzcqv0j: timeline || null,
    person: person || 'Test Person',
  },
})

describe('getSprintRoadmap', () => {
  it('returns Sprint items with deadline in current month', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const deadline = `${y}-${m}-15`

    const items = [
      makeItem('1', '🚧 Sprint', deadline, 'Inbound Studio'),
      makeItem('2', '⏳Backlog', deadline, 'Inbound Studio'),
      makeItem('3', '✅ Done', deadline, 'Inbound Studio'),
    ]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('includes Review and Modificacion phases', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const deadline = `${y}-${m}-20`

    const items = [
      makeItem('1', '🚧 Sprint', deadline, 'Inbound Studio'),
      makeItem('2', '👀 Review', deadline, 'Performance y Conversión'),
      makeItem('3', '⚙️ Modificación', deadline, 'RevOps & Analytics'),
    ]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(3)
  })

  it('excludes items without deadline', () => {
    const items = [makeItem('1', '🚧 Sprint', null, 'Inbound Studio')]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(0)
  })

  it('excludes items with deadline outside current month', () => {
    const items = [makeItem('1', '🚧 Sprint', '2020-01-15', 'Inbound Studio')]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(0)
  })

  it('groups by squad then sorts by deadline ascending', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')

    const items = [
      makeItem('1', '🚧 Sprint', `${y}-${m}-20`, 'Performance y Conversión'),
      makeItem('2', '🚧 Sprint', `${y}-${m}-10`, 'Inbound Studio'),
      makeItem('3', '🚧 Sprint', `${y}-${m}-15`, 'Inbound Studio'),
    ]
    const result = getSprintRoadmap(items)
    // Grouped by squad order (SQUADS array order), then by deadline
    expect(result[0].id).toBe('2') // Inbound first (index 0 in SQUADS), earlier deadline
    expect(result[1].id).toBe('3') // Inbound, later deadline
    expect(result[2].id).toBe('1') // Performance (index 1 in SQUADS)
  })

  it('returns empty array for empty items', () => {
    expect(getSprintRoadmap([])).toEqual([])
  })
})
