/* eslint-disable import/first */
// redesign (lot C, decisions 3, 4, 5, 6 | OP-06, OP-08, OP-17): the General tab of a site. Controlled values (no react-hook-form),
// the same 13 fields and checks as `main` (without the /g flag), errors under their field and in the bar, one SaveBar, «Fill from
// Website» with its notices inline, and the leave guard. The controller is a stateful stand-in: `changes` is kept like the real one.
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockApi = vi.hoisted(() => ({ configurations: { subdomain: 'acme' } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: mockApi.configurations }]
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { OrderingProductGeneralDetails } from '../index'

const SITE = {
  id: 7,
  name: 'Acme',
  code: 'acme',
  url: 'https://acme.example.com',
  description: 'The shop',
  header: '',
  logo: '',
  social_share: '',
  business_url_template: '/:business_slug',
  category_url_template: '',
  product_url_template: '/:business_slug/:category_slug/:product_slug',
  cart_url_template: '/cart',
  checkout_url_template: '',
  profile_url_template: '',
  reset_password_url_template: '',
  track_order_url_template: ''
}

const spies = {}
let update
let add

// The controller: `changes` live here, `resetChanges` empties them, a write that works empties them too (as `cleanFormState` does)
// `keepChanges`: a controller that does not empty them after a save, to press Save again on the same draft
const Host = ({ site = SITE, adding = false, sitesList = [], enableAutoFillFromWebsite = false, loading = false, keepChanges = false }) => {
  const [changes, setChanges] = useState({})
  const write = (fn) => async (...args) => {
    const result = await fn(...args)
    if (!result.error && !keepChanges) setChanges({})
    return result
  }
  return (
    <OrderingProductGeneralDetails
      siteState={{ site: adding ? {} : site }}
      formState={{ loading, changes, error: null }}
      isAddMode={adding}
      sitesList={sitesList}
      enableAutoFillFromWebsite={enableAutoFillFromWebsite}
      handleChangeInput={({ target }) => {
        spies.change(target)
        setChanges(current => ({ ...current, [target.name]: target.value }))
      }}
      handlechangeImage={spies.image}
      handleUpdateSite={write(update)}
      handleAddSite={write(add)}
      resetChanges={() => { spies.reset(); setChanges({}) }}
    />
  )
}

const field = (name) => screen.getByRole('textbox', { name })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const save = () => within(saveBar()).getByRole('button', { name: /^Save/ })
const type = async (user, name, value) => {
  const input = field(name)
  await user.clear(input)
  if (value) await user.type(input, value)
}
const run = async (fn) => {
  let result
  await act(async () => { result = await fn() })
  return result
}
const noticeOf = (text) => screen.getByText(text).closest('[role="status"]')
const errorOf = (name) => {
  const input = field(name)
  const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
  return ids.map(id => document.getElementById(id)).find(node => node?.getAttribute('role') === 'alert') ?? null
}

beforeEach(() => {
  update = vi.fn(async () => ({ error: false, result: { id: 7 } }))
  add = vi.fn(async () => ({ error: false, result: { id: 8 } }))
  spies.change = vi.fn()
  spies.image = vi.fn()
  spies.reset = vi.fn()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('General · what the tab shows', () => {
  it('shows the values of the site in the 13 fields', () => {
    render(<Host />)

    expect(field(/^Name/)).toHaveValue('Acme')
    expect(field(/^Code/)).toHaveValue('acme')
    expect(field('URL')).toHaveValue('https://acme.example.com')
    expect(field('Description')).toHaveValue('The shop')
    expect(field('Business url template')).toHaveValue('/:business_slug')
    expect(field('Category url template')).toHaveValue('')
    expect(field('Product url template')).toHaveValue('/:business_slug/:category_slug/:product_slug')
    expect(field('Cart url template')).toHaveValue('/cart')
    for (const name of ['Checkout url template', 'Profile url template', 'Reset password url template', 'Track order url template']) {
      expect(field(name)).toHaveValue('')
    }
    // the three images
    for (const name of ['Choose image Header', 'Choose image Logo', 'Choose image Social share']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('the groups are Basics, Images and URL templates, in that order', () => {
    render(<Host />)

    const titles = screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)
    expect(titles).toEqual(['Basics', 'Images', 'URL templates'])
  })

  it('the formats of each template are visible as a hint, not behind an icon', () => {
    render(<Host />)

    expect(field('Business url template')).toHaveAccessibleDescription(/Available Formats: \/:business_slug · \/store\/:business_slug · \/store\?<any>=:business_slug/)
    expect(field('Category url template')).toHaveAccessibleDescription(/store\/:business_slug\/:category_slug · store\/:category_slug\?<any>=:business_slug · :business_slug\/:category_slug · :category_slug\?<any>=:business_slug/)
    expect(field('Product url template')).toHaveAccessibleDescription(/\/store\/:business_slug\/:category_slug\/:product_slug · .*· \/:business_slug\?<any>=:category_id&<any>=:product_id/)
  })

  it('the header says that a new logo also replaces it', () => {
    render(<Host />)

    expect(screen.getByRole('group', { name: 'Header' })).toHaveAccessibleDescription('A new logo also replaces it.')
  })

  it('a site that has none of the optional values shows empty fields, not «undefined»', () => {
    render(<Host site={{ id: 9, name: 'Bare', code: 'bare' }} />)

    expect(field('URL')).toHaveValue('')
    expect(field('Description')).toHaveValue('')
  })

  it('no bar until the first change', () => {
    render(<Host />)

    expect(saveBar()).not.toBeInTheDocument()
  })
})

describe('General · help notice', () => {
  it('«Contact us» opens the Ordering.co pricing page, and is not shown when adding', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<Host />)

    expect(screen.getByText('Do you need help with the setup?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Contact us' }))
    expect(open).toHaveBeenCalledWith('https://www.ordering.co/pricing/', '_blank', 'noopener,noreferrer')

    cleanup()
    render(<Host adding />)
    expect(screen.queryByText('Do you need help with the setup?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contact us' })).not.toBeInTheDocument()
  })

  it('without a subdomain «Contact us» opens the same page, never www.undefined.com', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockApi.configurations = {}
    try {
      render(<Host />)
      await user.click(screen.getByRole('button', { name: 'Contact us' }))
      expect(open).toHaveBeenCalledWith('https://www.ordering.co/pricing/', '_blank', 'noopener,noreferrer')
    } finally {
      mockApi.configurations = { subdomain: 'acme' }
    }
  })
})

describe('General · editing and the save bar', () => {
  it('writing in a field shows the bar with the count and the name of the field', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.type(field(/^Name/), 'e')

    expect(saveBar()).toHaveTextContent('1 unsaved change')
    expect(saveBar()).toHaveTextContent('Name')
    expect(spies.change).toHaveBeenCalledWith(expect.objectContaining({ name: 'name', value: 'Acmee' }))
  })

  it('counts the fields changed, not the keystrokes, and names them in the order of the form', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.type(field('Cart url template'), 'x')
    await user.type(field(/^Code/), 'x')
    await user.type(field(/^Name/), 'x')
    await user.type(field(/^Name/), 'y')

    expect(saveBar()).toHaveTextContent('3 unsaved changes')
    expect(saveBar()).toHaveTextContent('Name, Code, Cart url template')
  })

  it('a field typed and put back is not a change', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.type(field(/^Name/), '{Backspace}')

    expect(saveBar()).not.toBeInTheDocument()
  })

  it('an image picked is a change named Header, and goes to the controller', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host />)
    const file = new File(['png'], 'h.png', { type: 'image/png' })

    await user.upload(container.querySelectorAll('input[type="file"]')[0], file)

    expect(spies.image).toHaveBeenCalledWith(file, 'header')
  })

  it('Save sends with handleUpdateSite(undefined, { inlineError: true }), then says «Saved»', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith(undefined, { inlineError: true })
    expect(add).not.toHaveBeenCalled()
    await waitFor(() => expect(saveBar()).toHaveTextContent('Saved'))
    expect(within(saveBar()).getByRole('status')).toHaveTextContent('Saved')
  })

  it('Discard calls resetChanges and the bar goes', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))

    expect(spies.reset).toHaveBeenCalledTimes(1)
    expect(saveBar()).not.toBeInTheDocument()
  })

  it('while it saves the fields are off and the bar shows the work', async () => {
    const user = userEvent.setup()
    let release
    update = vi.fn(() => new Promise(resolve => { release = () => resolve({ error: false, result: {} }) }))
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    await waitFor(() => expect(field(/^Name/)).toBeDisabled())
    expect(field('URL')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose image Header' })).toBeDisabled()
    release()
    await waitFor(() => expect(field(/^Name/)).toBeEnabled())
  })

  it('the reason the API gives is in the bar, translated, with «Try again» that sends again', async () => {
    const user = userEvent.setup()
    update = vi.fn().mockResolvedValueOnce({ error: true, result: ['The code is already taken'] })
      .mockResolvedValue({ error: false, result: {} })
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('The code is already taken')
    await user.click(within(saveBar()).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(within(saveBar()).queryByRole('alert')).not.toBeInTheDocument())
  })

  it('an answer without a message says a text of its own', async () => {
    const user = userEvent.setup()
    update = vi.fn(async () => ({ error: true, result: undefined }))
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('The product could not be saved.')
  })

  it('a change clears the old reason', async () => {
    const user = userEvent.setup()
    update = vi.fn(async () => ({ error: true, result: ['Nope'] }))
    render(<Host />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())
    expect(await within(saveBar()).findByRole('alert')).toBeInTheDocument()
    await user.type(field(/^Name/), 'y')

    expect(within(saveBar()).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('General · checks (OP-06): under the field and in the bar, nothing is sent with errors', () => {
  it('Name empty: the error is under Name, the bar says «Fix 1 field to save.» and nothing is sent', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Name/, '')
    await user.click(save())

    expect(errorOf(/^Name/)).toHaveTextContent('The name field is required.')
    expect(field(/^Name/)).toHaveAttribute('aria-invalid', 'true')
    expect(within(saveBar()).getByRole('alert')).toHaveTextContent('Fix 1 field to save.')
    expect(update).not.toHaveBeenCalled()
    // and no modal Alert
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('Code empty is required too', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Code/, '')
    await user.click(save())

    expect(errorOf(/^Code/)).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('an invalid URL is an error under URL', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, 'URL', 'not a url')
    await user.click(save())

    expect(errorOf('URL')).toHaveTextContent('The Url is not a valid URL.')
    expect(update).not.toHaveBeenCalled()
  })

  it('a URL that is fine goes through', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, 'URL', 'https://www.acme.com/shop')
    await user.click(save())

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  })

  it('two errors: the bar says «Fix 2 fields to save.»', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Name/, '')
    await type(user, 'URL', 'nope')
    await user.click(save())

    expect(within(saveBar()).getByRole('alert')).toHaveTextContent('Fix 2 fields to save.')
    expect(errorOf(/^Name/)).toBeInTheDocument()
    expect(errorOf('URL')).toBeInTheDocument()
  })

  it('editing a field with an error checks that field again', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Name/, '')
    await user.click(save())
    expect(errorOf(/^Name/)).toBeInTheDocument()
    await user.type(field(/^Name/), 'B')

    expect(errorOf(/^Name/)).toBeNull()
    expect(field(/^Name/)).not.toHaveAttribute('aria-invalid', 'true')
    expect(within(saveBar()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('an error is not shown until the first save (the checks run on save, as in main)', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Name/, '')

    expect(errorOf(/^Name/)).toBeNull()
  })

  it('Discard takes the errors away too', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, /^Name/, '')
    await user.click(save())
    expect(errorOf(/^Name/)).toBeInTheDocument()
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))

    expect(errorOf(/^Name/)).toBeNull()
    expect(field(/^Name/)).toHaveValue('Acme')
  })

  it.each([
    ['Business url template', '/bad'],
    ['Category url template', 'oops'],
    ['Product url template', '/nothing']
  ])('%s with a wrong format is an error under it', async (name, value) => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, name, value)
    await user.click(save())

    expect(errorOf(name)).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  // No /g: a regex with the flag remembers where it stopped, so the second check of the same text gave the other answer
  it('the templates give the same answer the second time (no /g flag)', async () => {
    const user = userEvent.setup()
    render(<Host keepChanges />)

    await type(user, 'Business url template', '/store/:business_slug')
    await type(user, 'Category url template', 'store/:business_slug/:category_slug')
    await type(user, 'Product url template', '/store/:business_slug/:category_slug/:product_slug')
    await user.click(save())
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    await user.click(save())
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(errorOf('Business url template')).toBeNull()
  })

  it('a wrong template is wrong every time you check it', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, 'Business url template', '/bad')
    await user.click(save())
    expect(errorOf('Business url template')).toBeInTheDocument()
    await user.click(save())
    expect(errorOf('Business url template')).toBeInTheDocument()
    await user.click(save())
    expect(errorOf('Business url template')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('the URL pattern gives the same answer every time too', async () => {
    const user = userEvent.setup()
    render(<Host keepChanges />)

    await type(user, 'URL', 'https://www.acme.com')
    for (let i = 1; i <= 3; i++) {
      await user.click(save())
      await waitFor(() => expect(update).toHaveBeenCalledTimes(i))
    }
  })

  it('the product template must start like the business one (kept as in main)', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await type(user, 'Product url template', '/store/:business_slug/:category_slug/:product_slug')
    await user.click(save())

    expect(errorOf('Product url template')).toHaveTextContent('The product url template do not match with business url template')
    expect(update).not.toHaveBeenCalled()
  })

  it('with a business template and an empty product template the site saves (the field is optional)', async () => {
    const user = userEvent.setup()
    render(<Host site={{ ...SITE, product_url_template: '' }} />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('The product url template do not match with business url template')).not.toBeInTheDocument()
  })

  it('a business template with a query is matched on both sides of the «?»', async () => {
    const user = userEvent.setup()
    render(<Host site={{ ...SITE, business_url_template: '/store?q=:business_slug', product_url_template: '/store/:category_slug/:product_slug?q=:business_slug' }} />)

    await user.type(field(/^Name/), 'x')
    await user.click(save())

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  })
})

describe('General · adding a product (OP-01, OP-03)', () => {
  it('starts empty, saves with handleAddSite(undefined, { inlineError: true }) and names the button «Add product»', async () => {
    const user = userEvent.setup()
    render(<Host adding />)

    expect(field(/^Name/)).toHaveValue('')
    expect(field(/^Code/)).toHaveValue('')
    await user.type(field(/^Name/), 'New')
    await user.type(field(/^Code/), 'new')
    await user.click(within(saveBar()).getByRole('button', { name: 'Add product' }))

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    expect(add).toHaveBeenCalledWith(undefined, { inlineError: true })
    expect(update).not.toHaveBeenCalled()
  })

  // redesign (review r1, Q-06): `handleAddSite` does not sync the header with the logo, so the add must not say it does
  it('the header of the add form does not promise that a new logo replaces it', () => {
    render(<Host adding />)

    expect(screen.getByRole('group', { name: 'Header' })).toBeInTheDocument()
    expect(screen.queryByText('A new logo also replaces it.')).not.toBeInTheDocument()
  })

  // redesign (review r1, Q-05): the add form opens with the focus on Name, not left on the «Add product» that opened it
  it('opens with the focus on Name when adding, and does not take the focus when editing a site', () => {
    const { unmount } = render(<Host adding />)
    expect(field(/^Name/)).toHaveFocus()
    unmount()

    render(<Host />)
    expect(field(/^Name/)).not.toHaveFocus()
  })

  it('the required fields are checked when adding too', async () => {
    const user = userEvent.setup()
    render(<Host adding />)

    await user.type(field(/^Name/), 'New')
    await user.click(within(saveBar()).getByRole('button', { name: 'Add product' }))

    expect(errorOf(/^Code/)).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })
})

describe('General · Fill from Website', () => {
  const WEBSITE = { id: 1, code: 'website', name: 'Website', url: 'https://web.example.com', logo: 'https://cdn.example.test/logo.png', cart_url_template: '/other-cart' }

  it.each([
    ['is shown for a site that is not the website, with the option on', { enableAutoFillFromWebsite: true }, true],
    ['is hidden with the option off', { enableAutoFillFromWebsite: false }, false],
    ['is hidden for the site «website»', { enableAutoFillFromWebsite: true, site: { ...SITE, code: 'website' } }, false],
    ['is hidden when adding', { enableAutoFillFromWebsite: true, adding: true }, false]
  ])('the button %s', (_, props, shown) => {
    render(<Host sitesList={[WEBSITE]} {...props} />)

    const button = screen.queryByRole('button', { name: 'Fill from Website' })
    if (shown) {
      expect(button).toBeInTheDocument()
      // it sits next to the title of the group it fills
      expect(button.closest('.odc-op-section-head')).toHaveTextContent('Images')
    } else {
      expect(button).not.toBeInTheDocument()
    }
  })

  it('fills only what is empty, from the site «website», and the bar counts it', async () => {
    const user = userEvent.setup()
    render(<Host enableAutoFillFromWebsite sitesList={[WEBSITE]} site={{ ...SITE, url: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    expect(field('URL')).toHaveValue('https://web.example.com')
    expect(field('Cart url template')).toHaveValue('/cart') // had a value: kept
    expect(spies.change).toHaveBeenCalledWith({ name: 'url', value: 'https://web.example.com' })
    expect(spies.change).toHaveBeenCalledWith({ name: 'logo', value: 'https://cdn.example.test/logo.png' })
    expect(spies.change).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'cart_url_template' }))
    expect(saveBar()).toHaveTextContent('2 unsaved changes')
    expect(saveBar()).toHaveTextContent('URL, Logo')
  })

  it('without a website site in the list it uses the one stored in the browser', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('website_site_details', JSON.stringify({ id: 1, url: 'https://stored.example.com' }))
    render(<Host enableAutoFillFromWebsite sitesList={[]} site={{ ...SITE, url: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    expect(field('URL')).toHaveValue('https://stored.example.com')
  })

  it('no source: the notice is inline, under the title, and there is no Alert', async () => {
    const user = userEvent.setup()
    render(<Host enableAutoFillFromWebsite sitesList={[]} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    const notice = noticeOf('No source site found to sync from.')
    expect(notice).toHaveAttribute('data-tone', 'info')
    // under the title of Images, not at the top with the help notice
    expect(notice.previousElementSibling).toHaveClass('odc-op-section-head')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(spies.change).not.toHaveBeenCalled()
  })

  it('nothing to fill: says so inline', async () => {
    const user = userEvent.setup()
    render(<Host enableAutoFillFromWebsite sitesList={[{ id: 1, code: 'website' }]} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    expect(noticeOf('Nothing to sync. All fields already have values.')).toBeInTheDocument()
    expect(saveBar()).not.toBeInTheDocument()
  })

  it('a stored site that cannot be read says so inline', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('website_site_details', '{broken')
    render(<Host enableAutoFillFromWebsite sitesList={[]} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    expect(noticeOf('Error parsing website site details')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('a notice goes when the fill works afterwards', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Host enableAutoFillFromWebsite sitesList={[]} site={{ ...SITE, url: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))
    expect(noticeOf('No source site found to sync from.')).toBeInTheDocument()

    window.localStorage.setItem('website_site_details', JSON.stringify({ id: 1, url: 'https://stored.example.com' }))
    rerender(<Host enableAutoFillFromWebsite sitesList={[]} site={{ ...SITE, url: '' }} />)
    await user.click(screen.getByRole('button', { name: 'Fill from Website' }))

    expect(screen.queryByText('No source site found to sync from.')).not.toBeInTheDocument()
  })
})

describe('General · the leave guard (OP-08)', () => {
  it('registers with the host: dirty and its count follow what is written', async () => {
    const user = userEvent.setup()
    const register = vi.fn(() => () => {})
    render(
      <LeaveGuardContext.Provider value={{ register, requestLeave: vi.fn() }}>
        <Host />
      </LeaveGuardContext.Provider>
    )
    const entry = register.mock.calls[0][0].current

    expect(entry.isDirty()).toBe(false)
    await user.type(field(/^Name/), 'x')
    await user.type(field(/^Code/), 'x')

    expect(entry.isDirty()).toBe(true)
    expect(entry.count()).toBe(2)
  })

  it('the guard discards through resetChanges and saves through the same check as the bar', async () => {
    const user = userEvent.setup()
    const register = vi.fn(() => () => {})
    render(
      <LeaveGuardContext.Provider value={{ register, requestLeave: vi.fn() }}>
        <Host />
      </LeaveGuardContext.Provider>
    )
    const entry = register.mock.calls[0][0].current

    await type(user, /^Name/, '')
    expect(await run(() => entry.save())).toEqual({ ok: false }) // the name is required: the guard stays and the bar says why
    expect(update).not.toHaveBeenCalled()
    expect(errorOf(/^Name/)).toBeInTheDocument()

    await user.type(field(/^Name/), 'Z')
    expect(await run(() => entry.save())).toEqual({ ok: true })
    expect(update).toHaveBeenCalledTimes(1)

    await user.type(field(/^Name/), 'Q')
    await run(() => entry.discard())
    expect(spies.reset).toHaveBeenCalledTimes(1)
  })

  it('a failed save through the guard answers { ok: false }', async () => {
    const user = userEvent.setup()
    const register = vi.fn(() => () => {})
    update = vi.fn(async () => ({ error: true, result: ['Nope'] }))
    render(
      <LeaveGuardContext.Provider value={{ register, requestLeave: vi.fn() }}>
        <Host />
      </LeaveGuardContext.Provider>
    )
    const entry = register.mock.calls[0][0].current

    await user.type(field(/^Name/), 'x')

    expect(await run(() => entry.save())).toEqual({ ok: false })
  })
})
