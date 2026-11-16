/* eslint-disable import/first */
// redesign stores 3.C: level 0 of the Importers panel. The two side bars it opened are one level 1 of the panel
// (ImportersPane): «Import file» (the row, Enter, or the row menu) opens the ImporterJobForm with the importer's name as its title;
// «Edit» and «Add importer» open the ImporterForm; only one at a time, and changing the record goes through the leave guard.
// The ImporterListing controller, the two forms and the Learn menu are stand-ins; the list, the panes and the leave guard are real.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  phone: false,
  dirty: false,
  formDirty: false,
  leaveSpy: null,
  jobForm: vi.fn(),
  importerForm: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  // the menu importers tab is for who can open /connect/importers; these cases are the CSV list alone (a business owner)
  useSession: () => [{ user: { level: mockState.level ?? 2 } }],
  useEvent: () => [{ emit: () => {} }],
  useApi: () => [{ project: 'demo' }],
  ImporterListing: () => null
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
vi.mock('../../../../utils', () => ({ learnOptionsValues: () => [{ value: 'importers', name: 'Importers', url: 'https://example.test' }] }))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => <button type='button'>Learn</button> }))

// The leave guard is real; this only watches which ways out ask it (the spy is called, then the real answer is used).
vi.mock('../../../Shared/Product/LeaveGuard', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRequestLeave: () => {
      const real = actual.useRequestLeave()
      return (...args) => {
        mockState.leaveSpy?.(...args)
        return real(...args)
      }
    }
  }
})

vi.mock('../../ImporterJobForm', async () => {
  const { useLeaveGuard } = await import('../../../Shared/Product/LeaveGuard')
  return {
    ImporterJobForm: (props) => {
      mockState.jobForm(props)
      useLeaveGuard({ dirty: () => mockState.dirty, save: () => ({ ok: true }), discard: () => {} })
      return (
        <div data-testid='job-form' data-importer={props.selectedImporter?.id}>
          <button type='button' onClick={props.onClose}>Finish import</button>
        </div>
      )
    }
  }
})
// Like the real form, a save closes the form's own level (onClose) before the save resolves
vi.mock('../../ImporterForm', async () => {
  const { useLeaveGuard } = await import('../../../Shared/Product/LeaveGuard')
  return {
    ImporterForm: (props) => {
      mockState.importerForm(props)
      useLeaveGuard({
        dirty: () => mockState.formDirty,
        save: async () => { props.onClose(); return { ok: true } },
        discard: () => {}
      })
      return (
      <div data-testid='importer-form' data-importer={props.selectedImporter?.id ?? 'none'}>
        <button type='button' onClick={props.onClose}>Finish form</button>
      </div>
      )
    }
  }
})

import { LeaveDialog, LeaveGuardContext, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'
import { ImportersStack } from '../../ImportersButton/ImportersPanes'
import { ImportersListingUI } from '../index'

const IMPORTERS = [
  { id: 1, name: 'Products default', slug: 'sync_products_default', type: 'sync_products' },
  { id: 2, name: 'Acme menu', slug: 'acme-menu', type: 'sync_multiple' },
  { id: 3, name: 'Legacy feed', slug: 'legacy-feed', type: 'sync_categories' }
]

// The Sheet of ImportersButton in miniature: a leave-guard host around the stack of levels
const Host = ({ children }) => {
  const leave = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={leave.context}>
      <ImportersStack rootTitle='Importers'>{children}</ImportersStack>
      <LeaveDialog
        {...leave.dialog}
        title='Save your changes?'
        description='You have unsaved changes in Importers.'
        keepLabel='Keep editing'
        saveLabel='Save and continue'
        discardLabel='Discard'
        closeLabel='Close'
      />
    </LeaveGuardContext.Provider>
  )
}

const draw = (props = {}) => {
  const spies = {
    getImporters: vi.fn(),
    handleDeleteImporter: vi.fn(async () => {}),
    handleSuccessAddImporter: vi.fn(),
    handleSuccessUpdateImporter: vi.fn(),
    onImportSuccess: vi.fn()
  }
  const tree = (extra) => (
    <Host>
      <ImportersListingUI
        importerList={{ loading: false, error: null, importers: IMPORTERS }}
        actionStatus={{ loading: false, error: null }}
        paginationDetail={{}}
        {...spies}
        {...extra}
      />
    </Host>
  )
  const utils = render(tree(props))
  return { ...utils, ...spies, redraw: (next) => utils.rerender(tree(next)) }
}

const rowOf = (name) => screen.getByRole('rowheader', { name }).closest('tr')
const openRow = (name) => userEvent.click(within(rowOf(name)).getByText(name))
const levelHeading = (name) => screen.findByRole('heading', { name })

beforeEach(() => {
  vi.clearAllMocks()
  mockState.phone = false
  mockState.dirty = false
  mockState.formDirty = false
  mockState.leaveSpy = null
})

describe('the head', () => {
  it('has the Learn menu and a Product «Add importer» button, and no title of its own (the Sheet already says Importers)', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Add importer' })
    expect(add).toHaveClass('odc-btn')
    expect(add).toHaveAttribute('data-variant', 'secondary')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('draws no side bar and no modal: nothing but the list while no level is open', () => {
    draw()
    expect(screen.queryByTestId('job-form')).not.toBeInTheDocument()
    expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('draws no Enable on any row', () => {
    draw()
    expect(screen.queryByText('Enable')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})

describe('Import file (level 1)', () => {
  it('a click on a row opens the ImporterJobForm in a level titled with the importer name, and marks the row', async () => {
    const { handleSuccessUpdateImporter, onImportSuccess } = draw()
    await openRow('Acme menu')
    expect(await levelHeading('Acme menu')).toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '2')
    expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument()
    expect(rowOf('Acme menu')).toHaveAttribute('aria-current', 'true')

    const props = mockState.jobForm.mock.calls.at(-1)[0]
    expect(props.selectedImporter).toEqual(IMPORTERS[1])
    expect(props.handleSuccessUpdateImporter).toBe(handleSuccessUpdateImporter)
    expect(props.onImportSuccess).toBe(onImportSuccess)
    // the side-bar plumbing is gone
    for (const legacy of ['handleOpenChildForm', 'handleCloseChildForm', 'openMappingDetails', 'setOpenMappingDetails', 'moveDistance', 'setExtraOpen']) {
      expect(props).not.toHaveProperty(legacy)
    }
  })

  it('Enter on a row and the «Import file» item of the menu open the same level', async () => {
    draw()
    rowOf('Legacy feed').focus()
    await userEvent.keyboard('{Enter}')
    expect(await levelHeading('Legacy feed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Import file' }))
    expect(await levelHeading('Acme menu')).toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '2')
  })

  it('the form closes its own level (onClose) and the row is no longer marked', async () => {
    draw()
    await openRow('Acme menu')
    await userEvent.click(await screen.findByRole('button', { name: 'Finish import' }))
    await waitFor(() => expect(screen.queryByTestId('job-form')).not.toBeInTheDocument())
    expect(rowOf('Acme menu')).not.toHaveAttribute('aria-current')
  })

  it('the way back of the level (‹ Importers) closes it', async () => {
    draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    await userEvent.click(screen.getByRole('button', { name: 'Importers' }))
    await waitFor(() => expect(screen.queryByTestId('job-form')).not.toBeInTheDocument())
  })

  it('on a phone it is the same level, with the cards of the list behind it', async () => {
    mockState.phone = true
    draw()
    await userEvent.click(screen.getByRole('link', { name: 'Acme menu' }))
    expect(await levelHeading('Acme menu')).toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toBeInTheDocument()
  })
})

describe('Edit and Add (level 1)', () => {
  it('Edit opens the ImporterForm titled «Edit importer» with the importer, in mode edit', async () => {
    const { handleSuccessAddImporter, handleSuccessUpdateImporter } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    expect(await levelHeading('Edit importer')).toBeInTheDocument()
    expect(screen.getByTestId('importer-form')).toHaveAttribute('data-importer', '2')
    expect(screen.queryByTestId('job-form')).not.toBeInTheDocument()

    const props = mockState.importerForm.mock.calls.at(-1)[0]
    expect(props.openNewImporter).toBe(true)
    expect(props.selectedImporter).toEqual(IMPORTERS[1])
    expect(props.handleSuccessAdd).toBe(handleSuccessAddImporter)
    expect(props.handleSuccessUpdateImporter).toBe(handleSuccessUpdateImporter)
    for (const legacy of ['openMappingDetails', 'setOpenMappingDetails']) expect(props).not.toHaveProperty(legacy)
    expect(rowOf('Acme menu')).toHaveAttribute('aria-current', 'true')
  })

  // J2 row 15 (P-1): «Add importer» of the head is the one add; the repeated one under the list is gone
  it('«Add importer» of the head opens the ImporterForm titled «Add importer» with an empty importer, and is the only add', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Add importer' }))
    expect(await levelHeading('Add importer')).toBeInTheDocument()
    expect(screen.getByTestId('importer-form')).toHaveAttribute('data-importer', 'none')
    expect(mockState.importerForm.mock.calls.at(-1)[0].selectedImporter).toEqual({})
    expect(document.querySelector('tr[aria-current]')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Finish form' }))
    await waitFor(() => expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Add new importer' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add importer' })).toHaveLength(1)
  })

  it('only one level 1 at a time: Edit replaces the import and the import replaces Edit', async () => {
    draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Legacy feed' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await levelHeading('Edit importer')
    expect(screen.queryByTestId('job-form')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Acme menu' })).not.toBeInTheDocument()
    expect(screen.getAllByTestId('importer-form')).toHaveLength(1)

    await openRow('Products default')
    await levelHeading('Products default')
    expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('job-form')).toHaveLength(1)
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '1')
  })

  it('the title of the import follows a rename saved from the form', async () => {
    const { redraw } = draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    redraw({ importerList: { loading: false, error: null, importers: IMPORTERS.map(item => (item.id === 2 ? { ...item, name: 'Acme full menu' } : item)) } })
    expect(await levelHeading('Acme full menu')).toBeInTheDocument()
  })
})

describe('changing the record goes through the leave guard', () => {
  it('another row, Edit and Add each ask requestLeave first, with what they will do as the way out', async () => {
    const leaveSpy = vi.fn()
    mockState.leaveSpy = leaveSpy
    draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    expect(leaveSpy).toHaveBeenCalledTimes(1)
    expect(leaveSpy.mock.calls[0][0]).toEqual(expect.any(Function))

    await openRow('Legacy feed')
    await levelHeading('Legacy feed')
    expect(leaveSpy).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await levelHeading('Edit importer')
    expect(leaveSpy).toHaveBeenCalledTimes(3)

    await userEvent.click(screen.getByRole('button', { name: 'Add importer' }))
    await levelHeading('Add importer')
    expect(leaveSpy).toHaveBeenCalledTimes(4)
  })

  it('with unsaved work the other row does not open until the person decides: Keep editing stays, Discard changes the record', async () => {
    draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    mockState.dirty = true

    await openRow('Legacy feed')
    const question = await screen.findByRole('alertdialog', { name: 'Save your changes?' })
    expect(screen.queryByRole('heading', { name: 'Legacy feed' })).not.toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '2')
    await userEvent.click(within(question).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '2')
    expect(rowOf('Acme menu')).toHaveAttribute('aria-current', 'true')

    await openRow('Legacy feed')
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(await levelHeading('Legacy feed')).toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '3')
  })
})

// review (live, 1440): the form closes its own level when its save succeeds; with «Save and continue» that unmounted the level's
// guard before it could go on, so the row the person had clicked never opened
describe('«Save and continue» from the importer form', () => {
  it('saves, then opens what the person clicked', async () => {
    draw()
    await userEvent.click(within(rowOf('Acme menu')).getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await levelHeading('Edit importer')
    mockState.formDirty = true

    await openRow('Legacy feed')
    await userEvent.click(await screen.findByRole('button', { name: 'Save and continue' }))
    expect(await levelHeading('Legacy feed')).toBeInTheDocument()
    expect(screen.getByTestId('job-form')).toHaveAttribute('data-importer', '3')
    expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument()
  })
})

describe('deleting', () => {
  it('asks first and only then calls the controller', async () => {
    const { handleDeleteImporter } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Acme menu?' })
    expect(handleDeleteImporter).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(handleDeleteImporter).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Acme menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete importer' }))
    expect(handleDeleteImporter).toHaveBeenCalledWith(2)
  })

  it('the 8 default importers have no Delete and one that is not a default has it', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Products default' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Legacy feed' }))
    expect(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('a failed delete and a failed load are shown, and «Try again» calls getImporters', async () => {
    const { getImporters } = draw({
      actionStatus: { loading: false, error: ['Importer is in use'] },
      importerList: { loading: false, error: ['Network Error'], importers: [] }
    })
    const notices = screen.getAllByRole('status')
    expect(notices.map(notice => notice.textContent)).toEqual(['Importer is in use', "We couldn't load the importers.Try again"])
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(getImporters).toHaveBeenCalledTimes(1)
  })

  it('the detail of an importer that was deleted closes by itself', async () => {
    const { redraw } = draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    redraw({ importerList: { loading: false, error: null, importers: IMPORTERS.filter(item => item.id !== 2) } })
    await waitFor(() => expect(screen.queryByTestId('job-form')).not.toBeInTheDocument())
  })

  it('the detail stays open while the list reloads', async () => {
    const { redraw } = draw()
    await openRow('Acme menu')
    await levelHeading('Acme menu')
    redraw({ importerList: { loading: true, error: null, importers: [] } })
    expect(screen.getByTestId('job-form')).toBeInTheDocument()
  })
})
