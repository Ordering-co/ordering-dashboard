import { describe, expect, it } from 'vitest'

import {
  hasAssignedDriverCompany,
  shouldShowDriverCompanyBlock,
  shouldShowDriverCompanyPicker
} from '../shouldShowDriverCompanyBlock'

describe('hasAssignedDriverCompany', () => {
  it('is false for missing, empty, or default values', () => {
    expect(hasAssignedDriverCompany(undefined)).toBe(false)
    expect(hasAssignedDriverCompany(null)).toBe(false)
    expect(hasAssignedDriverCompany('')).toBe(false)
    expect(hasAssignedDriverCompany('default')).toBe(false)
  })

  it('is true for a company id', () => {
    expect(hasAssignedDriverCompany(12)).toBe(true)
    expect(hasAssignedDriverCompany('12')).toBe(true)
  })
})

describe('shouldShowDriverCompanyBlock', () => {
  it('always shows the filter view', () => {
    expect(shouldShowDriverCompanyBlock({
      isFilterView: true,
      loading: true,
      companies: []
    })).toBe(true)
  })

  it('hides Order Details while the controls list is loading', () => {
    expect(shouldShowDriverCompanyBlock({
      loading: true,
      companies: [],
      assignedCompanyId: null
    })).toBe(false)
  })

  it('hides Order Details when the loaded list is empty and no company is assigned', () => {
    expect(shouldShowDriverCompanyBlock({
      loading: false,
      companies: [],
      assignedCompanyId: null
    })).toBe(false)
  })

  it('shows Order Details when a company is already assigned and the list is empty', () => {
    expect(shouldShowDriverCompanyBlock({
      loading: false,
      companies: [],
      assignedCompanyId: 9
    })).toBe(true)
  })

  it('shows Order Details when controls returns companies', () => {
    expect(shouldShowDriverCompanyBlock({
      loading: false,
      companies: [{ id: 1, name: 'Fleet Co' }]
    })).toBe(true)
  })
})

describe('shouldShowDriverCompanyPicker', () => {
  it('always shows the filter picker', () => {
    expect(shouldShowDriverCompanyPicker({
      isFilterView: true,
      loading: true,
      companies: []
    })).toBe(true)
  })

  it('hides the Order Details picker while loading', () => {
    expect(shouldShowDriverCompanyPicker({
      loading: true,
      companies: [{ id: 1 }]
    })).toBe(false)
  })

  it('hides the Order Details picker when the fetch errors', () => {
    expect(shouldShowDriverCompanyPicker({
      loading: false,
      error: ['network'],
      companies: []
    })).toBe(false)
  })

  it('hides the Order Details picker when the loaded list is empty', () => {
    expect(shouldShowDriverCompanyPicker({
      loading: false,
      companies: []
    })).toBe(false)
  })

  it('shows the Order Details picker when controls returns companies', () => {
    expect(shouldShowDriverCompanyPicker({
      loading: false,
      companies: [{ id: 1, name: 'Fleet Co' }]
    })).toBe(true)
  })
})
