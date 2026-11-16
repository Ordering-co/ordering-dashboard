/* eslint-disable import/first */
// redesign stores 5.1a: Store details › Information on Product. The real controller (BusinessFormDetails) runs with
// its contexts mocked, so what the tests pin is the request main sends (`businesses(id).save(changes)`), the fields and their
// conditions, the save bar, the leave guard, the crop that is cancelled (G2-05), several files (G2-26), the ribbon (5.1a-01),
// the networks (G2-24), the price levels (G2-22), the disabled reason (G2-23) and the export switches (G2-25). The cropper and
// the legacy colour picker are stand-ins (they have their own tests).
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  save: null,
  showToast: null,
  user: { id: 1, level: 0 },
  project: 'demo',
  configs: { format_number_currency: { value: '$' } },
  // the language of whoever is using the dashboard: the catalogue's English default unless a test says otherwise
  translate: null
}))

vi.mock('../../../../../../index', async () => {
  const actual = await vi.importActual('../../../../../../components/BusinessFormDetails')
  return {
    useLanguage: () => [{}, (key, fallback) => runtime.translate(key, fallback)],
    useConfig: () => [{ configs: runtime.configs }],
    useSession: () => [{ user: runtime.user, token: 'token' }],
    useApi: () => [{ project: runtime.project }],
    useToast: () => [{}, { showToast: (...args) => runtime.showToast(...args) }],
    ToastType: { Info: 'info', Success: 'success', Error: 'error' },
    BusinessFormDetails: actual.BusinessFormDetails
  }
})
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'token', user: runtime.user }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ project: runtime.project, businesses: () => ({ save: (...args) => runtime.save(...args) }) }]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: runtime.configs }]
}))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: (...args) => runtime.showToast(...args) }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => runtime.translate(key, fallback)]
}))
vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: (props) => (
    <button type='button' onClick={() => { props.handleChangePhoto('data:image/png;base64,CROPPED'); props.onClose && props.onClose() }}>
      Crop
    </button>
  )
}))
vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor, onChangeColor }) => (
    <button type='button' className='od-color-picker-trigger' onClick={() => onChangeColor('#112233')}>{defaultColor || 'Pick'}</button>
  )
}))

import { BusinessInformation } from '../index'
import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'

const STORE = {
  id: 7,
  name: 'Sample Burgers',
  enabled: true,
  vertical: 'store',
  external_id: '12',
  description: 'Burgers',
  phone: '16316478472',
  cellphone: '',
  featured: true,
  price_level: '2',
  header: 'https://img.test/header.png',
  logo: 'https://img.test/logo.png',
  ribbon: { enabled: false, text: 'New', color: '#bc641a', shape: 'capsule_shape' },
  instagram_profile: 'https://www.instagram.com/sample'
}

let host
const Host = ({ children }) => {
  host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      {children}
      <LeaveDialog {...host.dialog} title='Save your changes?' keepLabel='Keep editing' saveLabel='Save and continue' discardLabel='Discard' closeLabel='Close' />
    </LeaveGuardContext.Provider>
  )
}

const draw = ({ business, ...props } = {}) => render(
  <Host>
    <BusinessInformation {...props} business={{ ...STORE, ...(business || {}) }} />
  </Host>
)

const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const saveButton = () => within(saveBar()).getByRole('button', { name: 'Save changes' })
const ok = (result) => ({ content: { error: false, result } })

beforeEach(() => {
  runtime.save = vi.fn(async (changes) => ok({ id: 7, ...changes }))
  runtime.showToast = vi.fn()
  runtime.user = { id: 1, level: 0 }
  runtime.project = 'demo'
  runtime.configs = { format_number_currency: { value: '$' } }
  runtime.translate = (key, fallback) => fallback ?? key
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Information · fields', () => {
  it('every field has its visible label tied to its control (G2-21)', () => {
    draw()
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Sample Burgers')
    expect(screen.getByRole('combobox', { name: 'Vertical' })).toHaveValue('store')
    expect(screen.getByRole('textbox', { name: 'External ID' })).toHaveValue('12')
    expect(screen.getByRole('textbox', { name: 'Short description' })).toHaveValue('Burgers')
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveAttribute('type', 'tel')
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toHaveAttribute('type', 'tel')
    expect(screen.getByRole('switch', { name: 'Featured' })).toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Price filter' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Instagram' })).toHaveValue('sample')
    expect(screen.getByRole('group', { name: /Header image/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Logo/ })).toBeInTheDocument()
    // the old «Save» at the foot of the form is gone; with nothing changed there is no bar
    expect(saveBar()).toBeNull()
  })

  // main dropped the EatStreet owner rule; main 581c89005 left Featured to the admin alone, on every project
  it('a store owner sees External ID, phones and the price filter, but not Featured, on EatStreet as anywhere', () => {
    runtime.project = 'eatstreet'
    runtime.user = { id: 1, level: 2 }
    draw()
    expect(screen.getByRole('textbox', { name: 'External ID' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: 'Phone number' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('radiogroup', { name: 'Price filter' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Featured' })).toBeNull()
  })

  it('the admin sees Featured', () => {
    runtime.user = { id: 1, level: 0 }
    draw()
    expect(screen.getByRole('switch', { name: 'Featured' })).toBeInTheDocument()
  })

  it('the price levels say «$» when the project has no currency symbol, never «undefined» (G2-22)', () => {
    runtime.configs = {}
    draw()
    const group = screen.getByRole('radiogroup', { name: 'Price filter' })
    expect(group).not.toHaveTextContent('undefined')
    expect(within(group).getByRole('radio', { name: '$$' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the disabled reason only shows for a disabled store; it saves the label in the language of whoever saves, and an unknown stored value stays (G2-23)', async () => {
    const { unmount } = draw()
    expect(screen.queryByRole('combobox', { name: 'Disabled reason' })).toBeNull()
    unmount()
    draw({ business: { enabled: false, disabled_reason: 'Closed for the holidays' } })
    const select = screen.getByRole('combobox', { name: 'Disabled reason' })
    expect(select).toHaveValue('Closed for the holidays')
    await userEvent.selectOptions(select, 'No drivers')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ disabled_reason: 'No drivers' }, { accessToken: 'token' })
  })

  describe('in a language other than English (R-03: main saved the translated label)', () => {
    const SPANISH = { OVEN_FAILURE: 'Falla del horno', NO_DRIVERS: 'Sin conductores' }
    beforeEach(() => {
      runtime.translate = (key, fallback) => SPANISH[key] ?? fallback ?? key
    })

    it('choosing a reason sends the label in the language of whoever saves, as main does', async () => {
      draw({ business: { enabled: false } })
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disabled reason' }), 'Falla del horno')
      await userEvent.click(saveButton())
      expect(runtime.save).toHaveBeenCalledWith({ disabled_reason: 'Falla del horno' }, { accessToken: 'token' })
    })

    it('a reason with no translation sends its English default, the catalogue default main sends', async () => {
      draw({ business: { enabled: false } })
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disabled reason' }), 'Raining')
      await userEvent.click(saveButton())
      expect(runtime.save).toHaveBeenCalledWith({ disabled_reason: 'Raining' }, { accessToken: 'token' })
    })

    it('a stored English value is recognised, shown translated, and not re-sent while it is untouched', async () => {
      draw({ business: { enabled: false, disabled_reason: 'Oven failure' } })
      const select = screen.getByRole('combobox', { name: 'Disabled reason' })
      expect(select).toHaveDisplayValue('Falla del horno')
      expect(within(select).queryByRole('option', { name: 'Oven failure' })).toBeNull()
      expect(saveBar()).toBeNull()
      expect(runtime.save).not.toHaveBeenCalled()
    })

    it('a value stored in this language is recognised the same way', () => {
      draw({ business: { enabled: false, disabled_reason: 'Sin conductores' } })
      const select = screen.getByRole('combobox', { name: 'Disabled reason' })
      expect(select).toHaveDisplayValue('Sin conductores')
      expect(within(select).getAllByRole('option', { name: 'Sin conductores' })).toHaveLength(1)
    })

    it('an unknown stored value stays as its own option, and is kept while untouched', () => {
      draw({ business: { enabled: false, disabled_reason: 'Cerrado por vacaciones' } })
      const select = screen.getByRole('combobox', { name: 'Disabled reason' })
      expect(select).toHaveDisplayValue('Cerrado por vacaciones')
      expect(saveBar()).toBeNull()
    })
  })
})

describe('Information · one Save', () => {
  it('a change shows the bar with its count and name; Save sends main\'s request with only the changes', async () => {
    const handleSuccessUpdate = vi.fn()
    draw({ handleSuccessUpdate })
    const name = screen.getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.type(name, 'Sample Grill')
    expect(saveBar()).toHaveTextContent('1 unsaved change')
    expect(saveBar()).toHaveTextContent('Name')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ name: 'Sample Grill' }, { accessToken: 'token' })
    await waitFor(() => expect(saveBar()).toHaveTextContent('Saved'))
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 7, name: 'Sample Grill' })
    // the bar is the feedback: no «Loading» or «Business updated» toast (D7)
    expect(runtime.showToast).not.toHaveBeenCalled()
  })

  // redesign bugs C: the API keeps External IDs with letters, and the field used to block every key but a digit
  it('the External ID takes letters, dashes and other characters, typed or pasted, and saves them as typed', async () => {
    draw({ business: { external_id: 'AB-12' } })
    const field = screen.getByRole('textbox', { name: 'External ID' })
    expect(field).toHaveValue('AB-12')
    expect(field).not.toHaveAttribute('inputmode', 'numeric')
    await userEvent.type(field, 'x_9')
    expect(field).toHaveValue('AB-12x_9')
    await userEvent.clear(field)
    await userEvent.paste('POS-77/b')
    expect(field).toHaveValue('POS-77/b')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ external_id: 'POS-77/b' }, { accessToken: 'token' })
  })

  it('Featured and the price level wait for Save (they are part of the form, as in main)', async () => {
    draw()
    await userEvent.click(screen.getByRole('switch', { name: 'Featured' }))
    await userEvent.click(screen.getByRole('radio', { name: '$$$$' }))
    expect(runtime.save).not.toHaveBeenCalled()
    expect(saveBar()).toHaveTextContent('2 unsaved changes')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ featured: false, price_level: '4' }, { accessToken: 'token' })
  })

  it('Discard puts every field back and hides the bar; nothing is sent', async () => {
    draw()
    const phone = screen.getByRole('textbox', { name: 'Phone number' })
    await userEvent.type(phone, '9')
    await userEvent.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(phone).toHaveValue('16316478472')
    expect(saveBar()).toBeNull()
    expect(runtime.save).not.toHaveBeenCalled()
  })

  it('an empty name blocks the save with its error under the field and the focus on it', async () => {
    draw()
    const name = screen.getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.click(saveButton())
    expect(runtime.save).not.toHaveBeenCalled()
    expect(screen.getByText('Business name is required')).toBeInTheDocument()
    expect(saveBar()).toHaveTextContent('Fix 1 field to save.')
    expect(name).toHaveFocus()
  })

  it('a failed save keeps the changes and says why in the bar, with Try again', async () => {
    runtime.save = vi.fn(async () => ({ content: { error: true, result: ['The name is already used'] } }))
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    await waitFor(() => expect(saveBar()).toHaveTextContent('The name is already used'))
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Sample Burgers!')
    runtime.save = vi.fn(async (changes) => ok({ id: 7, ...changes }))
    await userEvent.click(within(saveBar()).getByRole('button', { name: 'Try again' }))
    expect(runtime.save).toHaveBeenCalledWith({ name: 'Sample Burgers!' }, { accessToken: 'token' })
  })
})

describe('Information · leaving with unsaved work (G2-03)', () => {
  it('a way out with changes asks; «Discard» drops them and goes on', async () => {
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: 'Short description' }), ' and fries')
    const proceed = vi.fn()
    act(() => { host.requestLeave(proceed) })
    const dialog = await screen.findByRole('alertdialog')
    expect(proceed).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    expect(runtime.save).not.toHaveBeenCalled()
  })

  it('«Save and continue» saves the form and then goes on', async () => {
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: 'Short description' }), ' and fries')
    const proceed = vi.fn()
    act(() => { host.requestLeave(proceed) })
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    expect(runtime.save).toHaveBeenCalledWith({ description: 'Burgers and fries' }, { accessToken: 'token' })
  })

  it('«Save and continue» with an invalid field keeps the user on the form', async () => {
    draw()
    await userEvent.clear(screen.getByRole('textbox', { name: /^Name/ }))
    const proceed = vi.fn()
    const onCancel = vi.fn()
    act(() => { host.requestLeave(proceed, onCancel) })
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(proceed).not.toHaveBeenCalled()
    expect(runtime.save).not.toHaveBeenCalled()
  })

  it('without changes the way out goes at once', () => {
    draw()
    const proceed = vi.fn()
    act(() => { host.requestLeave(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Information · images', () => {
  const png = () => new File(['pixels'], 'logo.png', { type: 'image/png' })
  const headerInput = () => screen.getByRole('group', { name: /Header image/ }).querySelector('input[type="file"]')

  it('a cancelled crop leaves nothing pending (G2-05)', async () => {
    draw()
    fireEvent.change(headerInput(), { target: { files: [png()] } })
    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image crop' })).toBeNull())
    expect(saveBar()).toBeNull()
  })

  it('an accepted crop is one change, saved as main saves it', async () => {
    draw()
    fireEvent.change(headerInput(), { target: { files: [png()] } })
    await userEvent.click(await screen.findByRole('button', { name: 'Crop' }))
    expect(saveBar()).toHaveTextContent('Header image')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ header: 'data:image/png;base64,CROPPED' }, { accessToken: 'token' })
  })

  it('several files dropped on an image say why they are refused (G2-26)', () => {
    draw()
    const preview = screen.getByRole('group', { name: /Header image/ }).querySelector('.odc-image-field-preview')
    fireEvent.drop(preview, { dataTransfer: { files: [png(), png()], types: ['Files'] } })
    expect(screen.getByText('Drop one image at a time.')).toBeInTheDocument()
  })

  it('a file that is not an image is refused in the field, as main refused it', () => {
    draw()
    fireEvent.change(headerInput(), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Image crop' })).toBeNull()
  })
})

describe('Information · ribbon', () => {
  it('turning on a stored ribbon saves without asking to pick its colour and shape again (5.1a-01)', async () => {
    draw()
    await userEvent.click(screen.getByRole('switch', { name: 'Show a ribbon on the store' }))
    expect(screen.getByRole('textbox', { name: /^Text/ })).toHaveValue('New')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ ribbon: { enabled: true } }, { accessToken: 'token' })
  })

  // (main): the first enable of a store with no ribbon takes main's defaults, so it saves as it shows
  it('a new ribbon starts with main\'s text, colour and shape and saves them', async () => {
    draw({ business: { ribbon: null } })
    await userEvent.click(screen.getByRole('switch', { name: 'Show a ribbon on the store' }))
    expect(screen.getByRole('textbox', { name: /^Text/ })).toHaveValue('ribbon')
    expect(screen.getByRole('radio', { name: 'Rectangle' })).toBeChecked()
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { ribbon: { color: '#0083FE', text: 'ribbon', shape: 'rectangle', enabled: true } },
      { accessToken: 'token' }
    )
  })

  it('a ribbon without text, colour and shape is not saved; each error sits under its control', async () => {
    draw({ business: { ribbon: { enabled: true, text: '', color: '', shape: null } } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(runtime.save).not.toHaveBeenCalled()
    expect(screen.getByText('The Ribbon text field is required')).toBeInTheDocument()
    expect(screen.getByText('The Ribbon color field is required')).toBeInTheDocument()
    expect(screen.getByText('The Ribbon shape field is required')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: /^Text/ }), 'Hot')
    await userEvent.click(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger'))
    await userEvent.click(screen.getByRole('radio', { name: 'Capsule' }))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { name: 'Sample Burgers!', ribbon: { text: 'Hot', color: '#112233', shape: 'capsule_shape' } },
      { accessToken: 'token' }
    )
  })
})

// main the dirty-field tracking and ribbon seeding that main's BusinessInformation.index.test.jsx (ribbons, 15
// cases) protected. Two of its cases do not apply here: «sends only the dirty name field when the business hydrates after
// the first render» and «hydrates the ribbon values when a persisted enabled ribbon gains color and shape» both exist
// because main reads the ribbon through react-hook-form `defaultValues`, a snapshot taken once that needs an explicit
// re-sync when the business prop arrives later. This screen has no such snapshot: `effectiveRibbon(changes, business)`
// (informationModel.js) reads `business` straight from props on every render, so a later-arriving business is already
// correct without any hydration step. «seeds canonical ribbon defaults...» and «accepts the save after enabling a
// persisted disabled ribbon...» are covered above, by «a new ribbon starts with main's text, colour and shape and saves
// them» and «turning on a stored ribbon saves without asking to pick its colour and shape again (5.1a-01)».
describe('main ribbon regressions ported from main', () => {
  // main: "sends only the dirty name field when a persisted enabled ribbon is present"
  it('a name-only edit does not resend an already persisted, fully set ribbon', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    const name = screen.getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.type(name, 'Sample Grill')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ name: 'Sample Grill' }, { accessToken: 'token' })
    expect(runtime.save).toHaveBeenCalledTimes(1)
  })

  // main: "still requires ribbon color and shape when an enabled ribbon has none"
  it('an enabled ribbon with text but no colour or shape blocks the save on just those two fields', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'Local special' } } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(runtime.save).not.toHaveBeenCalled()
    expect(screen.queryByText('The Ribbon text field is required')).toBeNull()
    expect(screen.getByText('The Ribbon color field is required')).toBeInTheDocument()
    expect(screen.getByText('The Ribbon shape field is required')).toBeInTheDocument()
  })

  // main: "still requires ribbon color when a persisted enabled ribbon has an empty color"
  it('a persisted enabled ribbon with an empty colour and a set shape only requires the colour', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'Local special', color: '', shape: 'capsule_shape' } } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(runtime.save).not.toHaveBeenCalled()
    expect(screen.getByText('The Ribbon color field is required')).toBeInTheDocument()
    expect(screen.queryByText('The Ribbon shape field is required')).toBeNull()
  })

  // main: "saves an unrelated name edit when the business has no ribbon"
  it('saves an unrelated name edit when the business has no ribbon at all', async () => {
    draw({ business: { ribbon: null } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ name: 'Sample Burgers!' }, { accessToken: 'token' })
    expect(runtime.save).toHaveBeenCalledTimes(1)
  })

  // main: "keeps first-enable customizations across off/on toggles before saving"
  it('keeps a first-enable ribbon\'s customised text and colour across an off/on toggle before saving', async () => {
    draw({ business: { ribbon: null } })
    const toggle = () => screen.getByRole('switch', { name: 'Show a ribbon on the store' })
    await userEvent.click(toggle())
    const text = screen.getByRole('textbox', { name: /^Text/ })
    await userEvent.clear(text)
    await userEvent.type(text, 'My ribbon text')
    await userEvent.click(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger'))
    await userEvent.click(toggle())
    await userEvent.click(toggle())
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { ribbon: { color: '#112233', text: 'My ribbon text', shape: 'rectangle', enabled: true } },
      { accessToken: 'token' }
    )
  })

  // main: "keeps hydrated ribbon values across off/on toggles of an enabled ribbon"
  it('toggling an already-enabled ribbon off and back on sends only its enabled flag', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    const toggle = screen.getByRole('switch', { name: 'Show a ribbon on the store' })
    await userEvent.click(toggle)
    await userEvent.click(toggle)
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { name: 'Sample Burgers!', ribbon: { enabled: true } },
      { accessToken: 'token' }
    )
  })

  // main: "sends only the edited ribbon color in the save payload"
  it('sends only the edited ribbon colour when nothing else changed', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    await userEvent.click(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger'))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ ribbon: { color: '#112233' } }, { accessToken: 'token' })
  })

  // main: "saves the latest picked color when saving right after choosing it"
  it('saves a name edit together with a just-picked ribbon colour', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger'))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { name: 'Sample Burgers!', ribbon: { color: '#112233' } },
      { accessToken: 'token' }
    )
  })

  // main: "keeps an unresolved ribbon shape error after a color change until it is corrected"
  it('keeps the ribbon shape error after a colour change, until the shape itself is fixed', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'Local special', color: '#7b2cbf', shape: null } } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    expect(screen.getByText('The Ribbon shape field is required')).toBeInTheDocument()
    expect(runtime.save).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger'))
    expect(screen.getByText('The Ribbon shape field is required')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Rounded rectangle' }))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith(
      { name: 'Sample Burgers!', ribbon: { color: '#112233', shape: 'rectangle_round' } },
      { accessToken: 'token' }
    )
  })

  // main: "sends only the edited ribbon shape in the save payload"
  it('sends only the edited ribbon shape when nothing else changed', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    await userEvent.click(screen.getByRole('radio', { name: 'Rounded rectangle' }))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ ribbon: { shape: 'rectangle_round' } }, { accessToken: 'token' })
  })

  // main: "keeps the ribbon valid across a failed save retry and a later successful save"
  it('keeps a valid ribbon untouched through a failed save and a later successful retry', async () => {
    draw({ business: { ribbon: { enabled: true, text: 'New', color: '#bc641a', shape: 'capsule_shape' } } })
    runtime.save = vi.fn(async () => ({ content: { error: true, result: ['Network Error'] } }))
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    await waitFor(() => expect(saveBar()).toHaveTextContent('Network Error'))
    expect(screen.getByRole('group', { name: /^Color/ }).querySelector('.od-color-picker-trigger')).toHaveTextContent('#bc641a')
    runtime.save = vi.fn(async (changes) => ok({ id: 7, ...changes }))
    await userEvent.click(within(saveBar()).getByRole('button', { name: 'Try again' }))
    expect(runtime.save).toHaveBeenCalledWith({ name: 'Sample Burgers!' }, { accessToken: 'token' })
  })
})

// redesign bugs F row 38: the ribbon Shape is required (informationModel) and says so like its neighbours
describe('Information · ribbon shape required mark', () => {
  it('marks the Shape group as required when the ribbon is on, and not before', async () => {
    const { container } = draw()
    expect(screen.queryByRole('radiogroup', { name: /^Shape/ })).toBeNull()
    await userEvent.click(screen.getByRole('switch', { name: 'Show a ribbon on the store' }))
    const group = screen.getByRole('radiogroup', { name: /^Shape/ })
    expect(group).toHaveAttribute('aria-required', 'true')
    const title = container.querySelector('[data-bi-field="ribbon_shape"] .odc-radiogroup-title')
    expect(title.querySelector('.odc-field-required')).toHaveAttribute('aria-hidden', 'true')
    expect(title.querySelector('.odc-sr-only')).toHaveTextContent('Required')
  })
})

describe('Information · social networks (G2-24)', () => {
  it('keeps what is typed while typing, saves `base + user` as main, and shows the user part after leaving the field', async () => {
    draw()
    const facebook = screen.getByRole('textbox', { name: 'Facebook' })
    await userEvent.type(facebook, 'https://www.facebook.com/sample.burgers/')
    expect(facebook).toHaveValue('https://www.facebook.com/sample.burgers/')
    fireEvent.blur(facebook)
    expect(facebook).toHaveValue('sample.burgers')
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ facebook_profile: 'https://www.facebook.com/sample.burgers' }, { accessToken: 'token' })
  })

  it('clearing a network saves it empty', async () => {
    draw()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Instagram' }))
    await userEvent.click(saveButton())
    expect(runtime.save).toHaveBeenCalledWith({ instagram_profile: '' }, { accessToken: 'token' })
  })

  it('WhatsApp and TikTok keep main\'s rules, and a user name with spaces is refused, each under its field', async () => {
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: 'Whatsapp' }), 'abc')
    await userEvent.type(screen.getByRole('textbox', { name: 'Tik tok' }), 'sample')
    await userEvent.type(screen.getByRole('textbox', { name: 'Pinterest' }), 'sample burgers')
    await userEvent.click(saveButton())
    expect(runtime.save).not.toHaveBeenCalled()
    expect(screen.getByText('Whatsapp number is not valid')).toBeInTheDocument()
    expect(screen.getByText('TikTok user name is not valid')).toBeInTheDocument()
    expect(screen.getByText('Write the user name without spaces.')).toBeInTheDocument()
    expect(saveBar()).toHaveTextContent('Fix 3 fields to save.')
  })
})

describe('Information · export switches (G2-25)', () => {
  const exportProps = (extra = {}) => ({
    isGoogleRedirectPluginActive: true,
    googleRedirectPluginRoot: 'https://plugin.test',
    isPrimaryIncluded: true,
    isSecondaryIncluded: false,
    onGoogleFeedPrimaryToggle: vi.fn(async () => {}),
    onGoogleFeedToggle: vi.fn(async () => {}),
    ...extra
  })

  it('only for level 0 with the plugin, controlled by the stored value, and they save at once', async () => {
    const props = exportProps()
    draw(props)
    const eatstreet = screen.getByRole('switch', { name: 'Export to Eatstreet' })
    const direct = screen.getByRole('switch', { name: 'Export to Restaurant Direct' })
    expect(eatstreet).toBeChecked()
    expect(direct).not.toBeChecked()
    await userEvent.click(direct)
    expect(props.onGoogleFeedToggle).toHaveBeenCalledWith(true)
    // the stored value did not change (the controller rolled it back): the switch shows it again
    await waitFor(() => expect(direct).not.toBeChecked())
    expect(saveBar()).toBeNull()
  })

  it('a business owner does not see them', () => {
    runtime.user = { id: 1, level: 2 }
    draw(exportProps())
    expect(screen.queryByRole('switch', { name: 'Export to Eatstreet' })).toBeNull()
  })
})

// redesign stores 5.1a review r1: the findings of the Opus review, one test each.
describe('Information · review r1', () => {
  it('F1: the price filter\'s tab stop is the stored level once the store has arrived', () => {
    draw()
    const group = screen.getByRole('radiogroup', { name: 'Price filter' })
    expect(within(group).getByRole('radio', { name: '$$' })).toHaveAttribute('tabindex', '0')
    expect(within(group).getByRole('radio', { name: '$' })).toHaveAttribute('tabindex', '-1')
  })

  it('F3: an edit that is undone is not a change (no bar, no question on leaving)', async () => {
    draw()
    const name = screen.getByRole('textbox', { name: /^Name/ })
    await userEvent.type(name, 'x')
    expect(saveBar()).toHaveTextContent('Name')
    await userEvent.type(name, '{Backspace}')
    await userEvent.type(screen.getByRole('textbox', { name: 'Facebook' }), 'a{Backspace}')
    const ribbon = screen.getByRole('switch', { name: 'Show a ribbon on the store' })
    await userEvent.click(ribbon)
    await userEvent.click(ribbon)
    expect(saveBar()).toBeNull()
    const proceed = vi.fn()
    act(() => { host.requestLeave(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('F4: a WhatsApp number with spaces gets main\'s number message', async () => {
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: 'Whatsapp' }), '+1 631 647')
    await userEvent.click(saveButton())
    expect(screen.getByText('Whatsapp number is not valid')).toBeInTheDocument()
    expect(screen.queryByText('Write the user name without spaces.')).toBeNull()
  })

  it('F6: Discard also clears the «one image at a time» message', async () => {
    draw()
    const preview = screen.getByRole('group', { name: /Logo/ }).querySelector('.odc-image-field-preview')
    const png = () => new File(['pixels'], 'logo.png', { type: 'image/png' })
    fireEvent.drop(preview, { dataTransfer: { files: [png(), png()], types: ['Files'] } })
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(screen.queryByText('Drop one image at a time.')).toBeNull()
  })

  it('F7: after a click on Save the focus is on «Saved», as after Enter', async () => {
    draw()
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus())
  })

  it('F9: «Save and continue» that leaves the form says how the save went with a toast', async () => {
    const Leaving = () => {
      const [show, setShow] = React.useState(true)
      return (
        <Host>
          {show && <BusinessInformation business={STORE} />}
          <button type='button' onClick={() => host.requestLeave(() => setShow(false))}>Leave</button>
        </Host>
      )
    }
    render(<Leaving />)
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /^Name/ })).toBeNull())
    await waitFor(() => expect(runtime.showToast).toHaveBeenCalledWith('success', 'Business updated'))
  })

  it('F11: «Save and continue» with an invalid field puts the focus on that field', async () => {
    draw()
    const name = screen.getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    act(() => { host.requestLeave(vi.fn(), vi.fn()) })
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(name).toHaveFocus())
  })
})

// redesign tanda AB (S-4b): the live catalogue says «External Id» for EXTERNAL_ID; the store panel has its own key, STORE_EXTERNAL_ID («External ID»)
describe('Information · the External ID label (S-4b)', () => {
  it('does not take the live catalogue\'s «External Id» of EXTERNAL_ID', () => {
    runtime.translate = (key, fallback) => (key === 'EXTERNAL_ID' ? 'External Id' : fallback ?? key)
    draw()
    expect(screen.getByRole('textbox', { name: 'External ID' })).toHaveValue('12')
    expect(screen.queryByRole('textbox', { name: 'External Id' })).toBeNull()
  })
})
