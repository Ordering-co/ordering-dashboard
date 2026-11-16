/* eslint-disable import/first */
// parity of the Advanced sections of an app with the legacy page they replace. The oracle is the legacy `AdvancedSettings`
// itself, rendered for an app, a kiosk, a franchise app and a Maweja app, with its controls swapped for probes that record the path each
// one edits (the lists of `AdvancedSettings/utils.js` through `SettingComponent`, the images, the fonts, the order types, the app design
// and the title of the order-types menu). Every recorded path must be painted by exactly as many controls in the app's sections (the
// review date is in two places in both), no section may paint a path the legacy page did not, and the registry of the editor must list
// exactly the sections that have something to paint.
import React, { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'

const mockState = vi.hoisted(() => ({ project: 'demo', paths: [] }))

const translate = (_key, text) => text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useApi: () => [{ project: mockState.project }, {}]
}))
// the probes: each control of the legacy page records the path it edits
vi.mock('../../AdvancedSettings/SettingComponent', () => ({
  SettingComponent: ({ settingList }) => {
    settingList.filter(setting => !setting.disabled).forEach(setting => mockState.paths.push(setting.path))
    return null
  }
}))
vi.mock('../../AdvancedSettings/ImageBox', async () => {
  const React = await import('react')
  return {
    ImageFormatContext: React.createContext(null),
    ImageBox: ({ path }) => { mockState.paths.push(path); return null }
  }
})
vi.mock('../../AdvancedSettings/FontStyleGroup', () => ({
  FontStyleGroup: ({ path }) => { mockState.paths.push(path); return null }
}))
vi.mock('../../AdvancedSettings/OrderType', () => ({
  OrderType: ({ path }) => { mockState.paths.push(path); return null }
}))
vi.mock('../../AdvancedLayouts/LayoutStyleGroup', () => ({
  LayoutStyleGroup: ({ path }) => { mockState.paths.push(path); return null }
}))
// the title of the order-types menu is a bare Input: the probe writes once and the path is read back from what was written
vi.mock('../../../../styles', () => ({
  Button: ({ children }) => <button type='button'>{children}</button>,
  Input: ({ onChange }) => {
    useEffect(() => { onChange({ target: { value: '__probe__' } }) }, [])
    return null
  }
}))
vi.mock('../../../Shared', () => ({ Alert: () => null, Modal: () => null }))
vi.mock('../../UploadAudio', () => ({ UploadAudio: () => null }))

import { AdvancedSettings } from '../../AdvancedSettings'
import { APP_ADVANCED_SECTION_IDS, appAdvancedSectionIds, useAdvancedSectionConfig } from '../../OrderingWebsite/SectionsEditor/advancedSections'
import { buildSections, visibleSections } from '../sections'

// The dotted path of the first leaf of `object` equal to `value`
const pathOf = (object, value, prefix = '') => {
  for (const [key, node] of Object.entries(object ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (node === value) return path
    if (node && typeof node === 'object') {
      const found = pathOf(node, value, path)
      if (found) return found
    }
  }
  return null
}

// What the legacy page paints for an app of this kind: the path of each control, in order
const legacyPaths = ({ isKiosk = false, isFranchise = false, project = 'demo' }) => {
  mockState.project = project
  mockState.paths = []
  const written = []
  render(
    <AdvancedSettings
      isApp
      isKiosk={isKiosk}
      isFranchise={isFranchise}
      themesList={{ loading: false, themes: [{ id: 1 }] }}
      advancedValues={{}}
      setAdvancedValues={(next) => written.push(next)}
      handleUpdateSiteTheme={vi.fn()}
    />
  )
  const inputPaths = written.map(next => pathOf(next, '__probe__')).filter(Boolean)
  return [...mockState.paths, ...inputPaths]
}

// What the app's sections paint: the path of each control of each section the app has
const sectionPaths = (options) => {
  const config = renderHook(() => useAdvancedSectionConfig({ isApp: true, ...options })).result.current
  const owned = []
  appAdvancedSectionIds(options).forEach((id) => {
    const section = config[id]
    expect(section.enabled, id).toBe(true)
    section.blocks.forEach((block) => {
      if (block.kind === 'list') block.list.filter(item => !item.disabled).forEach(item => owned.push(item.path))
      else if (block.kind === 'order_types') {
        owned.push(block.titleField.path)
        block.types.forEach(type => owned.push(`${block.path}.components.${type.key}.components`))
      } else if (block.path) owned.push(block.path)
    })
    // a section the registry lists has something to paint
    expect(section.blocks.length, id).toBeGreaterThan(0)
  })
  return owned
}

const sorted = (paths) => [...paths].sort()

const VARIANTS = [
  ['an app', { isKiosk: false, isFranchise: false, project: 'demo' }],
  ['a kiosk', { isKiosk: true, isFranchise: false, project: 'demo' }],
  ['a franchise app', { isKiosk: false, isFranchise: true, project: 'demo' }],
  ['a Maweja app', { isKiosk: false, isFranchise: false, project: 'maweja' }],
  ['a Maweja kiosk', { isKiosk: true, isFranchise: false, project: 'Maweja' }],
  ['a Maweja franchise app', { isKiosk: false, isFranchise: true, project: 'maweja' }]
]

beforeEach(() => {
  mockState.project = 'demo'
  mockState.paths = []
})

describe('· every control of the legacy Advanced page of an app is in exactly one place of its sections', () => {
  it.each(VARIANTS)('%s', (_name, { isKiosk, isFranchise, project }) => {
    const legacy = legacyPaths({ isKiosk, isFranchise, project })
    expect(legacy.length).toBeGreaterThan(0)
    const isMaweja = project.toLowerCase() === 'maweja'
    expect(sorted(sectionPaths({ isKiosk, isFranchise, isMaweja }))).toEqual(sorted(legacy))
  })

  it('the app design (Maweja) and the homepage image are only for apps; the kiosk keeps only the homepage', () => {
    expect(appAdvancedSectionIds({ isKiosk: true })).toEqual(['homepage'])
    expect(appAdvancedSectionIds({ isMaweja: true })[0]).toBe('app_design')
    expect(appAdvancedSectionIds({ isMaweja: true, isFranchise: true })).not.toContain('app_design')
    expect(appAdvancedSectionIds({ isMaweja: true, isKiosk: true })).toEqual(['homepage'])
    expect(appAdvancedSectionIds({})).toEqual(APP_ADVANCED_SECTION_IDS.filter(id => !['app_design', 'smart_banners'].includes(id)))
  })
})

describe('· the editor lists exactly the sections the app has, each with its own ?section=', () => {
  it.each([
    ['app_marketplace_x', {}],
    ['app_marketplace_26', {}],
    ['app_kiosk_x', { isKiosk: true }],
    ['app_kiosk_26', {}],
    ['app_franchises_x', { isFranchise: true }],
    ['app_franchises_26', {}]
  ])('%s', (appCode, flags) => {
    const ids = visibleSections(buildSections({ t: translate, app: {}, appCode })).filter(section => section.group === 'advanced').map(section => section.id)
    expect(ids).toEqual(appAdvancedSectionIds(flags))
  })

  it('Maweja: the app design is listed first', () => {
    const ids = visibleSections(buildSections({ t: translate, app: {}, appCode: 'app_marketplace_x', project: 'maweja' }))
      .filter(section => section.group === 'advanced').map(section => section.id)
    expect(ids).toEqual(appAdvancedSectionIds({ isMaweja: true }))
  })

  it('an app without a theme of its own (business, driver) has no Advanced sections', () => {
    const sections = visibleSections(buildSections({ t: translate, app: {}, appCode: 'app_business_x' }))
    expect(sections.filter(section => section.group === 'advanced')).toEqual([])
  })

  it('no Advanced section reuses the id of another section of the editor', () => {
    const ids = buildSections({ t: translate, app: {}, appCode: 'app_marketplace_x', project: 'maweja' }).map(section => section.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
