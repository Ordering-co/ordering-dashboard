/* eslint-disable import/first */
// redesign AB-B3 (decisions 2 and 4; defects M-AB04, M-AB07, M-AB09, M-AB10, M-AB15, M-AB16, M-AB24): the banner panel (create and view) and
// its image grid. K/BannerDetails is a stub that gives the UI the state a test sets and records what the panel passed it; the positions
// helper (AB-B2) and the image dialog (AB-B4) are stubs that follow their documented contracts. RecordPanel, Menu, AsyncSwitch, Tabs,
// ConfirmDialog, TextField, InlineNotice and the rest are the real Product wrappers, and so are BannerNameField and BannerBusinesses.
// Nothing is ever sent: every handler is a spy.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isAddMode: false,
  itemsState: { loading: false, items: [], images: [], videos: [], error: null },
  actionState: { loading: false, error: null },
  businessList: { loading: false, businesses: [], pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 0 } },
  selectedBusinessIds: [],
  controllerProps: null,
  handlers: null,
  dialogProps: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    const [changes, setChanges] = React.useState({})
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        bannerState={{ banner: props.banner, loading: false, error: null }}
        bannerItemsState={mocks.itemsState}
        changesState={{ changes, loading: false, error: null }}
        actionState={mocks.actionState}
        isAddMode={mocks.isAddMode}
        handleChangeItem={(next) => setChanges(prev => ({ ...prev, ...next }))}
        handleUpdateClick={mocks.handlers.handleUpdateClick}
        handleAddBanner={mocks.handlers.handleAddBanner}
        handleDeleteBanner={mocks.handlers.handleDeleteBanner}
        handleDeleteBannerItem={mocks.handlers.handleDeleteBannerItem}
        handleUpdateBannerItem={mocks.handlers.handleUpdateBannerItem}
        handleSuccessBannerItemAdd={mocks.handlers.handleSuccessBannerItemAdd}
        businessList={mocks.businessList}
        selectedBusinessIds={mocks.selectedBusinessIds}
        handleSelectBusiness={mocks.handlers.handleSelectBusiness}
        handleSelectAllBusiness={mocks.handlers.handleSelectAllBusiness}
        handleSelectEveryBusiness={mocks.handlers.handleSelectEveryBusiness}
        handleChangeBusinessPage={mocks.handlers.handleChangeBusinessPage}
        searchBusinesses={mocks.handlers.searchBusinesses}
      />
    )
  }
  return {
    BannerDetails: Controller,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (url, params) => `${url}?${params}` }]
  }
})
vi.mock('../bannerPositions', () => ({
  // as the real one: `size` is the sentence, `dimensions` the measure alone
  usePositionText: () => (position) => ({
    title: position.titleDefault,
    description: position.descriptionDefault,
    size: `Recommended size ${position.size}`,
    dimensions: position.size
  })
}))
vi.mock('../BannerImageDialog', () => ({
  BannerImageDialog: (props) => {
    mocks.dialogProps = props
    return props.open
      ? (
        <div role='dialog' aria-label='Image dialog'>
          <button type='button' onClick={props.onClose}>close image dialog</button>
        </div>
        )
      : null
  }
}))

import { BannerImagesGrid } from '../BannerImagesGrid'
import { BannerPanel } from '../BannerPanel'

const webPage = { key: 'web_business_page', group: 'web', titleDefault: 'Web business page', descriptionDefault: 'Shown on a business page', size: '1440 x 300', aspectRatio: 1440 / 300, showAspectRatioBox: false, isBusinessPage: true }
const webHome = { key: 'web_home_page', group: 'web', titleDefault: 'Web home', descriptionDefault: 'Shown on the home', size: '1440 x 300', aspectRatio: 1440 / 300, showAspectRatioBox: false, isBusinessPage: false }
const appPage = { key: 'app_business_page', group: 'app', titleDefault: 'App business page', descriptionDefault: 'Shown in the app', size: '300 x 300', aspectRatio: 1, showAspectRatioBox: true, isBusinessPage: true }

const imageBusiness = { id: 101, type: 'image', url: 'https://img.test/a.png', action: { type: 'business', business_id: 1, url: '/store/kcf' } }
const imageProduct = { id: 102, type: 'image', url: 'https://img.test/b.png', action: { type: 'product', business_id: 1, product_id: 9, url: '/store/kcf?category=3&product=9' } }
const imageOther = { id: 103, type: 'image', url: 'https://img.test/c.png', action: { type: 'category', url: '/store/kcf/menu' } }
const imageNoLink = { id: 104, type: 'image', url: 'https://img.test/d.png', action: null }
const video = { id: 105, type: 'video', url: 'https://img.test/e.mp4', action: null }
const burger = { id: 7, name: 'Burger week', enabled: true, position: 'web_business_page', items: [imageBusiness, imageProduct, video], business: [{ id: 1 }, { id: 2 }] }
const fries = { id: 8, name: 'Fries day', enabled: false, position: 'web_home_page', items: [], business: [] }
const EMPTY = Object.freeze({})

let spies

const showItems = (images) => {
  mocks.itemsState = { loading: false, items: images, images, videos: [], error: null }
}

const Host = ({ banner = burger, position = webPage, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <BannerPanel
      banner={banner}
      position={position}
      onClose={spies.onClose}
      onCreated={spies.onCreated}
      handleSuccessUpdate={spies.handleSuccessUpdate}
      handleSuccessAdd={spies.handleSuccessAdd}
      handleSuccessDelete={spies.handleSuccessDelete}
      toggle={{ pendingIds: [], setEnabled: spies.setEnabled, alert: null }}
      onDirtyChange={spies.onDirtyChange}
      expanded={expanded}
      onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
      {...props}
    />
  )
}

const nameBox = () => screen.getByRole('textbox', { name: /^Name/ })

beforeEach(() => {
  mocks.isAddMode = false
  mocks.actionState = { loading: false, error: null }
  mocks.businessList = { loading: false, businesses: [{ id: 1, name: 'KCF', logo: null }, { id: 2, name: 'Fast Bite', logo: null }], pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 2 } }
  mocks.selectedBusinessIds = [1, 2]
  mocks.controllerProps = null
  mocks.dialogProps = null
  showItems([imageBusiness, imageProduct])
  mocks.handlers = {
    handleUpdateClick: vi.fn().mockResolvedValue({ ok: true, error: null }),
    handleAddBanner: vi.fn().mockResolvedValue({ ok: true, error: null, result: { id: 55, name: 'New one', position: 'web_business_page', items: [] } }),
    handleDeleteBanner: vi.fn().mockResolvedValue({ ok: true, error: null }),
    handleDeleteBannerItem: vi.fn(),
    handleUpdateBannerItem: vi.fn(),
    handleSuccessBannerItemAdd: vi.fn(),
    handleSelectBusiness: vi.fn(),
    handleSelectAllBusiness: vi.fn(),
    handleSelectEveryBusiness: vi.fn().mockResolvedValue({ ok: true, error: null, count: 2 }),
    handleChangeBusinessPage: vi.fn(),
    searchBusinesses: vi.fn()
  }
  spies = {
    onClose: vi.fn(),
    onCreated: vi.fn(),
    handleSuccessUpdate: vi.fn(),
    handleSuccessAdd: vi.fn(),
    handleSuccessDelete: vi.fn(),
    setEnabled: vi.fn().mockResolvedValue({ ok: true, error: null }),
    onDirtyChange: vi.fn(),
    onExpandedChange: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  vi.useRealTimers()
})

describe('BannerPanel wiring to the controller', () => {
  it('mounts K/BannerDetails with the row, the position key and the list handlers', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.banner).toBe(burger)
    expect(props.defaultPosition).toBe('web_business_page')
    expect(props.handleSuccessUpdate).toBe(spies.handleSuccessUpdate)
    expect(props.handleSuccessAdd).toBe(spies.handleSuccessAdd)
    expect(props.handleSuccessDelete).toBe(spies.handleSuccessDelete)
    expect(props.onClose).toBe(spies.onClose)
  })

  it('a new banner gives the controller the empty record', () => {
    mocks.isAddMode = true
    render(<Host banner={EMPTY} />)
    expect(mocks.controllerProps.banner).toBe(EMPTY)
    expect(mocks.controllerProps.defaultPosition).toBe('web_business_page')
  })

  it('opening another banner mounts the controller again (its state is per banner)', () => {
    const { rerender } = render(<Host banner={burger} />)
    const first = mocks.controllerProps
    rerender(<Host banner={fries} position={webHome} />)
    expect(mocks.controllerProps.banner).toBe(fries)
    expect(mocks.controllerProps).not.toBe(first)
    expect(nameBox()).toHaveValue('Fries day')
  })
})

describe('BannerPanel create mode (decisions 2; M-AB04, M-AB09, M-AB10)', () => {
  beforeEach(() => {
    mocks.isAddMode = true
    mocks.selectedBusinessIds = []
  })

  const typeName = (value) => fireEvent.change(nameBox(), { target: { value } })
  const create = () => screen.getByRole('button', { name: 'Create banner' })

  it('titles the panel «Add banner» with the position as subtitle, and has no menu, no Delete, no switch (M-AB04)', () => {
    render(<Host banner={EMPTY} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Add banner')
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('Web business page')
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByText(/Delete/)).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  // redesign (row 41, P-3)
  it('«Select all businesses» is in the create form too and reaches the controller', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    await user.click(screen.getByRole('button', { name: 'Select all businesses' }))
    expect(mocks.handlers.handleSelectEveryBusiness).toHaveBeenCalledTimes(1)
  })

  it('has a required Name and «Cancel» and «Create banner» in the footer', () => {
    render(<Host banner={EMPTY} />)
    expect(nameBox()).toBeRequired()
    expect(document.querySelector('.odc-record-foot')).toContainElement(create())
    expect(within(document.querySelector('.odc-record-foot')).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('«Create banner» is disabled until the name has text (M-AB09: an empty name counted as a change)', () => {
    render(<Host banner={EMPTY} />)
    expect(create()).toBeDisabled()
    typeName('   ')
    expect(create()).toBeDisabled()
    typeName('Burger week')
    expect(create()).toBeEnabled()
    typeName('')
    expect(create()).toBeDisabled()
  })

  it('creates through the controller and hands the new banner to the host (it opens it)', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    expect(mocks.handlers.handleAddBanner).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(spies.onCreated).toHaveBeenCalledTimes(1))
    expect(spies.onCreated.mock.calls[0][0]).toMatchObject({ id: 55, name: 'New one', position: 'web_business_page', enabled: true })
  })

  it('does not close the panel by itself: that is the host\'s (the controller calls onClose)', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    await waitFor(() => expect(spies.onCreated).toHaveBeenCalled())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('hands the banner over even when the controller already closed the panel under it', async () => {
    const user = userEvent.setup()
    const host = {}
    mocks.handlers.handleAddBanner = vi.fn(async () => {
      mocks.controllerProps.onClose()
      await Promise.resolve()
      host.view.unmount() // the host unmounts the panel in response to onClose
      return { ok: true, error: null, result: { id: 56, name: 'New one', position: 'web_business_page', items: [] } }
    })
    host.view = render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    await waitFor(() => expect(spies.onCreated).toHaveBeenCalledTimes(1))
    expect(spies.onCreated.mock.calls[0][0]).toMatchObject({ id: 56 })
  })

  it('is busy while it saves and a double press creates one banner (M-AB09)', async () => {
    const user = userEvent.setup()
    let done
    mocks.handlers.handleAddBanner = vi.fn(() => new Promise(resolve => { done = resolve }))
    render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    expect(create()).toHaveAttribute('aria-busy', 'true')
    await user.click(create())
    fireEvent.click(create())
    expect(mocks.handlers.handleAddBanner).toHaveBeenCalledTimes(1)
    await act(async () => { done({ ok: true, error: null, result: { id: 57 } }) })
    expect(create()).not.toHaveAttribute('aria-busy', 'true')
  })

  it('is busy while the controller says the action is loading', () => {
    mocks.actionState = { loading: true, error: null }
    render(<Host banner={EMPTY} />)
    typeName('New one')
    expect(create()).toHaveAttribute('aria-busy', 'true')
  })

  it('a failed create shows the translated error in the panel, keeps the form and does not hand over anything', async () => {
    const user = userEvent.setup()
    mocks.handlers.handleAddBanner = vi.fn().mockResolvedValue({ ok: false, error: ['Banner name is required'], result: null })
    render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Banner name is required')
    expect(nameBox()).toHaveValue('New one')
    expect(create()).toBeEnabled()
    expect(spies.onCreated).not.toHaveBeenCalled()
  })

  it('a failed create with no text, or a rejected call, still says something, and the next try clears it', async () => {
    const user = userEvent.setup()
    mocks.handlers.handleAddBanner = vi.fn().mockResolvedValueOnce({ ok: false, error: null }).mockRejectedValueOnce(new Error('Network down'))
    render(<Host banner={EMPTY} />)
    typeName('New one')
    await user.click(create())
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't create the banner. Try again.")
    await user.click(create())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network down'))
  })

  it('a position that is not «Business page» has no businesses; one that is has the list', () => {
    const { rerender } = render(<Host banner={EMPTY} position={webHome} />)
    expect(screen.queryByRole('searchbox', { name: 'Search businesses' })).toBeNull()
    rerender(<Host banner={EMPTY} position={appPage} />)
    expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'KCF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save businesses' })).toBeNull()
  })

  it('«Cancel» closes at once while the name is empty', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    await user.click(within(document.querySelector('.odc-record-foot')).getByRole('button', { name: 'Cancel' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('«Cancel» with a typed name goes through the discard guard: Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    typeName('Half typed')
    const cancel = () => within(document.querySelector('.odc-record-foot')).getByRole('button', { name: 'Cancel' })
    await user.click(cancel())
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(dialog).toHaveTextContent('What you changed here is not saved yet.')
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(nameBox()).toHaveValue('Half typed')

    await user.click(cancel())
    const again = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(again).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the close button of the header passes the guard too', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    typeName('Half typed')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('reports the unsaved state to the page: true with text, false when emptied or unmounted', () => {
    const { unmount } = render(<Host banner={EMPTY} />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    typeName('Half typed')
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    typeName('   ')
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    typeName('Again')
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('says nothing about dirty in view mode while nothing changed (the saved selection), and works without an onDirtyChange', () => {
    mocks.isAddMode = false
    mocks.selectedBusinessIds = [1, 2] // what burger has saved; the create form's [] would be a change
    render(<Host />)
    expect(spies.onDirtyChange).not.toHaveBeenCalled()
    cleanup()
    mocks.isAddMode = true
    render(<Host banner={EMPTY} onDirtyChange={undefined} />)
    typeName('x')
    expect(nameBox()).toHaveValue('x')
  })

  it('has «Open as page» as the campaigns panel does', async () => {
    const user = userEvent.setup()
    render(<Host banner={EMPTY} />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })
})

describe('BannerPanel view mode header', () => {
  it('names the banner and gives the group, the position and the size as the subtitle', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Burger week')
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('Web · Web business page')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('1440 x 300')
    expect(subtitle).not.toHaveTextContent('Recommended')
  })

  it('an app banner says App', () => {
    render(<Host position={appPage} />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('App · App business page')
  })

  it('a banner with no name is «Banner»', () => {
    render(<Host banner={{ ...burger, name: '' }} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Banner')
  })

  it('has the same switch as the row, named with the banner (M-AB16), and it calls toggle.setEnabled', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'On, Burger week' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveTextContent('On')
    await user.click(toggle)
    expect(spies.setEnabled).toHaveBeenCalledTimes(1)
    expect(spies.setEnabled.mock.calls[0][0]).toMatchObject({ id: 7, enabled: true })
    expect(spies.setEnabled.mock.calls[0][1]).toBe(false)
  })

  it('an off banner says Off', () => {
    render(<Host banner={fries} position={webHome} />)
    const toggle = screen.getByRole('switch', { name: 'Off, Fries day' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveTextContent('Off')
  })

  it('the panel shows the value of the row, so the two never disagree', () => {
    const { rerender } = render(<Host banner={burger} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    rerender(<Host banner={{ ...burger, enabled: false }} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('marks the panel switch busy while its banner is in flight (toggle.pendingIds), and not for another banner', () => {
    const toggle = { pendingIds: [7], setEnabled: spies.setEnabled, alert: null }
    const { unmount } = render(<Host toggle={toggle} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true')
    unmount()
    render(<Host banner={fries} position={webHome} toggle={toggle} />)
    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-busy', 'true')
  })

  it('a failed toggle says so and the switch goes back (AsyncSwitch)', async () => {
    const user = userEvent.setup()
    spies.setEnabled.mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    await user.click(screen.getByRole('switch'))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change the banner")
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('has «Open as page» and closes at once (no guard in view mode)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('BannerPanel name (M-AB07)', () => {
  it('shows the stored name in the self-saving field and saves through handleUpdateClick', async () => {
    vi.useFakeTimers()
    render(<Host />)
    expect(nameBox()).toHaveValue('Burger week')
    fireEvent.change(nameBox(), { target: { value: 'Burger month' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    expect(mocks.handlers.handleUpdateClick).toHaveBeenCalledTimes(1)
    expect(mocks.handlers.handleUpdateClick).toHaveBeenCalledWith({ name: 'Burger month' })
  })

  it('a pending name is sent when the panel goes away', async () => {
    vi.useFakeTimers()
    const { unmount } = render(<Host />)
    fireEvent.change(nameBox(), { target: { value: 'Burger month' } })
    unmount()
    expect(mocks.handlers.handleUpdateClick).toHaveBeenCalledWith({ name: 'Burger month' })
  })
})

describe('BannerPanel tabs', () => {
  it('a «Business page» banner has Images and Businesses, each with its count', () => {
    render(<Host />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveTextContent('Images')
    expect(tabs[0]).toHaveTextContent('2')
    expect(tabs[1]).toHaveTextContent('Businesses')
    expect(tabs[1]).toHaveTextContent('2')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('the images count is the images, not the videos', () => {
    showItems([imageBusiness])
    render(<Host banner={{ ...burger, items: [imageBusiness, video, video] }} />)
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('1')
  })

  it('any other position has only Images', () => {
    render(<Host banner={fries} position={webHome} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveTextContent('Images')
    expect(screen.queryByRole('tab', { name: /Businesses/ })).toBeNull()
  })

  it('names the tab list', () => {
    render(<Host />)
    expect(screen.getByRole('tablist', { name: 'Banner sections' })).toBeInTheDocument()
  })

  it('the Images tab holds the grid and the Businesses tab the list with its save', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Edit image 1 of Burger week' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: /Businesses/ }))
    expect(screen.getByRole('checkbox', { name: 'KCF' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Edit image 1 of Burger week' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(mocks.handlers.handleUpdateClick).toHaveBeenCalledWith({ businesses: [1, 2] })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('the businesses are wired to the controller handlers', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('tab', { name: /Businesses/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Fast Bite' }))
    expect(mocks.handlers.handleSelectBusiness).toHaveBeenCalledWith(2, false)
    await user.click(screen.getByRole('button', { name: 'Select none on this page' }))
    expect(mocks.handlers.handleSelectAllBusiness).toHaveBeenCalledWith(false, { pageOnly: true })
  })

  // redesign (row 41, P-3): «Select all businesses» reaches the controller from the Businesses tab and from the create form
  it('«Select all businesses» is wired to the controller in the Businesses tab', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('tab', { name: /Businesses/ }))
    await user.click(screen.getByRole('button', { name: 'Select all businesses' }))
    expect(mocks.handlers.handleSelectEveryBusiness).toHaveBeenCalledTimes(1)
  })
})

// (decision 17): the view panel is dirty when the chosen businesses differ from the saved ones, like the create form with text
describe('BannerPanel unsaved businesses in view mode', () => {
  // burger is saved with businesses 1 and 2 (mocks.selectedBusinessIds is what the controller says is chosen)
  const closeButton = () => screen.getByRole('button', { name: 'Close' })

  it('closing with a selection that differs from the saved one asks «Discard your changes?»: Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    mocks.selectedBusinessIds = [1]
    render(<Host />)
    await user.click(closeButton())
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(dialog).toHaveTextContent('What you changed here is not saved yet.')
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(spies.onClose).not.toHaveBeenCalled()

    await user.click(closeButton())
    const again = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(again).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('closing with the saved selection (in any order) closes at once', async () => {
    const user = userEvent.setup()
    mocks.selectedBusinessIds = [2, 1]
    render(<Host />)
    await user.click(closeButton())
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('reports the unsaved state to the page: true when the selection moves, false when it returns or the panel goes away', () => {
    mocks.selectedBusinessIds = [1, 2]
    const { rerender, unmount } = render(<Host />)
    expect(spies.onDirtyChange).not.toHaveBeenCalled()
    mocks.selectedBusinessIds = [1]
    rerender(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    mocks.selectedBusinessIds = [1, 2]
    rerender(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    mocks.selectedBusinessIds = [1]
    rerender(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('after «Save businesses» the saved banner is the new reference: no longer dirty, so closing is direct', async () => {
    const user = userEvent.setup()
    mocks.selectedBusinessIds = [1]
    const { rerender } = render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('tab', { name: /Businesses/ }))
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(mocks.handlers.handleUpdateClick).toHaveBeenCalledWith({ businesses: [1] })
    rerender(<Host banner={{ ...burger, business: [{ id: 1 }] }} />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.click(closeButton())
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a position that is not «Business page» has no businesses to lose: closing is direct', async () => {
    const user = userEvent.setup()
    mocks.selectedBusinessIds = []
    render(<Host banner={fries} position={webHome} />)
    await user.click(closeButton())
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(spies.onDirtyChange).not.toHaveBeenCalled()
  })
})

describe('BannerPanel delete (decision 4; M-AB24)', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete banner' }))
    return screen.findByRole('alertdialog', { name: 'Delete "Burger week"?' })
  }

  it('asks first, names the banner and the position, focuses Cancel and calls nothing before the confirm', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openDelete(user)
    expect(dialog).toHaveTextContent("It stops showing on Web business page. This can't be undone.")
    expect(within(dialog).getByRole('button', { name: 'Delete banner' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handlers.handleDeleteBanner).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.handlers.handleDeleteBanner).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.queryByText('Are you sure to delete this Banner?')).toBeNull()
  })

  it('the menu item is a danger one', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Delete banner' })).toHaveAttribute('data-tone', 'danger')
  })

  it('confirming deletes once and leaves the closing to the controller', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete banner' }))
    expect(mocks.handlers.handleDeleteBanner).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failed delete closes the question, keeps the panel and shows the translated error in it', async () => {
    const user = userEvent.setup()
    mocks.handlers.handleDeleteBanner = vi.fn().mockResolvedValue({ ok: false, error: ['The banner is in use'] })
    render(<Host />)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete banner' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The banner is in use')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Burger week')
    expect(nameBox()).toBeInTheDocument()
  })

  it('a failed delete with no text, or a rejected call, still says something', async () => {
    const user = userEvent.setup()
    mocks.handlers.handleDeleteBanner = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    await user.click(within(await openDelete(user)).getByRole('button', { name: 'Delete banner' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't delete the banner. Try again.")
    cleanup()
    document.getElementById('app-modals')?.remove()

    mocks.handlers.handleDeleteBanner = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    await user.click(within(await openDelete(user)).getByRole('button', { name: 'Delete banner' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('a second try clears the old error', async () => {
    const user = userEvent.setup()
    mocks.handlers.handleDeleteBanner = vi.fn().mockResolvedValueOnce({ ok: false, error: ['The banner is in use'] }).mockResolvedValueOnce({ ok: true })
    render(<Host />)
    await user.click(within(await openDelete(user)).getByRole('button', { name: 'Delete banner' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(within(await openDelete(user)).getByRole('button', { name: 'Delete banner' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('BannerImagesGrid (decision 2; M-AB15, M-AB16)', () => {
  const grid = (overrides = {}) => (
    <BannerImagesGrid
      banner={burger}
      images={[imageBusiness, imageProduct, imageOther, imageNoLink]}
      position={webPage}
      handleDeleteBannerItem={mocks.handlers.handleDeleteBannerItem}
      handleUpdateBannerItem={mocks.handlers.handleUpdateBannerItem}
      handleSuccessBannerItemAdd={mocks.handlers.handleSuccessBannerItemAdd}
      {...overrides}
    />
  )

  it('draws a native button per image, named «Edit image N of <banner>», and a last «Add image» tile', () => {
    render(grid())
    const tiles = screen.getAllByRole('button')
    expect(tiles.map(tile => tile.getAttribute('aria-label') ?? tile.textContent)).toEqual([
      'Edit image 1 of Burger week',
      'Edit image 2 of Burger week',
      'Edit image 3 of Burger week',
      'Edit image 4 of Burger week',
      'Add image'
    ])
    for (const tile of tiles) expect(tile.tagName).toBe('BUTTON')
    for (const tile of tiles) expect(tile).toHaveAttribute('type', 'button')
  })

  it('shows the thumbnail optimized, with no alt, in the ratio of the position', () => {
    render(grid())
    const images = document.querySelectorAll('.odc-banners-tile img')
    expect(images).toHaveLength(4)
    expect(images[0]).toHaveAttribute('src', 'https://img.test/a.png?h_130,c_limit')
    expect(images[0]).toHaveAttribute('alt', '')
    expect(document.querySelector('.odc-banners-images').style.getPropertyValue('--odc-banners-ratio')).toBe(String(1440 / 300))
  })

  it('an app position is square', () => {
    render(grid({ position: appPage }))
    expect(document.querySelector('.odc-banners-images').style.getPropertyValue('--odc-banners-ratio')).toBe('1')
    expect(document.querySelector('.odc-banners-images')).toHaveAttribute('data-shape', 'square')
  })

  it('a thumbnail that does not load leaves a neutral box, not a broken image', () => {
    render(grid())
    const first = document.querySelector('.odc-banners-tile img')
    fireEvent.error(first)
    expect(document.querySelector('.odc-banners-tile img[src="https://img.test/a.png?h_130,c_limit"]')).toBeNull()
    expect(document.querySelector('.odc-banners-tile [data-failed]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Edit image 1 of Burger week' })).toBeInTheDocument()
  })

  it('says what each image links to: Business, Product with the path in mono, or that the link is kept', () => {
    render(grid())
    const caption = (n) => document.getElementById(screen.getByRole('button', { name: `Edit image ${n} of Burger week` }).getAttribute('aria-describedby'))
    expect(caption(1)).toHaveTextContent('Business')
    expect(caption(1).querySelector('.odc-mono')).toHaveTextContent('/store/kcf')
    expect(caption(2)).toHaveTextContent('Product')
    expect(caption(2).querySelector('.odc-mono')).toHaveTextContent('/store/kcf?category=3&product=9')
    expect(caption(3)).toHaveTextContent('Link kept as it is')
    expect(caption(3).querySelector('.odc-mono')).toBeNull()
  })

  it('takes the path of an absolute url', () => {
    render(grid({ images: [{ ...imageBusiness, action: { type: 'business', url: 'https://shop.test/store/kcf' } }] }))
    const tile = screen.getByRole('button', { name: 'Edit image 1 of Burger week' })
    expect(document.getElementById(tile.getAttribute('aria-describedby')).querySelector('.odc-mono')).toHaveTextContent('/store/kcf')
  })

  it('an image with no link has no caption to describe it', () => {
    render(grid({ images: [imageNoLink] }))
    const tile = screen.getByRole('button', { name: 'Edit image 1 of Burger week' })
    expect(tile).not.toHaveAttribute('aria-describedby')
  })

  it('has no videos: only what the controller calls images', () => {
    render(grid({ images: [imageBusiness] }))
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('with no images there is only «Add image» and the muted line', () => {
    render(grid({ images: [] }))
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument()
    expect(screen.getByText('No images yet. Customers see nothing until you add one.')).toBeInTheDocument()
  })

  it('has no empty line when there are images', () => {
    render(grid())
    expect(screen.queryByText(/No images yet/)).toBeNull()
  })

  it('a tile opens the dialog with that image and the position, and the handlers', async () => {
    const user = userEvent.setup()
    render(grid())
    expect(mocks.dialogProps.open).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Edit image 2 of Burger week' }))
    expect(screen.getByRole('dialog', { name: 'Image dialog' })).toBeInTheDocument()
    expect(mocks.dialogProps.open).toBe(true)
    expect(mocks.dialogProps.image).toBe(imageProduct)
    expect(mocks.dialogProps.bannerId).toBe(7)
    expect(mocks.dialogProps.position).toBe(webPage)
    expect(mocks.dialogProps.handleDeleteBannerItem).toBe(mocks.handlers.handleDeleteBannerItem)
    expect(mocks.dialogProps.handleUpdateBannerItem).toBe(mocks.handlers.handleUpdateBannerItem)
    expect(mocks.dialogProps.handleSuccessBannerItemAdd).toBe(mocks.handlers.handleSuccessBannerItemAdd)
  })

  it('«Add image» opens it with null (add)', async () => {
    const user = userEvent.setup()
    render(grid())
    await user.click(screen.getByRole('button', { name: 'Add image' }))
    expect(mocks.dialogProps.open).toBe(true)
    expect(mocks.dialogProps.image).toBeNull()
  })

  it('closing returns the focus to the tile that opened it', async () => {
    const user = userEvent.setup()
    render(grid())
    await user.click(screen.getByRole('button', { name: 'Edit image 2 of Burger week' }))
    await user.click(screen.getByRole('button', { name: 'close image dialog' }))
    expect(mocks.dialogProps.open).toBe(false)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit image 2 of Burger week' })).toHaveFocus())
  })

  it('and to «Add image» when it was the one that opened it', async () => {
    const user = userEvent.setup()
    render(grid())
    await user.click(screen.getByRole('button', { name: 'Add image' }))
    await user.click(screen.getByRole('button', { name: 'close image dialog' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add image' })).toHaveFocus())
  })

  it('and to «Add image» when the image it opened is gone (it was deleted)', async () => {
    const user = userEvent.setup()
    const view = render(grid())
    await user.click(screen.getByRole('button', { name: 'Edit image 2 of Burger week' }))
    view.rerender(grid({ images: [imageBusiness, imageOther, imageNoLink] }))
    await user.click(screen.getByRole('button', { name: 'close image dialog' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add image' })).toHaveFocus())
  })

  // decision 12: a custom clickable thing gets the same reach rule as P/product.css `.odc-btn::after`
  it('a tile reaches 44px on a phone and with a coarse pointer, by a pseudo-element (the stylesheet carries the rule)', () => {
    const css = readFileSync(path.join(__dirname, '..', 'banner-panel.css'), 'utf8')
    const query = css.match(/@media \(pointer: coarse\), \(max-width: 767px\) \{([\s\S]*?)\n\}/)
    expect(query).not.toBeNull()
    expect(query[1]).toMatch(/\.odc-banners-tile::after\s*\{[^}]*inset:\s*var\(--od-x-target-inset\)/)
    expect(css).toMatch(/\.odc-banners-tile\s*\{[^}]*position:\s*relative/)
  })
})
