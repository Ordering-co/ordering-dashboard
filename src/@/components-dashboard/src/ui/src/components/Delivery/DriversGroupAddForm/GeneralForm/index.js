import React from 'react'
import { useLanguage, useSession } from '../../../../../../index'
import { useFormContext } from 'react-hook-form'
import { SecondSelect as DefaultSelect } from '../../../../styles'
import { TextField } from '../../../Shared/Product'
import { DriversGroupDrivers } from '../../DriversGroupDrivers'
import { DriversGroupCompanies } from '../../DriversGroupCompanies'
import { FieldError } from '../FieldError'
import { MissingResourceNotice } from '../MissingResourceNotice'
import {
  DRIVERS_PATH,
  DRIVER_MANAGERS_PATH,
  DRIVER_COMPANIES_PATH,
  getMissingResources,
  getMissingResourceMessages
} from '../missingResources'

import {
  Container,
  FieldSpacer,
  InputWrapper
} from './styles'

export const GeneralForm = (props) => {
  const {
    driversManagers,
    changesState,
    handleChangesState,
    handleChangeType,
    fieldErrors
  } = props

  const [, t] = useLanguage()
  const { register, errors } = useFormContext()
  const [{ user }] = useSession()

  const missingResources = getMissingResources(props)
  const missingMessages = getMissingResourceMessages(t)
  const isInHouse = changesState?.type === 0

  const typeOptions = [
    { value: 0, content: t('IN_HOUSE_DRIVERS', 'In house drivers') },
    { value: 1, content: t('DRIVER_COMPANIES', 'Driver companies') }
  ]

  const driversManagersOptions = driversManagers.map(manager => {
    return {
      value: manager.id,
      content: <div>{manager?.name} {manager?.lastname}</div>
    }
  })

  const priorityOptions = [
    { value: -1, content: t('LOW', 'Low') },
    { value: 0, content: t('NORMAL', 'Normal') },
    { value: 1, content: t('HIGH', 'High') },
    { value: 2, content: t('URGENT', 'Urgent') }
  ]

  // (P-2 of batch R): the name's message sits under the input, which points at it
  // (tanda AK): the Product text field, as in the group editor (DriversGroupGeneralForm): its frame draws the label, the
  // required mark, the message and the 44 px area on a phone; react-hook-form keeps the same check and focus through the ref
  const nameError = errors?.name?.message
  const managerError = fieldErrors?.manager

  const membersNotice = isInHouse
    ? missingResources.drivers && {
      label: t('DRIVERS', 'Drivers'),
      message: missingMessages.drivers,
      path: DRIVERS_PATH,
      linkText: t('ADD_DRIVER', 'Add driver'),
      error: fieldErrors?.drivers
    }
    : missingResources.companies && {
      label: t('DRIVER_COMPANIES', 'Driver companies'),
      message: missingMessages.companies,
      path: DRIVER_COMPANIES_PATH,
      linkText: t('ADD_DRIVER_COMPANY', 'Add driver company'),
      error: fieldErrors?.companies
    }

  return (
    <Container>
      <h2>{t('GENERAL', 'General')}</h2>
      <FieldSpacer>
        <TextField
          id='new-drivers-group-name'
          label={t('NAME', 'Name')}
          required
          requiredLabel={t('REQUIRED', 'Required')}
          name='name'
          defaultValue={changesState?.name ?? ''}
          onChange={value => handleChangesState({ name: value })}
          placeholder={t('NAME', 'Name')}
          ref={register({
            required: t(
              'VALIDATION_ERROR_REQUIRED',
              'Project is required'
            ).replace('_attribute_', t('NAME', 'Name'))
          })}
          error={nameError || undefined}
          autoComplete='off'
        />
      </FieldSpacer>
      {user?.level !== 5 && (
        <InputWrapper>
          <label id='new-drivers-group-manager-label'>
            {t('DRIVER_MANAGER', 'Driver manager')}{' '}
            <span className='odc-field-required' aria-hidden='true' title={t('REQUIRED', 'Required')}>*</span>
            <span className='odc-sr-only'>{t('REQUIRED', 'Required')}</span>
          </label>
          <div role='group' aria-labelledby='new-drivers-group-manager-label' aria-describedby={managerError?.id}>
            {missingResources.driversManagers
              ? (
                <MissingResourceNotice
                  message={missingMessages.driversManagers}
                  path={DRIVER_MANAGERS_PATH}
                  linkText={t('ADD_DRIVER_MANAGER', 'Add driver manager')}
                />
                )
              : (
                <DefaultSelect
                  isSecondIcon
                  placeholder={t('SELECT_MANAGER', 'Select driver manager')}
                  options={driversManagersOptions}
                  defaultValue={changesState?.administrator_id}
                  optionInnerMaxHeight='60vh'
                  onChange={val => handleChangesState({ administrator_id: val })}
                />
                )}
          </div>
          {managerError && <FieldError id={managerError.id}>{managerError.message}</FieldError>}
        </InputWrapper>
      )}
      <InputWrapper>
        <label>{t('TYPE', 'Type')}</label>
        <DefaultSelect
          isSecondIcon
          placeholder={t('SELECT_TYPE', 'Select type')}
          options={typeOptions}
          defaultValue={changesState?.type}
          onChange={val => handleChangeType(val)}
        />
      </InputWrapper>

      {/* (main #490): with no drivers (or no driver companies) loaded, a notice with the way to add them replaces the empty list */}
      {membersNotice && (
        <InputWrapper>
          <label>{membersNotice.label}</label>
          <MissingResourceNotice
            message={membersNotice.message}
            path={membersNotice.path}
            linkText={membersNotice.linkText}
          />
          {/* after Save, the check of the missing list is said under its notice too (role="alert") */}
          {membersNotice.error && <FieldError id={membersNotice.error.id}>{membersNotice.error.message}</FieldError>}
        </InputWrapper>
      )}
      {!membersNotice && isInHouse && <DriversGroupDrivers {...props} selectionError={fieldErrors?.drivers} />}
      {!membersNotice && !isInHouse && <DriversGroupCompanies {...props} selectionError={fieldErrors?.companies} />}

      <InputWrapper>
        <label>{t('PRIORITY', 'Priority')}</label>
        <DefaultSelect
          isSecondIcon
          placeholder={t('SELECT_PRIORITY', 'Select priority')}
          options={priorityOptions}
          defaultValue={changesState?.priority}
          onChange={val => handleChangesState({ priority: val })}
        />
      </InputWrapper>
    </Container>
  )
}
