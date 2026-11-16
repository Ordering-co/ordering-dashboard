import React, { useRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CONFIRM_DIALOG_LAYER, LEGACY_DIALOG_LAYER, useDialogLayer } from './dialog-layer'

// redesign F1b (D-11): the shared host `#app-modals` is fixed and full screen. While a non-modal popover (a
// filter pill) is the only layer in it, the host must let the pointer through, or the first click outside
// the popover lands on the host and never reaches the pill under it. Any modal layer makes it block again.
const Layer = ({ name, open = true, kind = CONFIRM_DIALOG_LAYER, modal }) => {
  const popupRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const layer = useDialogLayer({ open, kind, modal, popupRef, lastFocusedRef })
  if (!layer.ready) return null
  return <div ref={popupRef} data-testid={name} />
}

const host = () => document.getElementById('app-modals')

afterEach(() => {
  host()?.remove()
})

describe('dialog layer · pointer pass-through for non-modal layers (D-11)', () => {
  it('lets the pointer through the host while only non-modal layers are open', async () => {
    render(<Layer name='popover' modal={false} />)
    await screen.findByTestId('popover')
    expect(host().style.pointerEvents).toBe('none')
  })

  it('blocks it again as soon as a modal layer joins, and lets it through when that one closes', async () => {
    const { rerender } = render(
      <>
        <Layer key='popover' name='popover' modal={false} />
        <Layer key='dialog' name='dialog' open={false} />
      </>
    )
    await screen.findByTestId('popover')
    expect(host().style.pointerEvents).toBe('none')
    rerender(
      <>
        <Layer key='popover' name='popover' modal={false} />
        <Layer key='dialog' name='dialog' open />
      </>
    )
    await screen.findByTestId('dialog')
    expect(host().style.pointerEvents).toBe('')
    rerender(
      <>
        <Layer key='popover' name='popover' modal={false} />
        <Layer key='dialog' name='dialog' open={false} />
      </>
    )
    await waitFor(() => expect(host().style.pointerEvents).toBe('none'))
  })

  it('keeps modal dialogs blocking by default, legacy and confirm alike', async () => {
    render(
      <>
        <Layer name='confirm' />
        <Layer name='legacy' kind={LEGACY_DIALOG_LAYER} />
      </>
    )
    await screen.findByTestId('legacy')
    expect(host().style.pointerEvents).toBe('')
  })

  it('does not touch a foreign pre-existing host', async () => {
    const foreign = document.createElement('div')
    foreign.id = 'app-modals'
    document.body.appendChild(foreign)
    render(<Layer name='popover' modal={false} />)
    await screen.findByTestId('popover')
    expect(foreign.style.pointerEvents).toBe('')
  })
})
