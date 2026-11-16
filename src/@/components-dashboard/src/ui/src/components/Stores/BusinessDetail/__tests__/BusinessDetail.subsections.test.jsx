/* eslint-disable import/first */
// redesign stores 5.1b (decision 35, G2-03): Store details has one subsection selector at every width instead of a strip
// of eight tabs that scrolls sideways. Same `?tab=` keys, same order, same rules: Owner is not offered to level 2 and Agents not to
// (the EatStreet owner rule went with main ); a tab this person is not offered opens Information. The subsection bodies are stand-ins.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

const session = { user: { level: 0 }, search: '' }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key],
  useSession: () => [{ user: session.user }]
}))
const addQueryToUrl = vi.fn()
vi.mock('../../../../utils', () => ({ addQueryToUrl: (...args) => addQueryToUrl(...args) }))
vi.mock('react-router-dom', () => ({ useLocation: () => ({ search: session.search }) }))
vi.mock('../../BusinessInformation', () => ({ BusinessInformation: () => <p>Information body</p> }))
vi.mock('../../BusinessLocation', () => ({ BusinessLocation: () => <p>Location body</p> }))
vi.mock('../../BusinessOwners', () => ({ BusinessOwners: ({ type }) => <p>{type === 'agents' ? 'Agents body' : 'Owner body'}</p> }))
vi.mock('../../BusinessTypes', () => ({ BusinessTypes: () => <p>Categories body</p> }))
vi.mock('../../BusinessImages', () => ({ BusinessImages: () => <p>Images body</p> }))
vi.mock('../../BusinessVideos', () => ({ BusinessVideos: () => <p>Videos body</p> }))
vi.mock('../../SeoOptions', () => ({ SeoOptions: () => <p>SEO body</p> }))

import { BusinessDetail } from '../index'
import { visibleStoreDetailsTabs } from '../../BusinessInfoSettingList'

const THEME = { colors: { headingColor: '#000000' } }
const draw = () => render(
  <ThemeProvider theme={THEME}>
    <BusinessDetail business={{ id: 7 }} setIsExtendExtraOpen={() => {}} />
  </ThemeProvider>
)
const selector = () => screen.getByRole('button', { name: /^Subsection / })
const options = async (user) => {
  await user.click(selector())
  const menu = await screen.findByRole('menu')
  return within(menu).getAllByRole('menuitemradio').map(item => item.textContent)
}

beforeEach(() => {
  session.user = { level: 0 }
  session.search = ''
  addQueryToUrl.mockClear()
})

describe('Store details · subsection selector (decision 35)', () => {
  it('is a selector named by the open subsection, with no tab strip', () => {
    draw()
    expect(selector()).toHaveTextContent('Information')
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
    expect(screen.getByText('Information body')).toBeInTheDocument()
    // no ?tab= in the address: Information is written there, as before
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'information' })
  })

  it('offers the eight subsections in the strip\'s order', async () => {
    draw()
    expect(await options(userEvent.setup())).toEqual(['Information', 'Owner', 'Categories', 'Location', 'Agents', 'Images', 'Videos', 'SEO Options'])
  })

  it('choosing one shows it and writes its ?tab=', async () => {
    const user = userEvent.setup()
    draw()
    await options(user)
    await user.click(screen.getByRole('menuitemradio', { name: 'SEO Options' }))
    expect(screen.getByText('SEO body')).toBeInTheDocument()
    expect(selector()).toHaveTextContent('SEO Options')
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'seo_options' })
  })

  it('opens the subsection of the address (?tab=seo_options)', () => {
    session.search = '?tab=seo_options'
    draw()
    expect(screen.getByText('SEO body')).toBeInTheDocument()
    expect(selector()).toHaveTextContent('SEO Options')
  })

  it('level 2 is not offered Owner, and ?tab=owner opens Information', async () => {
    session.user = { level: 2 }
    session.search = '?tab=owner'
    draw()
    expect(screen.getByText('Information body')).toBeInTheDocument()
    expect(await options(userEvent.setup())).not.toContain('Owner')
  })

  // main no owner loses Agents any more
  it('an owner is offered Agents, and ?tab=agents opens it', async () => {
    session.user = { level: 2 }
    session.search = '?tab=agents'
    draw()
    expect(screen.queryByText('Information body')).toBeNull()
    expect(await options(userEvent.setup())).toContain('Agents')
  })

  it('an unknown ?tab= opens Information', () => {
    session.search = '?tab=nope'
    draw()
    expect(screen.getByText('Information body')).toBeInTheDocument()
  })
})

describe('visibleStoreDetailsTabs', () => {
  it('keeps the strip\'s rules', () => {
    expect(visibleStoreDetailsTabs({ level: 0 })).toHaveLength(8)
    expect(visibleStoreDetailsTabs({ level: 2 })).not.toContain('owner')
    expect(visibleStoreDetailsTabs({ level: 2 })).toContain('agents')
    expect(visibleStoreDetailsTabs({ level: 4 })).toHaveLength(8)
  })
})
