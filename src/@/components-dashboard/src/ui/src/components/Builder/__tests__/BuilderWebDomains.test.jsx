import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductDomain: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
}))
// redesign B2: the Domains card no longer imports `../../../styles` nor `../../Shared`: no mocks for them

import { BuilderWebOverview } from '../BuilderProductDetail/BuilderWebOverview'

const TEMPORARY = 'fleet-mountain-7zoeit-stores.my-sites.app'
const web = { id: 43, name: 'Burger Town online', kind: 'web', product_type: 'marketplace_website', product_status: 'draft', domain: null, temporal_domain: TEMPORARY }
const domainOf = (own = null) => ({ temporal_domain: TEMPORARY, cname_target: 'cname.my-sites.app', own })
const own = (status, errorCode = null) => ({ name: 'shop.burgertown.com', status, error_code: errorCode })

const renderOverview = (extra = {}) => {
  state.props = {
    domainState: { loading: false, error: false, domain: domainOf() },
    domainAction: null,
    reloadDomain: vi.fn(),
    saveDomain: vi.fn(async () => ({ ok: true, errorCodes: [], cnameTarget: null, own: own('pending') })),
    removeDomain: vi.fn(async () => ({ ok: true, errorCodes: [], cnameTarget: null, own: null })),
    verifyDomain: vi.fn(async () => ({ ok: true, errorCodes: [], cnameTarget: null, own: own('pending') })),
    ...extra
  }
  return renderWithProviders(<BuilderWebOverview product={web} />)
}

const card = () => screen.getByRole('region', { name: 'Domains' })
const type = (value) => fireEvent.change(screen.getByLabelText(/domain/i, { selector: 'input' }), { target: { value } })
const save = async (name = 'Save domain') => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }

describe('Own domain of a website', () => {
  beforeEach(() => { state.showToast.mockReset() })

  it('explains how to add a domain, with the record to copy, and keeps the temporary one', () => {
    renderOverview()
    expect(screen.getByText(/You can add your own domain below/)).toBeTruthy()
    expect(within(card()).getByRole('heading', { name: 'Use your own domain' })).toBeTruthy()
    expect(within(card()).getByText('Create a CNAME record')).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Copy cname.my-sites.app' })).toBeTruthy()
    expect(within(card()).getByText('Temporary address')).toBeTruthy()
    expect(within(card()).getByRole('link', { name: new RegExp(TEMPORARY) }).getAttribute('href')).toBe(`https://${TEMPORARY}`)
    expect(within(card()).getByRole('link', { name: new RegExp(TEMPORARY) }).getAttribute('target')).toBe('_blank')
    expect(within(card()).getByRole('button', { name: `Copy ${TEMPORARY}` })).toBeTruthy()
    // redesign B2: «Go to Domains» moves the focus to this heading
    expect(within(card()).getByRole('heading', { name: 'Domains' }).getAttribute('tabindex')).toBe('-1')
    expect(within(card()).getByRole('heading', { name: 'Domains' }).id).toBe('builder-web-domains')
  })

  it('copies the CNAME target', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    renderOverview()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy cname.my-sites.app' })) })
    expect(writeText).toHaveBeenCalledWith('cname.my-sites.app')
    // redesign C: P/CopyButton keeps both words in the button and announces «Copied» in its own status
    expect(within(card()).getByRole('button', { name: 'Copy cname.my-sites.app' })).toHaveAttribute('data-copied', 'true')
    expect(within(card()).getAllByRole('status').map(node => node.textContent)).toContain('Copied')
  })

  it('asks for a domain before sending anything', async () => {
    renderOverview()
    await save()
    expect(state.props.saveDomain).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Enter a domain.')
    expect(screen.getByLabelText('Your domain').getAttribute('aria-invalid')).toBe('true')
    // redesign B2: a P/TextField whose error is linked to the field
    expect(screen.getByLabelText('Your domain').classList.contains('odc-field-input')).toBe(true)
    expect(screen.getByLabelText('Your domain')).toHaveAccessibleDescription('Enter a domain.')
  })

  it('helps with the field and its steps before anything is sent', () => {
    renderOverview()
    const field = screen.getByLabelText('Your domain')
    expect(field.getAttribute('placeholder')).toBe('www.yourbrand.com')
    expect(field).toHaveAccessibleDescription('The full subdomain, like shop.yourbrand.com. You can paste the whole address.')
    expect(within(card()).getByText('Wait until your provider saves it.')).toBeTruthy()
    expect(within(card()).getByText('Enter your domain here and save.')).toBeTruthy()
    // redesign B2: Product buttons
    expect(screen.getByRole('button', { name: 'Save domain' }).getAttribute('data-variant')).toBe('primary')
  })

  it('locks saving while the domain is being saved', () => {
    renderOverview({ domainAction: 'save' })
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
  })

  it('shows a skeleton while the domain loads', () => {
    renderOverview({ domainState: { loading: true, error: false, domain: null } })
    const busy = card().querySelector('[aria-busy="true"]')
    expect(busy.querySelector('.odc-skeleton')).toBeTruthy()
    expect(screen.queryByLabelText('Your domain')).toBeNull()
  })

  it('saves the domain as typed and says it is being set up', async () => {
    renderOverview()
    type('https://Shop.Burgertown.com/')
    await save()
    expect(state.props.saveDomain).toHaveBeenCalledWith('https://Shop.Burgertown.com/')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. We’re setting up shop.burgertown.com; it takes a few minutes.')
  })

  it('repeats the record to create when the CNAME is missing', async () => {
    renderOverview({ saveDomain: vi.fn(async () => ({ ok: false, errorCodes: ['domain.cname_missing'], cnameTarget: 'cname.my-sites.app', own: null })) })
    type('shop.burgertown.com')
    await save()
    expect(screen.getByRole('alert').textContent).toBe('We couldn’t find a CNAME record for shop.burgertown.com.')
    expect(screen.getByRole('heading', { name: 'Create this record in your domain’s DNS, then save again' })).toBeTruthy()
    expect(screen.getByText('shop')).toBeTruthy()
    expect(screen.getByText(/Some providers ask for the full name, shop.burgertown.com/)).toBeTruthy()
  })

  it('suggests www for a root domain', async () => {
    renderOverview({ saveDomain: vi.fn(async () => ({ ok: false, errorCodes: ['domain.cname_missing'], cnameTarget: 'cname.my-sites.app', own: null })) })
    type('burgertown.com')
    await save()
    expect(screen.getByRole('alert').textContent).toBe('burgertown.com is a root domain, and a root domain can’t have a CNAME record.')
    fireEvent.click(screen.getByRole('button', { name: 'Use www.burgertown.com' }))
    expect(screen.getByLabelText('Your domain').value).toBe('www.burgertown.com')
    expect(document.activeElement).toBe(screen.getByLabelText('Your domain'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says a taken domain under the field and a support one in a banner', async () => {
    const saveDomain = vi.fn()
      .mockResolvedValueOnce({ ok: false, errorCodes: ['domain.taken'], cnameTarget: null, own: null })
      .mockResolvedValueOnce({ ok: false, errorCodes: ['domain.unsupported'], cnameTarget: null, own: null })
    renderOverview({ saveDomain })
    type('shop.burgertown.com')
    await save()
    expect(screen.getByRole('alert').textContent).toBe('This domain is already used by another website.')
    await save()
    expect(screen.getByRole('alert').textContent).toBe('This website’s domain is managed by support. Contact support to change it.')
    expect(screen.queryByLabelText('Your domain')).toBeNull()
  })

  it('shows a domain being set up, with the record to keep', () => {
    renderOverview({ domainState: { loading: false, error: false, domain: domainOf(own('pending')) } })
    // redesign C: each P/CopyButton has its own (empty) status region beside the domain's
    expect(within(card()).getAllByRole('status').map(node => node.textContent)).toContain('Setting up')
    // redesign B2: the state is a P/StatusBadge
    expect(within(card()).getByText('Setting up').closest('.odc-badge').getAttribute('data-family')).toBe('progress')
    expect(within(card()).getByText(/This takes a few minutes, up to about 20/)).toBeTruthy()
    expect(within(card()).getByText(/Keep the CNAME record shop → cname.my-sites.app/)).toBeTruthy()
    expect(within(card()).queryByRole('link', { name: /shop.burgertown.com/ })).toBeNull()
  })

  it('links an active domain and opens the website there', () => {
    renderOverview({ domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    expect(within(card()).getByText('Active').closest('.odc-badge').getAttribute('data-family')).toBe('done')
    expect(within(card()).getByRole('link', { name: /shop.burgertown.com/ }).getAttribute('href')).toBe('https://shop.burgertown.com')
    expect(screen.getByRole('link', { name: /Open website/ }).getAttribute('href')).toBe('https://shop.burgertown.com')
    expect(screen.getByText(/and at its temporary address/)).toBeTruthy()
  })

  it('explains a failed domain and verifies it again', async () => {
    const verifyDomain = vi.fn(async () => ({ ok: false, errorCodes: ['domain.cname_missing'], cnameTarget: 'cname.my-sites.app', own: null }))
    renderOverview({ verifyDomain, domainState: { loading: false, error: false, domain: domainOf(own('error', 'validation_timeout')) } })
    expect(within(card()).getByText('Not working').closest('.odc-badge').getAttribute('data-family')).toBe('cancel')
    expect(within(card()).getByText('Your website keeps opening at its temporary address.')).toBeTruthy()
    expect(within(card()).getByRole('heading', { name: 'We couldn’t verify shop.burgertown.com in time' })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify again' })) })
    expect(verifyDomain).toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('The CNAME record for shop.burgertown.com still isn’t there. Check it in your provider and try again in a few minutes.')
  })

  it('warns before changing the domain and goes back on cancel', async () => {
    renderOverview({ domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByText(/When you save, shop.burgertown.com stops opening your website/)).toBeTruthy()
    type('order.burgertown.com')
    await save('Save new domain')
    expect(state.props.saveDomain).toHaveBeenCalledWith('order.burgertown.com')

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('New domain')).toBeNull()
  })

  it('removes the domain after confirming', async () => {
    renderOverview({ domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    // redesign B2: a P/ConfirmDialog (alertdialog)
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove shop.burgertown.com?' })
    expect(within(dialog).getByText('Your website stops opening at shop.burgertown.com right away.')).toBeTruthy()
    expect(within(dialog).getByText(`It stays online at ${TEMPORARY}. You can add a domain again later.`)).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Remove domain' })) })
    expect(state.props.removeDomain).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', `Removed. Your website stays at ${TEMPORARY}.`)
  })

  it('keeps the domain when the removal is cancelled, and says when it fails', async () => {
    const removeDomain = vi.fn(async () => ({ ok: false, errorCodes: [], cnameTarget: null, own: null }))
    renderOverview({ removeDomain, domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Remove shop.burgertown.com?' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(removeDomain).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await act(async () => { fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Remove shop.burgertown.com?' })).getByRole('button', { name: 'Remove domain' })) })
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t remove the domain. Try again.')
  })

  it('locks the domain actions while one runs', () => {
    renderOverview({ domainAction: 'remove', domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    expect(screen.getByRole('button', { name: 'Change' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Removing…' }).disabled).toBe(true)
  })

  it('offers to try again when the domain does not load', () => {
    renderOverview({ domainState: { loading: false, error: true, domain: null } })
    // redesign B2: a P/EmptyState with the error tone (role alert)
    const alert = within(card()).getByRole('alert')
    expect(within(alert).getByText('We couldn’t load your domain')).toBeTruthy()
    expect(alert.classList.contains('odc-state')).toBe(true)
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(state.props.reloadDomain).toHaveBeenCalled()
  })
})
