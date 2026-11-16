import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Stepper } from '../Stepper'
import { Summary } from '../Summary'
import { WizardFooter } from '../WizardFooter'
import { Wizard } from '../Wizard'

const steps = [
  { id: 'customer', label: 'Customer', state: 'done' },
  { id: 'business', label: 'Business', state: 'current' },
  { id: 'items', label: 'Items', state: 'pending' },
  { id: 'payment', label: 'Payment', state: 'pending' }
]

describe('Stepper', () => {
  const renderStepper = (props = {}) => render(
    <Stepper
      label='Steps'
      steps={steps}
      doneLabel='Done'
      pendingLabel='Not reached yet'
      onSelect={vi.fn()}
      {...props}
    />
  )

  it('is a named navigation with an ordered list of the steps', () => {
    renderStepper()
    const nav = screen.getByRole('navigation', { name: 'Steps' })
    const items = within(nav).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items.map(item => item.textContent)).toEqual([
      expect.stringContaining('Customer'),
      expect.stringContaining('Business'),
      expect.stringContaining('Items'),
      expect.stringContaining('Payment')
    ])
    expect(nav.querySelector('ol')).not.toBeNull()
  })

  it('marks only the current step with aria-current="step"', () => {
    renderStepper()
    const current = document.querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0].closest('li')).toHaveTextContent('Business')
  })

  it('makes done steps buttons that go back, and pending steps plain text that cannot be skipped', async () => {
    const onSelect = vi.fn()
    renderStepper({ onSelect })
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: /Customer/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Items/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Payment/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Business/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Customer/ }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('says the state in words, never only in the marker', () => {
    renderStepper()
    expect(screen.getByRole('button', { name: 'Customer, Done' })).toBeInTheDocument()
    expect(screen.getAllByText('Not reached yet')).toHaveLength(2)
  })
})

describe('WizardFooter', () => {
  const renderFooter = (props = {}) => render(
    <WizardFooter
      backLabel='Back'
      continueLabel='Continue'
      onBack={vi.fn()}
      onContinue={vi.fn()}
      {...props}
    />
  )

  it('hides Back on the first step', () => {
    renderFooter({ showBack: false })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('shows Back as the secondary action and calls its handler', async () => {
    const onBack = vi.fn()
    renderFooter({ showBack: true, onBack })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('data-variant', 'secondary')
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('data-variant', 'primary')
  })

  it('disables Continue with the reason in view and linked by aria-describedby', () => {
    const onContinue = vi.fn()
    renderFooter({ continueDisabled: true, reason: 'Pick a business', onContinue })
    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeDisabled()
    expect(screen.getByText('Pick a business')).toBeVisible()
    expect(button).toHaveAccessibleDescription('Pick a business')
  })

  it('shows no reason when Continue is enabled', async () => {
    const onContinue = vi.fn()
    renderFooter({ continueDisabled: false, reason: 'Pick a business', onContinue })
    expect(screen.queryByText('Pick a business')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('shows no primary action when there is none (the payment step owns it)', () => {
    renderFooter({ showBack: true, continueLabel: null })
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
  })

  it('keeps the busy primary from repeating the action', async () => {
    const onContinue = vi.fn()
    renderFooter({ busy: true, onContinue })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).not.toHaveBeenCalled()
  })
})

describe('Summary', () => {
  const blocks = [
    { id: 'customer', label: 'Customer', lines: ['Ana Perez', '5550001111'], step: 0 },
    { id: 'address', label: 'Address', lines: ['1 Main St'], step: 0 },
    { id: 'type', label: 'Delivery type', lines: null, step: 1 },
    { id: 'business', label: 'Business', lines: null, step: 1 },
    { id: 'items', label: 'Items', lines: null, step: 2 }
  ]
  const renderSummary = (props = {}) => render(
    <Summary
      label='Order summary'
      editLabel='Edit'
      notSetLabel='Not set yet'
      totalLabel='Total'
      total={null}
      blocks={blocks}
      onEdit={vi.fn()}
      {...props}
    />
  )

  it('is a region with a name', () => {
    renderSummary()
    expect(screen.getByRole('region', { name: 'Order summary' })).toBeInTheDocument()
  })

  it('shows what is chosen and says "Not set yet" for what is missing', () => {
    renderSummary()
    const region = screen.getByRole('region', { name: 'Order summary' })
    expect(within(region).getByText('Ana Perez')).toBeInTheDocument()
    expect(within(region).getByText('5550001111')).toBeInTheDocument()
    expect(within(region).getByText('1 Main St')).toBeInTheDocument()
    expect(within(region).getAllByText('Not set yet')).toHaveLength(4) // type, business, items, total
  })

  it('offers Edit only on blocks that have data and jumps to the block step', async () => {
    const onEdit = vi.fn()
    renderSummary({ onEdit })
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Edit Customer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Address' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Business' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Address' }))
    expect(onEdit).toHaveBeenCalledWith(0)
  })

  it('shows the total when there is one', () => {
    renderSummary({ total: '$25.00' })
    expect(screen.getByText('$25.00')).toBeInTheDocument()
  })

  it('folds on small screens through a disclosure button', async () => {
    renderSummary({ total: '$25.00' })
    const toggle = screen.getByRole('button', { name: /Order summary/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls')
    await userEvent.setup().click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Wizard layout', () => {
  const renderWizard = (props = {}) => render(
    <Wizard
      stepperLabel='Steps'
      doneLabel='Done'
      pendingLabel='Not reached yet'
      steps={steps}
      current={1}
      onSelectStep={vi.fn()}
      title='Business'
      summary={<p>summary slot</p>}
      footer={<button type='button'>footer action</button>}
      {...props}
    >
      <p>step content</p>
    </Wizard>
  )

  it('renders the step title as a heading, the step content and the summary', () => {
    renderWizard()
    expect(screen.getByRole('heading', { level: 3, name: 'Business' })).toBeInTheDocument()
    expect(screen.getByText('step content')).toBeInTheDocument()
    expect(screen.getByText('summary slot')).toBeInTheDocument()
  })

  it('does not steal focus on the first render', () => {
    renderWizard()
    expect(screen.getByRole('heading', { name: 'Business' })).not.toHaveFocus()
  })

  it('moves focus to the step title when the step changes', async () => {
    const { rerender } = renderWizard()
    rerender(
      <Wizard
        stepperLabel='Steps'
        doneLabel='Done'
        pendingLabel='Not reached yet'
        steps={steps}
        current={2}
        onSelectStep={vi.fn()}
        title='Items'
        summary={<p>summary slot</p>}
        footer={<button type='button'>footer action</button>}
      >
        <p>step content</p>
      </Wizard>
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Items' })).toHaveFocus())
  })

  it('draws the footer inline when there is no host (standalone use)', () => {
    renderWizard()
    expect(screen.getByRole('button', { name: 'footer action' })).toBeInTheDocument()
  })

  it('moves the footer into the host when there is one, and waits while the host is not ready', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const { rerender } = renderWizard({ footerHost: null })
    expect(screen.queryByRole('button', { name: 'footer action' })).not.toBeInTheDocument()
    rerender(
      <Wizard
        stepperLabel='Steps'
        doneLabel='Done'
        pendingLabel='Not reached yet'
        steps={steps}
        current={1}
        onSelectStep={vi.fn()}
        title='Business'
        summary={null}
        footer={<button type='button'>footer action</button>}
        footerHost={host}
      >
        <p>step content</p>
      </Wizard>
    )
    expect(within(host).getByRole('button', { name: 'footer action' })).toBeInTheDocument()
    host.remove()
  })
})
