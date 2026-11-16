/* eslint-disable import/first */
// redesign (Q-02): the control of a string option (text or color) is decided once, when the option mounts, with the value it
// has then. Typing `#ff0000` passes through `#ff0` (a valid hex): the field must stay the same text field, with its focus.
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children, childRef }) => <div><input type='file' hidden ref={childRef} />{children}</div>
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  ImageCrop: () => null,
  Modal: () => null
}))
vi.mock('../../../Shared/UI/FirstSelect', () => ({ FirstSelect: () => null }))
vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor }) => <button type='button' className='od-color-picker-trigger'>{`swatch ${defaultColor}`}</button>
}))

import { ThemeOption, getThemeChoices } from '../ThemeOption'

// the tab keeps the value and hands it back to the option, as SiteTheme does
const Host = ({ initial }) => {
  const [value, setValue] = useState(initial)
  return (
    <ThemeOption
      name='buttonTextColor'
      optionObject={{ value_type: 'string' }}
      valueObject={value}
      path='home.buttonTextColor'
      onChange={(_path, next) => setValue(next)}
      handleAddThemeGallery={() => {}}
    />
  )
}

describe('ThemeOption · text or color', () => {
  it('Q-02: typing #ff0000 in a text field keeps #ff0000 and the same field with the focus', async () => {
    const user = userEvent.setup()
    render(<Host initial='' />)
    const field = screen.getByRole('textbox', { name: 'buttonTextColor' })
    await user.click(field)
    await user.keyboard('#ff0000')
    const after = screen.getByRole('textbox', { name: 'buttonTextColor' })
    expect(after).toBe(field)
    expect(after).toHaveValue('#ff0000')
    expect(after).toHaveFocus()
  })

  it('a value that already is a color keeps showing the color field', () => {
    render(<Host initial='#112233' />)
    expect(screen.queryByRole('textbox', { name: 'buttonTextColor' })).toBeNull()
    expect(screen.getByText('#112233')).toBeInTheDocument()
    expect(document.querySelector('.od-color-picker-trigger')).not.toBeNull()
  })
})

// redesign J5 row 48 (ordering-products P-4, ): the section and option choices are theme keys too
describe('getThemeChoices', () => {
  it('names a known theme key through its literal THEME_TITLE_ key, and keeps the old key for any other choice', () => {
    const t = (key, fallback) => ({ THEME_TITLE_HOMEPAGE_VIEW: 'vista de inicio', SOME_CHOICE: 'una opción' }[key] ?? fallback)
    const [known, other, number] = getThemeChoices(t, ['homepage_view', 'some_choice', 3])
    render(<>{known.content}{other.content}{number.content}</>)
    expect(screen.getByText('vista de inicio')).toBeInTheDocument()
    expect(screen.getByText('una opción')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(known.value).toBe('homepage_view')
  })
})

// redesign bugs Q, final review: the «profile» section has a group whose entry is a bare string (no value_type). The branch that
// walks a group's keys walked the string's characters too («a» → «0» → «a» …) and never ended, which crashed the tab (also in main).
describe('ThemeOption · a bare string inside a group', () => {
  it('draws the group and stops at the string instead of walking its characters', () => {
    render(
      <ThemeOption
        name='layout'
        optionObject={{ type: 'grid', columns: { value_type: 'number' } }}
        valueObject={{}}
        path='profile.components.address_list.components.layout'
        onChange={() => {}}
      />
    )
    expect(document.body.textContent).not.toMatch(/\b0\b.*\b0\b.*\b0\b/)
  })
})
