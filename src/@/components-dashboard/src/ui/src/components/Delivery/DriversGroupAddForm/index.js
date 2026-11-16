import React, { useState, useEffect, useRef } from 'react'
import {
  useLanguage,
  useConfig,
  useSession,
  DriversGroupDetails as DriversGroupDetailsController
} from '../../../../../index'
import { useForm, FormProvider } from 'react-hook-form'
import { Alert } from '../../Shared'
import { Button } from '../../../styles'
import { GeneralForm } from './GeneralForm'
import { BusinessesForm } from './BusinessesForm'
import { PaymethodsForm } from './PaymethodsForm'
import { AdvancedLogisticsForm } from './AdvancedLogisticsForm'
import { ScheduleForm } from './ScheduleForm'
import { getMissingResources, getMissingResourceMessages, hasSelectedIds } from './missingResources'

import {
  Container,
  SectionContainer,
  ButtonsContainer
} from './styles'

const DriversGroupAddFormUI = (props) => {
  const {
    actionState,
    changesState,
    isScheduleEnabled,
    handleAddDriversGroup
  } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const [{ user }] = useSession()
  const formMethods = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const autoAssignType = configState?.configs?.autoassign_type?.value

  // redesign DG-B5 (M-DG15): opt-in, the page's discard guard compares these changes with the defaults the add form starts with
  useEffect(() => {
    props.onChangesStateChange?.(changesState)
  }, [changesState])

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  // each check says what is missing in its own words; the generic «required» text read «Value is required» with no field
  // (P-2 of batch R): each one is shown under its own field, linked to it (aria-describedby), and the global Alert is only for the API.
  // The name is a react-hook-form field: its message is drawn by GeneralForm from `errors.name`, and the library focuses it.
  // (main #490): an empty selection ("[]") counts as none, and when the project has no drivers or no driver companies
  // the message says so (with what to do) instead of asking to choose from an empty list
  const missingResources = getMissingResources(props)
  const missingMessages = getMissingResourceMessages(t)
  const findFieldErrors = () => {
    const found = {}
    if (user?.level !== 5 && !changesState?.administrator_id) {
      found.manager = missingResources.driversManagers
        ? missingMessages.driversManagers
        : t('DRIVERS_GROUP_MANAGER_REQUIRED', 'Choose a driver manager.')
    }
    if (changesState?.type === 0 && !hasSelectedIds(changesState?.drivers)) {
      found.drivers = missingResources.drivers
        ? missingMessages.drivers
        : t('CHOOSE_LEAST_ONE_DRIVER', 'You must choose at least one driver.')
    }
    if (changesState?.type === 1 && !hasSelectedIds(changesState?.driver_companies)) {
      found.companies = missingResources.companies
        ? missingMessages.companies
        : t('DRIVERS_GROUP_COMPANY_REQUIRED', 'Choose at least one driver company.')
    }
    if (!hasSelectedIds(changesState?.business)) {
      found.business = t('SELECT_LEAST_ONE_BUSINESS', 'Select at least one business.')
    }
    if (isScheduleEnabled && !changesState?.timezone) {
      found.timezone = t('SELECT_TIMEZONE', 'Select a timezone')
    }
    return found
  }

  // Each error carries the id its message is rendered with, so the field can point `aria-describedby` at it and Save can find the field.
  const withIds = found => Object.fromEntries(Object.entries(found).map(([key, message]) => [key, { id: `drivers-group-add-${key}-error`, message }]))
  const [fieldErrors, setFieldErrors] = useState({})
  const [focusRequest, setFocusRequest] = useState(null)
  const formRef = useRef(null)

  // An error goes away as soon as its field is valid again (or stops existing, as the drivers list does when the type changes).
  useEffect(() => {
    setFieldErrors(current => {
      const keys = Object.keys(current)
      if (keys.length === 0) return current
      const stillWrong = findFieldErrors()
      const kept = keys.filter(key => stillWrong[key])
      if (kept.length === keys.length) return current
      return Object.fromEntries(kept.map(key => [key, current[key]]))
    })
  }, [changesState, isScheduleEnabled])

  // The control that an error describes is the field: a text input and the timezone trigger take the focus themselves, a list of
  // checkboxes (a group) hands it to its first checkbox, or to the group when it has none.
  useEffect(() => {
    if (!focusRequest) return
    const field = formRef.current?.querySelector(`[aria-describedby~="${focusRequest.id}"]`)
    if (!field) return
    const target = field.matches('input, [role="button"]')
      ? field
      // a Product list is a fieldset with its search first; its first checkbox (a P/Checkbox button) comes before any input
      : field.querySelector('[role="checkbox"]:not([disabled])') ?? field.querySelector('input:not([disabled])') ?? field.querySelector('[role="button"], a[href]') ?? field
    // (review): after a click on Save the message must be seen and the focus visible: the lists are long, so the
    // message (above its list) is brought into view first, and the focus is drawn as from the keyboard
    const message = document.getElementById(focusRequest.id)
    message?.scrollIntoView?.({ block: 'center' })
    target.focus({ preventScroll: !!message, focusVisible: true })
  }, [focusRequest])

  const onSubmit = () => {
    const found = findFieldErrors()
    const [first] = Object.keys(found)
    setFieldErrors(withIds(found))
    if (first) {
      setFocusRequest({ id: withIds(found)[first].id })
      return
    }
    handleAddDriversGroup()
  }

  // The name failed react-hook-form's check and `onSubmit` did not run: the other checks are shown now too, not one Save at a time.
  const onInvalid = () => {
    setFieldErrors(withIds(findFieldErrors()))
  }

  return (
    <FormProvider
      watch={formMethods.watch}
      control={formMethods.control}
      handleSubmit={formMethods.handleSubmit}
      reset={formMethods.reset}
      clearErrors={formMethods.clearErrors}
      setError={formMethods.setError}
      errors={formMethods.errors}
      trigger={formMethods.trigger}
      setValue={formMethods.setValue}
      getValues={formMethods.getValues}
      register={formMethods.register}
      unregister={formMethods.unregister}
      formState={formMethods.formState}
    >
      <Container ref={formRef} onSubmit={formMethods.handleSubmit(onSubmit, onInvalid)} data-tour='tour_fill_group'>
        <SectionContainer>
          <GeneralForm {...props} fieldErrors={fieldErrors} />
        </SectionContainer>
        <SectionContainer>
          <BusinessesForm {...props} fieldErrors={fieldErrors} />
        </SectionContainer>
        <SectionContainer>
          <PaymethodsForm {...props} />
        </SectionContainer>
        <SectionContainer>
          <ScheduleForm {...props} fieldErrors={fieldErrors} />
        </SectionContainer>
        {autoAssignType !== 'basic' && (
          <SectionContainer>
            <AdvancedLogisticsForm {...props} />
          </SectionContainer>
        )}
        <ButtonsContainer>
          <Button
            borderRadius='8px'
            color='primary'
            type='submit'
            disabled={Object.keys(changesState).length === 0}
          >
            {t('SAVE', 'Save')}
          </Button>
          <Button
            color='secundary'
            onClick={() => props.onClose()}
            type='button'
          >
            {t('CANCEL', 'Cancel')}
          </Button>
        </ButtonsContainer>
      </Container>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </FormProvider>
  )
}

export const DriversGroupAddForm = (props) => {
  const driversGroupAddFormProps = {
    ...props,
    UIComponent: DriversGroupAddFormUI
  }
  return <DriversGroupDetailsController {...driversGroupAddFormProps} />
}
