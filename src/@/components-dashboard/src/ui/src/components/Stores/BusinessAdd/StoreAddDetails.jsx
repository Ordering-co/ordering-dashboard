import React, { useId } from 'react'
import { useTheme } from 'styled-components'
import { useConfig, useLanguage } from '../../../../../index'
import { BUSINESS_VERTICALS } from '../../../../../constants/school'
import { cleanSlug, slugFromName } from '../../../../../utils/storeAdd'
import { isDashboardFeatureEnabled } from '../../../utils'
import { Field, TextArea, TextField } from '../../Shared/Product'

// redesign (D1): the «Your store» group of the add. The Google search above it is StoreAddGoogle (, main's
// ), which replaced the lookup of D2.

/** The «Your store» group: name (the slug follows it until edited), slug, description, phone, email for orders, vertical (Schools). */
export const StoreAddDetails = ({ form, changeFields, problems, showErrors, disabled, fieldRefs, slugApiErrorText }) => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const id = useId()
  const requiredLabel = t('REQUIRED', 'Required')
  const error = (key, messages) => (showErrors && problems?.[key] ? messages[problems[key]] : undefined)
  const showApps = !configs?.white_label_module?.value

  return (
    <section className='odc-sadd-group' aria-labelledby={`${id}-title`}>
      <h2 className='odc-sadd-group-title' id={`${id}-title`}>{t('STORE_ADD_YOUR_STORE', 'Your store')}</h2>
      <div className='odc-sadd-row'>
        <TextField
          ref={fieldRefs?.name}
          name='name'
          label={t('STORE_NAME', 'Store name')}
          required
          requiredLabel={requiredLabel}
          value={form.name ?? ''}
          disabled={disabled}
          error={error('name', { required: t('STORE_ADD_NAME_REQUIRED', 'Enter the store name') })}
          onChange={value => changeFields(form.slugEdited ? { name: value } : { name: value, slug: slugFromName(value ?? '') })}
        />
        <TextField
          ref={fieldRefs?.slug}
          name='slug'
          label={t('SLUG', 'Slug')}
          required
          requiredLabel={requiredLabel}
          value={form.slug ?? ''}
          disabled={disabled}
          hint={t('STORE_ADD_SLUG_HINT', 'The store’s address on your website. No spaces.')}
          error={error('slug', {
            required: t('STORE_ADD_SLUG_REQUIRED', 'Enter a slug'),
            invalid: t('STORE_ADD_SLUG_INVALID', 'Remove the spaces from the slug'),
            // the API refused the slug (G5-19: main's slug dialog could never open)
            api: slugApiErrorText
          })}
          onChange={value => changeFields({ slug: cleanSlug(value), slugEdited: true })}
        />
      </div>
      <TextArea
        name='description'
        label={t('BUSINESS_DESCRIPTION', 'Business description')}
        placeholder={t('SHORT_BUSINESS_ABOUT', 'Write a little description')}
        rows={4}
        value={form.description ?? ''}
        disabled={disabled}
        onChange={value => changeFields({ description: value })}
      />
      <div className='odc-sadd-row'>
        <TextField
          name='cellphone'
          type='tel'
          label={t('PHONE_NUMBER', 'Phone number')}
          value={form.cellphone ?? ''}
          disabled={disabled}
          autoComplete='off'
          onChange={value => changeFields({ cellphone: value })}
        />
        <TextField
          ref={fieldRefs?.email}
          name='email'
          type='email'
          label={t('STORE_ADD_ORDERS_EMAIL', 'Email for new orders')}
          required
          requiredLabel={requiredLabel}
          value={form.email ?? ''}
          disabled={disabled}
          error={error('email', {
            required: t('STORE_ADD_EMAIL_REQUIRED', 'Enter the email that receives new orders'),
            invalid: t('INVALID_EMAIL', 'Invalid email')
          })}
          onChange={value => changeFields({ email: value })}
        />
      </div>
      {isDashboardFeatureEnabled({ featureKey: 'schools', configs }) && (
        <Field label={t('VERTICAL', 'Vertical')}>
          <select
            className='odc-field-input odc-sadd-select'
            value={form.vertical ?? 'store'}
            disabled={disabled}
            onChange={event => changeFields({ vertical: event.target.value })}
          >
            {BUSINESS_VERTICALS.map(vertical => (
              <option key={vertical.value} value={vertical.value}>
                {t(`BUSINESS_VERTICAL_${vertical.value.toUpperCase()}`, vertical.name)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {showApps && (
        <div className='odc-sadd-apps'>
          <p>{t('STORE_ADD_APPS_HINT', 'Receive the orders on the store app too:')}</p>
          <div className='odc-sadd-apps-links'>
            <a href='https://apps.apple.com/us/app/store-app-2-0/id1608192050' target='_blank' rel='noopener noreferrer'>
              <img src={theme?.images?.general?.appStore} alt={t('STORE_ADD_APP_STORE', 'Download on the App Store')} />
            </a>
            <a href='https://play.google.com/store/apps/details?id=com.ordering.storeappv5&hl=en&gl=US' target='_blank' rel='noopener noreferrer'>
              <img src={theme?.images?.general?.googlePlay} alt={t('STORE_ADD_GOOGLE_PLAY', 'Get it on Google Play')} />
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
