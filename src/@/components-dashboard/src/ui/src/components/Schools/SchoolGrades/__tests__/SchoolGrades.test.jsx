/* eslint-disable import/first */
// redesign SC-B2 (decision 4; M-SC03, M-SC06, M-SC10, M-SC11): the Grades tab as a Product DataTable (RecordCards under 768px) with a
// dialog to add and edit, a danger confirmation to delete and a retry when the load fails. The Product wrappers, the shared B1 pieces
// (useSchoolList, SchoolListError, schoolDisplay) and U/FirstSelect are real; the app contexts and the API (K/schoolApi) are doubles.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mocks = vi.hoisted(() => ({
  phone: false,
  catalog: {},
  showToast: vi.fn(),
  api: {
    listGrades: vi.fn(),
    createGrade: vi.fn(),
    updateGrade: vi.fn(),
    deleteGrade: vi.fn(),
    bulkGrades: vi.fn()
  }
}))

vi.mock('../../../../../../index', () => ({
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'tok' }],
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mocks.catalog[key] ?? text],
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../components/Schools/schoolApi', () => mocks.api)
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { SchoolGrades } from '../index'

const SCHOOL = { id: 7, name: 'Lincoln' }
const ROWS = [
  { id: 1, name: 'First graders', code: 'g1' },
  { id: 2, name: 'Little ones', code: 'pre_k' },
  { id: 3, name: 'Mixed', code: 'legacy_code' },
  { id: 4, name: 'No code', code: null }
]
const ok = (result, pagination = { current_page: 1, total_pages: 1, total: result.length }) => ({ error: false, result, pagination })
const fail = (result) => ({ error: true, result })
const deferred = () => {
  let finish
  const promise = new Promise((resolve) => { finish = resolve })
  return { promise, resolve: finish }
}

const draw = (props = {}) => {
  const onPageChange = vi.fn()
  render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SchoolGrades school={SCHOOL} initialPage={1} onPageChange={onPageChange} {...props} />
    </ThemeProvider>
  )
  return { onPageChange }
}

const table = () => screen.findByRole('table', { name: 'Grades' })
const rowOf = async (name) => (await screen.findByRole('rowheader', { name })).closest('tr')
const dialog = () => screen.findByRole('dialog')

beforeEach(() => {
  mocks.phone = false
  mocks.catalog = {}
  mocks.showToast.mockReset()
  Object.values(mocks.api).forEach((fn) => fn.mockReset())
  mocks.api.listGrades.mockResolvedValue(ok(ROWS))
  mocks.api.createGrade.mockResolvedValue({ error: false, result: { id: 9 } })
  mocks.api.updateGrade.mockResolvedValue({ error: false, result: { id: 1 } })
  mocks.api.deleteGrade.mockResolvedValue({ error: false, result: {} })
  mocks.api.bulkGrades.mockResolvedValue({ error: false, result: [] })
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('the list', () => {
  it('loads the grades of the school at initialPage with the page size of main (10)', async () => {
    draw({ initialPage: 2 })
    await table()
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(1)
    expect(mocks.api.listGrades).toHaveBeenCalledWith({ root: 'https://api.test' }, 'tok', { schoolId: 7, page: 2, pageSize: 10 })
  })

  it('draws the name as the row header and the code as its translated name', async () => {
    draw()
    const root = await table()
    expect(within(root).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Code', 'Actions'])
    const first = await rowOf('First graders')
    expect(within(first).getAllByRole('cell')[0]).toHaveTextContent('Grade 1')
    expect(within(first).getAllByRole('cell')[0]).toHaveTextContent('g1')
    expect(within(await rowOf('Little ones')).getAllByRole('cell')[0]).toHaveTextContent('Pre-K')
  })

  it('never paints a raw code alone: a name that differs shows the code behind it, an unknown code shows once, no code is a dash', async () => {
    draw()
    await table()
    expect((await rowOf('First graders')).textContent).toMatch(/Grade 1\s*·\s*g1/)
    const mixed = await rowOf('Mixed')
    expect(mixed.textContent.match(/legacy_code/g)).toHaveLength(1)
    expect(within(mixed).getAllByRole('cell')[0]).not.toHaveTextContent('·')
    expect(within(await rowOf('No code')).getAllByRole('cell')[0]).toHaveTextContent('—')
  })

  it('the last column has no visible title and two visible actions per row, none behind a menu', async () => {
    draw()
    const first = await rowOf('First graders')
    expect(within(first).getByRole('button', { name: 'Edit grade First graders' })).toHaveTextContent('Edit')
    expect(within(first).getByRole('button', { name: 'Delete grade First graders' })).toBeInTheDocument()
    expect(within(first).queryByRole('menu')).toBeNull()
    expect(document.querySelector('thead th:last-child .odc-sr-only')).toHaveTextContent('Actions')
  })

  it('shows skeletons while it loads', async () => {
    const pending = deferred()
    mocks.api.listGrades.mockReturnValue(pending.promise)
    draw()
    const root = await screen.findByRole('table', { name: 'Grades' })
    expect(root).toHaveAttribute('aria-busy', 'true')
    expect(root.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    pending.resolve(ok(ROWS))
    await rowOf('First graders')
  })

  it('an empty school says «No grades yet» with a way to add one, and no pagination', async () => {
    mocks.api.listGrades.mockResolvedValue(ok([], { current_page: 1, total_pages: 1, total: 0 }))
    draw()
    expect(await screen.findByText('No grades yet')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    await userEvent.click(within(document.querySelector('.odc-state')).getByRole('button', { name: 'Add grade' }))
    expect(await dialog()).toBeInTheDocument()
  })

  it('does not call the API without a school', async () => {
    draw({ school: undefined })
    await waitFor(() => expect(screen.getByText('No grades yet')).toBeInTheDocument())
    expect(mocks.api.listGrades).not.toHaveBeenCalled()
  })

  it('draws the pagination with the sizes 10 / 25 / 50 and follows it (page and onPageChange)', async () => {
    mocks.api.listGrades.mockResolvedValue(ok(ROWS, { current_page: 1, total_pages: 3, total: 25 }))
    const { onPageChange } = draw()
    await table()
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    await waitFor(() => expect(mocks.api.listGrades).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 }))
  })
})

describe('a list that fails to load (M-SC03)', () => {
  it('says so with «Retry», never «No grades yet», and «Retry» loads it again', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(fail(['Network down']))
    draw()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Network down')
    expect(screen.queryByText('No grades yet')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await rowOf('First graders')
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the toolbar usable', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(fail('nope'))
    draw()
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Add grade' })).toBeEnabled()
  })
})

describe('the toolbar', () => {
  it('«Add grade» opens an empty dialog titled «Add grade»', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    expect(within(root).getByRole('heading', { name: 'Add grade' })).toBeInTheDocument()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('')
  })

  // redesign D-79 (owner, 2026-10-19): «Create from catalog» asks first (C8, tone primary) and says how many grades it adds
  const openSeedConfirm = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Create from catalog' }))
    return screen.findByRole('alertdialog')
  }

  it('«Create from catalog» asks first: title, the count as «up to», «Create grades», focus on Cancel, and calls nothing yet', async () => {
    draw()
    await table()
    const root = await openSeedConfirm()
    expect(within(root).getByRole('heading', { name: 'Create grades from the catalog?' })).toBeInTheDocument()
    expect(root).toHaveTextContent('This adds up to 14 grades to this school. You can delete them one by one.')
    expect(within(root).getByRole('button', { name: 'Create grades' })).toBeInTheDocument()
    await waitFor(() => expect(within(root).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.api.bulkGrades).not.toHaveBeenCalled()
  })

  it('Cancel in the «Create from catalog» confirmation closes it and does not call bulkGrades', async () => {
    draw()
    await table()
    const root = await openSeedConfirm()
    await userEvent.click(within(root).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.api.bulkGrades).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Create from catalog' })).toBeEnabled()
  })

  it('confirming calls bulkGrades with the school, busy while it runs, then toasts, closes and loads page 1', async () => {
    const pending = deferred()
    mocks.api.bulkGrades.mockReturnValue(pending.promise)
    const { onPageChange } = draw({ initialPage: 2 })
    await table()
    const button = screen.getByRole('button', { name: 'Create from catalog' })
    const root = await openSeedConfirm()
    const confirm = within(root).getByRole('button', { name: 'Create grades' })
    await userEvent.click(confirm)
    expect(mocks.api.bulkGrades).toHaveBeenCalledWith({ root: 'https://api.test' }, 'tok', { school_id: 7 })
    // busy while it runs: a second press does nothing
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
    expect(within(root).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.click(confirm)
    expect(mocks.api.bulkGrades).toHaveBeenCalledTimes(1)
    pending.resolve({ error: false, result: [] })
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Grades created from catalog'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(mocks.api.listGrades).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 1, pageSize: 10 }))
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(button).not.toHaveAttribute('aria-busy')
  })

  it('«Create from catalog» that fails (after confirming) shows the error of the API in a toast, closes the confirmation and does not reload', async () => {
    mocks.api.bulkGrades.mockResolvedValue(fail(['Already seeded']))
    draw()
    await table()
    const root = await openSeedConfirm()
    await userEvent.click(within(root).getByRole('button', { name: 'Create grades' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Already seeded'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(1)
  })
})

describe('add and edit', () => {
  it('a row opens the edit dialog with its values', async () => {
    draw()
    await userEvent.click(await rowOf('First graders'))
    const root = await dialog()
    expect(within(root).getByRole('heading', { name: 'Edit grade' })).toBeInTheDocument()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('First graders')
    expect(within(root).getByRole('button', { name: /Code/ })).toHaveTextContent('Grade 1')
  })

  it('«Edit» opens the same dialog', async () => {
    draw()
    await userEvent.click(within(await rowOf('Little ones')).getByRole('button', { name: 'Edit grade Little ones' }))
    const root = await dialog()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('Little ones')
    expect(within(root).getByRole('button', { name: /Code/ })).toHaveTextContent('Pre-K')
  })

  it('an empty name marks the field, shows the toast of main, focuses the field and calls nothing', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    const field = within(root).getByRole('textbox', { name: /Name/ })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(within(root).getByText('Name is required')).toBeInTheDocument()
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Name is required')
    await waitFor(() => expect(field).toHaveFocus())
    expect(mocks.api.createGrade).not.toHaveBeenCalled()
    expect(mocks.api.updateGrade).not.toHaveBeenCalled()
  })

  it('a name of only spaces is also empty', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), '   ')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    expect(mocks.api.createGrade).not.toHaveBeenCalled()
  })

  it('typing clears the error', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    expect(within(root).getByText('Name is required')).toBeInTheDocument()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'A')
    await waitFor(() => expect(within(root).queryByText('Name is required')).toBeNull())
  })

  it('create sends { school_id, code, name }, toasts, closes and reloads the current page', async () => {
    mocks.api.listGrades.mockResolvedValue(ok(ROWS, { current_page: 2, total_pages: 3, total: 25 }))
    draw({ initialPage: 2 })
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Second graders')
    fireEvent.click(within(root).getByRole('button', { name: /Code/ }))
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Grade 2' }))
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.createGrade).toHaveBeenCalledWith(
      { root: 'https://api.test' }, 'tok', { school_id: 7, code: 'g2', name: 'Second graders' }
    ))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Changes saved'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(mocks.api.listGrades).toHaveBeenCalledTimes(2))
    expect(mocks.api.listGrades).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 })
  })

  it('without choosing a code, create sends the empty code of main', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Free')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.createGrade).toHaveBeenCalledWith(
      expect.anything(), 'tok', { school_id: 7, code: '', name: 'Free' }
    ))
  })

  it('Enter in the name saves', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Quick{Enter}')
    await waitFor(() => expect(mocks.api.createGrade).toHaveBeenCalledTimes(1))
  })

  it('edit sends { code, name } to the grade', async () => {
    draw()
    await userEvent.click(await rowOf('First graders'))
    const root = await dialog()
    const field = within(root).getByRole('textbox', { name: /Name/ })
    await userEvent.clear(field)
    await userEvent.type(field, 'Firsts')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.updateGrade).toHaveBeenCalledWith(
      { root: 'https://api.test' }, 'tok', 1, { code: 'g1', name: 'Firsts' }
    ))
    expect(mocks.api.createGrade).not.toHaveBeenCalled()
  })

  it('«Save» is busy while it saves and a second press does nothing', async () => {
    const pending = deferred()
    mocks.api.createGrade.mockReturnValue(pending.promise)
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Slow')
    const save = within(root).getByRole('button', { name: 'Save' })
    await userEvent.click(save)
    await waitFor(() => expect(save).toHaveAttribute('aria-busy', 'true'))
    await userEvent.click(save)
    expect(mocks.api.createGrade).toHaveBeenCalledTimes(1)
    pending.resolve({ error: false, result: {} })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an error of the API leaves the dialog open with what was typed, and a toast', async () => {
    mocks.api.createGrade.mockResolvedValue(fail(['Name already taken']))
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Dup')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Name already taken'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('Dup')
    expect(within(root).getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy')
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(1)
  })

  it('an error of the API with no message still says something', async () => {
    mocks.api.createGrade.mockResolvedValue({ error: true })
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'X')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Something went wrong. Try again.'))
  })

  it('Cancel closes without calling the API; reopening starts from the new values', async () => {
    draw()
    await userEvent.click(await rowOf('First graders'))
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Add grade' }))
    expect(within(await dialog()).getByRole('textbox', { name: /Name/ })).toHaveValue('')
    expect(mocks.api.updateGrade).not.toHaveBeenCalled()
  })
})

describe('delete (decision 4; M-SC06, M-SC11)', () => {
  const openConfirm = async (name = 'First graders') => {
    await userEvent.click(within(await rowOf(name)).getByRole('button', { name: `Delete grade ${name}` }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, naming the grade, with the consequence, «Delete grade» and the focus on Cancel', async () => {
    draw()
    const root = await openConfirm()
    expect(within(root).getByRole('heading', { name: 'Delete grade "First graders"?' })).toBeInTheDocument()
    expect(root).toHaveTextContent('Delete this grade? Students keep working and lose this grade.')
    expect(within(root).getByRole('button', { name: 'Delete grade' })).toBeInTheDocument()
    await waitFor(() => expect(within(root).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.api.deleteGrade).not.toHaveBeenCalled()
  })

  it('the name goes in as text: «$&» in it is not a replacement pattern', async () => {
    mocks.api.listGrades.mockResolvedValue(ok([{ id: 5, name: 'Cost $& more', code: 'k' }]))
    draw()
    const root = await openConfirm('Cost $& more')
    expect(within(root).getByRole('heading', { name: 'Delete grade "Cost $& more"?' })).toBeInTheDocument()
  })

  it('Cancel closes without deleting', async () => {
    draw()
    const root = await openConfirm()
    await userEvent.click(within(root).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.api.deleteGrade).not.toHaveBeenCalled()
  })

  it('confirms: busy while it runs, deleteGrade with the id, toast, closes and reloads the current page', async () => {
    const pending = deferred()
    mocks.api.deleteGrade.mockReturnValue(pending.promise)
    mocks.api.listGrades.mockResolvedValue(ok(ROWS, { current_page: 2, total_pages: 3, total: 25 }))
    draw({ initialPage: 2 })
    const root = await openConfirm()
    const confirm = within(root).getByRole('button', { name: 'Delete grade' })
    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
    expect(mocks.api.deleteGrade).toHaveBeenCalledWith({ root: 'https://api.test' }, 'tok', 1)
    expect(within(root).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    pending.resolve({ error: false, result: {} })
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Grade deleted'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(mocks.api.listGrades).toHaveBeenCalledTimes(2))
    expect(mocks.api.listGrades).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 })
  })

  it('an error of the API closes the confirmation, toasts the error and does not reload', async () => {
    mocks.api.deleteGrade.mockResolvedValue(fail(['In use']))
    draw()
    const root = await openConfirm()
    await userEvent.click(within(root).getByRole('button', { name: 'Delete grade' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'In use'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.api.listGrades).toHaveBeenCalledTimes(1)
  })

  it('deleting the only row of the last page goes back one page (M-SC10)', async () => {
    mocks.api.listGrades
      .mockResolvedValueOnce(ok([{ id: 9, name: 'Lone', code: 'k' }], { current_page: 2, total_pages: 2, total: 11 }))
      .mockResolvedValueOnce(ok([], { current_page: 2, total_pages: 1, total: 10 }))
      .mockResolvedValueOnce(ok(ROWS, { current_page: 1, total_pages: 1, total: 10 }))
    const { onPageChange } = draw({ initialPage: 2 })
    const root = await openConfirm('Lone')
    await userEvent.click(within(root).getByRole('button', { name: 'Delete grade' }))
    await rowOf('First graders')
    expect(mocks.api.listGrades).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 1, pageSize: 10 })
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(screen.queryByText('No grades yet')).toBeNull()
  })
})

// redesign (T): the reload puts the table in its skeleton and unmounts the button that opened the dialog, so the focus fell on
// <body> (or on the next tab stop). Once the list is back it returns to that row's «Edit» (a save) or to the row that took the deleted
// one's place (a delete); with no row left, to the toolbar's «Add grade».
describe('the keyboard focus after a save or a delete', () => {
  const FIRST = 'First graders'
  const LITTLE = 'Little ones'
  const LAST = 'No code'
  const editButton = (name) => screen.findByRole('button', { name: `Edit grade ${name}` })
  const confirmDelete = async (name) => {
    await userEvent.click(within(await rowOf(name)).getByRole('button', { name: `Delete grade ${name}` }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete grade' }))
  }

  it('after «Save» of an edit the focus is on that row\'s «Edit» button, not on <body> or «Create from catalog»', async () => {
    const reload = deferred()
    mocks.api.listGrades.mockResolvedValueOnce(ok(ROWS)).mockReturnValueOnce(reload.promise)
    draw()
    const opener = await editButton(LITTLE)
    opener.focus()
    await userEvent.keyboard('{Enter}')
    const root = await dialog()
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.listGrades).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).not.toBe(opener)
    await act(async () => { reload.resolve(ok(ROWS)) })
    const again = await editButton(LITTLE)
    await waitFor(() => expect(again).toHaveFocus())
  })

  it('after a delete the focus is on the row that took its place', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(ok(ROWS)).mockResolvedValueOnce(ok(ROWS.slice(1)))
    draw()
    await confirmDelete(FIRST)
    await waitFor(() => expect(screen.queryByText(FIRST)).toBeNull())
    const next = await rowOf(LITTLE)
    await waitFor(() => expect(next).toHaveFocus())
  })

  it('deleting the last row of the page leaves the focus on the one before it', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(ok(ROWS)).mockResolvedValueOnce(ok(ROWS.slice(0, 3)))
    draw()
    await confirmDelete(LAST)
    await waitFor(() => expect(screen.queryByText(LAST)).toBeNull())
    const previous = await rowOf('Mixed')
    await waitFor(() => expect(previous).toHaveFocus())
  })

  it('deleting the only row leaves the focus on the toolbar\'s «Add grade»', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(ok([ROWS[0]])).mockResolvedValueOnce(ok([], { current_page: 1, total_pages: 1, total: 0 }))
    draw()
    await confirmDelete(FIRST)
    await screen.findByText('No grades yet')
    const add = document.querySelector('.odc-school-toolbar').querySelector('button')
    expect(add).toHaveTextContent('Add grade')
    await waitFor(() => expect(add).toHaveFocus())
  })
})

describe('on a phone', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, not a table, with the name, the code line and the two actions', async () => {
    draw()
    const list = await screen.findByRole('list', { name: 'Grades' })
    expect(screen.queryByRole('table')).toBeNull()
    const card = list.querySelector('[data-row-id="1"]')
    expect(card).toHaveTextContent('First graders')
    expect(card).toHaveTextContent('Grade 1')
    expect(card).toHaveTextContent('g1')
    expect(within(card).getByRole('button', { name: 'Edit grade First graders' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Delete grade First graders' })).toBeInTheDocument()
  })

  it('«Edit» in the card opens the dialog and the trash opens the confirmation', async () => {
    draw()
    const list = await screen.findByRole('list', { name: 'Grades' })
    const card = list.querySelector('[data-row-id="2"]')
    await userEvent.click(within(card).getByRole('button', { name: 'Edit grade Little ones' }))
    expect(within(await dialog()).getByRole('textbox', { name: /Name/ })).toHaveValue('Little ones')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(within(card).getByRole('button', { name: 'Delete grade Little ones' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  it('a failed load is the same notice with «Retry»', async () => {
    mocks.api.listGrades.mockResolvedValueOnce(fail(['Network down']))
    draw()
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    expect(screen.queryByText('No grades yet')).toBeNull()
  })
})

describe('texts', () => {
  it('come from the catalog', async () => {
    mocks.catalog = {
      SCHOOL_ADD_GRADE: 'Añadir grado',
      SCHOOL_SEED_GRADES: 'Crear desde el catálogo',
      SCHOOL_GRADE_G1: 'Grado 1',
      SCHOOL_TAB_GRADES: 'Grados',
      NAME: 'Nombre',
      SCHOOL_EDIT_GRADE_NAMED: 'Editar grado _name_'
    }
    draw()
    expect(await screen.findByRole('table', { name: 'Grados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir grado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear desde el catálogo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument()
    expect((await rowOf('First graders')).textContent).toContain('Grado 1')
    expect(screen.getByRole('button', { name: 'Editar grado First graders' })).toBeInTheDocument()
  })
})
