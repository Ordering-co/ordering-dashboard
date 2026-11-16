/* eslint-disable import/first */
// redesign stores 5.15b (; G5-04, G5-10, G5-11, G5-12, G5-13, G5-14): the sales channel guides of a store.
// - «How to connect» opens the guide on P/SectionSplit (no Lorem ipsum modal in between);
// - every link step shows the store's real address with «Copy link», at every width and in both Instagram tabs;
// - without an address the step says why, and while it loads it waits;
// - no Lorem ipsum, no sales notes, no HTML from translations in the six directories.
import React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import baseTheme from '~/theme.json'

const state = vi.hoisted(() => ({}))
const reset = () => {
  state.width = 1440
  state.project = { loading: false, websiteProduct: 'web_marketplace_26' }
  state.site = { sites: [], loading: false }
  state.storeUrl = (slug) => slug ? `https://shop.example.com/store/${encodeURIComponent(slug)}` : null
}
reset()

// src/index.js attaches the images at boot; the test gives the ones these components read
const theme = {
  ...baseTheme,
  images: {
    icons: { facebook: 'facebook.svg', tiktok: 'tiktok.svg', instagram: 'instagram.svg', businessGoogle: 'google.svg' },
    salesChannels: new Proxy({}, { get: (_target, key) => `${String(key)}.png` })
  }
}

const mockModule = vi.hoisted(() => async () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useSite: () => [state.site]
}))
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: state.width, height: 900 }) }))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: (slug) => state.storeUrl(slug) }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [state.project] }))

import { BusinessSalesChannel } from '../index'

let writeText
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  delete navigator.clipboard
  reset()
})

const setup = (business = { id: 2, slug: 'fastbite' }) => {
  const setIsExtendExtraOpen = vi.fn()
  render(
    <ThemeProvider theme={theme}>
      <BusinessSalesChannel business={business} setIsExtendExtraOpen={setIsExtendExtraOpen} />
    </ThemeProvider>
  )
  return { setIsExtendExtraOpen }
}
const open = (channel) => fireEvent.click(screen.getByRole('button', { name: `How to connect ${channel}` }))
const URL = 'https://shop.example.com/store/fastbite'

describe('Sales channels · list (G5-10)', () => {
  it('lists the four channels, each with a «How to connect» button named by its channel', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Sales channels' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Sales channels' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    for (const channel of ['Facebook', 'TikTok', 'Instagram', 'Google Business Profile']) {
      expect(screen.getByRole('button', { name: `How to connect ${channel}` })).toHaveTextContent('How to connect')
    }
    expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull()
    expect(screen.getByText(/Nothing is connected automatically/)).toBeInTheDocument()
  })

  it('opens the guide directly (no modal in between), names it by the channel and gives the section the width', () => {
    const { setIsExtendExtraOpen } = setup()
    open('Facebook')
    expect(screen.queryByText(/Ok, I understand/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Facebook', level: 3 })).toBeInTheDocument()
    expect(setIsExtendExtraOpen).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: 'How to connect Facebook' }).closest('li')).toHaveAttribute('aria-current', 'true')
  })

  it('opens a guide even without an address (main disabled the four buttons without a word)', () => {
    state.storeUrl = () => null
    setup({ id: 2, slug: null })
    expect(screen.getByRole('button', { name: 'How to connect Facebook' })).toBeEnabled()
  })
})

describe('Sales channels · the store link (G5-04, G5-11, G5-12)', () => {
  for (const width of [1440, 390]) {
    it(`shows the real address with «Copy link» in Facebook, Instagram and Google at ${width}px`, async () => {
      state.width = width
      setup()
      for (const channel of ['Facebook', 'Instagram', 'Google Business Profile']) {
        open(channel)
        expect(screen.getByText(URL)).toBeInTheDocument()
        expect(screen.queryByText(/yourbusinessname/)).toBeNull()
        if (width < 1000) fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      }
    })
  }

  it('copies the link', async () => {
    setup()
    open('Google Business Profile')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })) })
    expect(writeText).toHaveBeenCalledWith(URL)
  })

  it('gives Instagram › Advanced the same address', () => {
    setup()
    open('Instagram')
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(screen.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(URL)).toBeInTheDocument()
    expect(screen.queryByText(/yourbusinessname/)).toBeNull()
  })

  it('says why there is no link when the store has no address, with nothing to copy', () => {
    state.storeUrl = () => null
    setup({ id: 2, slug: null })
    open('Facebook')
    expect(screen.getByRole('status')).toHaveTextContent('This store has no website address yet')
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })

  it('waits for the address while the sites load (no notice yet)', () => {
    state.storeUrl = () => null
    state.site = { sites: [], loading: true }
    setup()
    open('Facebook')
    expect(screen.queryByText(/no website address/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })

  it('keeps TikTok as main had it: the steps and the Ads Manager link, no store link', () => {
    setup()
    open('TikTok')
    // one level under the guide's title, the SectionSplit's h3 (review 5.15b R2)
    expect(screen.getAllByRole('heading', { level: 4, name: /^Step \d+$/ })).toHaveLength(10)
    expect(screen.getByRole('link', { name: /Open TikTok Ads Manager/ })).toHaveAttribute('href', 'https://ads.tiktok.com/i18n/home')
    expect(screen.queryByText(URL)).toBeNull()
  })

  it('links Google to the language-neutral page (main forced /intl/es/)', () => {
    setup()
    open('Google Business Profile')
    const link = screen.getByRole('link', { name: /Open Google Business Profile/ })
    expect(link).toHaveAttribute('href', 'https://www.google.com/business/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAccessibleName(/opens in a new tab/)
  })
})

describe('Sales channels · source (G5-10, G5-13, G5-14)', () => {
  const root = path.join(__dirname, '..', '..')
  const live = ['BusinessSalesChannel', 'BusinessSalesGoogle', 'BusinessSalesInstagram', 'BusinessSalesTiktok']
    .flatMap(dir => readdirSync(path.join(root, dir)).filter(f => /\.(js|jsx)$/.test(f)).map(f => path.join(root, dir, f)))
    .concat([path.join(root, 'BusinessSalesFacebook', 'index.js'), path.join(root, 'BusinessSalesFacebook', 'FacebookProfile.js')])
  const source = live.map(file => readFileSync(file, 'utf8')).join('\n')

  it('has no Lorem ipsum, no sales notes and no HTML from translations', () => {
    expect(source).not.toMatch(/Lorem ipsum/i)
    expect(source).not.toMatch(/shared revenue|pay 99 per business/i)
    expect(source).not.toMatch(/dangerouslySetInnerHTML/)
    expect(source).not.toMatch(/<strong>/)
  })

  it('has no width animation by element id, no undeclared `open`, no Modal and no placeholder address', () => {
    expect(source).not.toMatch(/getElementById/)
    expect(source).not.toMatch(/if \(!open\)/)
    expect(source).not.toMatch(/\bModal\b/)
    expect(source).not.toMatch(/yourbusinessname/)
  })
})
