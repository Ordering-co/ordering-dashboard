import React, { useId } from 'react'
import { Check, CircleAlert } from '../../Shared/Icon'
import { useLanguage } from '../../../../../index'
import { Button } from '../../Shared/Product'

// redesign (D1): what will be created and what is missing, with «Create store» always in sight. From 1280px it is a
// column beside the form (sticky); below that the same list folds away and the actions sit in a bar at the foot of the page,
// with the number of required fields still missing. Nothing here edits: it reads the form.

const ALL_DAY = lapse => lapse?.open?.hour === 0 && lapse?.open?.minute === 0 && lapse?.close?.hour === 23 && lapse?.close?.minute === 59
const REQUIRED_KEYS = ['name', 'slug', 'email', 'payments']

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

export const StoreAddSummary = ({ form, schedule, paymethods, paymethodIds, zone, gallery, cities, cityId, problems, showErrors, status, errorText, onCreate, onCancel }) => {
  const [, t] = useLanguage()
  const id = useId()
  const busy = status === 'creating' || status === 'finishing'
  const done = status === 'partial' || status === 'created'
  const missing = REQUIRED_KEYS.filter(key => problems?.[key]).length + Object.keys(problems || {}).filter(key => key.startsWith('zone')).length

  const openDays = (schedule || []).filter(day => day?.enabled)
  const hoursText = openDays.length === 7 && openDays.every(day => day.lapses?.length === 1 && ALL_DAY(day.lapses[0]))
    ? t('STORE_ADD_OPEN_ALL_DAY', 'Open every day, 24 hours')
    : openDays.length === 0
      ? t('STORE_ADD_ALWAYS_CLOSED', 'Closed every day')
      : withCount(t('STORE_ADD_OPEN_DAYS', 'Open _count_ days a week'), { count: openDays.length })
  const chosen = (paymethods || []).filter(method => paymethodIds.includes(method.id))
  const city = (cities || []).find(item => String(item.id) === String(cityId))
  const images = [form.logo && t('LOGO', 'Logo'), form.header && t('STORE_ADD_HEADER', 'Header'),
    gallery?.length && withCount(t('STORE_ADD_PHOTOS_COUNT', '_count_ photos'), { count: gallery.length })].filter(Boolean)

  const rows = [
    {
      key: 'store',
      state: problems?.name || problems?.slug || problems?.email ? 'missing' : 'ok',
      title: form.name || t('STORE_ADD_NO_NAME', 'No name yet'),
      detail: [form.slug, form.email].filter(Boolean).join(' · ')
    },
    {
      // review 6: a typed address without a pin is not «done»
      key: 'location',
      state: form.address && form.location ? 'ok' : 'note',
      title: form.address || t('STORE_ADD_NO_ADDRESS', 'No address'),
      detail: !form.address
        ? t('STORE_ADD_NO_ADDRESS_HINT', 'Without an address customers can’t find the store on the map')
        : !form.location
            ? t('STORE_LOCATION_NO_PIN', 'No pin yet')
            : [city?.name, form.timezone].filter(Boolean).join(' · ')
    },
    { key: 'hours', state: 'ok', title: hoursText },
    {
      key: 'payments',
      state: problems?.payments ? 'missing' : 'ok',
      title: chosen.length
        ? withCount(chosen.length === 1 ? t('STORE_ADD_PAYMETHODS_ONE', '_count_ payment method') : t('STORE_ADD_PAYMETHODS_OTHER', '_count_ payment methods'), { count: chosen.length })
        : t('STORE_ADD_NO_PAYMETHOD', 'No payment method'),
      detail: chosen.map(method => t(method?.gateway?.toUpperCase(), method?.name)).join(', ')
    },
    {
      key: 'zone',
      state: zone ? (Object.keys(problems || {}).some(key => key.startsWith('zone')) ? 'missing' : 'ok') : 'note',
      title: zone ? (zone.name || t('STORE_ADD_ZONE_UNNAMED', 'Delivery zone')) : t('STORE_ADD_NO_ZONE', 'No delivery zone'),
      detail: zone ? null : t('STORE_ADD_NO_ZONE_HINT', 'You can add zones later in Delivery')
    },
    { key: 'images', state: images.length ? 'ok' : 'note', title: images.length ? images.join(' · ') : t('STORE_ADD_NO_IMAGES', 'No images') }
  ]

  const missingText = missing === 1
    ? t('STORE_ADD_MISSING_ONE', '1 required field missing')
    : withCount(t('STORE_ADD_MISSING_OTHER', '_count_ required fields missing'), { count: missing })
  const createLabel = status === 'creating'
    ? t('STORE_ADD_CREATING', 'Creating store…')
    : status === 'finishing' ? t('STORE_ADD_FINISHING', 'Adding the details…') : t('CREATE_STORE', 'Create store')

  const actions = (
    <>
      {errorText && <p className='odc-sadd-summary-error' role='alert'>{errorText}</p>}
      {showErrors && missing > 0 && <p className='odc-sadd-summary-missing'>{missingText}</p>}
      <div className='odc-sadd-summary-actions'>
        <Button variant='primary' onClick={onCreate} disabled={busy || done} aria-busy={busy || undefined}>{createLabel}</Button>
        <Button variant='ghost' onClick={onCancel} disabled={busy}>{t('CANCEL', 'Cancel')}</Button>
      </div>
    </>
  )

  return (
    <>
      <aside className='odc-sadd-summary' aria-labelledby={`${id}-title`}>
        <h2 className='odc-sadd-summary-title' id={`${id}-title`}>{t('STORE_ADD_NEW_STORE', 'New store')}</h2>
        <ul className='odc-sadd-summary-list'>
          {rows.map(row => (
            <li key={row.key} className='odc-sadd-summary-row' data-state={showErrors || row.state !== 'missing' ? row.state : 'note'}>
              <span className='odc-sadd-summary-mark' aria-hidden='true'>
                {row.state === 'ok' ? <Check className='odc-icon' /> : row.state === 'missing' && showErrors ? <CircleAlert className='odc-icon' /> : '·'}
              </span>
              <span className='odc-sadd-summary-text'>
                <span className='odc-sadd-summary-row-title'>{row.title}</span>
                {row.detail && <span className='odc-sadd-summary-row-detail'>{row.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
        {/* review 6: once the store exists the outcome above has the actions; Cancel here would undo nothing */}
        {!done && <div className='odc-sadd-summary-wide'>{actions}</div>}
        {!done && <p className='odc-sadd-summary-next'>{t('STORE_ADD_NEXT', 'Next: add your menu in Products.')}</p>}
      </aside>
      {!done && <div className='odc-sadd-bar' role='group' aria-label={t('CREATE_STORE', 'Create store')}>{actions}</div>}
    </>
  )
}
