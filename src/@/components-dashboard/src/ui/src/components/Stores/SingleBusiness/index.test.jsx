import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { SingleBusiness } from './index'

const h = vi.hoisted(() => ({
  session: { user: { id: 7, level: 0 } }
}))

vi.mock('../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    useSession: () => [h.session],
    useUtils: () => [{ optimizeImage: image => image }],
    BusinessDetails: ({ UIComponent, business, ...props }) => React.createElement(UIComponent, {
      ...props,
      businessState: { business, loading: false }
    })
  }
})

const business = {
  id: 17,
  name: 'Sample store',
  enabled: true,
  featured: false,
  reviews: { total: 2 }
}

const renderRow = (user) => {
  h.session.user = user ? { id: 7, ...user } : null
  const handleChangeActiveBusiness = vi.fn()
  const view = render(
    <ThemeProvider theme={theme}>
      <table>
        <SingleBusiness
          viewMethod='list'
          allowColumns={{ business: true, featured: true, ratings: true }}
          business={business}
          businessId={business.id}
          detailsBusinessId='0'
          businessIds={[]}
          handleChangeBusinessIds={vi.fn()}
          handleChangeActiveBusiness={handleChangeActiveBusiness}
          handleOpenBusinessDetails={vi.fn()}
          citiesList={[]}
          isEatstreetProject={false}
        />
      </table>
    </ThemeProvider>
  )
  return { ...view, handleChangeActiveBusiness }
}

describe('SingleBusiness Featured control', () => {
  beforeEach(() => {
    h.session.user = { id: 7, level: 0 }
  })

  it('shows the row Featured switch to admins and preserves switch callbacks', () => {
    const { container, handleChangeActiveBusiness } = renderRow({ level: 0 })
    expect(container.querySelector('.featured input[type=checkbox]')).toBeInTheDocument()

    const switches = container.querySelectorAll('input[type=checkbox]')
    expect(switches).toHaveLength(2)
    fireEvent.click(switches[0])
    expect(handleChangeActiveBusiness).toHaveBeenCalledWith(true, true)
    fireEvent.click(container.querySelectorAll('input[type=checkbox]')[1])
    expect(handleChangeActiveBusiness).toHaveBeenNthCalledWith(2, false)
    expect(screen.getByText('Enable')).toBeInTheDocument()
  })

  it.each([
    ['level 2 user', { level: 2 }],
    ['missing user', null]
  ])('hides the row Featured switch but keeps the enabled switch for a %s', (_role, user) => {
    const { container, handleChangeActiveBusiness } = renderRow(user)
    expect(container.querySelector('.featured input[type=checkbox]')).toBeNull()

    const switches = container.querySelectorAll('input[type=checkbox]')
    expect(switches).toHaveLength(1)
    fireEvent.click(switches[0])
    expect(handleChangeActiveBusiness).toHaveBeenCalledWith(false)
    expect(screen.getByText('Enable')).toBeInTheDocument()
  })
})
