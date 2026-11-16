/* eslint-disable import/first */
// redesign stores 5.14 (E3; S-5, S-7…S-11): the General tab of a promotion on Product. The UI is tested on its own with the
// props the controller (BusinessPromotionForm, E1) hands it: `promotionState.promotion`, `createPromotion(body, { inlineError })` and
// `updatePromotion(body, { inlineError })`, each answering `{ ok: true, result }` | `{ ok: false, error }`. Covered: a new promotion with
// the defaults of `main` and a «Create promotion» bar; Coupon shows the code, Discount hides it; the advanced module shows and hides
// its fields; the rules of S-8 (a percentage above 100 and an end before the start block the save and say so under the field and in
// the bar); an edit sends only what changed; a failed save keeps what was written and says why in the bar; «Enabled» only in edit,
// saved at once and never counted as a change; dates (draft until Done, untouched ones not sent); the image (png / jpeg / jpg, 2 MB,
// no crop).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({ advanced: false, phone: false, controller: null }))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => fallback],
    useConfig: () => [{ configs: probe.advanced ? { advanced_offers_module: { value: true } } : {} }],
    useSession: () => [{ user: { level: 0 } }],
    // the controller's part: it hands its UI the props and nothing else is known here
    BusinessPromotionForm: ({ UIComponent, ...props }) => {
      probe.controller = { ...props, UIComponent }
      return ReactModule.createElement(UIComponent, { ...props, promotionState: { promotion: props.promotion } })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))
// The sponsor select is legacy (it has its own tests): a labelled group of buttons that reports the value
vi.mock('../../../Shared/RecipientSelect', () => ({
  RecipientSelect: ({ labelFallback, value, onChange }) => (
    <div role='group' aria-label={labelFallback} data-value={value}>
      <button type='button' onClick={() => onChange('platform')}>Platform</button>
    </div>
  )
}))

import { BusinessPromotionGeneralForm, BusinessPromotionGeneralFormUI } from '../index'

const COUPON = {
  id: 5,
  name: 'Ten off',
  description: 'Weekend',
  image: null,
  start: '2026-03-01 17:34:00',
  end: '2026-03-31 17:34:59',
  type: 2,
  coupon: 'TEN',
  rate_type: 1,
  rate: 10,
  minimum: 20,
  limit: 0,
  enabled: true
}
const ADVANCED = { ...COUPON, auto: false, public: true, target: 2, condition_type: 1, stackable: false, sponsor: 'business' }

const spies = {}
const mount = (promotion = {}, props = {}) => {
  spies.create = vi.fn(async (body) => ({ ok: true, result: { id: 77, enabled: true, ...body } }))
  spies.update = vi.fn(async (body) => ({ ok: true, result: { ...promotion, ...body } }))
  spies.toggle = vi.fn(async () => ({ ok: true }))
  spies.created = vi.fn()
  spies.saved = vi.fn()
  spies.close = vi.fn()
  return renderWithProviders(
    <BusinessPromotionGeneralFormUI
      promotionState={{ promotion }}
      business={{ id: 7, offers: [] }}
      createPromotion={spies.create}
      updatePromotion={spies.update}
      onToggleEnabled={spies.toggle}
      onCreated={spies.created}
      onSaved={spies.saved}
      onClose={spies.close}
      {...props}
    />
  )
}

const field = (name) => screen.getByLabelText(new RegExp(`^${name}`))
const bar = () => screen.getByRole('group', { name: 'Save changes' })
const saveButton = (label) => within(bar()).getByRole('button', { name: label })
const dateButton = () => document.querySelector('.odc-bp-date')
// the Product select: open the combobox named `name`, pick the option `option`
const pickOption = async (user, name, option) => {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${name}`) }))
  const box = await screen.findByRole('listbox', { hidden: true })
  await user.click(within(box).getByRole('option', { name: option, hidden: true }))
}
const png = () => new File(['pixels'], 'p.png', { type: 'image/png' })

const pickRange = async (user) => {
  probe.phone = true
  await user.click(dateButton())
  const dialog = await screen.findByRole('dialog', { name: 'Date range' })
  await user.click(dialog.querySelector('[data-day$="-10"]'))
  await user.click(dialog.querySelector('[data-day$="-14"]'))
  await user.click(within(dialog.querySelector('.odc-dr-foot')).getByRole('button', { name: 'Done' }))
}

beforeEach(() => {
  probe.advanced = false
  probe.phone = false
  probe.controller = null
  document.getElementById('app-modals')?.remove()
})

describe('a new promotion', () => {
  it('opens empty with the defaults of main: Coupon, fixed amount, no «Enabled» switch and no save bar yet', () => {
    mount({})
    expect(screen.queryByRole('switch', { name: 'Enabled' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Fixed amount' })).toHaveAttribute('aria-pressed', 'true')
    expect(field('Name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Date range: Select dates' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('creates with the defaults plus what was written, in the bar that says «Create promotion»', async () => {
    const user = userEvent.setup()
    mount({})
    await user.type(field('Name'), 'Welcome')
    await user.type(field('Coupon code'), 'HEL LO')
    await user.type(field('Value'), '7')
    await pickRange(user)
    expect(bar()).toHaveTextContent('4 unsaved changes')
    await user.click(saveButton('Create promotion'))
    await waitFor(() => expect(spies.create).toHaveBeenCalledTimes(1))
    const [body, options] = spies.create.mock.calls[0]
    expect(options).toEqual({ inlineError: true })
    expect(body).toMatchObject({ name: 'Welcome', type: 2, coupon: 'HELLO', rate_type: 2, rate: 7, sponsor: 'business' })
    expect(body.start).toMatch(/^\d{4}-\d{2}-10 00:00:00$/)
    expect(body.end).toMatch(/^\d{4}-\d{2}-14 23:59:59$/)
    expect(body).not.toHaveProperty('auto')
    expect(spies.update).not.toHaveBeenCalled()
    await waitFor(() => expect(spies.created).toHaveBeenCalledWith(expect.objectContaining({ id: 77, name: 'Welcome' })))
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('does not close the form on creating, and from then on it is the created promotion: «Enabled» appears and a second save is an update', async () => {
    const user = userEvent.setup()
    mount({})
    await user.type(field('Name'), 'Welcome')
    await user.type(field('Coupon code'), 'HELLO')
    await user.type(field('Value'), '7')
    await pickRange(user)
    await user.click(saveButton('Create promotion'))
    await waitFor(() => expect(spies.created).toHaveBeenCalled())
    expect(spies.close).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Enabled' })).toBeInTheDocument()
    await user.type(field('Name'), ' 2')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.create).toHaveBeenCalledTimes(1)
  })

  it('the default value 0 cannot be saved: the value must be written', async () => {
    const user = userEvent.setup()
    mount({})
    await user.type(field('Name'), 'Welcome')
    await user.type(field('Coupon code'), 'HELLO')
    await pickRange(user)
    await user.click(saveButton('Create promotion'))
    expect(spies.create).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a value greater than 0.')).toBeInTheDocument()
    expect(bar()).toHaveTextContent('Fix 1 field to save.')
  })

  it('nothing is said under a field until the first attempt to save', async () => {
    const user = userEvent.setup()
    mount({})
    await user.type(field('Name'), 'x')
    expect(screen.queryByText('Enter a value greater than 0.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(saveButton('Create promotion'))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(bar()).toHaveTextContent('Fix 3 fields to save.')
    expect(spies.create).not.toHaveBeenCalled()
  })
})

describe('how it is applied', () => {
  it('Coupon shows the code and Discount hides it', async () => {
    const user = userEvent.setup()
    mount({})
    expect(field('Coupon code')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Discount' }))
    expect(screen.queryByLabelText(/^Coupon code/)).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Coupon' }))
    expect(field('Coupon code')).toBeInTheDocument()
  })

  it('the code loses its spaces as it is written', async () => {
    const user = userEvent.setup()
    mount({})
    await user.type(field('Coupon code'), 'A B  C')
    expect(field('Coupon code')).toHaveValue('ABC')
  })

  it('without the advanced module there is no show-in-cart, automatic discount, applies-to, combine or sponsor', async () => {
    const user = userEvent.setup()
    mount({})
    expect(screen.queryByRole('checkbox', { name: 'Show in cart' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /^Applies to/ })).toBeNull()
    expect(screen.queryByRole('switch', { name: /combine/ })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Sponsor' })).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Discount' }))
    expect(screen.queryByRole('checkbox', { name: 'Automatic discount' })).toBeNull()
  })

  it('with the advanced module it shows them: show in cart under Coupon, automatic under Discount, applies to, combine and sponsor', async () => {
    const user = userEvent.setup()
    probe.advanced = true
    mount({})
    expect(screen.getByRole('checkbox', { name: 'Show in cart' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Please indicate if you want the coupon to be seen in the cart or hidden')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Automatic discount' })).toBeNull()
    await user.click(screen.getByRole('combobox', { name: /^Applies to/ }))
    expect(within(await screen.findByRole('listbox', { hidden: true })).getAllByRole('option', { hidden: true }).map(option => option.textContent)).toEqual(['Subtotal', 'Delivery fee', 'Service fee'])
    await user.keyboard('{Escape}')
    expect(screen.getByRole('switch', { name: 'Allow to combine offer (discount/coupon) with others?' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('group', { name: 'Sponsor' })).toHaveAttribute('data-value', 'business')
    await user.click(screen.getByRole('radio', { name: 'Discount' }))
    expect(screen.getByRole('checkbox', { name: 'Automatic discount' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('checkbox', { name: 'Show in cart' })).toBeNull()
  })

  it('a new promotion with the advanced module sends its defaults too, and the combine switch counts as a change', async () => {
    const user = userEvent.setup()
    probe.advanced = true
    mount({})
    await user.type(field('Name'), 'Auto')
    await user.type(field('Coupon code'), 'AUTO')
    await user.type(field('Value'), '5')
    await user.click(screen.getByRole('switch', { name: /combine/ }))
    await pickOption(user, 'Applies to', 'Service fee')
    await user.click(within(screen.getByRole('group', { name: 'Sponsor' })).getByRole('button', { name: 'Platform' }))
    await pickRange(user)
    expect(bar()).toHaveTextContent('7 unsaved changes')
    await user.click(saveButton('Create promotion'))
    await waitFor(() => expect(spies.create).toHaveBeenCalled())
    expect(spies.create.mock.calls[0][0]).toMatchObject({
      type: 2, rate_type: 2, rate: 5, sponsor: 'platform', auto: false, public: true, condition_type: 1, target: 3, stackable: true
    })
  })
})

describe('the discount', () => {
  it('writes the value as a percentage in % and as an amount without a currency', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    expect(field('Value')).toHaveValue('10%')
    await user.click(screen.getByRole('button', { name: 'Fixed amount' }))
    expect(field('Value')).toHaveValue('10')
    expect(field('Value').value).not.toMatch(/[$%]/)
  })

  it('the minimum and the limit are optional and show their stored values (a limit of 0 is 0)', () => {
    mount(COUPON)
    expect(field('Minimum purchase')).toHaveValue('20')
    expect(field('Limit')).toHaveValue('0')
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0) // the required marks are texts, not colours
  })
})

describe('validation (S-8)', () => {
  it('a percentage above 100 blocks the save, under the field and in the bar', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Value'))
    await user.type(field('Value'), '150')
    await user.tab()
    await user.click(saveButton('Save changes'))
    expect(spies.update).not.toHaveBeenCalled()
    expect(screen.getByText('A percentage can\'t be more than 100.')).toBeInTheDocument()
    expect(bar()).toHaveTextContent('Fix 1 field to save.')
    expect(field('Value')).toHaveAttribute('aria-invalid', 'true')
  })

  it('a limit with decimals is kept as typed and blocks the save (it is never rounded in silence)', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Limit'))
    await user.type(field('Limit'), '2.5')
    await user.tab()
    expect(field('Limit')).toHaveValue('2.5')
    await user.click(saveButton('Save changes'))
    expect(spies.update).not.toHaveBeenCalled()
    expect(screen.getByText('The limit must be a whole number, 0 or more.')).toBeInTheDocument()
  })

  // R-05 (stores 7.1): `main` only checked the name and the code, so stored dates the wrong way round do not block another edit;
  // dates the user sets the wrong way round are refused (promotionForm.test.js › «asks for both dates as soon as one is set»).
  it('stored dates the wrong way round do not block a name change, and are not re-sent', async () => {
    const user = userEvent.setup()
    mount({ ...COUPON, start: '2026-03-10 00:00:00', end: '2026-03-09 23:59:59' })
    await user.type(field('Name'), ' x')
    await user.click(saveButton('Save changes'))
    expect(spies.update).toHaveBeenCalledTimes(1)
    expect(spies.update.mock.calls[0][0]).not.toHaveProperty('start')
    expect(screen.queryByText('The start date must not be after the end date.')).not.toBeInTheDocument()
  })

  it('a promotion without a name or without a code cannot be saved', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Name'))
    await user.clear(field('Coupon code'))
    await user.click(saveButton('Save changes'))
    expect(spies.update).not.toHaveBeenCalled()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('The field Coupon is required')).toBeInTheDocument()
    expect(bar()).toHaveTextContent('Fix 2 fields to save.')
  })

  it('a decimal limit and a negative minimum say what is wrong', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Minimum purchase'))
    await user.type(field('Minimum purchase'), '-5')
    await user.tab()
    await user.click(saveButton('Save changes'))
    expect(screen.getByText('The minimum purchase must be 0 or more.')).toBeInTheDocument()
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('fixing the field clears the count and lets the save through', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Value'))
    await user.type(field('Value'), '150')
    await user.click(saveButton('Save changes'))
    await user.clear(field('Value'))
    await user.type(field('Value'), '15')
    expect(screen.queryByText('A percentage can\'t be more than 100.')).toBeNull()
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
  })
})

describe('an existing promotion', () => {
  it('opens filled with its values and with «Enabled» above, outside the save bar', () => {
    mount(COUPON)
    expect(field('Name')).toHaveValue('Ten off')
    expect(field('Description')).toHaveValue('Weekend')
    expect(field('Coupon code')).toHaveValue('TEN')
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
    expect(dateButton()).toHaveTextContent('2026-03-01 – 2026-03-31')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('sends only what changed, with the options of an inline error, and says «Saved»', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.clear(field('Value'))
    await user.type(field('Value'), '15')
    await user.type(field('Name'), ' extra')
    expect(bar()).toHaveTextContent('2 unsaved changes')
    expect(bar()).toHaveTextContent('Name')
    expect(bar()).toHaveTextContent('Value')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.update).toHaveBeenCalledWith({ name: 'Ten off extra', rate: 15 }, { inlineError: true })
    expect(spies.create).not.toHaveBeenCalled()
    await waitFor(() => expect(spies.saved).toHaveBeenCalledWith(expect.objectContaining({ id: 5, name: 'Ten off extra', rate: 15 })))
    expect(screen.getByText('Saved')).toBeInTheDocument()
    // the saved record is the new baseline: nothing is left to save
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  it('dates that were not touched are not sent, so the stored time survives', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.type(field('Name'), '!')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalled())
    const body = spies.update.mock.calls[0][0]
    expect(body).not.toHaveProperty('start')
    expect(body).not.toHaveProperty('end')
  })

  it('a stored promotion without dates and with value 0 can still be edited: only the description is sent (R-05)', async () => {
    const user = userEvent.setup()
    mount({ ...COUPON, start: null, end: null, rate: 0 })
    await user.type(field('Description'), '!')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.update).toHaveBeenCalledWith({ description: 'Weekend!' }, { inlineError: true })
    expect(screen.queryByText('Select the start and end dates.')).toBeNull()
    expect(screen.queryByText('Enter a value greater than 0.')).toBeNull()
  })

  it('the same promotion asks for both dates once only a start date is set (R-05)', async () => {
    const user = userEvent.setup()
    probe.phone = true
    mount({ ...COUPON, start: null, end: null, rate: 0 })
    await user.click(dateButton())
    const dialog = await screen.findByRole('dialog', { name: 'Date range' })
    await user.click(dialog.querySelector('[data-day$="-10"]'))
    await user.click(within(dialog.querySelector('.odc-dr-foot')).getByRole('button', { name: 'Done' }))
    await user.click(saveButton('Save changes'))
    expect(spies.update).not.toHaveBeenCalled()
    expect(screen.getByText('Select the start and end dates.')).toBeInTheDocument()
    expect(screen.queryByText('Enter a value greater than 0.')).toBeNull()
    expect(bar()).toHaveTextContent('Fix 1 field to save.')
  })

  it('a failed save keeps the detail with what was written and says why in the bar', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    spies.update.mockResolvedValueOnce({ ok: false, error: ['The coupon already exists'] })
    await user.type(field('Name'), ' extra')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(within(bar()).getByRole('alert')).toHaveTextContent('The coupon already exists'))
    expect(field('Name')).toHaveValue('Ten off extra')
    expect(spies.saved).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).toBeNull()
    // Try again sends the same body
    spies.update.mockResolvedValueOnce({ ok: true, result: { ...COUPON, name: 'Ten off extra' } })
    await user.click(within(bar()).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(2))
    expect(spies.update.mock.calls[1][0]).toEqual({ name: 'Ten off extra' })
  })

  it('a failure with no text says the promotion could not be saved', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    spies.update.mockRejectedValueOnce(new Error(''))
    await user.type(field('Name'), '!')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(within(bar()).getByRole('alert')).toHaveTextContent('We couldn\'t save the promotion'))
  })

  it('Discard puts every field back', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.type(field('Name'), ' extra')
    await user.click(screen.getByRole('radio', { name: 'Discount' }))
    await user.click(within(bar()).getByRole('button', { name: 'Discard' }))
    expect(field('Name')).toHaveValue('Ten off')
    expect(screen.getByRole('radio', { name: 'Coupon' })).toHaveAttribute('aria-checked', 'true')
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('a change that returns to the stored value is not a change', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.type(field('Name'), 'x')
    expect(bar()).toHaveTextContent('1 unsaved change')
    await user.type(field('Name'), '{Backspace}')
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('with the advanced module a stored promotion shows its values, and changing «Applies to» is sent alone', async () => {
    const user = userEvent.setup()
    probe.advanced = true
    mount(ADVANCED)
    expect(screen.getByRole('combobox', { name: /^Applies to/ })).toHaveAccessibleName('Applies to Delivery fee')
    await pickOption(user, 'Applies to', 'Subtotal')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledWith({ target: 1 }, { inlineError: true }))
  })
})

describe('the payload of the «Applies to» select (lote C)', () => {
  it('choosing «Service fee» on a stored promotion sends exactly { target: 3 } (a number) and the inline-error option', async () => {
    const user = userEvent.setup()
    probe.advanced = true
    mount(ADVANCED)
    await pickOption(user, 'Applies to', 'Service fee')
    expect(screen.getByRole('combobox', { name: /^Applies to/ })).toHaveAccessibleName('Applies to Service fee')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1))
    expect(spies.update.mock.calls).toEqual([[{ target: 3 }, { inlineError: true }]])
  })
})

describe('«Enabled» (S-5)', () => {
  it('saves at once through onToggleEnabled with the promotion and the next value, and never dirties the bar', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await waitFor(() => expect(spies.toggle).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }), false))
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(spies.update).not.toHaveBeenCalled()
  })

  it('goes back and says why when it fails', async () => {
    const user = userEvent.setup()
    mount(COUPON, { onToggleEnabled: vi.fn(async () => ({ ok: false, error: ['Not allowed'] })) })
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not allowed'))
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
  })

  it('follows the stored record when the list changes it', () => {
    const { rerender } = mount(COUPON)
    rerender(
      <BusinessPromotionGeneralFormUI promotionState={{ promotion: { ...COUPON, enabled: false } }} onToggleEnabled={spies.toggle} />
    )
    expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('the dates (S-9)', () => {
  it('a range is a draft until «Done»: it is written once, 00:00:00 to 23:59:59, and counts as one change', async () => {
    const user = userEvent.setup()
    mount(COUPON)
    await pickRange(user)
    expect(dateButton()).toHaveTextContent(/\d{4}-\d{2}-10 – \d{4}-\d{2}-14/)
    expect(bar()).toHaveTextContent('1 unsaved change')
    await user.click(saveButton('Save changes'))
    await waitFor(() => expect(spies.update).toHaveBeenCalled())
    const body = spies.update.mock.calls[0][0]
    expect(Object.keys(body).sort()).toEqual(['end', 'start'])
    expect(body.start).toMatch(/^\d{4}-\d{2}-10 00:00:00$/)
    expect(body.end).toMatch(/^\d{4}-\d{2}-14 23:59:59$/)
  })
})

describe('the image (S-11)', () => {
  const fileInput = (container) => container.querySelector('input[type="file"]')

  it('is a Product field that does not crop: the picked file becomes the new image and counts as a change', async () => {
    const { container } = mount(COUPON)
    expect(screen.getByRole('group', { name: 'Image' })).toBeInTheDocument()
    fireEvent.change(fileInput(container), { target: { files: [png()] } })
    await waitFor(() => expect(container.querySelector('.odc-image-field-img')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/)))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(bar()).toHaveTextContent('1 unsaved change')
    expect(bar()).toHaveTextContent('Image')
  })

  it('refuses a file that is not png, jpeg or jpg, and says so under the field', async () => {
    const { container } = mount(COUPON)
    fireEvent.change(fileInput(container), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('refuses a file over 2 MB with the message of today', async () => {
    const { container } = mount(COUPON)
    const big = new File([new Uint8Array(2049 * 1024)], 'big.png', { type: 'image/png' })
    fireEvent.change(fileInput(container), { target: { files: [big] } })
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
  })

  it('a good file after a bad one clears the message', async () => {
    const { container } = mount(COUPON)
    fireEvent.change(fileInput(container), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } })
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    fireEvent.change(fileInput(container), { target: { files: [png()] } })
    await waitFor(() => expect(screen.queryByText('Only images can be accepted')).toBeNull())
  })
})

describe('the wiring', () => {
  it('hands the controller its props and the UI, and nothing is lost on the way', () => {
    const onToggleEnabled = vi.fn()
    renderWithProviders(
      <BusinessPromotionGeneralForm promotion={COUPON} business={{ id: 7, offers: [] }} onToggleEnabled={onToggleEnabled} onCreated={vi.fn()} />
    )
    expect(probe.controller).toMatchObject({ promotion: COUPON, business: { id: 7 }, onToggleEnabled })
    expect(probe.controller.UIComponent).toBe(BusinessPromotionGeneralFormUI)
    expect(field('Name')).toHaveValue('Ten off')
  })
})
