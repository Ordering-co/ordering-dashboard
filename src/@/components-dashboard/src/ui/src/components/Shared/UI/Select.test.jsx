import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./theme', () => ({
  useOrderingUI: () => ({
    style: { '--od-ui-surface': '#fff' },
    dir: 'rtl'
  })
}))

import { Select } from './Select'

const options = [
  { value: 'business', content: 'Business' },
  { value: 'platform', content: 'Platform' },
  { value: 'disabled', content: 'Disabled', disabled: true },
  { value: null, content: 'Unavailable' }
]

describe('Ordering Select T1 contract', () => {
  it('forwards its trigger ref and emits one scalar callback for a changed value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const ref = createRef()

    render(
      <Select
        ref={ref}
        className='recipient-select'
        defaultValue='business'
        options={options}
        onChange={onChange}
      />
    )

    expect(ref.current).toBe(screen.getByRole('combobox', { name: 'Business' }))
    expect(ref.current.closest('[data-slot="select-root"]')).toHaveClass('od-ui', 'recipient-select')
    expect(ref.current.closest('[data-slot="select-root"]')).toHaveAttribute('dir', 'rtl')

    await user.click(ref.current)
    // The popup mounts asynchronously; under a loaded full run it can take longer than one tick.
    await user.click(await screen.findByRole('option', { name: 'Platform' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('platform')
    expect(screen.getByRole('combobox', { name: 'Platform' })).toHaveFocus()
  })

  it('emits once whenever the already-selected option is activated', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Select defaultValue='business' options={options} onChange={onChange} />)

    const trigger = screen.getByRole('combobox', { name: 'Business' })
    await user.click(trigger)
    const selectedOption = screen.getByRole('option', { name: 'Business', hidden: true })
    fireEvent.pointerDown(selectedOption)
    fireEvent.click(selectedOption)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('business')

    trigger.focus()
    await user.keyboard('{Enter}')
    screen.getByRole('option', { name: 'Business', hidden: true }).focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('business')
  })

  it('keeps noSelected display state while repeating the action callback', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Select
        noSelected
        placeholder='Choose recipient'
        options={options}
        onChange={onChange}
      />
    )

    const choosePlatform = async () => {
      await user.click(screen.getByRole('combobox', { name: 'Choose recipient' }))
      const option = screen.getByRole('option', { name: 'Platform', hidden: true })
      fireEvent.pointerDown(option)
      fireEvent.click(option)
    }

    await choosePlatform()
    await choosePlatform()

    expect(onChange).toHaveBeenNthCalledWith(1, 'platform')
    expect(onChange).toHaveBeenNthCalledWith(2, 'platform')
    expect(screen.getByRole('combobox', { name: 'Choose recipient' })).toBeInTheDocument()
  })

  it('keeps disabled roots and disabled or null options inert', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Select isDisabled placeholder='Disabled select' options={options} onChange={onChange} />
    )

    const disabledTrigger = screen.getByRole('combobox', { name: 'Disabled select' })
    expect(disabledTrigger).toBeDisabled()
    await user.click(disabledTrigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    rerender(<Select placeholder='Choose recipient' options={options} onChange={onChange} />)
    await user.click(screen.getByRole('combobox', { name: 'Choose recipient' }))
    fireEvent.click(screen.getByRole('option', { name: 'Disabled', hidden: true }))
    fireEvent.click(screen.getByRole('option', { name: 'Unavailable', hidden: true }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('preserves notAsync display state across defaultValue updates', () => {
    const { rerender } = render(
      <Select notAsync defaultValue='business' options={options} onChange={vi.fn()} />
    )

    expect(screen.getByRole('combobox', { name: 'Business' })).toBeInTheDocument()
    rerender(<Select notAsync defaultValue='platform' options={options} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Business' })).toBeInTheDocument()
  })
})
