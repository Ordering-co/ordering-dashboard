/* eslint-disable import/first */
// redesign (lot C, decisions 1, 3, 9, 10 | OP-03, OP-09, OP-10, OP-11, OP-15, OP-17): the panel of a site, a RecordPanel with the
// tabs General and Theme, «Open as page», the ⋯ menu with Delete and the confirmation that names the site. The controller
// (`SiteDetails`) is a stateful stand-in that records what the panel calls; the Product wrappers and the General tab are the real
// ones. The Theme tab (lot D) is stood in by a component that paints its `siteId` and counts its mounts.
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  splitMode: 'split',
  controllerProps: null,
  handleDeleteSite: null,
  themeMounts: 0,
  dictionary: {}
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useSplitView: () => ({ ...actual.useSplitView(), mode: mocks.splitMode }) }
})
vi.mock('../../SiteTheme', async () => {
  const React = await import('react')
  const SiteTheme = ({ siteId }) => {
    React.useEffect(() => { mocks.themeMounts += 1 }, [])
    return <div data-testid='theme-panel'>theme of {String(siteId)}</div>
  }
  return { SiteTheme }
})
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const SiteDetails = ({ UIComponent, site, ...props }) => {
    const [changes, setChanges] = React.useState({})
    mocks.controllerProps = { site, ...props }
    return (
      <UIComponent
        {...props}
        site={site}
        siteState={{ site: site || {}, loading: false, error: null }}
        formState={{ loading: false, changes, error: null }}
        isAddMode={!site}
        handleChangeInput={({ target }) => setChanges(current => ({ ...current, [target.name]: target.value }))}
        handlechangeImage={() => {}}
        handleUpdateSite={async () => ({ error: false, result: {} })}
        handleAddSite={async () => ({ error: false, result: {} })}
        handleDeleteSite={(...args) => mocks.handleDeleteSite(...args)}
        resetChanges={() => setChanges({})}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (key, fallback) => mocks.dictionary[key] ?? fallback],
    useApi: () => [{}, { configurations: { subdomain: 'acme' } }],
    SiteDetails
  }
})

import { OrderingProductDetails } from '../index'

const SITE = { id: 7, name: 'Synthetic Site', code: 'synthetic', url: 'https://synthetic.example.com' }

let spies
const Host = ({ initialTab = 'general', site = SITE, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <OrderingProductDetails
      site={site}
      sitesList={site ? [site] : []}
      initialTab={initialTab}
      onTabChange={spies.onTabChange}
      expanded={expanded}
      onToggleExpanded={() => { spies.onToggleExpanded(); setExpanded(value => !value) }}
      onRequestClose={spies.onRequestClose}
      onClose={spies.onClose}
      {...props}
    />
  )
}

beforeEach(() => {
  mocks.splitMode = 'split'
  mocks.controllerProps = null
  mocks.themeMounts = 0
  mocks.dictionary = {}
  mocks.handleDeleteSite = vi.fn().mockResolvedValue({ error: false, result: {} })
  spies = {
    onTabChange: vi.fn(),
    onToggleExpanded: vi.fn(),
    onRequestClose: vi.fn(),
    onClose: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const tab = (name) => screen.getByRole('tab', { name })
const openDeleteDialog = async (user) => {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  return screen.findByRole('alertdialog')
}

describe('OrderingProductDetails · header', () => {
  it('the title is the name of the site and the subtitle its code, in mono and left to right', () => {
    render(<Host />)

    expect(screen.getByRole('heading', { level: 2, name: 'Synthetic Site' })).toBeInTheDocument()
    const code = screen.getByText('synthetic')
    expect(code).toHaveClass('odc-figure')
    expect(code).toHaveAttribute('dir', 'ltr')
  })

  it('the name takes its own direction', () => {
    render(<Host />)

    expect(screen.getByText('Synthetic Site')).toHaveAttribute('dir', 'auto')
  })

  it('a site without a code shows no subtitle', () => {
    render(<Host site={{ id: 8, name: 'No code' }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'No code' })).toBeInTheDocument()
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
  })

  it('«Close» asks the page (onRequestClose), which sends it through the leave guard', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(spies.onRequestClose).toHaveBeenCalledTimes(1)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('on a phone the way out is «Back» and there is no «Open as page»', () => {
    mocks.splitMode = 'full'
    render(<Host />)

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open as page' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
  })

  it('«Open as page» is a named button that turns into «Back to split view» (OP-10)', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: 'Open as page' }))

    expect(spies.onToggleExpanded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open as page' })).not.toBeInTheDocument()
  })

  it('passes onClose to the controller untouched (it closes without asking after a success)', () => {
    render(<Host />)

    expect(mocks.controllerProps.onClose).toBe(spies.onClose)
    expect(mocks.controllerProps.site).toBe(SITE)
  })
})

describe('OrderingProductDetails · tabs (OP-11, OP-15, OP-17)', () => {
  it('General and Theme are the tabs of a tablist; General is selected and its form is in the panel', () => {
    render(<Host />)

    const list = screen.getByRole('tablist', { name: 'Product sections' })
    expect(within(list).getAllByRole('tab').map(node => node.textContent)).toEqual(['General', 'Theme'])
    expect(tab('General')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Theme')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Synthetic Site')
  })

  it('Theme is not mounted until the tab is pressed, and then it stays mounted', async () => {
    const user = userEvent.setup()
    render(<Host />)

    expect(screen.queryByTestId('theme-panel')).not.toBeInTheDocument()
    expect(mocks.themeMounts).toBe(0)

    await user.click(tab('Theme'))
    expect(screen.getByTestId('theme-panel')).toHaveTextContent('theme of 7')
    expect(tab('Theme')).toHaveAttribute('aria-selected', 'true')

    await user.click(tab('General'))
    expect(screen.getByTestId('theme-panel')).toBeInTheDocument()
    await user.click(tab('Theme'))
    expect(mocks.themeMounts).toBe(1)
  })

  it('tells the page when the tab changes', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(tab('Theme'))
    expect(spies.onTabChange).toHaveBeenLastCalledWith('theme')
    await user.click(tab('General'))
    expect(spies.onTabChange).toHaveBeenLastCalledWith('general')
    expect(spies.onTabChange).toHaveBeenCalledTimes(2)
  })

  it('opens on the tab the page asks for, and mounts Theme at once', () => {
    render(<Host initialTab='theme' />)

    expect(tab('Theme')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('theme-panel')).toBeInTheDocument()
  })

  it.each([undefined, null, '', 'bogus', 'THEME'])('an unknown tab (%s) is General', (initialTab) => {
    render(<Host initialTab={initialTab} />)

    expect(tab('General')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('theme-panel')).not.toBeInTheDocument()
  })

  it('follows the page when it changes the tab (the browser\'s Back)', () => {
    const { rerender } = render(<Host initialTab='general' />)

    rerender(<Host initialTab='theme' />)

    expect(tab('Theme')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('theme-panel')).toBeInTheDocument()
  })

  it('can be moved with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Host />)

    tab('General').focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Enter}')

    expect(tab('Theme')).toHaveAttribute('aria-selected', 'true')
    expect(spies.onTabChange).toHaveBeenLastCalledWith('theme')
  })

  it('General keeps what was written, and its errors, when you go to Theme and come back (OP-17)', async () => {
    const user = userEvent.setup()
    render(<Host />)

    const name = () => screen.getByRole('textbox', { name: /^Name/ })
    await user.clear(name())
    await user.type(name(), 'Renamed')
    await user.click(tab('Theme'))
    await user.click(tab('General'))

    expect(name()).toHaveValue('Renamed')
    expect(screen.getByRole('group', { name: 'Save changes' })).toHaveTextContent('1 unsaved change')

    await user.clear(name())
    await user.click(within(screen.getByRole('group', { name: 'Save changes' })).getByRole('button', { name: /^Save/ }))
    expect(name()).toHaveAttribute('aria-invalid', 'true')
    await user.click(tab('Theme'))
    await user.click(tab('General'))
    expect(name()).toHaveAttribute('aria-invalid', 'true')
  })

  it('adding: no tabs, a title «Add product», only General, and Theme never mounts even if asked for (OP-03, OP-15)', () => {
    render(<Host site={null} initialTab='theme' />)

    expect(screen.getByRole('heading', { level: 2, name: 'Add product' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('theme-panel')).not.toBeInTheDocument()
    expect(mocks.themeMounts).toBe(0)
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('')
    // no subtitle, no Delete, no «Open as page» when there is no site yet
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open as page' })).not.toBeInTheDocument()
  })
})

describe('OrderingProductDetails · Delete (OP-09, decision 9)', () => {
  it('⋯ › Delete asks first with the name, «This can\'t be undone.» and «Delete product»; nothing is deleted yet', async () => {
    const user = userEvent.setup()
    render(<Host />)

    const dialog = await openDeleteDialog(user)

    expect(within(dialog).getByRole('heading', { name: 'Delete Synthetic Site?' })).toBeInTheDocument()
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete product' })).toBeInTheDocument()
    expect(mocks.handleDeleteSite).not.toHaveBeenCalled()
  })

  it('the name goes in as it is, even with a «$&» in it', async () => {
    const user = userEvent.setup()
    render(<Host site={{ ...SITE, name: "Joe's $& Shop" }} />)

    const dialog = await openDeleteDialog(user)

    expect(within(dialog).getByRole('heading', { name: "Delete Joe's $& Shop?" })).toBeInTheDocument()
  })

  it('Cancel closes it and deletes nothing', async () => {
    const user = userEvent.setup()
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(mocks.handleDeleteSite).not.toHaveBeenCalled()
  })

  it('«Delete product» calls the controller with { inlineError: true }, once', async () => {
    const user = userEvent.setup()
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    await waitFor(() => expect(mocks.handleDeleteSite).toHaveBeenCalledTimes(1))
    expect(mocks.handleDeleteSite).toHaveBeenCalledWith({ inlineError: true })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('while it deletes, the button is busy and cannot be pressed again', async () => {
    const user = userEvent.setup()
    let release
    mocks.handleDeleteSite = vi.fn(() => new Promise(resolve => { release = () => resolve({ error: false, result: {} }) }))
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete product' })).toHaveAttribute('aria-busy', 'true'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete product' }))
    expect(mocks.handleDeleteSite).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('a failure closes the question and opens an alert with the reason of the API', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteSite = vi.fn().mockResolvedValue({ error: true, result: ['The site has active products'] })
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    const alert = await screen.findByRole('alertdialog', { name: 'Ordering products' })
    expect(within(alert).getByText('The site has active products')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Delete Synthetic Site?' })).not.toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  // redesign (review r1, Q-10): the text of the API goes through the dictionary, as General, Theme and the list do
  it('the reason of the API is translated by its slug, and an unknown one stays as it came', async () => {
    const user = userEvent.setup()
    mocks.dictionary = { THE_SITE_HAS_ACTIVE_PRODUCTS: 'El sitio tiene productos activos' }
    mocks.handleDeleteSite = vi.fn().mockResolvedValue({ error: true, result: ['The site has active products', 'Something else'] })
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    const alert = await screen.findByRole('alertdialog', { name: 'Ordering products' })
    expect(within(alert).getByText('El sitio tiene productos activos')).toBeInTheDocument()
    expect(within(alert).getByText('Something else')).toBeInTheDocument()
    expect(within(alert).queryByText('The site has active products')).not.toBeInTheDocument()
  })

  it('a request that throws is a failure too, with its message', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteSite = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    const alert = await screen.findByRole('alertdialog', { name: 'Ordering products' })
    expect(within(alert).getByText('Network down')).toBeInTheDocument()
  })

  it('a failure without a message says a text of its own', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteSite = vi.fn().mockResolvedValue({ error: true, result: undefined })
    render(<Host />)

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete product' }))

    const alert = await screen.findByRole('alertdialog', { name: 'Ordering products' })
    expect(within(alert).getByText('The product could not be deleted.')).toBeInTheDocument()
  })
})
