import React, { createRef, useState } from 'react'
import { configure, fireEvent, getConfig, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('./theme', async importOriginal => ({
  ...await importOriginal(),
  useOrderingUI: () => ({
    style: { '--od-ui-surface': '#fff' },
    dir: 'rtl'
  })
}))

import { Alert, Confirm } from './Confirm'
import { Dialog } from './Dialog'

// fila 48: the focus hand-offs below (Base UI dialogs restoring focus after a transition) are awaited with `waitFor`, whose
// 1 s default and the 5 s test default are both exceeded when the whole suite runs in parallel on a loaded machine (this file is
// 0.1-0.5 s per test alone; reported intermittent in full runs, not reproduced in 4 loaded runs). The tests wait on states, never on time, so only the limits grow;
// a passing wait still returns as soon as its condition holds and every assertion is unchanged.
let previousAsyncUtilTimeout
beforeAll(() => {
  previousAsyncUtilTimeout = getConfig().asyncUtilTimeout
  configure({ asyncUtilTimeout: 10_000 })
})
afterAll(() => {
  configure({ asyncUtilTimeout: previousAsyncUtilTimeout })
})

describe('Ordering Confirm T1 contract', { timeout: 30_000 }, () => {
  it('renders translated array content and keeps accept and cancel independent', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onClose = vi.fn()
    const ref = createRef()

    render(
      <Confirm
        ref={ref}
        open
        title='Disable module?'
        content={['First warning', ['Nested warning']]}
        onAccept={onAccept}
        onCancel={onCancel}
        onClose={onClose}
        width='600px'
      >
        <strong>Stored data remains.</strong>
      </Confirm>
    )

    expect(screen.getByRole('alertdialog')).toBe(ref.current)
    expect(ref.current).toHaveClass('od-ui', 'od-dialog-popup')
    expect(ref.current).toHaveStyle({ width: '600px' })
    expect(ref.current).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText('First warning')).toBeInTheDocument()
    expect(screen.getByText('Nested warning')).toBeInTheDocument()
    expect(screen.getByText('Stored data remains.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('routes close, Escape and backdrop dismissal only to onClose', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onClose = vi.fn()

    const { rerender } = render(
      <Confirm open title='Confirm' onAccept={onAccept} onCancel={onCancel} onClose={onClose} />
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(document.querySelector('.od-dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(3)
    fireEvent.click(document.querySelector('.od-dialog-positioner'))
    expect(onClose).toHaveBeenCalledTimes(4)
    expect(onAccept).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    rerender(
      <Confirm
        open
        closeOnBackdrop={false}
        title='Confirm'
        onAccept={onAccept}
        onCancel={onCancel}
        onClose={onClose}
      />
    )
    fireEvent.click(document.querySelector('.od-dialog-positioner'))
    expect(onClose).toHaveBeenCalledTimes(4)
  })

  it('focuses the close action and restores the detached opener on dismissal', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>Open confirmation</button>
          <Confirm
            open={open}
            title='Confirm'
            onClose={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open confirmation' })
    await user.click(opener)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus())

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('owns simultaneous mixed modality before returning control to the surviving dialog', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [dialogOpen, setDialogOpen] = useState(false)
      const [confirmOpen, setConfirmOpen] = useState(false)
      const [closed, setClosed] = useState([])
      return (
        <>
          <button type='button' onClick={() => {
            setDialogOpen(true)
            setConfirmOpen(true)
          }}>
            Open mixed layers
          </button>
          <Dialog open={dialogOpen} title='Underlying dialog' onClose={() => {
            setClosed(current => [...current, 'dialog'])
            setDialogOpen(false)
          }}>
            <button type='button'>Underlying action</button>
          </Dialog>
          <Confirm open={confirmOpen} title='Top confirmation' onClose={() => {
            setClosed(current => [...current, 'confirm'])
            setConfirmOpen(false)
          }} />
          <output data-testid='mixed-closed'>{JSON.stringify(closed)}</output>
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open mixed layers' })
    await user.click(opener)
    const confirm = await screen.findByRole('alertdialog', { name: 'Top confirmation' })
    const dialog = document.querySelector('[data-od-dialog-owner][aria-label="Underlying dialog"]')
    expect(confirm.closest('[aria-hidden="true"], [inert]')).toBeNull()
    expect(dialog.closest('[aria-hidden="true"], [inert]')).not.toBeNull()
    await waitFor(() => expect(confirm).toContainElement(document.activeElement))

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Top confirmation' })).not.toBeInTheDocument())
    expect(JSON.parse(screen.getByTestId('mixed-closed').textContent)).toEqual(['confirm'])
    await waitFor(() => expect(dialog).toContainElement(document.activeElement))
    expect(dialog.closest('[aria-hidden="true"], [inert]')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
    expect(JSON.parse(screen.getByTestId('mixed-closed').textContent)).toEqual(['confirm', 'dialog'])
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('lets a later nested dialog own focus and Escape before restoring the confirmation', async () => {
    const user = userEvent.setup()
    const confirmClose = vi.fn()

    const Harness = () => {
      const [confirmOpen, setConfirmOpen] = useState(false)
      const [dialogOpen, setDialogOpen] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setConfirmOpen(true)}>Open parent confirmation</button>
          <Confirm
            open={confirmOpen}
            title='Parent confirmation'
            onClose={() => {
              confirmClose()
              setConfirmOpen(false)
            }}
            onCancel={() => {}}
            onAccept={() => {}}
          >
            <button type='button' onClick={() => setDialogOpen(true)}>Open child dialog</button>
            <Dialog open={dialogOpen} title='Later child dialog' onClose={() => setDialogOpen(false)}>
              <div className='popup-dialog'>
                <input aria-label='Child autofocus' autoFocus />
                <button type='button'>Child trailing action</button>
              </div>
            </Dialog>
          </Confirm>
        </>
      )
    }

    render(<Harness />)
    const externalOpener = screen.getByRole('button', { name: 'Open parent confirmation' })
    await user.click(externalOpener)
    const childOpener = await screen.findByRole('button', { name: 'Open child dialog' })
    await user.click(childOpener)
    const child = await screen.findByRole('dialog', { name: 'Later child dialog' })
    const confirm = document.querySelector('.od-dialog-popup[role="alertdialog"]')
    expect(child.closest('[aria-hidden="true"], [inert]')).toBeNull()
    expect(confirm.closest('[aria-hidden="true"], [inert]')).not.toBeNull()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Child autofocus' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Later child dialog' })).not.toBeInTheDocument())
    expect(confirmClose).not.toHaveBeenCalled()
    await waitFor(() => expect(childOpener).toHaveFocus())
    await user.tab()
    await expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab({ shift: true })
    await expect(childOpener).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(confirmClose).toHaveBeenCalledOnce())
    await waitFor(() => expect(externalOpener).toHaveFocus())
  })

  it('exports Alert as the same controlled surface', () => {
    render(<Alert open title='Notice' content='Read this' onClose={vi.fn()} />)
    expect(screen.getByRole('alertdialog', { name: 'Notice' })).toBeInTheDocument()
    expect(screen.getByText('Read this')).toBeInTheDocument()
  })
})
