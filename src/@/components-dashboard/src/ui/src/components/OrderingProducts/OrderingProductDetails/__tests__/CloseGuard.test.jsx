/* eslint-disable import/first */
// redesign (review r1, Q-03): one close guard for the whole panel. With General and Theme both unsaved, Esc, the scrim and the
// ✕ must ask about BOTH, and «Save and continue» must save both. The SplitView, the leave-guard host, the dialog, the panel, the General
// tab and the Theme tab are the real ones; only the two controllers (SiteDetails, SiteTheme) and the legacy pieces of Theme (the C18
// select and the color panel) are stand-ins.
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  handleUpdateSite: null,
  handleUpdateSiteTheme: null,
  siteUpdateResult: { error: false, result: {} }
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  ImageCrop: () => null,
  Modal: () => null
}))
vi.mock('../../../Shared/UI/FirstSelect', () => ({
  FirstSelect: ({ options = [], defaultValue, onChange, placeholder, ariaLabel }) => (
    <select
      aria-label={ariaLabel}
      defaultValue={defaultValue == null ? '' : String(defaultValue)}
      onChange={event => onChange(options.find(option => String(option.value) === event.target.value)?.value)}
    >
      <option value=''>{placeholder}</option>
      {options.map(option => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.content?.props ? option.content.props.children : option.content}
        </option>
      ))}
    </select>
  )
}))
vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor }) => <button type='button'>{`swatch ${defaultColor}`}</button>
}))
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const SiteDetails = ({ UIComponent, site, ...props }) => {
    const [changes, setChanges] = React.useState({})
    return (
      <UIComponent
        {...props}
        site={site}
        siteState={{ site: site || {}, loading: false, error: null }}
        formState={{ loading: false, changes, error: null }}
        isAddMode={!site}
        handleChangeInput={({ target }) => setChanges(current => ({ ...current, [target.name]: target.value }))}
        handlechangeImage={() => {}}
        handleUpdateSite={(...args) => mocks.handleUpdateSite(...args)}
        handleAddSite={async () => ({ error: false, result: {} })}
        handleDeleteSite={async () => ({ error: false, result: {} })}
        resetChanges={() => setChanges({})}
      />
    )
  }
  const record = {
    id: 1,
    theme_id: 5,
    theme: {
      values_default: { home: { hidden: false, components: { banner: { title: 'Home banner' } } } },
      structure: { home: { hidden: { value_type: 'boolean' }, components: { banner: { title: { value_type: 'string' } } } } }
    },
    values: {}
  }
  const SiteTheme = ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      siteThemesState={{ loading: false, result: [record], error: null }}
      themesList={{ loading: false, result: [], error: null }}
      actionState={{ loading: false, error: null }}
      selectedTheme={null}
      handleSelectTheme={() => {}}
      handleAssignTheme={async () => ({ error: false, result: {} })}
      handleUpdateSiteTheme={(...args) => mocks.handleUpdateSiteTheme(...args)}
      handleAddThemeGallery={() => {}}
      getSiteTheme={() => {}}
      getThemes={() => {}}
    />
  )
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
    useApi: () => [{}, { configurations: { subdomain: 'acme' } }],
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Info: 'info', Success: 'success', Error: 'error' },
    DragAndDrop: ({ children }) => <div>{children}</div>,
    ExamineClick: ({ children, childRef }) => <div><input type='file' hidden ref={childRef} />{children}</div>,
    SiteDetails,
    SiteTheme
  }
})

import { LeaveDialog, LeaveGuardContext, SplitView, useLeaveGuardHost } from '../../../Shared/Product'
import { OrderingProductDetails } from '../index'

const SITE = { id: 7, name: 'Synthetic Site', code: 'synthetic', url: 'https://synthetic.example.com' }

let closed
const Page = () => {
  const leave = useLeaveGuardHost()
  const [open, setOpen] = useState(true)
  const close = () => { closed(); setOpen(false) }
  return (
    <LeaveGuardContext.Provider value={leave.context}>
      <SplitView
        list={<div>the list</div>}
        panel={open
          ? <OrderingProductDetails site={SITE} sitesList={[SITE]} initialTab='general' onRequestClose={() => leave.requestLeave(close)} onClose={close} />
          : null}
        open={open}
        panelLabel='Synthetic Site'
        resizeLabel='Resize'
        onClose={close}
      />
      <LeaveDialog
        open={leave.dialog.open}
        saving={leave.dialog.saving}
        onKeep={leave.dialog.onKeep}
        onDiscard={leave.dialog.onDiscard}
        onSave={leave.dialog.onSave}
        returnFocus={leave.dialog.returnFocus}
        title='Save your changes?'
        description='You have unsaved changes.'
        keepLabel='Keep editing'
        saveLabel='Save and continue'
        discardLabel='Discard'
        closeLabel='Close'
      />
    </LeaveGuardContext.Provider>
  )
}

// General and Theme, both with unsaved work
const makeBothDirty = async (user) => {
  await user.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
  await user.click(screen.getByRole('tab', { name: 'Theme' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Section' }), 'home')
  await user.click(screen.getByRole('checkbox', { name: 'Hidden' }))
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('min-width'), addEventListener () {}, removeEventListener () {} }))
  closed = vi.fn()
  mocks.handleUpdateSite = vi.fn(async () => ({ error: false, result: {} }))
  mocks.handleUpdateSiteTheme = vi.fn(async () => ({ error: false, result: [] }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.getElementById('app-modals')?.remove()
})

describe('OrderingProductDetails · one close guard for General and Theme (Q-03)', () => {
  it('Esc with both tabs unsaved asks once and «Save and continue» saves General AND Theme', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await makeBothDirty(user)

    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    expect(closed).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1))
    expect(mocks.handleUpdateSite).toHaveBeenCalledTimes(1)
    expect(mocks.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
  })

  it('Esc › Discard drops the work of both tabs and closes', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await makeBothDirty(user)

    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1))
    expect(mocks.handleUpdateSite).not.toHaveBeenCalled()
    expect(mocks.handleUpdateSiteTheme).not.toHaveBeenCalled()
  })

  it('the ✕ asks about both too, and a failed save in one of them keeps the panel open', async () => {
    const user = userEvent.setup()
    mocks.handleUpdateSite = vi.fn(async () => ({ error: true, result: ['Name already taken'] }))
    render(<Page />)
    await makeBothDirty(user)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(mocks.handleUpdateSite).toHaveBeenCalledTimes(1))
    expect(closed).not.toHaveBeenCalled()
  })

  // review r2 (N-02): from the Theme tab, an invalid General stops the save and its tab comes to the front with the error
  it('Esc › «Save and continue» with an invalid General on the Theme tab brings General to the front with its error', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.clear(screen.getByRole('textbox', { name: /^Name/ }))
    await user.click(screen.getByRole('tab', { name: 'Theme' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Section' }), 'home')
    await user.click(screen.getByRole('checkbox', { name: 'Hidden' }))

    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.handleUpdateSite).not.toHaveBeenCalled()
    expect(closed).not.toHaveBeenCalled()
  })

  it('with nothing unsaved, Esc closes at once', async () => {
    const user = userEvent.setup()
    render(<Page />)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1))
  })
})
