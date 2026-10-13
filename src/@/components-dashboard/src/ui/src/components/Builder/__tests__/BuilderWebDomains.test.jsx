import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductDomain: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ({ color, borderRadius, outline, ...props }) => <button {...props} />,
    Input: ReactActual.forwardRef((props, ref) => <input ref={ref} {...props} />)
  }
})
vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, acceptText, onAccept, onCancel, children }) => open
    ? (
      <div role='dialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>Keep</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))

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
  })

  it('copies the CNAME target', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    renderOverview()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy cname.my-sites.app' })) })
    expect(writeText).toHaveBeenCalledWith('cname.my-sites.app')
    expect(within(card()).getByText('Copied')).toBeTruthy()
  })

  it('asks for a domain before sending anything', async () => {
    renderOverview()
    await save()
    expect(state.props.saveDomain).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Enter a domain.')
    expect(screen.getByLabelText('Your domain').getAttribute('aria-invalid')).toBe('true')
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
    expect(within(card()).getByRole('status').textContent).toBe('Setting up')
    expect(within(card()).getByText(/This takes a few minutes, up to about 20/)).toBeTruthy()
    expect(within(card()).getByText(/Keep the CNAME record shop → cname.my-sites.app/)).toBeTruthy()
    expect(within(card()).queryByRole('link', { name: /shop.burgertown.com/ })).toBeNull()
  })

  it('links an active domain and opens the website there', () => {
    renderOverview({ domainState: { loading: false, error: false, domain: domainOf(own('active')) } })
    expect(within(card()).getByText('Active')).toBeTruthy()
    expect(within(card()).getByRole('link', { name: /shop.burgertown.com/ }).getAttribute('href')).toBe('https://shop.burgertown.com')
    expect(screen.getByRole('link', { name: /Open website/ }).getAttribute('href')).toBe('https://shop.burgertown.com')
    expect(screen.getByText(/and at its temporary address/)).toBeTruthy()
  })

  it('explains a failed domain and verifies it again', async () => {
    const verifyDomain = vi.fn(async () => ({ ok: false, errorCodes: ['domain.cname_missing'], cnameTarget: 'cname.my-sites.app', own: null }))
    renderOverview({ verifyDomain, domainState: { loading: false, error: false, domain: domainOf(own('error', 'validation_timeout')) } })
    expect(within(card()).getByText('Not working')).toBeTruthy()
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
    const dialog = screen.getByRole('dialog', { name: 'Remove shop.burgertown.com?' })
    expect(within(dialog).getByText(`It stays online at ${TEMPORARY}. You can add a domain again later.`)).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Remove domain' })) })
    expect(state.props.removeDomain).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', `Removed. Your website stays at ${TEMPORARY}.`)
  })

  it('offers to try again when the domain does not load', () => {
    renderOverview({ domainState: { loading: false, error: true, domain: null } })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state.props.reloadDomain).toHaveBeenCalled()
  })
})
