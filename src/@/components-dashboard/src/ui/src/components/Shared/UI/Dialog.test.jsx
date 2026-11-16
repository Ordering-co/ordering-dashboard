import React, { createRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./theme', () => ({
  useOrderingUI: () => ({ style: { '--od-ui-surface': '#fff' }, dir: 'rtl' })
}))

vi.mock('../../../../../utils/focusPageStart', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, focusPageStart: vi.fn(actual.focusPageStart) }
})
import { Dialog } from './Dialog'
import { hasActiveDialogLayer } from './dialog-layer'
import { focusPageStart } from '../../../../../utils/focusPageStart'

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Ordering Dialog owner', () => {
  it('lets nonmodal surfaces inspect modality without creating or retaining a host', async () => {
    expect(hasActiveDialogLayer()).toBe(false)
    expect(document.getElementById('app-modals')).toBeNull()
    const { unmount } = render(<Dialog open title='Modal gate'><button>Modal action</button></Dialog>)
    await screen.findByRole('dialog', { name: 'Modal gate' })
    expect(hasActiveDialogLayer()).toBe(true)
    unmount()
    expect(hasActiveDialogLayer()).toBe(false)
    expect(document.getElementById('app-modals')).toBeNull()
  })

  it('links real alert content without erasing the default dialog role when omitted', async () => {
    const { rerender } = render(
      <Dialog open role='alertdialog' aria-labelledby='real-alert-title' aria-describedby='real-alert-description'>
        <div className='popup-dialog'>
          <h2 id='real-alert-title'>A <em>rich</em> title</h2>
          <p id='real-alert-description'>Retained alert message</p>
        </div>
      </Dialog>
    )
    const alert = await screen.findByRole('alertdialog', { name: 'A rich title' })
    expect(alert).toHaveAccessibleDescription('Retained alert message')
    expect(alert).not.toHaveAttribute('aria-label')

    rerender(<Dialog open title='Default dialog'>Default content</Dialog>)
    const dialog = await screen.findByRole('dialog', { name: 'Default dialog' })
    expect(dialog).not.toHaveAttribute('aria-describedby')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
  })

  it('preserves the legacy host and popup topology with a labelled Base UI dialog', async () => {
    const ref = createRef()
    render(
      <Dialog ref={ref} open title='Edit fixture' backdropClassName='fixture-backdrop'>
        <div className='popup-dialog'>
          <div className='dialog-inner'>Dialog content</div>
        </div>
      </Dialog>
    )

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Edit fixture' })).toBe(ref.current))
    const host = document.getElementById('app-modals')
    expect(host).toHaveClass('popup-component-backdrop', 'popup-backdrop', 'fixture-backdrop')
    expect(ref.current).toHaveClass('popup-component', 'od-ui', 'od-dialog-legacy-popup')
    expect(ref.current).toHaveAttribute('dir', 'rtl')
    expect(ref.current.querySelector(':scope > .popup-dialog > .dialog-inner')).toHaveTextContent('Dialog content')
  })

  it('dismisses once through Escape or its owning backdrop and can block backdrop dismissal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = render(<Dialog open title='Dismiss fixture' onClose={onClose}>Content</Dialog>)

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Dismiss fixture' })).toBeInTheDocument())
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    await user.click(document.querySelector('.od-dialog-legacy-backdrop'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))

    rerender(<Dialog open title='Dismiss fixture' closeOnBackdrop={false} onClose={onClose}>Content</Dialog>)
    await user.click(document.querySelector('.od-dialog-legacy-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(3))
  })

  it('keeps an isTopPosition dialog inert to dismissal only while another owned popup is open', async () => {
    const topClose = vi.fn()
    const otherClose = vi.fn()
    const { rerender } = render(
      <>
        <Dialog open title='Other dialog' onClose={otherClose}>Other</Dialog>
        <Dialog open title='Protected dialog' isTopPosition onClose={topClose}>Protected</Dialog>
      </>
    )

    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner][data-open]')).toHaveLength(2))
    const backdrops = document.querySelectorAll('.od-dialog-legacy-backdrop')
    await userEvent.click(backdrops[1])
    expect(topClose).not.toHaveBeenCalled()
    expect(otherClose).not.toHaveBeenCalled()

    rerender(<Dialog open title='Protected dialog' isTopPosition onClose={topClose}>Protected</Dialog>)
    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner][data-open]')).toHaveLength(1))
    await userEvent.click(document.querySelector('.od-dialog-legacy-backdrop'))
    await waitFor(() => expect(topClose).toHaveBeenCalledOnce())
  })

  it('gives modality and Escape ownership to one sibling at a time', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [layers, setLayers] = useState([])
      const [closed, setClosed] = useState([])
      const close = name => {
        setClosed(current => [...current, name])
        setLayers(current => current.filter(layer => layer !== name))
      }
      return (
        <>
          <button type='button' onClick={() => setLayers(['First', 'Second', 'Third'])}>Open siblings</button>
          {layers.map(name => (
            <Dialog key={name} open title={name} onClose={() => close(name)}>
              <button type='button'>{name} action</button>
            </Dialog>
          ))}
          <output data-testid='closed-layers'>{JSON.stringify(closed)}</output>
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open siblings' })
    await user.click(opener)
    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner][data-open]')).toHaveLength(3))

    const popup = name => document.querySelector(`[data-od-dialog-owner][aria-label="${name}"]`)
    const top = popup('Third')
    expect(top.closest('[aria-hidden="true"], [inert]')).toBeNull()
    expect(popup('First').closest('[aria-hidden="true"], [inert]')).not.toBeNull()
    expect(popup('Second').closest('[aria-hidden="true"], [inert]')).not.toBeNull()
    await waitFor(() => expect(top).toContainElement(document.activeElement))

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner][data-open]')).toHaveLength(2))
    expect(JSON.parse(screen.getByTestId('closed-layers').textContent)).toEqual(['Third'])
    await waitFor(() => expect(popup('Second')).toContainElement(document.activeElement))
    expect(popup('Second').closest('[aria-hidden="true"], [inert]')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner][data-open]')).toHaveLength(1))
    expect(JSON.parse(screen.getByTestId('closed-layers').textContent)).toEqual(['Third', 'Second'])
    await waitFor(() => expect(popup('First')).toContainElement(document.activeElement))

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
    expect(JSON.parse(screen.getByTestId('closed-layers').textContent)).toEqual(['Third', 'Second', 'First'])
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('restores forward and reverse tab order after promoting a covered sibling', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [firstOpen, setFirstOpen] = useState(false)
      const [secondOpen, setSecondOpen] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setFirstOpen(true)}>Open first layer</button>
          <Dialog open={firstOpen} title='First layer' onClose={() => setFirstOpen(false)}>
            <div>
              <button type='button' onClick={() => setSecondOpen(true)}>Open second layer</button>
              <button type='button'>First trailing action</button>
            </div>
          </Dialog>
          <Dialog open={secondOpen} title='Second layer' onClose={() => setSecondOpen(false)}>
            <button type='button'>Second action</button>
          </Dialog>
        </>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open first layer' }))
    const openSecond = await screen.findByRole('button', { name: 'Open second layer' })
    await user.click(openSecond)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Second action' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(openSecond).toHaveFocus())
    await user.tab()
    await expect(screen.getByRole('button', { name: 'First trailing action' })).toHaveFocus()
    await user.tab({ shift: true })
    await expect(openSecond).toHaveFocus()
  })

  it('honors an explicit child autofocus target and restores the external opener', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>Open dialog</button>
          <Dialog open={open} title='Focus fixture' onClose={() => setOpen(false)}>
            <div className='popup-dialog'>
              <button type='button' autoFocus>Preferred action</button>
              <button type='button'>Second action</button>
            </div>
          </Dialog>
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(opener)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preferred action' })).toHaveFocus())
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
    await waitFor(() => expect(opener).toHaveFocus())
  })

  // (row 10): a dialog that opens by itself has no opener (the focus was on <body>). Closing it must not leave the focus to
  // fall on the first tabbable of the document («Skip to content»): it goes to the start of the page, as focusPageStart decides.
  describe('with no opener (opened by itself)', () => {
    const shown = element => {
      element.getClientRects = () => [{ width: 1, height: 1 }]
      return element
    }
    const AutoOpen = () => {
      const [open, setOpen] = useState(true)
      return (
        <Dialog open={open} title='Start guide' onClose={() => setOpen(false)}>
          <button type='button'>Guide action</button>
        </Dialog>
      )
    }
    const pages = []
    const pageFixture = markup => {
      const page = document.createElement('div')
      page.innerHTML = markup
      document.body.append(page)
      pages.push(page)
      return page
    }
    afterEach(() => pages.splice(0).forEach(page => page.remove()))

    it('returns the focus to the page h1 when the opener was <body>', async () => {
      const page = pageFixture('<a href="#main-content">Skip to content</a><main><h1>Products</h1></main>')
      const heading = shown(page.querySelector('h1'))
      expect(document.activeElement).toBe(document.body)
      render(<AutoOpen />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Guide action' })).toHaveFocus())

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
      await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
      await waitFor(() => expect(heading).toHaveFocus())
      expect(page.querySelector('a')).not.toHaveFocus()
    })

    it('returns the focus to main when the page has no h1', async () => {
      const page = pageFixture('<a href="#main-content">Skip to content</a><main>Content</main>')
      const main = shown(page.querySelector('main'))
      render(<AutoOpen />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Guide action' })).toHaveFocus())

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 })
      await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
      await waitFor(() => expect(main).toHaveFocus())
    })

    // Review fix: only a dialog that opened with nothing focused goes to the page start. A real opener that unmounts while the
    // dialog is open (a deleted row) keeps the previous behavior: the page does not jump to the top.
    it('does not move the focus to the page start when a real opener disconnects while the dialog is open', async () => {
      const user = userEvent.setup()
      const page = pageFixture('<main><h1>Orders</h1></main>')
      const heading = shown(page.querySelector('h1'))
      focusPageStart.mockClear()

      const Harness = () => {
        const [rows, setRows] = useState(['row'])
        const [open, setOpen] = useState(false)
        return (
          <>
            {rows.map(row => <button key={row} type='button' onClick={() => setOpen(true)}>Delete row</button>)}
            <Dialog open={open} title='Confirm' onClose={() => setOpen(false)}>
              <button
                type='button'
                onClick={() => {
                  setRows([])
                  setOpen(false)
                }}
              >
                Confirm delete
              </button>
            </Dialog>
          </>
        )
      }

      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Delete row' }))
      await user.click(await screen.findByRole('button', { name: 'Confirm delete' }))
      await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(focusPageStart).not.toHaveBeenCalled()
      expect(heading).not.toHaveFocus()
    })
  })

  it('keeps the open host and uncontrolled content stable when backdropClassName changes', async () => {
    const content = <input aria-label='Uncontrolled dialog value' defaultValue='initial' />
    const { rerender } = render(
      <Dialog open title='Stable dialog' backdropClassName='first-backdrop'>{content}</Dialog>
    )

    const input = await screen.findByRole('textbox', { name: 'Uncontrolled dialog value' })
    const host = document.getElementById('app-modals')
    const popup = screen.getByRole('dialog', { name: 'Stable dialog' })
    input.value = 'edited'
    input.focus()

    rerender(<Dialog open title='Stable dialog' backdropClassName='second-backdrop'>{content}</Dialog>)
    expect(document.getElementById('app-modals')).toBe(host)
    expect(screen.getByRole('dialog', { name: 'Stable dialog' })).toBe(popup)
    expect(screen.getByRole('textbox', { name: 'Uncontrolled dialog value' })).toBe(input)
    expect(input).toHaveValue('edited')
    expect(input).toHaveFocus()
    expect(host).toHaveClass('first-backdrop')
    expect(host).not.toHaveClass('second-backdrop')

    rerender(<Dialog title='Stable dialog' backdropClassName='second-backdrop'>{content}</Dialog>)
    await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
    rerender(<Dialog open title='Stable dialog' backdropClassName='second-backdrop'>{content}</Dialog>)
    await waitFor(() => expect(document.getElementById('app-modals')).toHaveClass('second-backdrop'))
  })

  it('reference-counts the shared host and removes it only after the last user closes', async () => {
    const { rerender } = render(
      <>
        <Dialog key='first' open title='First'>First</Dialog>
        <Dialog key='second' open title='Second'>
          <input aria-label='Remaining dialog value' defaultValue='remaining' />
        </Dialog>
      </>
    )

    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner]')).toHaveLength(2))
    const host = document.getElementById('app-modals')
    const remainingPopup = document.querySelector('[data-od-dialog-owner][aria-label="Second"]')
    const remainingInput = remainingPopup.querySelector('[aria-label="Remaining dialog value"]')
    remainingInput.value = 'preserved'
    rerender(
      <Dialog key='second' open title='Second'>
        <input aria-label='Remaining dialog value' defaultValue='remaining' />
      </Dialog>
    )
    await waitFor(() => expect(document.querySelectorAll('[data-od-dialog-owner]')).toHaveLength(1))
    expect(document.getElementById('app-modals')).toBe(host)
    expect(document.querySelector('[data-od-dialog-owner][aria-label="Second"]')).toBe(remainingPopup)
    expect(remainingPopup.querySelector('[aria-label="Remaining dialog value"]')).toBe(remainingInput)
    expect(remainingInput).toHaveValue('preserved')

    rerender(<Dialog key='second' title='Second'>Second</Dialog>)
    await waitFor(() => expect(document.getElementById('app-modals')).not.toBeInTheDocument())
  })
})
