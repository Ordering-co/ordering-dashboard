/* eslint-disable import/first */
// redesign CA-B6 (decisions 1, 4 and 5; M-CA3, M-CA4, M-CA8, M-CA10, M-CA11; auditor #7, #18): the campaign panel. K/CampaignDetail is a stub
// that gives the UI the state a test sets (and records what the panel passed it); the create form (CA-B5) is a stub that follows its
// documented render-prop contract (`{ body, footer, dirty }`), so the panel's wiring is what is under test; the legacy detail (main's
// `M/CampaignDetail`, mounted for a campaign without `status`) is a stub that records its props. RecordPanel, Menu, Switch, ConfirmDialog,
// AlertDialog and EmptyState are the real Product wrappers, and so are CampaignView and campaignData. Nothing is ever sent.
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isAddMode: false,
  campaignState: null,
  controllerProps: null,
  controllerMounts: 0,
  handleDeleteCampaign: null,
  formProps: null,
  legacyProps: null,
  editor: (React, channel, props) => React.createElement('div', { 'data-testid': `preview-${channel}`, 'data-preview-only': String(!!props.previewOnly) }),
  parseDate: (date, options = {}) => `D[${String(date).slice(0, options.dateOnly ? 10 : 16)}]`
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        isAddMode={mocks.isAddMode}
        campaignState={mocks.campaignState}
        formState={{ loading: false, changes: {}, error: null }}
        contactState={{ loading: false, changes: { contact_type: mocks.campaignState?.campaign?.contact_type, contact_data: {} }, error: null }}
        audienceState={{ loading: false, audience: 0, error: null }}
        categoryList={{ loading: false, categories: [], error: null }}
        handleDeleteCampaign={mocks.handleDeleteCampaign}
      />
    )
  }
  return {
    CampaignDetail: Controller,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useConfig: () => [{ configs: {} }],
    useUtils: () => [{ parseDate: mocks.parseDate }]
  }
})
vi.mock('../../CampaignDetail', () => ({
  CampaignDetail: (props) => {
    mocks.legacyProps = props
    return <div data-testid='legacy-detail'>{"main's campaign detail"}</div>
  }
}))
vi.mock('../CampaignCreateForm', async () => {
  const React = await import('react')
  return {
    CampaignCreateForm: (props) => {
      mocks.formProps = props
      const [dirty, setDirty] = React.useState(false)
      // as the real form does: it reports its dirty state while it is mounted, on mount included
      React.useEffect(() => { props.onDirtyChange?.(dirty) }, [dirty])
      const body = (
        <div data-testid='form-body'>
          <button type='button' onClick={() => setDirty(true)}>make dirty</button>
        </div>
      )
      const footer = (
        <div data-testid='form-foot'>
          <button type='button' onClick={() => props.onCancel?.()}>Cancel</button>
          <button type='button'>Create campaign</button>
        </div>
      )
      return props.children({ body, footer, dirty })
    }
  }
})
vi.mock('../../CampaignEmail', async () => {
  const React = await import('react')
  return { CampaignEmail: (props) => mocks.editor(React, 'email', props) }
})
vi.mock('../../CampaignSMS', async () => {
  const React = await import('react')
  return { CampaignSMS: (props) => mocks.editor(React, 'sms', props) }
})
vi.mock('../../CampaignNotification', async () => {
  const React = await import('react')
  return { CampaignNotification: (props) => mocks.editor(React, 'notification', props) }
})
vi.mock('../../CampaignWhatsapp', async () => {
  const React = await import('react')
  return { CampaignWhatsapp: (props) => mocks.editor(React, 'whatsapp', props) }
})
vi.mock('../../CampaignPopup', async () => {
  const React = await import('react')
  return { CampaignPopup: (props) => mocks.editor(React, 'popup', props) }
})
vi.mock('../../CampaignWebHook', async () => {
  const React = await import('react')
  return { CampaignWebHook: (props) => mocks.editor(React, 'webhook', props) }
})

import { CampaignPanel } from '../CampaignPanel'

const weekend = {
  id: 13,
  name: 'Weekend offer',
  contact_type: 'notification',
  audience_type: 'dynamic',
  enabled: true,
  status: 'active',
  conditions: [{ id: 1, type: 'orders_count', condition: '>', value: 2 }],
  audience_count: 40,
  sent_count: 30,
  open_count: 7
}
const spring = {
  id: 11,
  name: 'Spring sale',
  contact_type: 'email',
  audience_type: 'fixed',
  status: 'scheduled',
  scheduled_at: '2026-08-01 10:00:00',
  conditions: [],
  audience_count: 20,
  sent_count: 0,
  open_count: 0
}
const oldPromo = { id: 15, name: 'Old promo', contact_type: 'email', audience_type: 'fixed', status: 'ended', conditions: [], audience_count: 100, sent_count: 100, open_count: 40 }
const legacy = { id: 21, name: 'No status yet', contact_type: 'email', audience_type: 'fixed', conditions: [] }

let spies
const list = { campaigns: [weekend, spring, oldPromo], loading: false, error: null }

// The page owns the open/expanded state; this host owns it for the test
const Host = ({ campaign = spring, campaignId = campaign?.id ?? null, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <CampaignPanel
      campaign={campaign}
      campaignId={campaignId}
      campaignList={list}
      handleSuccessAddCampaign={spies.handleSuccessAddCampaign}
      handleSuccessUpdateCampaign={spies.handleSuccessUpdateCampaign}
      handleSuccessDeleteCampaign={spies.handleSuccessDeleteCampaign}
      toggle={{ pendingIds: [], setEnabled: spies.setEnabled, alert: null }}
      onOpenOpens={spies.onOpenOpens}
      onClose={spies.onClose}
      expanded={expanded}
      onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
      {...props}
    />
  )
}

const showing = (campaign) => {
  mocks.campaignState = { campaign, loading: false, error: null }
}

beforeEach(() => {
  mocks.isAddMode = false
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.formProps = null
  mocks.legacyProps = null
  mocks.handleDeleteCampaign = vi.fn().mockResolvedValue({ ok: true, error: null })
  showing(spring)
  spies = {
    handleSuccessAddCampaign: vi.fn(),
    handleSuccessUpdateCampaign: vi.fn(),
    handleSuccessDeleteCampaign: vi.fn(),
    setEnabled: vi.fn(),
    onOpenOpens: vi.fn(),
    onClose: vi.fn(),
    onExpandedChange: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('CampaignPanel wiring to the controller', () => {
  it('mounts K/CampaignDetail with the row, the id and the list handlers, as M/CampaignListing passes them today', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.campaign).toBe(spring)
    expect(props.campaignId).toBe(11)
    expect(props.campaignList).toBe(list)
    expect(props.handleSuccessAddCampaign).toBe(spies.handleSuccessAddCampaign)
    expect(props.handleSuccessUpdateCampaign).toBe(spies.handleSuccessUpdateCampaign)
    expect(props.handleSuccessDeleteCampaign).toBe(spies.handleSuccessDeleteCampaign)
    expect(props.onClose).toBe(spies.onClose)
  })

  it('a new campaign gives the controller an empty record and no id', () => {
    mocks.isAddMode = true
    mocks.campaignState = { campaign: {}, loading: false, error: null }
    render(<Host campaign={{}} campaignId={null} />)
    expect(mocks.controllerProps.campaign).toEqual({})
    expect(mocks.controllerProps.campaignId).toBeNull()
  })

  it('a campaign opened by ?id= gives the controller only the id', () => {
    showing(spring)
    render(<Host campaign={{}} campaignId={11} />)
    expect(mocks.controllerProps.campaign).toEqual({})
    expect(mocks.controllerProps.campaignId).toBe(11)
  })
})

describe('CampaignPanel create mode', () => {
  beforeEach(() => {
    mocks.isAddMode = true
    mocks.campaignState = { campaign: {}, loading: false, error: null }
  })

  it('titles the panel «New campaign» and puts the form body in it and the form footer under it', () => {
    render(<Host campaign={{}} campaignId={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('New campaign')
    expect(screen.getByTestId('form-body').closest('.odc-record-body')).not.toBeNull()
    expect(screen.getByTestId('form-foot').closest('.odc-record-foot')).not.toBeNull()
    // the form gets what the controller gave the UI, and the controller's way out for its own use
    expect(mocks.formProps.formState).toBeDefined()
    expect(mocks.formProps.contactState).toBeDefined()
    expect(mocks.formProps.onClose).toBe(spies.onClose)
    expect(typeof mocks.formProps.onCancel).toBe('function')
    // no read-only view, no menu of a created campaign
    expect(screen.queryByRole('region', { name: 'Channel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('«Open as page» is in the header, as today\'s expand button', async () => {
    const user = userEvent.setup()
    render(<Host campaign={{}} campaignId={null} />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })

  it('«Cancel» closes at once while the form is clean', async () => {
    const user = userEvent.setup()
    render(<Host campaign={{}} campaignId={null} />)
    await user.click(within(screen.getByTestId('form-foot')).getByRole('button', { name: 'Cancel' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('«Cancel» goes through the discard guard when the form is dirty: Keep editing stays, Discard closes (M-CA11)', async () => {
    const user = userEvent.setup()
    render(<Host campaign={{}} campaignId={null} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(within(screen.getByTestId('form-foot')).getByRole('button', { name: 'Cancel' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(dialog).toHaveTextContent('What you changed here is not saved yet.')
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(spies.onClose).not.toHaveBeenCalled()

    await user.click(within(screen.getByTestId('form-foot')).getByRole('button', { name: 'Cancel' }))
    const again = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(again).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  // redesign CA-B6 (coordinator addition): the page asks «Discard your changes?» before it drops a draft, so the panel reports it
  it('reports the dirty state of the form to the page through onDirtyChange', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host campaign={{}} campaignId={null} onDirtyChange={onDirtyChange} />)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('says «clean» again when the panel unmounts with a draft in it', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { unmount } = render(<Host campaign={{}} campaignId={null} onDirtyChange={onDirtyChange} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('says «clean» when the panel leaves create mode, and nothing in view mode', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { rerender } = render(<Host campaign={{}} campaignId={null} onDirtyChange={onDirtyChange} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    mocks.isAddMode = false
    showing(spring)
    rerender(<Host campaign={{}} campaignId={null} onDirtyChange={onDirtyChange} />)
    expect(screen.queryByTestId('form-body')).toBeNull()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    cleanup()

    const viewOnly = vi.fn()
    render(<Host onDirtyChange={viewOnly} />)
    expect(viewOnly).not.toHaveBeenCalled()
  })

  it('works without an onDirtyChange', async () => {
    const user = userEvent.setup()
    render(<Host campaign={{}} campaignId={null} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    expect(screen.getByTestId('form-body')).toBeInTheDocument()
  })

  it('the close button of the header passes the guard too', async () => {
    const user = userEvent.setup()
    render(<Host campaign={{}} campaignId={null} />)
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(spies.onClose).not.toHaveBeenCalled()
  })
})

describe('CampaignPanel view mode', () => {
  it('names the campaign, shows its status as a badge and draws the read-only view', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Spring sale')
    const badge = document.querySelector('.odc-record-status .odc-badge')
    expect(badge).toHaveTextContent('Scheduled')
    expect(badge).toHaveAttribute('data-family', 'pending')
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByRole('region', { name: 'Delivery' })).toHaveTextContent('Scheduled for D[2026-08-01 10:00]')
    expect(screen.getByTestId('preview-email')).toHaveAttribute('data-preview-only', 'true')
    expect(document.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(0)
    expect(screen.queryByTestId('form-body')).toBeNull()
    expect(screen.queryByTestId('legacy-detail')).toBeNull()
  })

  it('has «Open as page» and a ⋯ menu with Delete, and no discard guard: Close closes at once', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a dynamic campaign has the same switch as its row in the header, and it calls toggle.setEnabled', async () => {
    const user = userEvent.setup()
    showing(weekend)
    render(<Host campaign={weekend} />)
    const toggle = screen.getByRole('switch', { name: 'Active, Weekend offer' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveTextContent('Active')
    expect(document.querySelector('.odc-record-status .odc-badge')).toBeNull()
    await user.click(toggle)
    expect(spies.setEnabled).toHaveBeenCalledTimes(1)
    expect(spies.setEnabled.mock.calls[0][0]).toMatchObject({ id: 13, enabled: true })
    expect(spies.setEnabled.mock.calls[0][1]).toBe(false)
  })

  it('the panel shows the value of the row, so the two never disagree (the list has the freshest)', () => {
    showing(weekend) // what the controller loaded, stale
    render(<Host campaign={{ ...weekend, enabled: false }} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveTextContent('Paused')
    expect(screen.getByRole('region', { name: 'Delivery' })).toHaveTextContent('Paused')
  })

  it('a switch whose call is in flight is busy', () => {
    showing(weekend)
    render(<Host campaign={weekend} toggle={{ pendingIds: [13], setEnabled: spies.setEnabled, alert: null }} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-busy', 'true')
  })

  it('an ended campaign shows the Ended badge and its notice', () => {
    showing(oldPromo)
    render(<Host campaign={oldPromo} />)
    expect(document.querySelector('.odc-record-status .odc-badge')).toHaveTextContent('Ended')
    expect(screen.getByRole('status')).toHaveTextContent('Information not editable when campaign has ended')
  })

  it('the opens link of the view calls onOpenOpens with the campaign', async () => {
    const user = userEvent.setup()
    showing(weekend)
    render(<Host campaign={weekend} />)
    await user.click(screen.getByRole('button', { name: '7 opens of Weekend offer' }))
    expect(spies.onOpenOpens).toHaveBeenCalledTimes(1)
    expect(spies.onOpenOpens.mock.calls[0][0]).toMatchObject({ id: 13 })
  })

  it('a campaign opened by ?id= is drawn from what the controller loaded', () => {
    showing(spring)
    render(<Host campaign={{}} campaignId={11} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Spring sale')
    expect(screen.getByRole('region', { name: 'Audience' })).toBeInTheDocument()
  })
})

describe('CampaignPanel delete (decision 5, M-CA4, M-CA10)', () => {
  const openMenu = (user) => user.click(screen.getByRole('button', { name: 'More actions' }))

  it('asks first, names the campaign, focuses Cancel and calls nothing before the confirm', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteCampaign).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.handleDeleteCampaign).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete campaign' }))
    expect(mocks.handleDeleteCampaign).toHaveBeenCalledTimes(1)
  })

  it('an ended campaign can be deleted too (today it never opened)', async () => {
    const user = userEvent.setup()
    showing(oldPromo)
    render(<Host campaign={oldPromo} />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Old promo"?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete campaign' }))
    expect(mocks.handleDeleteCampaign).toHaveBeenCalledTimes(1)
  })

  it('a delete that works leaves the closing to the controller (no alert, the panel does not close itself)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete campaign' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a failed delete says why in an alert and nothing closes', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteCampaign = vi.fn().mockResolvedValue({ ok: false, error: ['The campaign is being sent'] })
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete campaign' }))
    const alert = await screen.findByRole('alertdialog', { name: "The campaign wasn't deleted" })
    expect(alert).toHaveTextContent('The campaign is being sent')
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(spies.handleSuccessDeleteCampaign).not.toHaveBeenCalled()
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failed delete with no reason, or a rejected call, still says something', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteCampaign = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })).getByRole('button', { name: 'Delete campaign' }))
    expect(await screen.findByRole('alertdialog', { name: "The campaign wasn't deleted" })).toHaveTextContent("We couldn't delete this campaign. Try again.")
    cleanup()

    mocks.handleDeleteCampaign = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    await openMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Delete "Spring sale"?' })).getByRole('button', { name: 'Delete campaign' }))
    expect(await screen.findByRole('alertdialog', { name: "The campaign wasn't deleted" })).toHaveTextContent('Network down')
  })
})

describe('CampaignPanel loading and errors (M-CA8)', () => {
  it('shows skeletons, not a half-drawn panel, while the campaign loads', () => {
    mocks.campaignState = { campaign: {}, loading: true, error: null }
    render(<Host campaign={{}} campaignId={11} />)
    const body = screen.getByRole('status', { name: 'Loading' })
    expect(body).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelector('.odc-record-title .odc-skeleton')).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Channel' })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    // the way out stays
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('before the controller starts to load an id it is loading too, not empty', () => {
    mocks.campaignState = { campaign: {}, loading: false, error: null }
    render(<Host campaign={{}} campaignId={11} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('a load error is an alert with the message and Retry, which mounts the controller again', async () => {
    const user = userEvent.setup()
    mocks.campaignState = { campaign: {}, loading: false, error: ['Failed to fetch'] }
    render(<Host campaign={{}} campaignId={11} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this campaign.")
    expect(alert).toHaveTextContent('Failed to fetch')
    expect(mocks.controllerMounts).toBe(1)
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
  })

  it('a load error given as plain text is shown too', () => {
    mocks.campaignState = { campaign: {}, loading: false, error: 'Unauthorized' }
    render(<Host campaign={{}} campaignId={11} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
  })
})

describe('CampaignPanel keeps today\'s detail for a campaign without status (auditor #7)', () => {
  beforeEach(() => showing(legacy))

  it('mounts main\'s M/CampaignDetail inside the panel, with the same props M/CampaignListing gives it, and not the read-only view', () => {
    render(<Host campaign={legacy} />)
    const detail = screen.getByTestId('legacy-detail')
    expect(detail.closest('.odc-record-body')).not.toBeNull()
    expect(mocks.legacyProps.campaign).toMatchObject({ id: 21, name: 'No status yet' })
    expect(mocks.legacyProps.campaignId).toBe(21)
    expect(mocks.legacyProps.campaignList).toBe(list)
    expect(mocks.legacyProps.handleSuccessAddCampaign).toBe(spies.handleSuccessAddCampaign)
    expect(mocks.legacyProps.handleSuccessUpdateCampaign).toBe(spies.handleSuccessUpdateCampaign)
    expect(mocks.legacyProps.handleSuccessDeleteCampaign).toBe(spies.handleSuccessDeleteCampaign)
    expect(mocks.legacyProps.onClose).toBe(spies.onClose)
    expect(screen.queryByRole('region', { name: 'Channel' })).toBeNull()
    expect(screen.queryByTestId('form-body')).toBeNull()
  })

  it('names it in the header and keeps «Open as page»; its own ⋯ Delete is main\'s, so the panel adds none', () => {
    render(<Host campaign={legacy} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No status yet')
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('a campaign opened by ?id= that turns out to have no status gets main\'s detail too', () => {
    render(<Host campaign={{}} campaignId={21} />)
    expect(screen.getByTestId('legacy-detail')).toBeInTheDocument()
    expect(mocks.legacyProps.campaignId).toBe(21)
  })
})

describe('CampaignPanel inside a SplitView', () => {
  it('Escape on a dirty form asks before it closes the panel (M-CA11)', async () => {
    const user = userEvent.setup()
    const original = window.innerWidth
    window.innerWidth = 1400
    mocks.isAddMode = true
    mocks.campaignState = { campaign: {}, loading: false, error: null }
    const { SplitView } = await import('../../../Shared/Product')
    try {
      render(
        <SplitView
          open
          onClose={spies.onClose}
          panelLabel='Campaign'
          resizeLabel='Resize'
          list={<div>list</div>}
          panel={<Host campaign={{}} campaignId={null} />}
        />
      )
      await user.click(screen.getByRole('button', { name: 'make dirty' }))
      await act(async () => { await user.keyboard('{Escape}') })
      await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
      expect(spies.onClose).not.toHaveBeenCalled()
    } finally {
      window.innerWidth = original
    }
  })
})
