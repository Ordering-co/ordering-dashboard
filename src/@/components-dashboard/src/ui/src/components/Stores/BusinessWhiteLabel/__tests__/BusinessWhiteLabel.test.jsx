/* eslint-disable import/first */
// redesign stores 5.16 (; G5-17, G5-18; decision 6): Store details › White label. Covered: «Create site» asks first
// (P/ConfirmDialog) because the request itself creates the site, and only the dialog's confirm sends it; the muted copy has no
// inline literal colour; a failed load says why (the API message, translated) with «Retry»; with a site the embedded editor
// gets the same props as before (the site name `<store> Web` is data).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({
  confirmCreate: true,
  siteCurrentState: { loading: false, site: null, theme: null, error: null },
  handleConfirmCreate: null,
  handleRetry: null,
  setIsExtendExtraOpen: null,
  website: null,
  refresh: null
}))

// `probe.refresh()` re-renders the stand-in, so the UI gets the new `confirmCreate` / `siteCurrentState` the way the real controller
// hands them over once its state changes.
const controller = vi.hoisted(() => ({
  BusinessWhiteLabel: ({ UIComponent, ...props }) => {
    const [, setTick] = React.useState(0)
    probe.refresh = () => setTick(tick => tick + 1)
    return (
      <UIComponent
        {...props}
        siteCurrentState={probe.siteCurrentState}
        confirmCreate={probe.confirmCreate}
        handleConfirmCreate={(...args) => probe.handleConfirmCreate(...args)}
        handleRetry={(...args) => probe.handleRetry(...args)}
      />
    )
  }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessWhiteLabel: controller.BusinessWhiteLabel
}))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessWhiteLabel: controller.BusinessWhiteLabel
}))
vi.mock('../../../MyProducts/OrderingWebsite', () => ({
  OrderingWebsite: (props) => {
    probe.website(props)
    return <div data-testid='ordering-website'>{props.name}</div>
  }
}))

import { BusinessWhiteLabel } from '../index'

const STORE = { id: 12, name: 'Casa Norte' }

const renderUI = (props = {}) => render(<BusinessWhiteLabel business={STORE} setIsExtendExtraOpen={probe.setIsExtendExtraOpen} {...props} />)

beforeEach(() => {
  probe.confirmCreate = true
  probe.siteCurrentState = { loading: false, site: null, theme: null, error: null }
  probe.handleConfirmCreate = vi.fn().mockResolvedValue(undefined)
  probe.handleRetry = vi.fn()
  probe.setIsExtendExtraOpen = vi.fn()
  probe.website = vi.fn()
})

describe('Store details › White label · create the site', () => {
  it('«Create site» opens a confirmation and does not create anything yet', async () => {
    const user = userEvent.setup()
    renderUI()
    expect(screen.getByRole('heading', { level: 1, name: 'White Label' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Create site' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Create a site for Casa Norte?' })).toBeTruthy()
    expect(dialog.textContent).toMatch(/dedicated white-label site for this store right away/i)
    expect(dialog.textContent).toMatch(/cannot be undone from here/i)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(probe.handleConfirmCreate).not.toHaveBeenCalled()
  })

  it('names the store in <bdi> so a name in another script keeps its direction', async () => {
    const user = userEvent.setup()
    renderUI({ business: { id: 3, name: 'متجر' } })
    await user.click(screen.getByRole('button', { name: 'Create site' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.querySelector('bdi')?.textContent).toBe('متجر')
  })

  it('Cancel closes the dialog and creates nothing', async () => {
    const user = userEvent.setup()
    renderUI()
    await user.click(screen.getByRole('button', { name: 'Create site' }))
    const dialog = await screen.findByRole('alertdialog')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(probe.handleConfirmCreate).not.toHaveBeenCalled()
  })

  it('only the dialog confirm creates the site, once', async () => {
    const user = userEvent.setup()
    renderUI()
    await user.click(screen.getByRole('button', { name: 'Create site' }))
    const dialog = await screen.findByRole('alertdialog')

    await user.click(within(dialog).getByRole('button', { name: 'Create site' }))

    expect(probe.handleConfirmCreate).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog busy while the site is being created', async () => {
    const user = userEvent.setup()
    renderUI()
    await user.click(screen.getByRole('button', { name: 'Create site' }))
    const dialog = await screen.findByRole('alertdialog')
    probe.siteCurrentState = { loading: true, site: null, theme: null, error: null }
    probe.confirmCreate = false
    probe.handleConfirmCreate = vi.fn(() => new Promise(() => {}))

    await user.click(within(dialog).getByRole('button', { name: 'Create site' }))

    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Create site' }).getAttribute('aria-busy')).toBe('true'))
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('Store details › White label · focus after the dialog', () => {
  const openDialog = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Create site' }))
    return screen.findByRole('alertdialog')
  }

  it('after a confirmed create the focus goes to the «Site & theme» heading, since the button it came from is gone', async () => {
    const user = userEvent.setup()
    // like the controller: once the create is confirmed the «Create site» card is replaced by the site card
    probe.handleConfirmCreate = vi.fn(async () => {
      probe.confirmCreate = false
      probe.siteCurrentState = { loading: true, site: null, theme: null, error: null }
      act(() => probe.refresh())
    })
    renderUI()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Create site' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    const heading = screen.getByRole('heading', { level: 2, name: 'Site & theme' })
    expect(heading.getAttribute('tabindex')).toBe('-1')
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })

  it('Cancel gives the focus back to «Create site», which is still there', async () => {
    const user = userEvent.setup()
    renderUI()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create site' })))
  })

  it('a confirm that leaves the «Create site» card in place (the create failed) gives the focus back to its button', async () => {
    const user = userEvent.setup()
    probe.handleConfirmCreate = vi.fn().mockResolvedValue(undefined)
    renderUI()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Create site' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create site' })))
  })
})

describe('Store details › White label · brand', () => {
  it('has no inline style with a literal colour (G5-18)', async () => {
    const { container } = renderUI()
    expect(container.innerHTML).not.toMatch(/#748194/i)
    expect(container.querySelector('[style*="color"]')).toBeNull()
    expect(container.querySelector('[style*="font-size"]')).toBeNull()
  })

  it('mounts as an extended panel and releases it on unmount', () => {
    const { unmount } = renderUI()
    expect(probe.setIsExtendExtraOpen).toHaveBeenLastCalledWith(true)
    unmount()
    expect(probe.setIsExtendExtraOpen).toHaveBeenLastCalledWith(false)
  })
})

describe('Store details › White label · site', () => {
  beforeEach(() => {
    probe.confirmCreate = false
  })

  it('shows the embedded editor with the same props and the «<store> Web» name', () => {
    probe.siteCurrentState = { loading: false, site: { id: 55, code: 'casa' }, theme: { theme_id: 9 }, error: null }
    renderUI()
    expect(screen.getByTestId('ordering-website').textContent).toBe('Casa Norte Web')
    expect(probe.website).toHaveBeenCalledWith(expect.objectContaining({
      forcedSiteId: 55,
      forcedThemeId: 9,
      appId: 'casa',
      name: 'Casa Norte Web',
      business: STORE,
      disableReplaceCode: true,
      // redesign J5 row 52 (ordering-website P-OW3, ): the sections editor, embedded
      layout: 'sections'
    }))
  })

  it('says there is no site when the business has none', () => {
    renderUI()
    expect(screen.getByText('No site available for this business.')).toBeTruthy()
  })

  it('paints a skeleton, not the legacy one, while loading', () => {
    probe.siteCurrentState = { loading: true, site: null, theme: null, error: null }
    const { container } = renderUI()
    expect(container.querySelector('.odc-skeleton')).not.toBeNull()
    expect(container.querySelector('.react-loading-skeleton')).toBeNull()
  })

  it('a failed load says why with the API message and Retry loads again', async () => {
    const user = userEvent.setup()
    probe.siteCurrentState = { loading: false, site: null, theme: null, error: ['Not allowed'] }
    renderUI()

    expect(screen.getByText('Not allowed')).toBeTruthy()
    expect(screen.queryByText('Could not load the site for this business.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(probe.handleRetry).toHaveBeenCalledTimes(1)
  })

  it('a failed load without a message falls back to the generic text', () => {
    probe.siteCurrentState = { loading: false, site: null, theme: null, error: [] }
    renderUI()
    expect(screen.getByText('Could not load the site for this business.')).toBeTruthy()
  })
})
