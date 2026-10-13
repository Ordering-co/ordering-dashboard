import React, { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { HourglassSplit, CheckCircleFill, XCircleFill, ArrowClockwise } from 'react-bootstrap-icons'
import { useLanguage, DragAndDrop, ExamineClick, ImporterJobForm as ImporterJobFormController } from '../../../../../index'
import { isJobFailed, isJobSuccess } from '../../../../../components/ImporterJobForm'
import { Modal, Alert, SideBar } from '../../Shared'
import { bytesConverter } from '../../../utils'
import { Button, Input } from '../../../styles'
import { ImporterForm } from '../ImporterForm'
import { ImporterHelpContent } from '../ImporterHelpContent'
import {
  FormWrapper,
  Header,
  FormInput,
  InputWrapper,
  ActionsForm,
  UploadCsvInputContainer,
  AdvancedOptionsButton,
  JobStatusWrapper,
  JobStatusHeader,
  JobStatusDetail,
  JobStatusActions
} from './styles'

const ImporterJobFormUI = (props) => {
  const {
    selectedImporter,
    formState,
    fileState,
    handleChangeInput,
    handleUploadCsv,
    handleCreateImporterJob,
    onClose,
    handleOpenChildForm,
    handleCloseChildForm,
    openMappingDetails,
    setOpenMappingDetails,
    handleSuccessUpdateImporter,
    jobStatus,
    handleCheckJobStatus
  } = props
  const [, t] = useLanguage()
  const formMethods = useForm()
  const jobKind = !jobStatus?.job
    ? null
    : isJobSuccess(jobStatus.job.status)
      ? 'success'
      : isJobFailed(jobStatus.job.status)
        ? 'failed'
        : 'pending'
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [openImporterHelp, setOpenImporterHelp] = useState(false)
  const headerCsvInputRef = useRef(null)
  const [hasImportedFile, setImportedFile] = useState(false)
  const [openAdvancedOptions, setOpenAdvancedOptions] = useState(false)

  const handleFiles = (files) => {
    if (files.length === 1) {
      const type = files[0].type
      if (type !== 'application/vnd.ms-excel' && type !== 'text/csv') {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_CSV', 'Only CSV can be accepted')]
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
      handleUploadCsv(files[0])
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const onSubmit = () => {
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
    if (Object.keys(formMethods.errors).length > 0) {
      const content = Object.values(formMethods.errors).map(error => error.message)
      setAlertState({
        open: true,
        content
      })
    }
  }, [formMethods.errors])

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

  return (
    <>
      <FormWrapper>
        <Header>
          {handleGetTitle(selectedImporter?.type)}
        </Header>
        <FormInput onSubmit={formMethods.handleSubmit(onSubmit)}>
          <InputWrapper>
            <label>{t('SEPARATOR', 'Separator (;)')}</label>
            <Input
              name='separator'
              type='text'
              placeholder=';'
              maxLength='1'
              defaultValue={formState?.changes?.separator}
              onChange={handleChangeInput}
              disabled={formState.loading}
              autoComplete='off'
            />
          </InputWrapper>
          <InputWrapper>
            <label>{t('ENCLOSURE', 'Enclosure (“) ')}</label>
            <Input
              name='enclosure'
              type='text'
              placeholder='"'
              maxLength='1'
              defaultValue={formState?.changes?.enclosure}
              onChange={handleChangeInput}
              disabled={formState.loading}
              autoComplete='off'
            />
          </InputWrapper>
          <InputWrapper>
            <label>{t('ESCAPE', 'Escape (|)')}</label>
            <Input
              name='escape'
              type='text'
              placeholder='\'
              maxLength='1'
              defaultValue={formState?.changes?.escape}
              onChange={handleChangeInput}
              disabled={formState.loading}
              autoComplete='off'
            />
          </InputWrapper>
          <InputWrapper>
            <label>{t('START_LINE', 'Start line')}</label>
            <Input
              name='start_line'
              type='text'
              maxLength='1'
              defaultValue={formState?.changes?.start_line}
              onChange={handleChangeInput}
              disabled={formState.loading}
              autoComplete='off'
            />
          </InputWrapper>
          <InputWrapper
            onClick={() => headerCsvInputRef.current.click()}
          >
            <ExamineClick
              onFiles={files => handleFiles(files)}
              childRef={(e) => { headerCsvInputRef.current = e }}
              accept='.csv,.xlsx,.xls'
              disabled={formState.loading}
            >
              <DragAndDrop
                onDrop={dataTransfer => handleFiles(dataTransfer.files)}
                className='csvUpload'
              >
                <UploadCsvInputContainer>
                  <label>{t('UPLOAD_FILE', 'Upload file')}</label>
                  <Input
                    name='CSVfile'
                    placeholder={t('CSV', 'CSV')}
                    autoComplete='off'
                    defaultValue={
                      fileState?.fileName
                    }
                    pattern='^.+\.(xlsx|xls|csv)$'
                    readOnly
                    ref={formMethods.register({
                      required: t('VALIDATION_ERROR_CSV_FILE_REQUIRED', 'CSV file is required')
                    })}
                    onChange={handleChangeInput}
                  />
                  <Button
                    name='upload'
                    color='primary'
                    borderRadius='7.6px'
                    type='button'
                  >
                    {t('UPLOAD', 'Upload')}
                  </Button>
                </UploadCsvInputContainer>
              </DragAndDrop>
            </ExamineClick>
          </InputWrapper>
          <ActionsForm>
            <Button
              type='submit'
              color='primary'
              borderRadius='5px'
              disabled={(!hasImportedFile && !(Object.keys(formState?.changes).length > 0)) || formState?.loading || !!jobStatus?.job}
            >
              {formState?.loading ? t('LOADING', 'Loading') : t('IMPORT', 'Import')}
            </Button>
            <AdvancedOptionsButton
              onClick={() => {
                handleOpenChildForm()
                setOpenAdvancedOptions(true)
              }}
            >
              {t('ADVANCED_OPTION', 'Advanced Options')}
            </AdvancedOptionsButton>
          </ActionsForm>
        </FormInput>

        {jobStatus?.job && (
          <JobStatusWrapper>
            {jobKind === 'pending' && (
              <>
                <JobStatusHeader $kind='pending' $spinning={jobStatus.checking}>
                  {jobStatus.checking ? <ArrowClockwise /> : <HourglassSplit />}
                  {t('IMPORTER_JOB_PENDING', 'Import in progress')}
                </JobStatusHeader>
                {jobStatus.polling && (
                  <JobStatusDetail>
                    {t('IMPORTER_JOB_AUTO_CHECKING', "We'll check automatically — you can also check now")}
                  </JobStatusDetail>
                )}
              </>
            )}

            {jobKind === 'failed' && (
              <>
                <JobStatusHeader $kind='failed'>
                  <XCircleFill /> {t('IMPORTER_JOB_FAILED', 'Import failed')}
                </JobStatusHeader>
                <JobStatusDetail>
                  {typeof jobStatus.job.result_data?.error === 'string' ? jobStatus.job.result_data.error : t('ERROR', 'Error')}
                </JobStatusDetail>
              </>
            )}

            {jobKind === 'success' && (
              <>
                <JobStatusHeader $kind='success'>
                  <CheckCircleFill /> {t('IMPORTER_JOB_SUCCESS', 'Import completed')}
                </JobStatusHeader>
                {jobStatus.job.result_data && (
                  <JobStatusDetail>
                    {t('CREATED', 'Created')}: {jobStatus.job.result_data.inserts ?? 0} · {t('UPDATED', 'Updated')}: {jobStatus.job.result_data.updates ?? 0}
                    {(jobStatus.job.result_data.metafields_inserts > 0 || jobStatus.job.result_data.metafields_updates > 0) && (
                      <> · {t('METAFIELDS', 'Metafields')}: {jobStatus.job.result_data.metafields_inserts ?? 0}/{jobStatus.job.result_data.metafields_updates ?? 0}</>
                    )}
                  </JobStatusDetail>
                )}
              </>
            )}

            {jobStatus.error && (
              <JobStatusDetail>
                {t('IMPORTER_JOB_CHECK_ERROR', 'Could not check the import status, please try again')}
              </JobStatusDetail>
            )}

            <JobStatusActions>
              {jobKind === 'pending'
                ? (
                <Button
                  type='button'
                  color='primary'
                  outline
                  borderRadius='5px'
                  disabled={jobStatus.checking}
                  onClick={() => handleCheckJobStatus()}
                >
                  {jobStatus.checking ? t('LOADING', 'Loading') : t('CHECK_NOW', 'Check now')}
                </Button>
                  )
                : (
                <Button
                  type='button'
                  color='primary'
                  borderRadius='5px'
                  onClick={() => onClose()}
                >
                  {t('CLOSE', 'Close')}
                </Button>
                  )}
            </JobStatusActions>
          </JobStatusWrapper>
        )}

        <Alert
          title={t('CREATE_IMPORTER_JOB', 'Create importer job')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => closeAlert()}
          onAccept={() => closeAlert()}
          closeOnBackdrop={false}
        />
        {openImporterHelp && (
          <Modal
            width='50%'
            height='80vh'
            padding='30px'
            title=''
            open={openImporterHelp}
            onClose={() => setOpenImporterHelp(false)}
          >
            <ImporterHelpContent />
          </Modal>
        )}
        {openAdvancedOptions && (
          <SideBar
            isBorderShow
            open={openAdvancedOptions}
            defaultSideBarWidth={openMappingDetails ? 1000 : 500}
            moveDistance={openMappingDetails ? 500 : 0}
            onClose={() => {
              handleCloseChildForm()
              setOpenMappingDetails(false)
              setOpenAdvancedOptions(false)
            }}
          >
            <ImporterForm
              isAdvanedOptions
              selectedImporter={selectedImporter}
              openMappingDetails={openMappingDetails}
              setOpenMappingDetails={setOpenMappingDetails}
              handleSuccessUpdateImporter={handleSuccessUpdateImporter}
              onClose={() => {
                handleCloseChildForm()
                setOpenMappingDetails(false)
                setOpenAdvancedOptions(false)
              }}
            />
          </SideBar>
        )}
      </FormWrapper>
    </>
  )
}

export const ImporterJobForm = (props) => {
  const addCsvDetailProps = {
    ...props,
    UIComponent: ImporterJobFormUI
  }
  return <ImporterJobFormController {...addCsvDetailProps} />
}
