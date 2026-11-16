/* eslint-disable import/first */
// «Other POS systems». The logos of the setup-call providers (Checkmate 400x62, Deliverect 217x77) are wide wordmarks; they were
// squeezed into the 24x24 box of a POS mark and came out as a line. The wordmark gets a box of its own (auto width up to a maximum,
// fixed maximum height, object-fit: contain); the name is written beside every logo, so the image stays decorative (alt='').
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../Shared/Product', () => ({
  Button: ({ children, ...props }) => <button type='button' {...props}>{children}</button>,
  ConfirmDialog: () => null,
  Skeleton: () => null
}))

import { PosCatalogList } from '../PosCatalogList'

const theme = { images: { general: { ItsaCheckmateLogo: 'https://logo.example/checkmate.png', deliverect: 'https://logo.example/deliverect.png' } } }

const options = [
  { key: 'call:checkmate', kind: 'call', name: 'Checkmate', logoKey: 'ItsaCheckmateLogo', action: 'book_call', href: 'https://calendly.example/call', restricted: false, noteKey: 'POS_MENU_NOTE_SETUP_CALL', noteDefault: 'We set it up with you on a call' },
  { key: 'call:deliverect', kind: 'call', name: 'Deliverect', logoKey: 'deliverect', action: 'book_call', href: 'https://calendly.example/call', restricted: false, noteKey: 'POS_MENU_NOTE_SETUP_CALL', noteDefault: 'We set it up with you on a call' },
  { key: 'integration:7', kind: 'integration', integration: { id: 7, name: 'Square', type: 'pos', logo: 'https://logo.example/square.png' }, action: 'connect', disabled: false }
]

const renderList = () => render(
  <ThemeProvider theme={theme}>
    <PosCatalogList options={options} loading={false} business={{ id: 1 }} integrations={[]} />
  </ThemeProvider>
)

const rowOf = (name) => screen.getByText(name).closest('li')

afterEach(cleanup)

describe('PosCatalogList logos', () => {
  it('gives the setup-call wordmarks their own box and keeps them decorative, since the name is written beside them', () => {
    renderList()
    for (const [name, src] of [['Checkmate', 'https://logo.example/checkmate.png'], ['Deliverect', 'https://logo.example/deliverect.png']]) {
      const logo = within(rowOf(name)).getByRole('presentation', { hidden: true })
      expect(logo).toHaveAttribute('src', src)
      expect(logo).toHaveAttribute('alt', '')
      expect(logo).toHaveClass('psp-logo', 'psp-logo-wordmark')
    }
  })

  it('keeps the square mark of an integration in the small box', () => {
    renderList()
    const logo = within(rowOf('Square')).getByRole('presentation', { hidden: true })
    expect(logo).toHaveClass('psp-logo')
    expect(logo).not.toHaveClass('psp-logo-wordmark')
  })
})

describe('pos-store-panel.css wordmark box', () => {
  const css = readFileSync(resolve(__dirname, '../pos-store-panel.css'), 'utf8')
  const rule = (selector) => {
    const start = css.indexOf(`${selector} {`)
    return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
  }

  it('lets the wordmark size itself up to a maximum instead of forcing the 24px square', () => {
    const wordmark = rule('.psp-logo-wordmark')
    expect(wordmark).toMatch(/inline-size:\s*auto/)
    expect(wordmark).toMatch(/block-size:\s*auto/)
    expect(wordmark).toMatch(/max-inline-size:\s*calc\(var\(--od-x-control-height-lg\)/)
    expect(wordmark).toMatch(/max-block-size:\s*var\(--od-x-control-height-lg\)/)
    expect(wordmark).toMatch(/object-fit:\s*contain/)
  })
})

describe('PosCatalogList Contact us', () => {
  const contactOptions = [
    { key: 'integration:40', kind: 'integration', integration: { id: 40, name: 'Rappi', type: 'sales_channel', logo: 'https://logo.example/rappi.png' }, action: 'contact_us', href: 'https://www.ordering.co/contact/', restricted: false, disabled: false, noteKey: 'SALES_CHANNELS_NOTE_CONTACT_US', noteDefault: 'We check availability and set it up with you' },
    { key: 'integration:42', kind: 'integration', integration: { id: 42, name: 'DoorDash', type: 'sales_channel' }, action: 'install', disabled: false }
  ]

  it('draws a link to the contact page in a new tab, with no Install or Connect button in the row', () => {
    render(
      <ThemeProvider theme={theme}>
        <PosCatalogList options={contactOptions} loading={false} business={{ id: 1 }} integrations={[]} />
      </ThemeProvider>
    )
    const row = within(rowOf('Rappi'))
    const link = row.getByRole('link', { name: 'Contact us · Rappi' })
    expect(link).toHaveAttribute('href', 'https://www.ordering.co/contact/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('Contact us')
    expect(row.queryByRole('button')).toBeNull()
    expect(row.getByText('We check availability and set it up with you')).toBeInTheDocument()
    expect(within(rowOf('DoorDash')).getByRole('button', { name: 'Install DoorDash' })).toBeInTheDocument()
  })
})
