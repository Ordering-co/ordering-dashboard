import React, { useRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CONFIRM_DIALOG_LAYER,
  LEGACY_DIALOG_LAYER,
  useDialogLayer
} from './dialog-layer'

const Layer = ({ name, open = true, kind, backdropClassName }) => {
  const popupRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const layer = useDialogLayer({ open, kind, backdropClassName, popupRef, lastFocusedRef })
  if (!layer.ready) return null
  return <div ref={popupRef} data-testid={name}>{String(layer.isActive)}</div>
}

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('dialog layer coordination', () => {
  it('uses latest opening order across dialog families', async () => {
    render(
      <>
        <Layer name='confirm' kind={CONFIRM_DIALOG_LAYER} />
        <Layer name='later-dialog' kind={LEGACY_DIALOG_LAYER} />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('later-dialog')).toHaveTextContent('true'))
    expect(screen.getByTestId('confirm')).toHaveTextContent('false')
  })

  it('promotes the latest remaining layer at the same visual priority without remounting it', async () => {
    const { rerender } = render(
      <>
        <Layer key='first' name='first' kind={LEGACY_DIALOG_LAYER} />
        <Layer key='second' name='second' kind={LEGACY_DIALOG_LAYER} />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('second')).toHaveTextContent('true'))
    const first = screen.getByTestId('first')
    expect(first).toHaveTextContent('false')
    rerender(<Layer key='first' name='first' kind={LEGACY_DIALOG_LAYER} />)
    await waitFor(() => expect(first).toHaveTextContent('true'))
    expect(screen.getByTestId('first')).toBe(first)
  })

  it('keeps multi-class backdrop hooks for one owned legacy interval', async () => {
    const { rerender } = render(
      <>
        <Layer key='confirm' name='confirm' kind={CONFIRM_DIALOG_LAYER} />
        <Layer key='legacy' name='legacy' kind={LEGACY_DIALOG_LAYER} backdropClassName='fixture-one fixture-two popup-backdrop' />
      </>
    )

    await waitFor(() => expect(document.getElementById('app-modals')).toHaveClass('fixture-one', 'fixture-two', 'popup-backdrop'))
    const host = document.getElementById('app-modals')
    rerender(<Layer key='confirm' name='confirm' kind={CONFIRM_DIALOG_LAYER} />)
    await waitFor(() => expect(document.getElementById('app-modals')).toHaveClass('od-dialog-confirm-only-host'))
    expect(document.getElementById('app-modals')).toBe(host)
    expect(document.getElementById('app-modals')).not.toHaveClass('fixture-one', 'fixture-two')
    expect(document.getElementById('app-modals')).toHaveClass('popup-backdrop')
  })

  it('does not mutate or remove a foreign pre-existing host', async () => {
    const foreignHost = document.createElement('div')
    foreignHost.id = 'app-modals'
    foreignHost.className = 'foreign-host popup-backdrop'
    foreignHost.style.backgroundColor = 'rgb(1, 2, 3)'
    document.body.appendChild(foreignHost)
    const originalClassName = foreignHost.className
    const { unmount } = render(
      <Layer name='confirm' kind={CONFIRM_DIALOG_LAYER} backdropClassName='ignored-hook' />
    )

    await screen.findByTestId('confirm')
    expect(foreignHost.className).toBe(originalClassName)
    expect(foreignHost.style.backgroundColor).toBe('rgb(1, 2, 3)')
    unmount()
    expect(document.getElementById('app-modals')).toBe(foreignHost)
    expect(foreignHost.className).toBe(originalClassName)
    expect(foreignHost.style.backgroundColor).toBe('rgb(1, 2, 3)')
  })
})
