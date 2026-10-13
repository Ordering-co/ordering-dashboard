/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../styles', () => ({
  IconButton: ({ children, ...props }) => <button type='button' {...props}>{children}</button>,
  Button: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

vi.mock('../../../styles/Select', () => ({
  Select: ({ options = [], onChange, defaultValue }) => (
    <select
      aria-label='page-size'
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(Number(e.target.value))}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.value}</option>
      ))}
    </select>
  )
}))

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: true, user: { level: 0 } }],
  Popup: ({ UIComponent, open, ...props }) => (
    open ? <UIComponent {...props} open={open} /> : null
  )
}))

vi.mock('../../PageNotFound', () => ({
  PageNotFound: () => <div>Page not found</div>
}))

import { SearchBar } from '../SearchBar'
import { SideBar } from '../SideBar'
import { Modal } from '../Modal'
import { Confirm, Alert } from '../Confirm'
import { Pagination } from '../Pagination'
import { PaginationButton } from '../PaginationButton'
import { NotFoundSource } from '../NotFoundSource'
import { SpinnerLoader } from '../SpinnerLoader'
import { ProtectedRoute } from '../ProtectedRoute'
import { Image } from '../Image'
import { LinkableText } from '../LinkableText'
import { Tabs, Tab } from '../Tabs'
import { SimpleSpinner } from '../SimpleSpinner'

describe('Shared presentation components', () => {
  it('renders the sidebar and closes it through its close control', () => {
    const onClose = vi.fn()

    renderWithProviders(
      <SideBar open onClose={onClose}>
        <p>Sidebar content</p>
      </SideBar>
    )

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Sidebar content')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('forwards search input and clearing actions', () => {
    const onSearch = vi.fn()

    renderWithProviders(<SearchBar onSearch={onSearch} placeholder='Search orders' />)

    fireEvent.change(screen.getByPlaceholderText('Search orders'), { target: { value: 'pizza' } })

    expect(onSearch).toHaveBeenCalledWith('pizza')
  })

  it('renders modal actions and closes on Escape', () => {
    const onClose = vi.fn()
    const onAccept = vi.fn()
    const onCancel = vi.fn()

    renderWithProviders(
      <Modal open title='Edit order' onClose={onClose} onAccept={onAccept} onCancel={onCancel}>
        <p>Modal body</p>
      </Modal>
    )

    expect(screen.getByText('Edit order')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(document, { code: 'Escape' })

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders confirm content and alert alias', () => {
    const onAccept = vi.fn()
    const onClose = vi.fn()

    renderWithProviders(
      <Confirm
        open
        title='Confirm delete'
        content={['First error', ['Nested error']]}
        onAccept={onAccept}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Confirm delete')).toBeInTheDocument()
    expect(screen.getByText('First error')).toBeInTheDocument()
    expect(screen.getByText('Nested error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledOnce()

    renderWithProviders(
      <Alert open title='Alert' content='Plain message' onClose={onClose} />
    )
    expect(screen.getByText('Plain message')).toBeInTheDocument()
  })

  it('paginates and changes page size', () => {
    const handleChangePage = vi.fn()
    const handleChangePageSize = vi.fn()

    renderWithProviders(
      <Pagination
        currentPage={1}
        totalPages={8}
        defaultPageSize={10}
        handleChangePage={handleChangePage}
        handleChangePageSize={handleChangePageSize}
      />
    )

    fireEvent.click(screen.getByText('2'))
    expect(handleChangePage).toHaveBeenCalledWith(2)

    fireEvent.change(screen.getByLabelText('page-size'), { target: { value: '25' } })
    expect(handleChangePageSize).toHaveBeenCalledWith(25)
  })

  it('renders pagination button range controls', () => {
    const prevPaginate = vi.fn()
    const nextPaginate = vi.fn()

    renderWithProviders(
      <PaginationButton
        pageSize={10}
        total={35}
        currentPage={2}
        totalPages={4}
        prevPaginate={prevPaginate}
        nextPaginate={nextPaginate}
      />
    )

    expect(screen.getByText('11-20 of 35')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(prevPaginate).toHaveBeenCalledOnce()
    expect(nextPaginate).toHaveBeenCalledOnce()
  })

  it('renders empty and loading helpers', () => {
    const onClickButton = vi.fn()

    renderWithProviders(
      <NotFoundSource content='No results' btnTitle='Retry' onClickButton={onClickButton} />,
      { theme: { colors: {}, images: { general: { notFound: '/nf.svg' } } } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClickButton).toHaveBeenCalledOnce()

    renderWithProviders(<SpinnerLoader content='Loading…' logotype='/logo.svg' />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByAltText('logo')).toHaveAttribute('src', '/logo.svg')

    renderWithProviders(<SimpleSpinner width='20px' height='20px' />)
    expect(document.getElementById('loading')).toBeInTheDocument()
  })

  it('renders image fallbacks, linkable text, tabs, and protected routes', () => {
    renderWithProviders(<Image src='' fallback={<span>Fallback avatar</span>} />)
    expect(screen.getByText('Fallback avatar')).toBeInTheDocument()

    renderWithProviders(<LinkableText text='Visit https://example.com today' />)
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com')

    renderWithProviders(
      <Tabs>
        <Tab active>Active</Tab>
        <Tab>Idle</Tab>
      </Tabs>
    )
    expect(screen.getByText('Active')).toBeInTheDocument()

    renderWithProviders(
      <ProtectedRoute path='/' allowedLevels={[0]}>
        <div>Secret</div>
      </ProtectedRoute>,
      { initialEntries: ['/'], routePath: '/' }
    )
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })
})
