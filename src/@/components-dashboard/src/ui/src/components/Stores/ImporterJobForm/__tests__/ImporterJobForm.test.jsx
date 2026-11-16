/* eslint-disable import/first */
// redesign stores 3.C: the import of one importer, level 1 of the Importers panel. It is drawn here with simulated
// controller props (the controller has its own tests in components/ImporterJobForm/__tests__). Pins: G1-18 (`accept` is
// `.csv,.xls`), decision 25 (Import asks first; only «Import file» creates the job), the three states of the job, the Product
// pieces (no heading of its own, inline notices) and «Advanced Options» as a level-2 pane.
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', async () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  DragAndDrop: (await import('../../../../../../components/DragAndDrop')).DragAndDrop,
  ExamineClick: (await import('../../../../../../components/ExamineClick')).ExamineClick,
  ImporterJobForm: () => null
}))
vi.mock('../../../../utils', async () => ({
  bytesConverter: (await import('../../../../utils/bytesConverter')).bytesConverter
}))
vi.mock('../../ImporterForm', () => ({
  ImporterForm: (props) => (
    <div data-testid='importer-form' data-advanced={props.isAdvanedOptions ? 'yes' : 'no'} data-importer={props.selectedImporter?.id}>
      <button type='button' onClick={props.onClose}>Close advanced</button>
    </div>
  )
}))

import { ImportersStack } from '../../ImportersButton/ImportersPanes'
import { ImporterJobFormUI } from '../index'

const JOB_PENDING = 0
const JOB_SUCCESS = 1
const JOB_FAILED = 3

const baseProps = (overrides = {}) => ({
  selectedImporter: { id: 77, name: 'Import Products', type: 'sync_products' },
  formState: { loading: false, changes: { separator: ',', enclosure: '"', escape: '/', start_line: 2 }, result: { error: false } },
  fileState: { fileName: null, importOptions: {} },
  handleChangeInput: vi.fn(),
  handleUploadCsv: vi.fn(),
  handleCreateImporterJob: vi.fn(),
  handleCheckJobStatus: vi.fn(),
  handleSuccessUpdateImporter: vi.fn(),
  onClose: vi.fn(),
  jobStatus: { checking: false, job: null, error: false, polling: false },
  ...overrides
})

const draw = (overrides) => {
  const props = baseProps(overrides)
  const utils = render(
    <ImportersStack rootTitle='Importers'>
      <ImporterJobFormUI {...props} />
    </ImportersStack>
  )
  return { props, ...utils }
}

const withFile = { fileState: { fileName: 'products.csv', importOptions: {} } }
const fileInput = (container) => container.querySelector('input[type="file"]')
const upload = (container, file) => fireEvent.change(fileInput(container), { target: { files: [file] } })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the form (G1-18)', () => {
  it('draws no heading of its own: the level title belongs to the pane; a muted caption names the type', () => {
    draw()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('Product importer')).toBeInTheDocument()
  })

  it('keeps the four options as Product text fields with the same names, limits, defaults and placeholders', () => {
    draw()
    // bugs E row 8b: the labels no longer show a character («Separator (;)», «Escape (|)») that is not the prefilled one
    // («,» and «/»), and the placeholders are the prefilled values
    const separator = screen.getByLabelText('Separator')
    expect(separator).toHaveAttribute('name', 'separator')
    expect(separator).toHaveAttribute('maxlength', '1')
    expect(separator).toHaveAttribute('placeholder', ',')
    expect(separator).toHaveAttribute('autocomplete', 'off')
    expect(separator).toHaveValue(',')
    expect(screen.getByLabelText('Enclosure')).toHaveAttribute('name', 'enclosure')
    expect(screen.getByLabelText('Escape character')).toHaveAttribute('name', 'escape')
    expect(screen.getByLabelText('Escape character')).toHaveAttribute('placeholder', '/')
    expect(screen.getByLabelText('Escape character')).toHaveValue('/')
    expect(screen.getByLabelText('Start line')).toHaveAttribute('name', 'start_line')
    expect(separator.closest('.odc-field')).not.toBeNull()
  })

  it('reports an edit to handleChangeInput with the name and the value of the field', async () => {
    const { props } = draw()
    const separator = screen.getByLabelText('Separator')
    await userEvent.clear(separator)
    await userEvent.type(separator, ';')
    expect(props.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'separator', value: ';' } })
  })

  it('disables the options and the file button while the job is being created', () => {
    draw({ formState: { loading: true, changes: {}, result: { error: false } } })
    expect(screen.getByLabelText('Separator')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDisabled()
  })
})

describe('the file', () => {
  it('only offers CSV and XLS to the file chooser (G1-18: .xlsx was never accepted)', () => {
    const { container } = draw()
    expect(fileInput(container)).toHaveAttribute('accept', '.csv,.xls')
  })

  it('shows the drop zone text, a Choose file button, the hint and the name of the chosen file', () => {
    draw(withFile)
    expect(screen.getByText('Drop a file here or choose one')).toBeInTheDocument()
    const choose = screen.getByRole('button', { name: 'Choose file' })
    expect(choose).toHaveClass('odc-btn')
    expect(screen.getByText('products.csv')).toBeInTheDocument()
    const hint = screen.getByText('CSV or XLS, up to 2 MB')
    expect(choose).toHaveAttribute('aria-describedby', hint.id)
  })

  it('Choose file opens the chooser of the hidden input', async () => {
    const { container } = draw()
    const click = vi.spyOn(fileInput(container), 'click')
    await userEvent.click(screen.getByRole('button', { name: 'Choose file' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('a .xlsx says Only CSV or XLS files can be accepted and is not uploaded', async () => {
    const { container, props } = draw()
    upload(container, new File(['x'], 'products.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    expect(await screen.findByText('Only CSV or XLS files can be accepted')).toBeInTheDocument()
    expect(props.handleUploadCsv).not.toHaveBeenCalled()
  })

  it('a file over 2 MB says so, as an inline notice, and is not uploaded', async () => {
    const { container, props } = draw()
    const big = new File(['x'], 'big.csv', { type: 'text/csv' })
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 })
    upload(container, big)
    const notice = (await screen.findByText('The maximum file size is 2 megabytes')).closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(props.handleUploadCsv).not.toHaveBeenCalled()
  })

  it('a CSV is uploaded, and a notice left by a rejected file goes away', async () => {
    const { container, props } = draw()
    upload(container, new File(['x'], 'products.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    await screen.findByText('Only CSV or XLS files can be accepted')
    const csv = new File(['a,b'], 'products.csv', { type: 'text/csv' })
    upload(container, csv)
    expect(props.handleUploadCsv).toHaveBeenCalledWith(csv)
    await waitFor(() => expect(screen.queryByText('Only CSV or XLS files can be accepted')).not.toBeInTheDocument())
  })

  it('dropping a file uploads it like choosing it', () => {
    const { container, props } = draw()
    const csv = new File(['a,b'], 'dropped.csv', { type: 'text/csv' })
    fireEvent.drop(container.querySelector('.odc-imp-job-drop'), { dataTransfer: { files: [csv] } })
    expect(props.handleUploadCsv).toHaveBeenCalledWith(csv)
  })

  it('the notice can be closed', async () => {
    const { container } = draw()
    upload(container, new File(['x'], 'a.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const notice = (await screen.findByText('Only CSV or XLS files can be accepted')).closest('.odc-notice')
    await userEvent.click(within(notice).getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Only CSV or XLS files can be accepted')).not.toBeInTheDocument()
  })
})

describe('Import asks first (decision 25)', () => {
  it('opens a confirmation that names the file and the importer, and does not create the job', async () => {
    const { props } = draw(withFile)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Import products.csv?' })
    expect(within(dialog).getByText("Import Products creates and updates records in your project with the rows of this file. It can't be undone from here.")).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Import file' })
    expect(confirm).toHaveAttribute('data-variant', 'primary') // not the danger tone
    expect(props.handleCreateImporterJob).not.toHaveBeenCalled()
  })

  it('puts the initial focus on Cancel', async () => {
    draw(withFile)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('Import file creates the job once, with the id of the importer', async () => {
    const { props } = draw(withFile)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import file' }))
    expect(props.handleCreateImporterJob).toHaveBeenCalledTimes(1)
    expect(props.handleCreateImporterJob).toHaveBeenCalledWith(77)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('Cancel closes the confirmation and does nothing else', async () => {
    const { props } = draw(withFile)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(props.handleCreateImporterJob).not.toHaveBeenCalled()
    expect(props.handleUploadCsv).not.toHaveBeenCalled()
  })

  it('without a file it says the file is required and opens nothing', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('CSV file is required')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(props.handleCreateImporterJob).not.toHaveBeenCalled()
  })

  it('stays disabled once there is a job, and while it loads', () => {
    draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_PENDING }, error: false, polling: true } })
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })
})

describe('the state of the job', () => {
  it('pending: says so, tells that it checks by itself and Check now checks', async () => {
    const { props } = draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_PENDING }, error: false, polling: true } })
    const live = screen.getByRole('status')
    expect(within(live).getByText('Import in progress')).toBeInTheDocument()
    expect(within(live).getByText("We'll check automatically — you can also check now")).toBeInTheDocument()
    expect(live).toHaveAttribute('aria-live', 'polite')
    await userEvent.click(screen.getByRole('button', { name: 'Check now' }))
    expect(props.handleCheckJobStatus).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('pending and checking: the button waits', () => {
    draw({ ...withFile, jobStatus: { checking: true, job: { id: 1, status: JOB_PENDING }, error: false, polling: false } })
    expect(screen.getByRole('button', { name: 'Loading' })).toBeDisabled()
  })

  it('pending with a failed check: says the check failed', () => {
    draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_PENDING }, error: true, polling: false } })
    expect(screen.getByText('Could not check the import status, please try again')).toBeInTheDocument()
  })

  it('failed: says it failed, shows the error of the job and offers Close', async () => {
    const { props } = draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_FAILED, result_data: { error: 'Row 3 is wrong' } }, error: false, polling: false } })
    const live = screen.getByRole('status')
    expect(within(live).getByText('Import failed')).toBeInTheDocument()
    expect(within(live).getByText('Row 3 is wrong')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('failed without a message: a generic error', () => {
    draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_FAILED }, error: false, polling: false } })
    expect(within(screen.getByRole('status')).getByText('Error')).toBeInTheDocument()
  })

  it('success: shows what was created and updated, and the metafields when there are some', () => {
    draw({
      ...withFile,
      jobStatus: {
        checking: false,
        job: { id: 1, status: JOB_SUCCESS, result_data: { inserts: 5, updates: 2, metafields_inserts: 1, metafields_updates: 3 } },
        error: false,
        polling: false
      }
    })
    const live = screen.getByRole('status')
    expect(within(live).getByText('Import completed')).toBeInTheDocument()
    expect(live).toHaveTextContent('Created: 5 · Updated: 2 · Metafields: 1/3')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('success without metafields leaves them out', () => {
    draw({ ...withFile, jobStatus: { checking: false, job: { id: 1, status: JOB_SUCCESS, result_data: { inserts: 5 } }, error: false, polling: false } })
    expect(screen.getByRole('status')).toHaveTextContent('Created: 5 · Updated: 0')
    expect(screen.getByRole('status')).not.toHaveTextContent('Metafields')
  })

  it('paints no state without a job', () => {
    draw()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('errors of the controller', () => {
  it('shows the messages of the failed request as an error notice, one per line, and can be closed', async () => {
    draw({ formState: { loading: false, changes: {}, result: { error: true, result: ['Row 2: bad price', 'Row 5: bad name'] } } })
    const notice = (await screen.findByText('Row 2: bad price')).closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(within(notice).getByText('Row 5: bad name')).toBeInTheDocument()
    await userEvent.click(within(notice).getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Row 2: bad price')).not.toBeInTheDocument()
  })

  it('accepts a single message as a string', async () => {
    draw({ formState: { loading: false, changes: {}, result: { error: true, result: 'Something failed' } } })
    expect(await screen.findByText('Something failed')).toBeInTheDocument()
  })
})

describe('Advanced Options', () => {
  it('opens level 2 of the panel with the importer form in advanced mode, and closing it comes back', async () => {
    const { props } = draw()
    expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Advanced Options' }))
    const form = await screen.findByTestId('importer-form')
    expect(form).toHaveAttribute('data-advanced', 'yes')
    expect(form).toHaveAttribute('data-importer', String(props.selectedImporter.id))
    expect(screen.getByRole('heading', { name: 'Advanced Options' })).toBeInTheDocument()

    // the pane's own X goes back
    await userEvent.click(screen.getByRole('button', { name: 'Close Advanced Options' }))
    await waitFor(() => expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Advanced Options' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Close advanced' }))
    await waitFor(() => expect(screen.queryByTestId('importer-form')).not.toBeInTheDocument())
  })
})
