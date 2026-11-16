import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { AlertDialog, Avatar, Button, Checkbox, InlineNotice, SelectField, TextField } from '../../Shared/Product'
import { DriversGroupDrivers } from '../DriversGroupDrivers'
import { DriversGroupCompanies } from '../DriversGroupCompanies'
import { DriversGroupPickList, DriversGroupPickRow } from '../DriversGroupPickList'
import { FieldError } from '../DriversGroupAddForm/FieldError'
import { MissingResourceNotice } from '../DriversGroupAddForm/MissingResourceNotice'
import { DRIVER_MANAGERS_PATH, getMissingResourceMessages } from '../DriversGroupAddForm/missingResources'
import './drivers-group-general-form.css'

const MANAGER_ERROR_ID = 'drivers-group-manager-error'

export const DriversGroupGeneralForm = (props) => {
  const {
    driversGroupState,
    driversManagers,
    changesState,
    handleChangesState,
    handleUpdateDriversGroup,
    handleAddDriversGroup,
    actionDisabled,
    actionState,
    isTourOpen,
    handleNextClick,
    selectedDriverManager,
    handleSelectDriverManager,
    handleSelectAllManagers,
    handleChangeMaxDistance,
    useAdvanced,
    handleLogistic,
    // redesign (AD-6): `{ loading, error }` of each list the panel picks from (the page's); absent in the add form
    pickLists,
    driversManagersLoaded
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [{ user }] = useSession()
  const [searchManagerValue, setSearchManagerValue] = useState(null)
  // redesign (AD-7): «Name is required» is told under the field, not in the dialog
  const [nameError, setNameError] = useState(null)
  const [managerAttempt, setManagerAttempt] = useState(0)
  const formRef = useRef(null)

  const typeOptions = [
    { value: 0, label: t('IN_HOUSE_DRIVERS', 'In house drivers') },
    { value: 1, label: t('DRIVER_COMPANIES', 'Driver companies') }
  ]

  const priorityOptions = [
    { value: -1, label: t('LOW', 'Low') },
    { value: 0, label: t('NORMAL', 'Normal') },
    { value: 1, label: t('HIGH', 'High') },
    { value: 2, label: t('URGENT', 'Urgent') }
  ]

  const group = driversGroupState.driversGroup
  const shownName = changesState?.name ?? group?.name ?? ''

  const managersUnavailable = Boolean(pickLists?.managers?.loading) || Boolean(pickLists?.managers?.error)
  const managerMissing = Boolean(group) && user?.level !== 5 && !managersUnavailable &&
    Array.isArray(selectedDriverManager) && selectedDriverManager.length === 0
  const noManagersYet = Boolean(driversManagersLoaded) && (driversManagers ?? []).length === 0
  const noManagersMessage = getMissingResourceMessages(t).driversManagers
  const managerError = managerMissing && managerAttempt > 0

  useEffect(() => {
    if (!managerAttempt) return
    const field = formRef.current?.querySelector(`[aria-describedby~="${MANAGER_ERROR_ID}"]`)
    if (!field) return
    document.getElementById(MANAGER_ERROR_ID)?.scrollIntoView?.({ block: 'center' })
    const target = field.querySelector('[role="checkbox"]:not([disabled]), a[href]') ?? field
    target.focus({ preventScroll: true, focusVisible: true })
  }, [managerAttempt])

  const onSubmit = (event) => {
    event.preventDefault()
    // redesign (AD-7): the check react-hook-form's `required` made on the name, now under the field
    if (String(shownName).trim() === '') {
      setNameError(t('VALIDATION_ERROR_REQUIRED', '_attribute_ is required.').replace('_attribute_', t('NAME', 'Name')))
      // review AD-R2: Save sits at the foot of a long section; the field it blocks on comes into view with the focus
      const field = formRef.current?.querySelector('input[name="name"]')
      field?.scrollIntoView?.({ block: 'center' })
      field?.focus({ preventScroll: true })
      return
    }
    if (group) {
      if (managerMissing) {
        setManagerAttempt(attempt => attempt + 1)
        return
      }
      if (changesState?.drivers === '[]') {
        setAlertState({
          open: true,
          content: [t('CHOOSE_LEAST_ONE_DRIVER', 'You must choose at least one driver.')]
        })
        return
      }
      handleUpdateDriversGroup(changesState)
    } else {
      // if (user?.level !== 5 && !changesState?.administrator_id) {
      //   setAlertState({
      //     open: true,
      //     content: [t('VALIDATION_ERROR_REQUIRED', 'The manager is required.').replace('_attribute_', t('DRIVER_MANAGER', 'Driver manager'))]
      //   })
      //   return
      // }
      // if (typeof changesState?.priority === 'undefined') {
      //   setAlertState({
      //     open: true,
      //     content: [t('VALIDATION_ERROR_REQUIRED', 'The priority is required.').replace('_attribute_', t('PRIORITY', 'Priority'))]
      //   })
      //   return
      // }
      if (changesState?.type === 0 && !changesState?.drivers) {
        setAlertState({
          open: true,
          content: [t('VALIDATION_ERROR_REQUIRED', 'The drivers is required.').replace('_attribute_', t('DRIVERS', 'Drivers'))]
        })
        return
      }
      if (changesState?.type === 1 && !changesState?.driver_companies) {
        setAlertState({
          open: true,
          content: [t('VALIDATION_ERROR_REQUIRED', 'The Driver company is required.').replace('_attribute_', t('DRIVER_COMPANY', 'Driver company'))]
        })
        return
      }

      if (isTourOpen) {
        handleNextClick()
      } else {
        handleAddDriversGroup()
      }
    }
  }

  // redesign (AD-6): derived from the managers and the search (name or email, no capitals told apart)
  const filteredManagers = useMemo(() => {
    const list = driversManagers ?? []
    if (!searchManagerValue) return list
    const needle = searchManagerValue.toLowerCase()
    return list.filter(manager => (
      manager?.name?.toLowerCase().includes(needle) ||
      manager?.email?.toLowerCase().includes(needle)
    ))
  }, [driversManagers, searchManagerValue])

  const closeAlert = () => setAlertState({ open: false, content: [] })

  return (
    <form
      ref={formRef}
      className='gpg-form'
      data-tour='tour_fill_group'
      onSubmit={onSubmit}
      noValidate
      aria-disabled={actionDisabled ? 'true' : undefined}
      inert={actionDisabled ? '' : undefined}
    >
      <TextField
        label={t('NAME', 'Name')}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        name='name'
        value={shownName}
        error={nameError ?? undefined}
        onChange={value => {
          setNameError(null)
          handleChangesState({ name: value })
        }}
        autoComplete='off'
      />
      <TextField
        label={t('DRIVER_AVAILABLE_MAX_DISTANCE', 'Driver available max distance')}
        name='driver_available_max_distance'
        value={changesState?.driver_available_max_distance ?? group?.driver_available_max_distance ?? ''}
        onChange={value => handleChangeMaxDistance(value)}
        placeholder={t('WITHOUT_RESTRICTIONS', 'Without restrictions')}
        autoComplete='off'
      />
      {user?.level !== 5 && (
        <DriversGroupPickList
          legend={group
            ? (
              <>
                {t('DRIVER_MANAGER', 'Driver manager')}{' '}
                <span className='odc-field-required' aria-hidden='true' title={t('REQUIRED', 'Required')}>*</span>
                <span className='odc-sr-only'>{t('REQUIRED', 'Required')}</span>
              </>
              )
            : t('DRIVER_MANAGER', 'Driver manager')}
          message={managerMissing && (
            <>
              {noManagersYet && (
                <MissingResourceNotice
                  message={noManagersMessage}
                  path={DRIVER_MANAGERS_PATH}
                  linkText={t('ADD_DRIVER_MANAGER', 'Add driver manager')}
                />
              )}
              {!noManagersYet && !managerError && (
                <InlineNotice tone='warning'>
                  {t('DRIVERS_GROUP_WITHOUT_MANAGER', 'This group has no driver manager. A group needs one: choose a driver manager.')}
                </InlineNotice>
              )}
              {managerError && (
                <FieldError id={MANAGER_ERROR_ID}>
                  {noManagersYet ? noManagersMessage : t('DRIVERS_GROUP_MANAGER_REQUIRED', 'Choose a driver manager.')}
                </FieldError>
              )}
            </>
          )}
          groupProps={managerError ? { 'aria-describedby': MANAGER_ERROR_ID, tabIndex: -1 } : undefined}
          search={searchManagerValue}
          onSearch={setSearchManagerValue}
          searchLabel={t('DRIVERS_GROUPS_SEARCH_MANAGERS', 'Search driver managers')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          placeholder={t('SEARCH', 'Search')}
          onSelectAll={() => handleSelectAllManagers(true)}
          onSelectNone={() => handleSelectAllManagers(false)}
          selectAllLabel={t('SELECT_ALL', 'Select all')}
          selectNoneLabel={t('SELECT_NONE', 'Select none')}
          loading={Boolean(pickLists?.managers?.loading)}
          loadingLabel={t('LOADING', 'Loading')}
          error={Boolean(pickLists?.managers?.error)}
          errorTitle={t('DRIVERS_GROUPS_MANAGERS_LOAD_ERROR', "We couldn't load the driver managers.")}
          empty={filteredManagers.length === 0}
          emptyTitle={t('DRIVERS_GROUPS_NO_MANAGERS', 'No driver managers yet')}
          noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
        >
          {filteredManagers.map(manager => (
            <DriversGroupPickRow
              key={manager.id}
              // redesign (AD-3): the photo, else the initials of the name (main drew FaUserAlt)
              media={<Avatar kind='person' name={manager?.name} src={manager?.photo} />}
              title={manager?.name}
              meta={manager?.email}
              checked={selectedDriverManager?.includes(manager?.id)}
              onCheckedChange={next => handleSelectDriverManager(manager?.id, next)}
            />
          ))}
        </DriversGroupPickList>
      )}
      <SelectField
        label={t('TYPE', 'Type')}
        placeholder={t('SELECT_TYPE', 'Select type')}
        options={typeOptions}
        value={changesState?.type ?? group?.type}
        // the select compares as text and hands back the option's own value; the form branches on `changesState?.type === 0`
        onValueChange={value => handleChangesState({ type: Number(value) })}
      />
      <div className='gpg-check'>
        <Checkbox checked={Boolean(useAdvanced)} onCheckedChange={next => handleLogistic(next)}>
          {t('USE_ADVANCED_LOGISTICS', 'Use advanced logistics')}
        </Checkbox>
      </div>
      {
        (changesState?.type === 0 || (typeof changesState?.type === 'undefined' && group?.type === 0))
          ? <DriversGroupDrivers {...props} />
          : <DriversGroupCompanies {...props} />
      }
      <SelectField
        label={t('PRIORITY', 'Priority')}
        placeholder={t('SELECT_PRIORITY', 'Select priority')}
        options={priorityOptions}
        value={changesState?.priority ?? group?.priority}
        onValueChange={value => handleChangesState({ priority: Number(value) })}
      />
      <div className='gpg-actions'>
        <Button
          variant='primary'
          type='submit'
          disabled={Object.keys(changesState).length === 0}
          busy={Boolean(actionState?.loading)}
        >
          {isTourOpen
            ? t('NEXT', 'Next')
            : (group ? t('SAVE', 'Save') : t('ADD', 'Add'))}
        </Button>
      </div>
      <AlertDialog
        open={alertState.open}
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={closeAlert}
      />
    </form>
  )
}
