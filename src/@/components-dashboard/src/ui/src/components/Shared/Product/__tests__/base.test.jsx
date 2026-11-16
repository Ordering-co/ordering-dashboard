import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Inbox } from '../../Icon'
import { Button, IconButton } from '../Button'
import { Checkbox } from '../Checkbox'
import { Avatar, getInitials } from '../Avatar'
import { EmptyState, Skeleton } from '../Feedback'
import { Count, SlaBadge, Status, StatusBadge } from '../Status'

describe('Product Button', () => {
  it('is a native button with its variant and size, type=button by default', async () => {
    const onClick = vi.fn()
    render(<Button variant='primary' size='lg' onClick={onClick}>Accept order</Button>)
    const button = screen.getByRole('button', { name: 'Accept order' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-variant', 'primary')
    expect(button).toHaveAttribute('data-size', 'lg')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps the label while busy and ignores repeated clicks', async () => {
    const onClick = vi.fn()
    render(<Button busy onClick={onClick}>Refund $35.23</Button>)
    const button = screen.getByRole('button', { name: 'Refund $35.23' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  // dropping onClick is not enough, the native submit still fires.
  it('does not submit its form while busy, by click or by Enter', async () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <input aria-label='Card number' />
        <Button type='submit' busy>Add card</Button>
      </form>
    )
    const button = screen.getByRole('button', { name: 'Add card' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    await userEvent.type(screen.getByRole('textbox', { name: 'Card number' }), '4242{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()

    rerender(
      <form onSubmit={onSubmit}>
        <input aria-label='Card number' />
        <Button type='submit'>Add card</Button>
      </form>
    )
    expect(button).not.toHaveAttribute('aria-disabled')
    await userEvent.click(button)
    await userEvent.type(screen.getByRole('textbox', { name: 'Card number' }), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('keeps the aria-disabled of Base UI on a focusable disabled button that is not busy', () => {
    render(<Button disabled focusableWhenDisabled>Cancel</Button>)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not submit a form with several fields by Enter while busy', async () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <input aria-label='Name' />
        <input aria-label='Email' />
        <Button type='submit' busy>Create</Button>
      </form>
    )
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'a@b.co{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('names an icon-only button and refuses one without a label', () => {
    render(<IconButton icon={Inbox} label='Open inbox' />)
    const button = screen.getByRole('button', { name: 'Open inbox' })
    expect(button).toHaveAttribute('title', 'Open inbox')
    expect(button).toHaveAttribute('data-icon-only')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IconButton icon={Inbox} />)).toThrow('IconButton needs a label')
  })
})

describe('Product Status (C5)', () => {
  it('pairs the indicator with the exact status text', () => {
    render(<Status family='progress' label='Driver almost arrived to customer' />)
    const text = screen.getByText('Driver almost arrived to customer')
    const status = text.closest('.odc-status')
    expect(status).toHaveAttribute('data-family', 'progress')
    expect(status.querySelector('.odc-dot')).toHaveAttribute('aria-hidden', 'true')
  })

  it('gives the review family an icon so it never reads as pending', () => {
    const { container } = render(<StatusBadge family='review' label='Order not ready' />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.odc-dot')).toBeNull()
  })

  it('rejects an unknown family or SLA level', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Status family='green' label='x' />)).toThrow('Unknown status family')
    expect(() => render(<SlaBadge level='red' label='x' />)).toThrow('Unknown SLA level')
  })

  it('keeps on-time SLA quiet and fills only risk and late', () => {
    const { container } = render(
      <>
        <SlaBadge level='ok' label='On time' />
        <SlaBadge level='risk' label='Due in 4 min' />
        <SlaBadge level='late' label='Delayed · 12 min' />
      </>
    )
    expect(container.querySelector('[data-level="ok"]')).toHaveClass('odc-sla')
    expect(container.querySelector('[data-level="risk"]')).toHaveClass('odc-badge')
    expect(container.querySelector('[data-level="late"]')).toHaveClass('odc-badge')
    expect(screen.getByText('Delayed · 12 min')).toBeInTheDocument()
  })

  it('reads a count with its meaning', () => {
    render(<Count value={3} attention srLabel='3 pending orders' />)
    expect(screen.getByText('3 pending orders')).toHaveClass('odc-sr-only')
    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Product Avatar (C12)', () => {
  it.each([
    ['Customer Demo', 'CD'],
    ['Mei', 'M'],
    ['  ana   maría  ruiz ', 'AR'],
    ['محمد علي', 'مع'],
    ['', '']
  ])('initials of %j are %j', (name, initials) => {
    expect(getInitials(name)).toBe(initials)
  })

  it('falls back to initials when the photo fails, and to a glyph with no name', () => {
    const { container, rerender } = render(<Avatar name='Grace Okafor' src='https://example.invalid/x.png' />)
    fireEvent.error(container.querySelector('img'))
    expect(screen.getByText('GO')).toBeInTheDocument()
    rerender(<Avatar name='' kind='business' />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.odc-avatar')).toHaveAttribute('aria-hidden', 'true')
  })

  it('is an image with a name only when it stands alone', () => {
    render(<Avatar name='Fast Bite' kind='business' label='Fast Bite' />)
    expect(screen.getByRole('img', { name: 'Fast Bite' })).toHaveAttribute('data-kind', 'business')
  })
})

describe('Product EmptyState and Skeleton (C10)', () => {
  it('announces an error and offers the one way back', () => {
    render(<EmptyState tone='error' icon={Inbox} title='We couldn’t load the orders' description='Check your connection and try again.' action={<Button>Try again</Button>} />)
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the orders')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('does not announce an ordinary empty state', () => {
    render(<EmptyState icon={Inbox} title='No pending orders' />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('draws a decorative line with a token size', () => {
    const { container } = render(<Skeleton size='var(--od-x-avatar)' align='end' />)
    const line = container.querySelector('.odc-skeleton')
    expect(line).toHaveAttribute('aria-hidden', 'true')
    expect(line.getAttribute('style')).toContain('var(--od-x-avatar)')
  })
})

describe('Product Checkbox (C6)', () => {
  it('is a native button with role=checkbox and the three aria-checked states', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<Checkbox label='Select order 13792' onCheckedChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Select order 13792' })
    expect(box.tagName).toBe('BUTTON')
    expect(box).toHaveAttribute('aria-checked', 'false')
    box.focus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<Checkbox label='Select order 13792' checked onCheckedChange={onChange} />)
    expect(box).toHaveAttribute('aria-checked', 'true')
    rerender(<Checkbox label='Select all orders on this page' checked='mixed' onCheckedChange={onChange} />)
    expect(screen.getByRole('checkbox', { name: 'Select all orders on this page' })).toHaveAttribute('aria-checked', 'mixed')
  })

  it('takes its name from visible text when it has children', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked onCheckedChange={onChange}>Driver</Checkbox>)
    await userEvent.click(screen.getByText('Driver'))
    expect(onChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('checkbox', { name: 'Driver' })).toBeInTheDocument()
  })
})
