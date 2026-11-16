/* eslint-disable import/first */
// redesign AB-B2 (decision 1; defect M-AB26): the six banner positions as data, every batch imports them. The values are the ones
// `M/AdBannersListing/index.js:26-84` has on `main` (keys, titles, descriptions, sizes, ratios, the app crop box, the two
// «Business page» positions); the display order is the new one (home, business listing, business page inside Web and App).
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ catalog: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.catalog[key] ?? text]
}))

import {
  BANNER_POSITIONS,
  POSITION_GROUPS,
  positionByKey,
  positionsOfGroup,
  usePositionText
} from '../bannerPositions'

const HOME = 'Add a banner to your home page and inform everyone about the latest news in your marketplace.'
const LISTING = 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.'
const PAGE = 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.'

// the values of main, written out (not read from the module under test)
const TODAY = [
  ['web_home_page', 'web', 'WEB_HOME', 'Web home', 'HOME_BANNER_DESCRIPTION', HOME, '1440 x 300', 1440 / 300, false, false],
  ['web_business_listing', 'web', 'WEB_BUSINESS_LISTING', 'Web business listing', 'BUSINESS_LISTING_BANNER_DESCRIPTION', LISTING, '1440 x 300', 1440 / 300, false, false],
  ['web_business_page', 'web', 'WEB_BUSINESS_PAGE', 'Web business page', 'BUSINESS_PAGE_BANNER_DESCRIPTION', PAGE, '1440 x 300', 1440 / 300, false, true],
  ['app_business_listing', 'app', 'APP_BUSINESS_LISTING', 'App business listing', 'BUSINESS_LISTING_BANNER_DESCRIPTION', LISTING, '300 x 300', 1, true, false],
  ['app_business_page', 'app', 'APP_BUSINESS_PAGE', 'App business page', 'BUSINESS_PAGE_BANNER_DESCRIPTION', PAGE, '300 x 300', 1, true, true],
  ['app_home_page', 'app', 'APP_HOME_PAGE', 'App home page', 'HOME_BANNER_DESCRIPTION', HOME, '300 x 300', 1, true, false]
]

beforeEach(() => {
  mocks.catalog = {}
})

describe('BANNER_POSITIONS', () => {
  it('has the six positions of main, in main order, with no other', () => {
    expect(BANNER_POSITIONS.map(position => position.key)).toEqual(TODAY.map(row => row[0]))
  })

  it.each(TODAY)('%s keeps its group, text keys, defaults, size, ratio, crop box and business-page flag', (
    key, group, titleKey, titleDefault, descriptionKey, descriptionDefault, size, aspectRatio, showAspectRatioBox, isBusinessPage
  ) => {
    const position = BANNER_POSITIONS.find(item => item.key === key)
    expect(position).toMatchObject({ key, group, titleKey, titleDefault, descriptionKey, descriptionDefault, size, aspectRatio })
    expect(Boolean(position.showAspectRatioBox)).toBe(showAspectRatioBox)
    expect(Boolean(position.isBusinessPage)).toBe(isBusinessPage)
  })

  it('shows the crop box on exactly the three app positions and the business page tools on exactly the two «Business page» ones', () => {
    expect(BANNER_POSITIONS.filter(position => position.showAspectRatioBox).map(position => position.key).sort())
      .toEqual(['app_business_listing', 'app_business_page', 'app_home_page'])
    expect(BANNER_POSITIONS.filter(position => position.isBusinessPage).map(position => position.key).sort())
      .toEqual(['app_business_page', 'web_business_page'])
  })

  it('the web positions are 1440 x 300 (4.8:1) and the app ones 300 x 300 (1:1)', () => {
    BANNER_POSITIONS.filter(position => position.group === 'web').forEach(position => {
      expect(position.size).toBe('1440 x 300')
      expect(position.aspectRatio).toBe(1440 / 300)
    })
    BANNER_POSITIONS.filter(position => position.group === 'app').forEach(position => {
      expect(position.size).toBe('300 x 300')
      expect(position.aspectRatio).toBe(1)
    })
  })

  it('cannot be changed by a consumer (the other batches share these objects)', () => {
    expect(Object.isFrozen(BANNER_POSITIONS)).toBe(true)
    BANNER_POSITIONS.forEach(position => expect(Object.isFrozen(position)).toBe(true))
  })
})

describe('positionByKey', () => {
  it('finds a position by its key', () => {
    expect(positionByKey('app_home_page')).toBe(BANNER_POSITIONS.find(position => position.key === 'app_home_page'))
  })

  it.each([['legacy_position'], [''], [undefined], [null], [7]])('is undefined for %j', (key) => {
    expect(positionByKey(key)).toBeUndefined()
  })
})

describe('groups and display order', () => {
  it('has two groups, web first', () => {
    expect(POSITION_GROUPS).toEqual(['web', 'app'])
  })

  it('shows each group as home, business listing, business page (main listed the app ones listing, page, home)', () => {
    expect(positionsOfGroup('web').map(position => position.key)).toEqual(['web_home_page', 'web_business_listing', 'web_business_page'])
    expect(positionsOfGroup('app').map(position => position.key)).toEqual(['app_home_page', 'app_business_listing', 'app_business_page'])
  })

  it('has nothing for an unknown group', () => {
    expect(positionsOfGroup('tv')).toEqual([])
  })

  it('together the groups hold every position once', () => {
    const shown = POSITION_GROUPS.flatMap(group => positionsOfGroup(group).map(position => position.key))
    expect([...shown].sort()).toEqual(BANNER_POSITIONS.map(position => position.key).sort())
  })
})

describe('usePositionText', () => {
  const textOf = () => renderHook(() => usePositionText()).result.current

  it.each(TODAY)('%s: the title, the description and the recommended size, as main wrote them', (
    key, _group, _titleKey, titleDefault, _descriptionKey, descriptionDefault, size
  ) => {
    const text = textOf()(positionByKey(key))
    expect(text.title).toBe(titleDefault)
    expect(text.description).toBe(descriptionDefault)
    expect(text.size).toBe(`Recommended size ${size}`)
    expect(text.dimensions).toBe(size)
  })

  it('takes every text from the catalog by its key', () => {
    mocks.catalog = {
      WEB_HOME: 'Inicio web',
      HOME_BANNER_DESCRIPTION: 'Descripción del inicio',
      RECOMMENDED_IMAGE_SIZE: 'Tamaño recomendado _size_'
    }
    const text = textOf()(positionByKey('web_home_page'))
    expect(text.title).toBe('Inicio web')
    expect(text.description).toBe('Descripción del inicio')
    expect(text.size).toBe('Tamaño recomendado 1440 x 300')
    // the same description key serves the app home position
    expect(textOf()(positionByKey('app_home_page')).description).toBe('Descripción del inicio')
  })

  it('does not break on an unknown position: empty texts', () => {
    expect(textOf()(undefined)).toEqual({ title: '', description: '', size: '', dimensions: '' })
  })
})
