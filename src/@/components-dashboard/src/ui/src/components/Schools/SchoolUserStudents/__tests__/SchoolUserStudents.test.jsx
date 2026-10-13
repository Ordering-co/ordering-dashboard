/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()
const listGrades = vi.fn()
const listClassrooms = vi.fn()
const listParentStudents = vi.fn()
const createParentStudent = vi.fn()
const updateStudent = vi.fn()
const removeParentStudent = vi.fn()

const businessesChain = {
  asDashboard: () => businessesChain,
  select: () => businessesChain,
  where: () => businessesChain,
  get: () => Promise.resolve({ content: { result: [{ id: 67, name: 'Centreville' }], pagination: { total_pages: 1 } } })
}

vi.mock('../../../../../../index', () => ({
  useApi: () => [{ businesses: () => businessesChain }],
  useSession: () => [{ token: 'session-token' }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error', Success: 'success' }
}))

vi.mock('../../../../../../components/Schools/schoolApi', () => ({
  listGrades: (...args) => listGrades(...args),
  listClassrooms: (...args) => listClassrooms(...args),
  listParentStudents: (...args) => listParentStudents(...args),
  createParentStudent: (...args) => createParentStudent(...args),
  updateStudent: (...args) => updateStudent(...args),
  removeParentStudent: (...args) => removeParentStudent(...args)
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ placeholder, options = [], onChange }) => (
    <div>
      <span>{placeholder}</span>
      {options.map((opt) => (
        <button key={opt.value} type='button' onClick={() => onChange(opt.value)}>{opt.content}</button>
      ))}
    </div>
  )
}))

vi.mock('../../../../styles/MultiSelect', () => ({
  MultiSelect: () => null
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, onClick, disabled }) => <button type='button' onClick={onClick} disabled={disabled}>{children}</button>,
  Input: (props) => <input {...props} />
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div data-testid='modal'>{children}</div> : null),
  Confirm: () => null,
  SpinnerLoader: () => <div data-testid='spinner' />
}))

import { SchoolUserStudents } from '..'

const openFormAndFillRequired = async () => {
  fireEvent.click(screen.getByText('Add student'))
  fireEvent.click(await screen.findByText('Centreville'))
  await screen.findByText('Room A')
  const inputs = screen.getByTestId('modal').querySelectorAll('input')
  fireEvent.change(inputs[0], { target: { value: 'Ada' } })
  fireEvent.change(inputs[1], { target: { value: 'Lovelace' } })
  fireEvent.click(screen.getByText('Room A'))
}

beforeEach(() => {
  vi.clearAllMocks()
  listGrades.mockResolvedValue({ error: false, result: [{ id: 5, name: '5th' }] })
  listClassrooms.mockResolvedValue({ error: false, result: [{ id: 10, name: 'Room A' }] })
  listParentStudents.mockResolvedValue({ error: false, result: [] })
  createParentStudent.mockResolvedValue({ error: false, result: { id: 9 } })
})

describe('SchoolUserStudents', () => {
  it('requires a grade before creating the student', async () => {
    renderWithProviders(<SchoolUserStudents userId={1} />)
    await openFormAndFillRequired()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'Grade is required'))
    expect(createParentStudent).not.toHaveBeenCalled()
  })

  it('creates the student with the picked grade', async () => {
    renderWithProviders(<SchoolUserStudents userId={1} />)
    await openFormAndFillRequired()
    fireEvent.click(screen.getByText('5th'))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(createParentStudent).toHaveBeenCalledWith(
      expect.anything(), 'session-token', 1, expect.objectContaining({ grade_id: 5, classroom_id: 10, school_id: 67 })
    ))
    expect(showToast).not.toHaveBeenCalledWith('error', 'Grade is required')
  })

  it('does not require a grade when the school has none configured', async () => {
    listGrades.mockResolvedValue({ error: false, result: [] })
    renderWithProviders(<SchoolUserStudents userId={1} />)
    await openFormAndFillRequired()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(createParentStudent).toHaveBeenCalled())
    expect(showToast).not.toHaveBeenCalledWith('error', 'Grade is required')
  })
})
