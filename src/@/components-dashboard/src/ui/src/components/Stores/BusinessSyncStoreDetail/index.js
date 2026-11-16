import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { CopyButton } from '../../Shared/Product'
import './sync-store-detail.css'

// redesign stores 3.D: the detail of a store in the integration-sync panel, as Product. The five rows and the five
// URLs are the ones of today, unchanged: they are placeholders (integrator.com is not a real host) and taking them out is the
// owner's decision (G1-21), not this migration's.
const LINKS = {
  order_status_update: 'https://integrator.com/orderstatusUpdate',
  receive_menus: 'https://integrator.com/menuUpdate',
  snooze: 'https://integrator.com/snoozeUnsnooze',
  busy_mode: 'https://integrator.com/busyMode',
  preparation_time: 'https://integrator.com/updatePrepTimeURL'
}

const COPIED_FOR_MS = 2000

export const BusinessSyncStoreDetail = (props) => {
  const { business } = props

  const [, t] = useLanguage()

  // «Copied» (or why not) stays for a moment in a status, for whoever cannot see the button: the same contract as the
  // customer panel (Users/CustomersDirectory/CustomerOverview). The region is always there so the change is announced.
  const [copyNote, setCopyNote] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const announce = (note) => {
    clearTimeout(timer.current)
    setCopyNote(note)
    timer.current = setTimeout(() => setCopyNote(null), COPIED_FOR_MS)
  }

  const rows = [
    { key: 'order_status_update', name: t('RECEIVE_ORDER_STATUS_UPDATES', 'Receive order status updates') },
    { key: 'receive_menus', name: t('RECEIVE_MENUS', 'Receive menus') },
    { key: 'snooze', name: t('SNOOZE_OR_UNSNOOZE', 'Snooze or unsnooze') },
    { key: 'busy_mode', name: t('ENABLE_OR_DISABLE_BUSY_MODE', 'Enable or Disable busy mode') },
    { key: 'preparation_time', name: t('UPDATE_PREPARATION_TIME', 'Update preparation time') }
  ]

  const copyNoteText = copyNote === 'copied'
    ? t('COPIED', 'Copied')
    : copyNote === 'failed'
      ? t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")
      : ''

  return (
    <div className='odc-root bsd'>
      <h3 className='bsd-title'>{business?.name}</h3>
      <dl className='bsd-rows'>
        {rows.map(({ key, name }) => (
          <div className='bsd-row' key={key}>
            <dt>{name}</dt>
            <dd>
              <a className='bsd-link' href={LINKS[key]}>{LINKS[key]}</a>
              {/* redesign stores 5.18: P/CopyButton (iconOnly; it copies over http too); review F2: the result is said in
                  the line under the rows (`announce={false}`), so a failure never squeezes the URL */}
              <CopyButton
                iconOnly
                announce={false}
                onResult={announce}
                size='sm'
                text={LINKS[key]}
                label={t('COPY_URL_OF', 'Copy URL: _name_').replace('_name_', name)}
                copiedLabel={t('COPIED', 'Copied')}
                failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
              />
            </dd>
          </div>
        ))}
      </dl>
      <p className='bsd-note' role='status'>{copyNoteText}</p>
    </div>
  )
}
