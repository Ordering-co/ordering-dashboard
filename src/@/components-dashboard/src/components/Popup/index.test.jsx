import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../ui/src/components/Shared/UI/theme', () => ({
  useOrderingUI: () => ({ style: {}, dir: 'ltr' })
}))

import { Popup } from '.'

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const FixtureUI = ({ label, autoFocus }) => (
  <div className='popup-dialog'>
    <div className='dialog-inner'>{label}</div>
    <button type='button' autoFocus={autoFocus}>Fixture action</button>
  </div>
)

describe('Popup Dialog facade', () => {
  it('forwards an explicit accessible label and description without changing default roles', async () => {
    const DescribedUI = () => <div className='popup-dialog'><p id='popup-detail'>Accessible details</p></div>
    const { rerender } = render(
      <Popup open role='alertdialog' aria-label='Explicit alert label' aria-describedby='popup-detail' title='Fallback ignored' UIComponent={DescribedUI} />
    )
    const alert = await screen.findByRole('alertdialog', { name: 'Explicit alert label' })
    expect(alert).toHaveAccessibleDescription('Accessible details')
    rerender(<Popup open title='Default facade dialog' UIComponent={FixtureUI} label='Default content' />)
    expect(await screen.findByRole('dialog', { name: 'Default facade dialog' })).not.toHaveAttribute('aria-describedby')
  })

  it('passes the public UIComponent props through the owned Base UI dialog', async () => {
    render(<Popup open title='Popup fixture' UIComponent={FixtureUI} label='Forwarded content' />)

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Popup fixture' })).toBeInTheDocument())
    expect(screen.getByText('Forwarded content')).toBeInTheDocument()
    expect(document.querySelector('.popup-component > .popup-dialog > .dialog-inner')).toHaveTextContent('Forwarded content')
  })

  it('preserves closeWithKeyboard as an ignored legacy prop and closes once on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Popup
        open
        closeWithKeyboard={false}
        title='Keyboard fixture'
        UIComponent={FixtureUI}
        label='Keyboard content'
        onClose={onClose}
      />
    )

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Keyboard fixture' })).toBeInTheDocument())
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('keeps clicks inside the real UI from dismissing while its backdrop closes once', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Popup open title='Pointer fixture' UIComponent={FixtureUI} label='Inside target' onClose={onClose} />)

    await user.click(await screen.findByRole('button', { name: 'Fixture action' }))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(document.querySelector('.od-dialog-legacy-backdrop'))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('keeps an explicit descendant autofocus target as the initial focus', async () => {
    render(<Popup open title='Autofocus fixture' UIComponent={FixtureUI} label='Autofocus content' autoFocus />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fixture action' })).toHaveFocus())
  })
})
