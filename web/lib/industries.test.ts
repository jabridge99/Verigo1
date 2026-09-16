import { describe, expect, it } from 'vitest'
import { industries, selectableIndustries } from './industries'

describe('selectableIndustries', () => {
  it('excludes reporting_group -- it is not a real AUSTRAC IndustryType and 422s if selected', () => {
    expect(selectableIndustries.some(i => i.id === 'reporting_group')).toBe(false)
  })

  it('still has the full list of real industries', () => {
    // Every entry except reporting_group should still be selectable.
    const realIds = industries.filter(i => i.id !== 'reporting_group').map(i => i.id)
    expect(selectableIndustries.map(i => i.id).sort()).toEqual(realIds.sort())
  })
})

describe('industries', () => {
  it('still includes reporting_group -- the /solutions/reporting-group marketing page needs it', () => {
    expect(industries.some(i => i.id === 'reporting_group')).toBe(true)
  })
})
