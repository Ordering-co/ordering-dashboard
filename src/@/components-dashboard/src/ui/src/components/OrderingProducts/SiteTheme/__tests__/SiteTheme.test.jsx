/* eslint-disable import/first */
// redesign (lot D, decisions 7 and 8; OP-07, OP-14, OP-16): the Theme tab on Product controls.
// Covered: the skeleton while it loads; a failed load (notice with the reason and «Try again», no theme to assign); no theme (assign,
// and its error under the button); a theme (a section paints its blocks, A -> B shows B's value, a checkbox counts «1 unsaved change»,
// Discard goes back, «Update» is there without changes and sends the values, the error of an update is visible, a color shows its
// hex, the leave guard knows the tab is dirty). The controller is a stand-in that gives the props the real one gives; the C18 select
// and the color panel (legacy pieces with their own tests) are stand-ins that emit one value.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockState = vi.hoisted(() => ({ controller: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children, childRef }) => <div><input type='file' hidden ref={childRef} />{children}</div>,
  SiteTheme: ({ UIComponent, ...props }) => <UIComponent {...props} {...mockState.controller} />
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  ImageCrop: () => null,
  Modal: () => null
}))
// the C18 select: a native select that names itself with `ariaLabel` and emits the value of the option
vi.mock('../../../Shared/UI/FirstSelect', () => ({
  FirstSelect: ({ options = [], defaultValue, onChange, placeholder, ariaLabel }) => (
    <select
      aria-label={ariaLabel}
      defaultValue={defaultValue == null ? '' : String(defaultValue)}
      onChange={event => onChange(options.find(option => String(option.value) === event.target.value)?.value)}
    >
      <option value=''>{placeholder}</option>
      {options.map(option => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.content?.props ? option.content.props.children : option.content}
        </option>
      ))}
    </select>
  )
}))
// the color panel: it shows nothing; ColorField draws the value beside it
vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor, onChangeColor }) => (
    <button type='button' className='od-color-picker-trigger' onClick={() => onChangeColor('#abcdef')}>{`swatch ${defaultColor}`}</button>
  )
}))

import { LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product'
import { SiteTheme } from '../index'

const blockStructure = {
  title: { value_type: 'string' },
  color: { value_type: 'string' },
  visible: { value_type: 'boolean' }
}

const themeRecord = () => ({
  id: 1,
  theme_id: 5,
  theme: {
    values_default: {
      home: { hidden: false, components: { banner: { title: 'Home banner', color: '#112233', visible: true } } },
      menu: { hidden: false, components: { banner: { title: 'Menu banner', color: '#445566', visible: false } } },
      extras: { hidden: false, components: { image: 'https://example.test/a.jpg', slug: 'grid', card: { borderRadius: '8', align: 'left' } } }
    },
    structure: {
      home: { hidden: { value_type: 'boolean' }, components: { banner: { ...blockStructure } } },
      menu: { hidden: { value_type: 'boolean' }, components: { banner: { ...blockStructure } } },
      extras: {
        components: {
          image: { value_type: 'string' },
          slug: { value_type: 'string', options: ['grid', 'list'] },
          card: { borderRadius: { value_type: 'string' }, align: { value_type: 'string', options: ['left', 'right'] } }
        }
      }
    }
  },
  values: {}
})

const baseValues = () => themeRecord().theme.values_default

const setController = (overrides = {}) => {
  mockState.controller = {
    siteThemesState: { loading: false, result: [themeRecord()], error: null },
    themesList: { loading: false, result: [{ id: 3, name: 'classic_theme', values_default: {} }], error: null },
    actionState: { loading: false, error: null },
    selectedTheme: null,
    handleSelectTheme: vi.fn(),
    handleAssignTheme: vi.fn(async () => ({ error: false, result: {} })),
    handleUpdateSiteTheme: vi.fn(async () => ({ error: false, result: [] })),
    handleAddThemeGallery: vi.fn(),
    getSiteTheme: vi.fn(),
    getThemes: vi.fn(),
    ...overrides
  }
  return mockState.controller
}

const openSection = async (user, section = 'home') => {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Section' }), section)
}

describe('SiteTheme', () => {
  beforeEach(() => {
    setController()
  })

  it('draws a busy skeleton with a hidden «Loading» while the theme loads', () => {
    setController({ siteThemesState: { loading: true, result: [], error: null } })
    render(<SiteTheme siteId={7} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(within(status).getByText('Loading')).toBeInTheDocument()
  })

  it('OP-07: a failed load says why, offers «Try again» and does not offer to assign a theme', async () => {
    const controller = setController({ siteThemesState: { loading: false, result: [], error: ['Unauthorized'] } })
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    expect(screen.getByText('Unauthorized')).toBeInTheDocument()
    expect(screen.queryByText('Select theme')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(controller.getSiteTheme).toHaveBeenCalledTimes(1)
  })

  it('OP-07: a failed load without a reason says the translated fallback', () => {
    setController({ siteThemesState: { loading: false, result: [], error: [] } })
    render(<SiteTheme siteId={7} />)
    expect(screen.getByText("We couldn't load this theme.")).toBeInTheDocument()
  })

  it('without a theme: «Save» waits for a chosen theme, assigns it and says the error under the button', async () => {
    const controller = setController({
      siteThemesState: { loading: false, result: [], error: null },
      handleAssignTheme: vi.fn(async () => ({ error: true, result: ['Not allowed'] }))
    })
    const user = userEvent.setup()
    const { rerender } = render(<SiteTheme siteId={7} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), '3')
    expect(controller.handleSelectTheme).toHaveBeenCalledWith(3)

    setController({ ...controller, selectedTheme: { id: 3 } })
    rerender(<SiteTheme siteId={7} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(controller.handleAssignTheme).toHaveBeenCalledWith({ inlineError: true })
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
  })

  it('without a theme, a failed list of themes says so with «Try again»', async () => {
    const controller = setController({
      siteThemesState: { loading: false, result: [], error: null },
      themesList: { loading: false, result: [], error: ['Themes are down'] }
    })
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    expect(screen.getByText('Themes are down')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(controller.getThemes).toHaveBeenCalledTimes(1)
  })

  it('with a theme: a section paints its blocks with controls on the current values', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    expect(screen.queryByText('Page blocks')).toBeNull()
    await openSection(user, 'home')
    expect(screen.getByText('Page blocks')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Home banner')
    expect(screen.getByRole('checkbox', { name: 'visible' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hidden' })).not.toBeChecked()
  })

  it('OP-14: a color shows its hex as text', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    expect(screen.getByText('#112233')).toBeInTheDocument()
  })

  it('OP-16: going from section A to B with a block of the same name shows the values of B', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    await user.type(screen.getByRole('textbox', { name: 'title' }), '!')
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Home banner!')
    await openSection(user, 'menu')
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Menu banner')
    expect(screen.getByRole('checkbox', { name: 'visible' })).not.toBeChecked()
    expect(screen.getByText('#445566')).toBeInTheDocument()
    // and A keeps what was typed
    await openSection(user, 'home')
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Home banner!')
  })

  it('a checkbox counts «1 unsaved change» and Discard puts the value back', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    expect(screen.queryByText(/unsaved change/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'visible' }))
    expect(screen.getByRole('checkbox', { name: 'visible' })).not.toBeChecked()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Hidden' }))
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('checkbox', { name: 'visible' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hidden' })).not.toBeChecked()
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  // redesign (review r1, Q-09): the Discard button goes with the changes; the focus stays in the tab (its container), not the panel
  it('Q-09: after Discard the focus is on the tab itself (a container that can take it)', async () => {
    const user = userEvent.setup()
    const { container } = render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    await user.click(screen.getByRole('checkbox', { name: 'visible' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    const root = container.querySelector('.odc-op-theme')
    expect(root).toHaveAttribute('tabindex', '-1')
    expect(root).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  // redesign (live check): the record an update hands back may carry another id; the edited values stay
  it('a record handed back under another id after an update keeps the values on screen', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    await user.click(screen.getByRole('checkbox', { name: 'Hidden' }))
    await user.click(screen.getByRole('button', { name: 'Update' }))
    setController({ siteThemesState: { loading: false, result: [{ ...themeRecord(), id: 99, values: {} }], error: null } })
    rerender(<SiteTheme siteId={7} />)
    expect(screen.getByRole('checkbox', { name: 'Hidden' })).toBeChecked()
  })

  it('«Update» is there without changes and sends the values; with a change it sends the new ones', async () => {
    const controller = setController()
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    const update = screen.getByRole('button', { name: 'Update' })
    expect(update).toBeEnabled()
    await user.click(update)
    expect(controller.handleUpdateSiteTheme).toHaveBeenCalledWith(baseValues(), { inlineError: true })

    await openSection(user, 'home')
    await user.click(screen.getByRole('checkbox', { name: 'visible' }))
    await user.click(screen.getByRole('button', { name: 'Update' }))
    const sent = controller.handleUpdateSiteTheme.mock.calls[1][0]
    expect(sent.home.components.banner.visible).toBe(false)
    expect(sent.menu).toEqual(baseValues().menu)
    // a saved update is the new base: nothing is pending
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('a color picked in the field is sent as the new value', async () => {
    const controller = setController()
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'home')
    await user.click(screen.getByRole('button', { name: 'color #112233' }))
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(controller.handleUpdateSiteTheme.mock.calls[0][0].home.components.banner.color).toBe('#abcdef')
  })

  it('the error of an update is visible, translated, and goes away with the next change', async () => {
    setController({ handleUpdateSiteTheme: vi.fn(async () => ({ error: true, result: ['Theme is locked'] })) })
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Theme is locked')

    await openSection(user, 'home')
    await user.click(screen.getByRole('checkbox', { name: 'visible' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an update that fails without a reason says the translated fallback', async () => {
    setController({ handleUpdateSiteTheme: vi.fn(async () => ({ error: true, result: [] })) })
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't update this theme.")
  })

  it('an image block has a real button named «Choose image»', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'extras')
    const choose = screen.getByRole('button', { name: 'Choose image' })
    expect(choose.tagName).toBe('BUTTON')
    expect(choose).toHaveAttribute('type', 'button')
    expect(choose).toBeEnabled()
  })

  it('a block with choices and an option with choices are named selects that change the value', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'extras')
    const slug = screen.getByRole('combobox', { name: 'slug' })
    expect(slug).toHaveValue('grid')
    await user.selectOptions(slug, 'list')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'align' }), 'right')
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  })

  it('the border radius keeps the filter of main: past 99 the last digit is dropped', async () => {
    const user = userEvent.setup()
    render(<SiteTheme siteId={7} />)
    await openSection(user, 'extras')
    const radius = screen.getByRole('textbox', { name: 'borderRadius' })
    expect(radius).toHaveValue('8')
    await user.clear(radius)
    await user.type(radius, '120')
    expect(radius).toHaveValue('12')
  })

  it('registers its unsaved work in the leave guard', async () => {
    const hostRef = { current: null }
    const Harness = () => {
      const host = useLeaveGuardHost()
      hostRef.current = host
      return (
        <LeaveGuardContext.Provider value={host.context}>
          <SiteTheme siteId={7} />
        </LeaveGuardContext.Provider>
      )
    }
    const user = userEvent.setup()
    render(<Harness />)
    expect(hostRef.current.isDirty()).toBe(false)
    await openSection(user, 'home')
    await user.click(screen.getByRole('checkbox', { name: 'visible' }))
    expect(hostRef.current.isDirty()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(hostRef.current.isDirty()).toBe(false)
  })
})
