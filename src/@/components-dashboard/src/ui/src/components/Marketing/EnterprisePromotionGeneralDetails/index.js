import React, { useId, useRef, useState } from 'react'
import {
  useConfig,
  useLanguage,
  useUtils,
  DragAndDrop,
  ExamineClick
} from '../../../../../index'
import { DEFAULT_VISIBLE_DATE_FORMAT } from '../../../../../contexts/UtilsContext'
import { dayOf } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { bytesConverter } from '../../../utils'
import { Image as ImageIcon } from '../../Shared/Icon'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import {
  AlertDialog,
  Button,
  DatePicker,
  Dialog,
  Field,
  RadioGroup,
  Switch,
  TextArea,
  TextField
} from '../../Shared/Product'
import { createSummaryDateFormatter, formatDescriptionStamps } from '../PromotionJourneysListing/journeyUtils'
import '../EnterprisePromotionDetails/promotion-panel.css'

// redesign PE-B3 (decisions 5 and 7; PE-02, PE-18; defects D33, D37, D40, D41, D42, D44): the General form of the advanced editor with the
// fields of Product. Same fields, same handlers and the same submit rule as main (`Add` in add mode, `Save` otherwise, off while nothing is
// staged or it saves). What changes: the name is refused INLINE (it was a modal titled «Profile»), the dates are two day pickers in the
// project's format (a range popover of `react-date-range` before; ISO and 1970 for an offer with no end), the priority is a named radio
// group, the switch is named by its own text and the image area is a real button with a name and a decorative preview.

const has = (changes, key) => Object.prototype.hasOwnProperty.call(changes, key)

// The project's date format for what people read: dates_general_format, or the readable default when none is configured (decision 13), never ISO
const projectDateFormat = (configs) => {
  const generalFormat = configs?.dates_general_format?.value
  const configured = typeof generalFormat === 'string' && generalFormat.trim() !== ''
  return getDateTimeFormats(configured ? generalFormat : `${DEFAULT_VISIBLE_DATE_FORMAT} HH:mm`).dateFormat
}

// The words of P/DatePicker. `clearable` adds «Clear» (the end can be emptied)
const pickerLabels = (t, { clearable = false } = {}) => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.'),
  ...(clearable ? { clear: t('CLEAR', 'Clear') } : {})
})

export const EnterprisePromotionGeneralDetails = (props) => {
  const {
    isAddMode,
    promotionState,
    formState,
    actionState,
    handleChangeImage,
    handleChangeInput,
    handleUpdateClick,
    handleAddPromotion,
    handleChangeItem
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const dateFormat = projectDateFormat(configs)
  const locale = languageState?.language?.code

  const changes = formState.changes || {}
  const promotion = promotionState?.promotion || {}
  // a staged value wins, `null` included (an end that was emptied is empty, not the saved one)
  const valueOf = (key) => (has(changes, key) ? changes[key] : promotion[key])
  // (tanda Y review, as 693 on Quick offers): a description saved by an older version carries raw stamps; the field shows them as
  // dates. Presentation only: nothing is staged until the person types, and then what is staged is what they see.
  const [{ parseDate }] = useUtils()
  const descriptionShown = has(changes, 'description')
    ? changes.description
    : formatDescriptionStamps(promotion.description, createSummaryDateFormatter(parseDate))

  const ids = useId()
  const inputRef = useRef(null)
  const nameRef = useRef(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [nameError, setNameError] = useState(null)

  const orderPriorityOptions = [
    { value: 2, label: t('URGENT', 'Urgent') },
    { value: 1, label: t('HIGH', 'High') },
    { value: 0, label: t('NORMAL', 'Normal') },
    { value: -1, label: t('LOW', 'Low') }
  ]

  const handleFiles = (files) => {
    if (files.length === 1) {
      const type = files[0].type.split('/')[0]
      if (type !== 'image') {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_IMAGES', 'Only images can be accepted')]
        })
        return
      }

      if (bytesConverter(files[0]?.size) > 2048) {
        setAlertState({
          open: true,
          content: [t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')]
        })
        return
      }

      const reader = new window.FileReader()
      reader.readAsDataURL(files[0])
      reader.onload = () => {
        setCropState({ name: 'image', data: reader.result, open: true })
      }

      handleChangeImage(files[0])
    }
  }

  const closeAlert = () => setAlertState({ open: false, content: [] })
  const closeCrop = () => setCropState(current => ({ ...current, open: false }))

  const handleChangePhoto = (croppedImg) => {
    handleChangeItem({ [cropState?.name]: croppedImg })
    setCropState({ name: null, data: null, open: false })
  }

  const name = valueOf('name') ?? ''

  // redesign PE-B3 (D40): the required name is checked here and its message sits under the field
  const onSubmit = (event) => {
    event.preventDefault()
    if (name === '') {
      setNameError(t('NAME_REQUIRED', 'The name is required.'))
      nameRef.current?.focus()
      return
    }
    if (Object.keys(changes).length > 0) {
      if (isAddMode) {
        handleAddPromotion()
      } else {
        handleUpdateClick()
      }
    }
  }

  // redesign PE-B3 (PE-02, PE-18): the day part of the stamp; an empty or invalid value is null (never 1970)
  const startDay = dayOf(valueOf('start'))
  const endDay = dayOf(valueOf('end'))

  const priorityRaw = valueOf('order_priority')
  const priority = priorityRaw === null || priorityRaw === undefined || priorityRaw === '' ? null : Number(priorityRaw)

  const stackable = typeof changes.stackable !== 'undefined' ? changes.stackable : promotion.stackable ?? false
  const imageSrc = changes.image || promotion.image

  const imageLabelId = `${ids}-image`
  const imageHintId = `${ids}-image-hint`

  return (
    <>
      <form className='odc-promo-form' onSubmit={onSubmit} noValidate>
        <div className='odc-promo-field'>
          <span id={imageLabelId} className='odc-promo-label'>{t('IMAGE', 'Image')}</span>
          <ExamineClick
            onFiles={handleFiles}
            childRef={(e) => { inputRef.current = e }}
            accept='image/png, image/jpeg, image/jpg'
            disabled={actionState.loading}
          >
            <DragAndDrop
              className='odc-promo-drop'
              onDrop={dataTransfer => handleFiles(dataTransfer.files)}
              disabled={actionState.loading}
            >
              <button
                type='button'
                className='odc-promo-upload'
                aria-labelledby={`${imageLabelId} ${imageHintId}`}
                data-has-image={imageSrc ? '' : undefined}
                disabled={actionState.loading}
                onClick={() => inputRef.current?.click()}
              >
                {imageSrc && <img className='odc-promo-upload-img' src={imageSrc} alt='' loading='lazy' />}
                <span id={imageHintId} className='odc-promo-upload-hint'>
                  <ImageIcon className='odc-icon' aria-hidden='true' />
                  <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                </span>
              </button>
            </DragAndDrop>
          </ExamineClick>
        </div>

        <TextField
          ref={nameRef}
          label={t('NAME', 'Name')}
          required
          requiredLabel={t('REQUIRED', 'Required')}
          name='name'
          value={name}
          error={nameError || undefined}
          onChange={(value) => {
            setNameError(null)
            handleChangeInput({ target: { name: 'name', value } })
          }}
          disabled={formState.loading}
          autoComplete='off'
        />

        <TextArea
          label={t('DESCRIPTION', 'Description')}
          rows={4}
          name='description'
          placeholder={t('SHORT_PROMOTION_ABOUT', 'Write a little description')}
          value={descriptionShown ?? ''}
          onChange={(value) => handleChangeInput({ target: { name: 'description', value } })}
          disabled={formState.loading}
          autoComplete='off'
        />

        {/* (tanda Y review): its own keys, as Quick offers (a live dictionary had «Start Date» beside «End date») */}
        <div className='odc-promo-panel-dates'>
          <Field label={t('PROMOTION_START_DATE', 'Start date')}>
            <DatePicker
              label={t('PROMOTION_START_DATE', 'Start date')}
              labels={pickerLabels(t)}
              dateFormat={dateFormat}
              locale={locale}
              value={startDay}
              max={endDay || undefined}
              disabled={formState.loading}
              onChange={(day) => { if (day) handleChangeItem({ start: `${day} 00:00:00` }) }}
            />
          </Field>
          <Field label={t('PROMOTION_END_DATE', 'End date')}>
            <DatePicker
              label={t('PROMOTION_END_DATE', 'End date')}
              labels={pickerLabels(t, { clearable: true })}
              dateFormat={dateFormat}
              locale={locale}
              value={endDay}
              min={startDay || undefined}
              disabled={formState.loading}
              onChange={(day) => handleChangeItem({ end: day ? `${day} 23:59:59` : null })}
            />
          </Field>
        </div>

        <TextField
          label={t('LABEL', 'Label')}
          name='label'
          value={valueOf('label') ?? ''}
          onChange={(value) => handleChangeInput({ target: { name: 'label', value } })}
        />

        <RadioGroup
          label={t('ORDER_PRIORITY', 'Order priority')}
          orientation='horizontal'
          className='odc-promo-priority'
          options={orderPriorityOptions}
          value={priority}
          onValueChange={(next) => handleChangeItem({ order_priority: Number(next) })}
        />

        <Switch
          checked={!!stackable}
          onCheckedChange={(next) => handleChangeItem({ stackable: next })}
        >
          {t('ALLOW_COMBINE_OFFER', 'Allow to combine offer (discount/coupon) with others?')}
        </Switch>

        <div className='odc-promo-panel-actions'>
          <Button
            variant='primary'
            type='submit'
            disabled={Object.keys(changes).length === 0 || actionState.loading}
          >
            {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={alertState.open}
        title={t('IMAGE', 'Image')}
        content={alertState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={closeAlert}
      />
      <Dialog
        open={!!cropState.open}
        onOpenChange={(next) => { if (!next) closeCrop() }}
        title={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
      >
        {cropState.data && (
          <ImageCrop
            photo={cropState.data}
            handleChangePhoto={handleChangePhoto}
            onClose={closeCrop}
          />
        )}
      </Dialog>
    </>
  )
}
