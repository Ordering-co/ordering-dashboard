/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign DG-B2b (M-DG28 | decisión 6): the zone editor header. `onBack` is opt-in; the ⋯ menu only exists for a saved zone and has
// a name; deleting goes through the product ConfirmDialog (C8) with the focus on Cancel.
const { infoProps, remove } = vi.hoisted(() => ({ infoProps: vi.fn(), remove: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  DriverGroupDeliveryZone: ({ UIComponent, zone, ...props }) => (
    <UIComponent
      {...props}
      zone={zone}
      zoneState={{ zone }}
      formState={{ loading: false, changes: {}, error: null }}
      kmlData={null}
      handleChangeInput={vi.fn()}
      handleChangeFormState={vi.fn()}
      handleUpdateDriverGroupDeliveryZone={vi.fn()}
      handleAddDriverGroupDeliveryZone={vi.fn()}
      handleUploadKmlFiles={vi.fn()}
      handleDeleteDriverGroupDeliveryZone={remove}
    />
  )
}))
vi.mock('../../DriversGroupDeliveryZoneInformation', () => ({
  DriverGroupDeliveryZoneInformation: props => { infoProps(props); return <div data-testid='zone-information' /> }
}))

import { DriverGroupDeliveryZoneDetails } from '..'

const zone = { id: 11, name: 'prishti', type: 2 }

// the styles of the ⋯ menu run `darken()` over the legacy theme color
const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, secundary: '#f5f5f5' } }

const setup = (props = {}) => renderWithProviders(
  <DriverGroupDeliveryZoneDetails drivergroup={{ id: 232 }} driverGroupsZones={{ zones: [zone] }} zone={zone} {...props} />,
  { theme }
)

afterEach(() => {
  document.getElementById('app-modals')?.remove()
  infoProps.mockClear()
  remove.mockClear()
})

describe('zone editor header', () => {
  it('without onBack draws no back button (as before)', () => {
    setup()
    expect(screen.queryByRole('button', { name: /all zones/i })).toBeNull()
    expect(screen.getByRole('heading', { name: 'prishti' })).toBeInTheDocument()
  })

  it('with onBack draws a ghost "All zones" button that calls it', () => {
    const onBack = vi.fn()
    setup({ onBack })
    const back = screen.getByRole('button', { name: 'All zones' })
    expect(back).toHaveAttribute('data-variant', 'ghost')
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('backLabel replaces the text of the back button', () => {
    setup({ onBack: vi.fn(), backLabel: 'Back to zones' })
    expect(screen.getByRole('button', { name: 'Back to zones' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All zones' })).toBeNull()
  })

  it('hands onDirtyChange to the form and does not leak onBack to it', () => {
    const onDirtyChange = vi.fn()
    setup({ onBack: vi.fn(), onDirtyChange })
    expect(screen.getByTestId('zone-information')).toBeInTheDocument()
    expect(infoProps.mock.calls.at(-1)[0].onDirtyChange).toBe(onDirtyChange)
  })
})

describe('zone ⋯ menu (M-DG28)', () => {
  it('is absent when adding a zone', () => {
    setup({ zone: undefined })
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
    expect(document.querySelector('[aria-haspopup]')).toBeNull() // no ⋯ trigger of any name
    expect(screen.queryByText('Delete')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Zone delivery settings' })).toBeInTheDocument()
  })

  it('has an accessible name on a saved zone', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Zone actions' })).toBeInTheDocument()
    expect(document.querySelector('[aria-haspopup]')).not.toBeNull() // the probe used for the add case can find a trigger
  })

  // redesign DG-R1 (R1-07): inside the group panel the group's ⋯ is «Actions»; the zone's must not read the same
  it('R1-07: is not called «Actions», the name of the group menu that is on screen beside it', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
  })

  // redesign DG-R1 (R1-07): the house icon button: seen at 32px, with the 44px touch area of product.css under 768px / coarse
  it('R1-07: is a Product icon button (32px control, 44px area from product.css)', () => {
    setup()
    const trigger = screen.getByRole('button', { name: 'Zone actions' })
    expect(trigger).toHaveClass('odc-btn')
    expect(trigger).toHaveAttribute('data-icon-only')
    expect(trigger).toHaveAttribute('data-size', 'md')
  })
})

describe('deleting a zone (C8)', () => {
  const openConfirm = async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Zone actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  }

  it('asks in a ConfirmDialog that names the zone, says it cannot be undone and starts on Cancel', async () => {
    setup()
    await openConfirm()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete prishti?')).toBeInTheDocument()
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete zone' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(remove).not.toHaveBeenCalled()
  })

  it('Cancel does not delete', async () => {
    setup()
    await openConfirm()
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(remove).not.toHaveBeenCalled()
  })

  it('"Delete zone" deletes once and closes', async () => {
    setup()
    await openConfirm()
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete zone' }))
    expect(remove).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
