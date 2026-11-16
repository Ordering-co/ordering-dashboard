/* eslint-disable import/first */
// redesign SC-B2 (decision 4; M-SC03, M-SC06, M-SC10, M-SC11): the Classrooms tab as a Product DataTable (RecordCards under 768px) with
// a dialog to add and edit, a danger confirmation to delete and a retry when the load fails. The Product wrappers and the shared B1
// pieces are real; the app contexts and the API (K/schoolApi) are doubles.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
    listClassrooms: vi.fn(),
    createClassroom: vi.fn(),
    updateClassroom: vi.fn(),
    deleteClassroom: vi.fn()
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

import { SchoolClassrooms } from '../index'

const SCHOOL = { id: 7, name: 'Lincoln' }
const ROWS = [
  { id: 1, name: 'Ms. Smith - Grade 1' },
  { id: 2, name: 'Mr. Jones - Grade 2' }
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
      <SchoolClassrooms school={SCHOOL} initialPage={1} onPageChange={onPageChange} {...props} />
    </ThemeProvider>
  )
  return { onPageChange }
}

const table = () => screen.findByRole('table', { name: 'Classrooms' })
const rowOf = async (name) => (await screen.findByRole('rowheader', { name })).closest('tr')
const dialog = () => screen.findByRole('dialog')

beforeEach(() => {
  mocks.phone = false
  mocks.catalog = {}
  mocks.showToast.mockReset()
  Object.values(mocks.api).forEach((fn) => fn.mockReset())
  mocks.api.listClassrooms.mockResolvedValue(ok(ROWS))
  mocks.api.createClassroom.mockResolvedValue({ error: false, result: { id: 9 } })
  mocks.api.updateClassroom.mockResolvedValue({ error: false, result: { id: 1 } })
  mocks.api.deleteClassroom.mockResolvedValue({ error: false, result: {} })
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('the list', () => {
  it('loads the classrooms of the school at initialPage with the page size of main (10)', async () => {
    draw({ initialPage: 3 })
    await table()
    expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(1)
    expect(mocks.api.listClassrooms).toHaveBeenCalledWith({ root: 'https://api.test' }, 'tok', { schoolId: 7, page: 3, pageSize: 10 })
  })

  it('draws the name as the row header and two visible actions per row', async () => {
    draw()
    const root = await table()
    expect(within(root).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Actions'])
    const first = await rowOf('Ms. Smith - Grade 1')
    expect(within(first).getByRole('button', { name: 'Edit classroom Ms. Smith - Grade 1' })).toHaveTextContent('Edit')
    expect(within(first).getByRole('button', { name: 'Delete classroom Ms. Smith - Grade 1' })).toBeInTheDocument()
    expect(within(first).queryByRole('menu')).toBeNull()
  })

  it('shows skeletons while it loads', async () => {
    const pending = deferred()
    mocks.api.listClassrooms.mockReturnValue(pending.promise)
    draw()
    const root = await screen.findByRole('table', { name: 'Classrooms' })
    expect(root).toHaveAttribute('aria-busy', 'true')
    expect(root.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    pending.resolve(ok(ROWS))
    await rowOf('Ms. Smith - Grade 1')
  })

  it('an empty school says «No classrooms yet» with a way to add one, and no pagination', async () => {
    mocks.api.listClassrooms.mockResolvedValue(ok([], { current_page: 1, total_pages: 1, total: 0 }))
    draw()
    expect(await screen.findByText('No classrooms yet')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    await userEvent.click(within(document.querySelector('.odc-state')).getByRole('button', { name: 'Add classroom' }))
    expect(await dialog()).toBeInTheDocument()
  })

  it('does not call the API without a school', async () => {
    draw({ school: undefined })
    await waitFor(() => expect(screen.getByText('No classrooms yet')).toBeInTheDocument())
    expect(mocks.api.listClassrooms).not.toHaveBeenCalled()
  })

  it('follows the pagination (page and onPageChange)', async () => {
    mocks.api.listClassrooms.mockResolvedValue(ok(ROWS, { current_page: 1, total_pages: 3, total: 25 }))
    const { onPageChange } = draw()
    await table()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    await waitFor(() => expect(mocks.api.listClassrooms).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 }))
  })
})

describe('a list that fails to load (M-SC03)', () => {
  it('says so with «Retry», never «No classrooms yet», and «Retry» loads it again', async () => {
    mocks.api.listClassrooms.mockResolvedValueOnce(fail(['Network down']))
    draw()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Network down')
    expect(screen.queryByText('No classrooms yet')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await rowOf('Ms. Smith - Grade 1')
    expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('add and edit', () => {
  it('«Add classroom» opens an empty dialog with the hint of main', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    const root = await dialog()
    expect(within(root).getByRole('heading', { name: 'Add classroom' })).toBeInTheDocument()
    const field = within(root).getByRole('textbox', { name: /Name/ })
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', 'e.g. Ms. Smith - Grade 1')
  })

  it('a row opens the edit dialog with its name', async () => {
    draw()
    await userEvent.click(await rowOf('Mr. Jones - Grade 2'))
    const root = await dialog()
    expect(within(root).getByRole('heading', { name: 'Edit classroom' })).toBeInTheDocument()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('Mr. Jones - Grade 2')
  })

  it('an empty name marks the field, shows the toast of main, focuses the field and calls nothing', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    const root = await dialog()
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    const field = within(root).getByRole('textbox', { name: /Name/ })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(within(root).getByText('Name is required')).toBeInTheDocument()
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Name is required')
    await waitFor(() => expect(field).toHaveFocus())
    expect(mocks.api.createClassroom).not.toHaveBeenCalled()
    expect(mocks.api.updateClassroom).not.toHaveBeenCalled()
  })

  it('create sends { school_id, name }, toasts, closes and reloads the current page', async () => {
    mocks.api.listClassrooms.mockResolvedValue(ok(ROWS, { current_page: 2, total_pages: 3, total: 25 }))
    draw({ initialPage: 2 })
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Room 3')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.createClassroom).toHaveBeenCalledWith(
      { root: 'https://api.test' }, 'tok', { school_id: 7, name: 'Room 3' }
    ))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Changes saved'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(2))
    expect(mocks.api.listClassrooms).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 })
  })

  it('Enter in the name saves', async () => {
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    await userEvent.type(within(await dialog()).getByRole('textbox', { name: /Name/ }), 'Quick{Enter}')
    await waitFor(() => expect(mocks.api.createClassroom).toHaveBeenCalledTimes(1))
  })

  it('edit sends { name } to the classroom', async () => {
    draw()
    await userEvent.click(await rowOf('Ms. Smith - Grade 1'))
    const root = await dialog()
    const field = within(root).getByRole('textbox', { name: /Name/ })
    await userEvent.clear(field)
    await userEvent.type(field, 'Ms. Smith - Grade 1B')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.updateClassroom).toHaveBeenCalledWith(
      { root: 'https://api.test' }, 'tok', 1, { name: 'Ms. Smith - Grade 1B' }
    ))
    expect(mocks.api.createClassroom).not.toHaveBeenCalled()
  })

  it('«Save» is busy while it saves and a second press does nothing', async () => {
    const pending = deferred()
    mocks.api.createClassroom.mockReturnValue(pending.promise)
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Slow')
    const save = within(root).getByRole('button', { name: 'Save' })
    await userEvent.click(save)
    await waitFor(() => expect(save).toHaveAttribute('aria-busy', 'true'))
    await userEvent.click(save)
    expect(mocks.api.createClassroom).toHaveBeenCalledTimes(1)
    pending.resolve({ error: false, result: {} })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an error of the API leaves the dialog open with what was typed, and a toast', async () => {
    mocks.api.createClassroom.mockResolvedValue(fail(['Name already taken']))
    draw()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add classroom' }))
    const root = await dialog()
    await userEvent.type(within(root).getByRole('textbox', { name: /Name/ }), 'Dup')
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Name already taken'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(root).getByRole('textbox', { name: /Name/ })).toHaveValue('Dup')
    expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(1)
  })
})

describe('delete (decision 4; M-SC06, M-SC11)', () => {
  const NAME = 'Ms. Smith - Grade 1'
  const openConfirm = async (name = NAME) => {
    await userEvent.click(within(await rowOf(name)).getByRole('button', { name: `Delete classroom ${name}` }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, naming the classroom, with the consequence, «Delete classroom» and the focus on Cancel', async () => {
    draw()
    const root = await openConfirm()
    expect(within(root).getByRole('heading', { name: 'Delete classroom "Ms. Smith - Grade 1"?' })).toBeInTheDocument()
    expect(root).toHaveTextContent('Delete this classroom? Students in it lose their classroom and must be reassigned.')
    expect(within(root).getByRole('button', { name: 'Delete classroom' })).toBeInTheDocument()
    await waitFor(() => expect(within(root).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.api.deleteClassroom).not.toHaveBeenCalled()
  })

  it('the name goes in as text: «$&» in it is not a replacement pattern', async () => {
    mocks.api.listClassrooms.mockResolvedValue(ok([{ id: 5, name: 'Room $& 5' }]))
    draw()
    const root = await openConfirm('Room $& 5')
    expect(within(root).getByRole('heading', { name: 'Delete classroom "Room $& 5"?' })).toBeInTheDocument()
  })

  it('confirms: busy while it runs, deleteClassroom with the id, toast, closes and reloads the current page', async () => {
    const pending = deferred()
    mocks.api.deleteClassroom.mockReturnValue(pending.promise)
    mocks.api.listClassrooms.mockResolvedValue(ok(ROWS, { current_page: 2, total_pages: 3, total: 25 }))
    draw({ initialPage: 2 })
    const root = await openConfirm()
    const confirm = within(root).getByRole('button', { name: 'Delete classroom' })
    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
    expect(mocks.api.deleteClassroom).toHaveBeenCalledWith({ root: 'https://api.test' }, 'tok', 1)
    expect(within(root).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    pending.resolve({ error: false, result: {} })
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Classroom deleted'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(2))
    expect(mocks.api.listClassrooms).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 2, pageSize: 10 })
  })

  it('an error of the API closes the confirmation, toasts the error and does not reload', async () => {
    mocks.api.deleteClassroom.mockResolvedValue(fail(['In use']))
    draw()
    const root = await openConfirm()
    await userEvent.click(within(root).getByRole('button', { name: 'Delete classroom' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'In use'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(1)
  })

  it('deleting the only row of the last page goes back one page (M-SC10)', async () => {
    mocks.api.listClassrooms
      .mockResolvedValueOnce(ok([{ id: 9, name: 'Lone' }], { current_page: 2, total_pages: 2, total: 11 }))
      .mockResolvedValueOnce(ok([], { current_page: 2, total_pages: 1, total: 10 }))
      .mockResolvedValueOnce(ok(ROWS, { current_page: 1, total_pages: 1, total: 10 }))
    const { onPageChange } = draw({ initialPage: 2 })
    const root = await openConfirm('Lone')
    await userEvent.click(within(root).getByRole('button', { name: 'Delete classroom' }))
    await rowOf(NAME)
    expect(mocks.api.listClassrooms).toHaveBeenLastCalledWith(expect.anything(), 'tok', { schoolId: 7, page: 1, pageSize: 10 })
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(screen.queryByText('No classrooms yet')).toBeNull()
  })
})

// redesign (T): the reload puts the table in its skeleton and unmounts the button that opened the dialog, so the focus fell on
// <body>. Once the list is back it returns to that row's «Edit» (a save) or to the row that took the deleted one's place (a delete).
describe('the keyboard focus after a save or a delete', () => {
  const JONES = 'Mr. Jones - Grade 2'
  const SMITH = 'Ms. Smith - Grade 1'
  const editButton = (name) => screen.findByRole('button', { name: `Edit classroom ${name}` })

  it('after «Save» of an edit the focus is on that row\'s «Edit» button, not on <body>', async () => {
    const reload = deferred()
    mocks.api.listClassrooms.mockResolvedValueOnce(ok(ROWS)).mockReturnValueOnce(reload.promise)
    draw()
    const opener = await editButton(SMITH)
    opener.focus()
    await userEvent.keyboard('{Enter}')
    const root = await dialog()
    await userEvent.click(within(root).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.api.listClassrooms).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(document.body) // the skeleton: the opener is gone
    await act(async () => { reload.resolve(ok(ROWS)) })
    const again = await editButton(SMITH)
    await waitFor(() => expect(again).toHaveFocus())
  })

  it('after a delete the focus is on the row that took its place', async () => {
    mocks.api.listClassrooms.mockResolvedValueOnce(ok(ROWS)).mockResolvedValueOnce(ok([ROWS[1]]))
    draw()
    await userEvent.click(within(await rowOf(SMITH)).getByRole('button', { name: `Delete classroom ${SMITH}` }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete classroom' }))
    await waitFor(() => expect(screen.queryByText(SMITH)).toBeNull())
    const next = await rowOf(JONES)
    await waitFor(() => expect(next).toHaveFocus())
  })

  it('deleting the last row of the page leaves the focus on the one before it', async () => {
    mocks.api.listClassrooms.mockResolvedValueOnce(ok(ROWS)).mockResolvedValueOnce(ok([ROWS[0]]))
    draw()
    await userEvent.click(within(await rowOf(JONES)).getByRole('button', { name: `Delete classroom ${JONES}` }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete classroom' }))
    await waitFor(() => expect(screen.queryByText(JONES)).toBeNull())
    const previous = await rowOf(SMITH)
    await waitFor(() => expect(previous).toHaveFocus())
  })

  it('deleting the only row leaves the focus on the toolbar\'s «Add classroom»', async () => {
    mocks.api.listClassrooms.mockResolvedValueOnce(ok([ROWS[0]])).mockResolvedValueOnce(ok([], { current_page: 1, total_pages: 1, total: 0 }))
    draw()
    await userEvent.click(within(await rowOf(SMITH)).getByRole('button', { name: `Delete classroom ${SMITH}` }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete classroom' }))
    await screen.findByText('No classrooms yet')
    const add = document.querySelector('.odc-school-toolbar').querySelector('button')
    expect(add).toHaveTextContent('Add classroom')
    await waitFor(() => expect(add).toHaveFocus())
  })
})

describe('on a phone', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, not a table, with the name and the two actions', async () => {
    draw()
    const list = await screen.findByRole('list', { name: 'Classrooms' })
    expect(screen.queryByRole('table')).toBeNull()
    const card = list.querySelector('[data-row-id="1"]')
    expect(card).toHaveTextContent('Ms. Smith - Grade 1')
    expect(within(card).getByRole('button', { name: 'Edit classroom Ms. Smith - Grade 1' })).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Delete classroom Ms. Smith - Grade 1' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  it('«Edit» in the card opens the dialog', async () => {
    draw()
    const card = (await screen.findByRole('list', { name: 'Classrooms' })).querySelector('[data-row-id="2"]')
    await userEvent.click(within(card).getByRole('button', { name: 'Edit classroom Mr. Jones - Grade 2' }))
    expect(within(await dialog()).getByRole('textbox', { name: /Name/ })).toHaveValue('Mr. Jones - Grade 2')
  })

  it('a failed load is the same notice with «Retry»', async () => {
    mocks.api.listClassrooms.mockResolvedValueOnce(fail(['Network down']))
    draw()
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    expect(screen.queryByText('No classrooms yet')).toBeNull()
  })
})

describe('texts', () => {
  it('come from the catalog', async () => {
    mocks.catalog = {
      SCHOOL_ADD_CLASSROOM: 'Añadir aula',
      SCHOOL_TAB_CLASSROOMS: 'Aulas',
      NAME: 'Nombre',
      SCHOOL_EDIT_CLASSROOM_NAMED: 'Editar aula _name_'
    }
    draw()
    expect(await screen.findByRole('table', { name: 'Aulas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir aula' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar aula Ms. Smith - Grade 1' })).toBeInTheDocument()
  })
})
