import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessesList } from './index'

const h = vi.hoisted(() => ({
  session: { user: { id: 7, level: 0 } }
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  useSession: () => [h.session]
}))

vi.mock('../../Shared', async () => {
  const React = await import('react')
  return {
    ColumnAllowSettingPopover: ({ optionsDefault, handleChangeAllowColumns }) => {
      const [open, setOpen] = React.useState(false)
      return (
        <div>
          <button type='button' aria-label='Choose columns' onClick={() => setOpen(!open)}>Columns</button>
          {open && optionsDefault.map(option => (
            <button key={option.value} type='button' onClick={() => handleChangeAllowColumns(option.value)}>
              {option.content}
            </button>
          ))}
        </div>
      )
    },
    Pagination: () => null
  }
})

vi.mock('../SingleBusiness', async () => {
  const React = await import('react')
  return {
    SingleBusiness: ({ business }) => (
      <tbody>
        <tr><td>{business?.name}</td></tr>
      </tbody>
    )
  }
})

const business = { id: 17, name: 'Sample store', featured: false, enabled: true }

const renderList = (user) => {
  h.session.user = user ? { id: 7, ...user } : null
  const callbacks = {
    handleEnableAllBusiness: vi.fn(),
    setBusinessIds: vi.fn()
  }
  const view = render(
    <ThemeProvider theme={theme}>
      <BusinessesList
        viewMethod='list'
        businessList={{ loading: false, businesses: [business] }}
        pagination={null}
        loadMoreBusinesses={vi.fn()}
        handleSucessRemoveBusiness={vi.fn()}
        handleSucessAddBusiness={vi.fn()}
        handleSucessUpdateBusiness={vi.fn()}
        handleOpenBusinessDetails={vi.fn()}
        handleOpenAddBusiness={vi.fn()}
        getPageBusinesses={vi.fn()}
        isTutorialMode={false}
        businessIds={[business.id]}
        handleChangeBusinessIds={vi.fn()}
        handleEnableAllBusiness={callbacks.handleEnableAllBusiness}
        selectedBusinessActiveState
        setBusinessIds={callbacks.setBusinessIds}
        handleGotToAdd={vi.fn()}
        citiesList={[]}
        isUseQuery={false}
        allowBusinessRegister={false}
        isEatstreetProject={false}
      />
    </ThemeProvider>
  )
  return { ...view, callbacks }
}

describe('BusinessesList Featured controls', () => {
  beforeEach(() => {
    h.session.user = { id: 7, level: 0 }
  })

  it('offers admins the Featured column choice and bulk switch callbacks', () => {
    const { container, callbacks } = renderList({ level: 0 })

    expect(screen.getByRole('columnheader', { name: 'Featured' })).toBeInTheDocument()
    fireEvent.click(container.querySelector('input[type=checkbox]'))
    expect(callbacks.handleEnableAllBusiness).toHaveBeenCalledWith(true, true)

    fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }))
    fireEvent.click(screen.getByRole('button', { name: 'Featured' }))
    expect(screen.queryByRole('columnheader', { name: 'Featured' })).not.toBeInTheDocument()
  })

  it.each([
    ['level 2 user', { level: 2 }],
    ['missing user', null]
  ])('hides Featured controls but keeps the enabled bulk switch for a %s', (_role, user) => {
    const { container, callbacks } = renderList(user)

    expect(screen.queryByRole('columnheader', { name: 'Featured' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }))
    expect(screen.queryByRole('button', { name: 'Featured' })).not.toBeInTheDocument()

    const switches = container.querySelectorAll('input[type=checkbox]')
    expect(switches).toHaveLength(1)
    fireEvent.click(switches[0])
    expect(callbacks.handleEnableAllBusiness).toHaveBeenCalledWith(false)
  })
})
