import React, { forwardRef, useId } from 'react'
import { Check, CircleAlert } from '../../Shared/Icon'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button } from '../../Shared/Product'

// redesign (D3; G5-23, SA-01, SA-04): the store was created but a write after it failed. It says which ones and lets
// the user try only those again (the controller asks first what already exists), or go on: nothing is lost and no second store is
// ever made. The form above stays read-only from here on.

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

export const StoreAddOutcome = forwardRef(function StoreAddOutcome ({ business, jobs, paymethods, zone, busy, onRetry, onContinue, onOpenStore }, ref) {
  const [, t] = useLanguage()
  const id = useId()
  const failed = jobs.filter(job => job.status === 'failed')
  const photoIndex = new Map(jobs.filter(job => job.kind === 'photo').map((job, index) => [job.key, index + 1]))
  const label = job => {
    if (job.kind === 'paymethod') {
      const method = paymethods.find(item => item.id === job.id)
      return withCount(t('STORE_ADD_JOB_PAYMETHOD', 'Payment method «_name_»'), { name: method ? t(method.gateway?.toUpperCase(), method.name) : job.id })
    }
    if (job.kind === 'photo') return withCount(t('STORE_ADD_JOB_PHOTO', 'Photo _count_'), { count: photoIndex.get(job.key) })
    // bugs E row 40a: the edits made after a network failure, applied to the store the first attempt created
    if (job.kind === 'details') return t('STORE_ADD_JOB_DETAILS', 'Store details')
    return withCount(t('STORE_ADD_JOB_ZONE', 'Delivery zone «_name_»'), { name: zone?.name || '' })
  }
  const title = failed.length === 1
    ? withCount(t('STORE_ADD_PARTIAL_ONE', '_name_ was created, but 1 thing needs another try'), { name: business?.name || business?.slug || '' })
    : withCount(t('STORE_ADD_PARTIAL_OTHER', '_name_ was created, but _count_ things need another try'), { name: business?.name || business?.slug || '', count: failed.length })

  return (
    <section ref={ref} tabIndex={-1} className='odc-sadd-outcome' role='alert' aria-labelledby={`${id}-title`}>
      <h2 className='odc-sadd-outcome-title' id={`${id}-title`}>{title}</h2>
      <ul className='odc-sadd-outcome-list'>
        <li className='odc-sadd-outcome-row' data-state='done'>
          <Check className='odc-icon' aria-hidden='true' />
          <span>{t('STORE_ADD_JOB_STORE', 'Store')}</span>
        </li>
        {jobs.map(job => (
          <li key={job.key} className='odc-sadd-outcome-row' data-state={job.status}>
            {job.status === 'failed'
              ? <CircleAlert className='odc-icon' aria-hidden='true' />
              : <Check className='odc-icon' aria-hidden='true' />}
            <span>
              {label(job)}
              {job.status === 'failed' && (
                <span className='odc-sadd-outcome-error'>
                  {' — '}{translateApiMessage(t, job.error, t('STORE_ADD_JOB_FAILED', 'It could not be saved.'))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className='odc-sadd-outcome-actions'>
        <Button variant='primary' onClick={onRetry} disabled={busy} aria-busy={busy || undefined}>{t('TRY_AGAIN', 'Try again')}</Button>
        <Button onClick={onContinue} disabled={busy}>{t('STORE_ADD_CONTINUE_PRODUCTS', 'Continue to Products')}</Button>
        <Button variant='ghost' onClick={onOpenStore} disabled={busy}>{t('STORE_ADD_OPEN_STORE', 'Open the store')}</Button>
      </div>
      <p className='odc-sadd-outcome-note'>{t('STORE_ADD_RETRY_NOTE', 'Trying again never creates another store.')}</p>
    </section>
  )
})
