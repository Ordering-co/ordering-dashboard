import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage, DragAndDrop, ExamineClick, ImporterJobForm as ImporterJobFormController } from '../../../../../index'
import { isJobFailed, isJobSuccess } from '../../../../../components/ImporterJobForm'
import { bytesConverter } from '../../../utils'
import { Button, ConfirmDialog, IconButton, InlineNotice, TextField } from '../../Shared/Product'
import { CircleAlert, CircleCheck, Clock, FileText, RotateCw, Upload, X } from '../../Shared/Icon'
import { ImporterForm } from '../ImporterForm'
import { ImportersPane } from '../ImportersButton/ImportersPanes'
import { focusWhenFree } from '../ImportersButton/ImportersPanes'
import './importer-job.css'

// redesign stores 3.C: the import of one importer, level 1 of the Importers panel. It no longer lives in a SideBar:
// the list mounts it inside `<ImportersPane title={importer.name}>`, which draws the level's title and its «‹ Back» / X, so this
// form has no heading of its own, only the readable type of the importer as a caption.
// What changed from the legacy form:
//  - «Import» asks first (decision 25, C8): a ConfirmDialog names the file and what the import does; only «Import file» calls
//    handleCreateImporterJob. Cancel does nothing else.
//  - The file is a drop zone with a «Choose file» button (the drop still works). G1-18: `accept` is `.csv,.xls`, not `.xlsx`:
//    handleFiles has always rejected it (type and size checks are the same as before).
//  - The file-required check no longer needs react-hook-form: Import without a file shows the same message and opens nothing.
//  - Errors and the invalid-file messages are inline notices in the panel, not a modal Alert.
//  - The job status keeps its logic (pending / failed / success, polling, Check now, Close) with Product pieces.
//  - «Advanced Options» opens a level 2 pane with ImporterForm (`isAdvanedOptions`). The legacy help modal is gone (G1-19).

const toLines = (content) => {
  if (Array.isArray(content)) return content.filter(line => typeof line === 'string' && line)
  return typeof content === 'string' && content ? [content] : []
}

export const ImporterJobFormUI = (props) => {
  const {
    selectedImporter,
    formState,
    fileState,
    handleChangeInput,
    handleUploadCsv,
    handleCreateImporterJob,
    onClose,
    handleSuccessUpdateImporter,
    jobStatus,
    handleCheckJobStatus
  } = props
  const [, t] = useLanguage()
  const jobKind = !jobStatus?.job
    ? null
    : isJobSuccess(jobStatus.job.status)
      ? 'success'
      : isJobFailed(jobStatus.job.status)
        ? 'failed'
        : 'pending'
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const headerCsvInputRef = useRef(null)
  const confirmedRef = useRef(false)
  const statusRef = useRef(null)
  const [hasImportedFile, setImportedFile] = useState(false)
  const [openAdvancedOptions, setOpenAdvancedOptions] = useState(false)
  const [openConfirm, setOpenConfirm] = useState(false)
  const hintId = useId()

  const handleFiles = (files) => {
    if (files.length === 1) {
      const type = files[0].type
      if (type !== 'application/vnd.ms-excel' && type !== 'text/csv') {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_CSV_XLS', 'Only CSV or XLS files can be accepted')]
        })
        return
      }
      if (bytesConverter(files[0]?.size) > 2048) {
        setAlertState({
          open: true,
          content: [t('MAXIMUM_SIZE', 'The maximum file size is 2 megabytes')]
        })
        return
      }
      closeAlert()
      handleUploadCsv(files[0])
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // Import asks first. Without a file it says so (the check react-hook-form's `required` made on the file input) and opens nothing.
  const onSubmit = (event) => {
    event.preventDefault()
    if (!fileState?.fileName) {
      setAlertState({
        open: true,
        content: [t('VALIDATION_ERROR_CSV_FILE_REQUIRED', 'CSV file is required')]
      })
      return
    }
    setOpenConfirm(true)
  }

  const onConfirmImport = () => {
    confirmedRef.current = true
    setOpenConfirm(false)
    if (Object.keys(formState.changes).length > 0 || hasImportedFile) {
      handleCreateImporterJob(selectedImporter?.id)
    }
  }

  const handleGetTitle = (type) => {
    let title = ''
    switch (type) {
      case 'sync_businesses':
        title = t('STORE_IMPORTER', 'Store importer')
        break
      case 'sync_categories':
        title = t('CATEGORY_IMPORTER', 'Category importer')
        break
      case 'sync_products':
        title = t('PRODUCT_IMPORTER', 'Product importer')
        break
      case 'sync_extra_products':
        title = t('EXTRA_PRODUCTS', 'Extra products')
        break
      case 'sync_extras':
        title = t('EXTRAS', 'Extras')
        break
      case 'sync_extra_options':
        title = t('EXTRA_OPTIONS', 'Extra options')
        break
      case 'sync_extra_option_suboptions':
        title = t('EXTRA_OPTION_SUBOPTIONS', 'extra option suboptions')
        break
      case 'sync_multiple':
        title = t('MULTIPLE', 'Multiple')
        break
      default:
        title = type
        break
    }
    return title
  }

  useEffect(() => {
    if (formState.result?.error && Object.keys(formState.result).length > 0) {
      setAlertState({
        open: true,
        content: formState?.result?.result
      })
    }
  }, [formState.result])

  useEffect(() => {
    if (fileState?.fileName) {
      setImportedFile(true)
    }
  }, [fileState])

  const closeAdvanced = () => setOpenAdvancedOptions(false)
  const alertLines = toLines(alertState.content)
  const kindLabel = handleGetTitle(selectedImporter?.type)
  const importerName = selectedImporter?.name
  const confirmTitle = fileState?.fileName
    ? t('IMPORTER_JOB_CONFIRM_TITLE', 'Import _file_?').replace('_file_', fileState.fileName)
    : t('IMPORTER_JOB_CONFIRM_TITLE_NO_FILE', 'Run _name_?').replace('_name_', importerName ?? '')
  const result = jobStatus?.job?.result_data

  const optionField = (name, label, placeholder) => (
    <TextField
      name={name}
      label={label}
      maxLength={1}
      defaultValue={formState?.changes?.[name]}
      onChange={(value) => handleChangeInput({ target: { name, value } })}
      disabled={formState.loading}
      autoComplete='off'
      placeholder={placeholder}
    />
  )

  return (
    <div className='odc-root odc-imp-job'>
      {kindLabel && <p className='odc-imp-job-kind'>{kindLabel}</p>}

      {alertState.open && alertLines.length > 0 && (
        <InlineNotice
          tone='danger'
          icon={CircleAlert}
          role='alert'
          className='odc-imp-job-notice'
          action={<IconButton icon={X} label={t('CLOSE', 'Close')} size='sm' onClick={closeAlert} />}
        >
          {alertLines.map((line, index) => (
            <span key={index} className='odc-imp-job-notice-line'>{line}</span>
          ))}
        </InlineNotice>
      )}

      <form className='odc-imp-job-form' onSubmit={onSubmit} noValidate>
        <div className='odc-imp-job-options'>
          {/* bugs E row 8b: «Separator (;)» and «Escape (|)» named a character that is not the prefilled one (the
              controller starts with «,» and «/»); the labels name the option and the placeholders are the prefilled values (Enclosure named a curly «“» for a straight «"») */}
          {optionField('separator', t('IMPORTER_SEPARATOR', 'Separator'), ',')}
          {optionField('enclosure', t('IMPORTER_ENCLOSURE', 'Enclosure'), '"')}
          {optionField('escape', t('IMPORTER_ESCAPE', 'Escape character'), '/')}
          {optionField('start_line', t('START_LINE', 'Start line'))}
        </div>

        <div className='odc-imp-job-file-block'>
          <ExamineClick
            onFiles={files => handleFiles(files)}
            childRef={(e) => { headerCsvInputRef.current = e }}
            accept='.csv,.xls'
            disabled={formState.loading}
          >
            <DragAndDrop
              onDrop={dataTransfer => handleFiles(dataTransfer.files)}
              className='odc-imp-job-drop'
              disabled={formState.loading}
            >
              <Upload className='odc-icon odc-imp-job-drop-icon' />
              <span className='odc-imp-job-drop-text'>{t('IMPORTER_FILE_DROP', 'Drop a file here or choose one')}</span>
              <Button
                aria-describedby={hintId}
                disabled={formState.loading}
                onClick={() => headerCsvInputRef.current?.click()}
              >
                {t('CHOOSE_FILE', 'Choose file')}
              </Button>
              <span className='odc-imp-job-file' aria-live='polite'>
                {fileState?.fileName && (
                  <>
                    <FileText className='odc-icon' />
                    <span className='odc-imp-job-file-name'>{fileState.fileName}</span>
                  </>
                )}
              </span>
            </DragAndDrop>
          </ExamineClick>
          <p id={hintId} className='odc-imp-job-hint'>{t('IMPORTER_FILE_HINT', 'CSV or XLS, up to 2 MB')}</p>
        </div>

        <div className='odc-imp-job-actions'>
          <Button
            type='submit'
            variant='primary'
            busy={!!formState?.loading}
            disabled={(!hasImportedFile && !(Object.keys(formState?.changes).length > 0)) || formState?.loading || !!jobStatus?.job}
          >
            {formState?.loading ? t('LOADING', 'Loading') : t('IMPORT', 'Import')}
          </Button>
          <Button onClick={() => setOpenAdvancedOptions(true)}>
            {t('ADVANCED_OPTION', 'Advanced Options')}
          </Button>
        </div>
      </form>

      {jobStatus?.job && (
        <div className='odc-imp-job-status' data-kind={jobKind} ref={statusRef} tabIndex={-1}>
          <div className='odc-imp-job-status-live' role='status' aria-live='polite'>
            {jobKind === 'pending' && (
              <>
                <p className='odc-imp-job-status-head'>
                  {jobStatus.checking
                    ? <RotateCw className='odc-icon odc-imp-job-spin' />
                    : <Clock className='odc-icon' />}
                  {t('IMPORTER_JOB_PENDING', 'Import in progress')}
                </p>
                {jobStatus.polling && (
                  <p className='odc-imp-job-status-detail'>
                    {t('IMPORTER_JOB_AUTO_CHECKING', "We'll check automatically — you can also check now")}
                  </p>
                )}
              </>
            )}

            {jobKind === 'failed' && (
              <>
                <p className='odc-imp-job-status-head'>
                  <CircleAlert className='odc-icon' />
                  {t('IMPORTER_JOB_FAILED', 'Import failed')}
                </p>
                <p className='odc-imp-job-status-detail'>
                  {typeof result?.error === 'string' ? result.error : t('ERROR', 'Error')}
                </p>
              </>
            )}

            {jobKind === 'success' && (
              <>
                <p className='odc-imp-job-status-head'>
                  <CircleCheck className='odc-icon' />
                  {t('IMPORTER_JOB_SUCCESS', 'Import completed')}
                </p>
                {result && (
                  <p className='odc-imp-job-status-detail'>
                    {t('CREATED', 'Created')}: {result.inserts ?? 0} · {t('UPDATED', 'Updated')}: {result.updates ?? 0}
                    {(result.metafields_inserts > 0 || result.metafields_updates > 0) && (
                      <> · {t('METAFIELDS', 'Metafields')}: {result.metafields_inserts ?? 0}/{result.metafields_updates ?? 0}</>
                    )}
                  </p>
                )}
              </>
            )}

            {jobStatus.error && (
              <p className='odc-imp-job-status-detail'>
                {t('IMPORTER_JOB_CHECK_ERROR', 'Could not check the import status, please try again')}
              </p>
            )}
          </div>

          <div className='odc-imp-job-status-actions'>
            {jobKind === 'pending'
              ? (
                <Button disabled={jobStatus.checking} onClick={() => handleCheckJobStatus()}>
                  {jobStatus.checking ? t('LOADING', 'Loading') : t('CHECK_NOW', 'Check now')}
                </Button>
                )
              : (
                <Button variant='primary' onClick={() => onClose()}>
                  {t('CLOSE', 'Close')}
                </Button>
                )}
          </div>
        </div>
      )}

      <ConfirmDialog
        // review (3.C): after «Import file» the Import button is disabled while the job runs, so the focus goes to the job status
        finalFocus={() => {
          if (!confirmedRef.current) return true
          confirmedRef.current = false
          focusWhenFree(() => statusRef.current)
          return false
        }}
        open={openConfirm}
        tone='default'
        title={confirmTitle}
        confirmLabel={t('IMPORTER_JOB_CONFIRM', 'Import file')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={onConfirmImport}
        onCancel={() => setOpenConfirm(false)}
      >
        {t('IMPORTER_JOB_CONFIRM_DESCRIPTION', "_name_ creates and updates records in your project with the rows of this file. It can't be undone from here.").replace('_name_', importerName ?? '')}
      </ConfirmDialog>

      {openAdvancedOptions && (
        <ImportersPane title={t('ADVANCED_OPTION', 'Advanced Options')} onBack={closeAdvanced}>
          <ImporterForm
            isAdvanedOptions
            selectedImporter={selectedImporter}
            handleSuccessUpdateImporter={handleSuccessUpdateImporter}
            onClose={closeAdvanced}
          />
        </ImportersPane>
      )}
    </div>
  )
}

export const ImporterJobForm = (props) => {
  const addCsvDetailProps = {
    ...props,
    UIComponent: ImporterJobFormUI
  }
  return <ImporterJobFormController {...addCsvDetailProps} />
}
