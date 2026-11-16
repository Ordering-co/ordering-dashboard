/* eslint-disable import/first */
// redesign the selects of the Theme tab live inside `.odc-record-body` (overflow-y: auto). Drawn in place, the list opened
// upwards and was clipped by that body (one of 26 options visible, no mouse click reached an option). They use FirstSelect's `portal`
// mode, so the list is drawn in the shared layer host, above everything, and a click on an option picks it.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { ThemeSelect } from '../ThemeOption'

afterEach(() => document.getElementById('app-modals')?.remove())

const options = ['home', 'menu', 'checkout'].map(key => ({ value: key, content: <span>{key}</span> }))

const renderSelect = (onChange = vi.fn()) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <div className='odc-record-body' data-testid='body' style={{ overflowY: 'auto' }}>
      <ThemeSelect label='Section' placeholder='Select a section to customize' options={options} value={undefined} onChange={onChange} />
    </div>
  </ThemeProvider>
)

describe('ThemeSelect · inside a scrolling record body', () => {
  it('draws the list outside the body that clips it', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(screen.getByRole('button', { name: /Section/ }))
    const list = await screen.findByRole('listbox')
    expect(screen.getByTestId('body').contains(list)).toBe(false)
    expect(document.getElementById('app-modals').contains(list)).toBe(true)
  })

  it('a mouse click on an option picks it and closes the list', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderSelect(onChange)
    await user.click(screen.getByRole('button', { name: /Section/ }))
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'menu' }))
    expect(onChange).toHaveBeenCalledWith('menu')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
