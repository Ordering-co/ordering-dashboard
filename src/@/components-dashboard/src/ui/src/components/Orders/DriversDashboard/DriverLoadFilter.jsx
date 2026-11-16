import React from 'react'
import { useLanguage } from '../../../../../index'
import { SegmentedControl, Tabs } from '../../Shared/Product'
import { figure, fillTemplate } from './DriverRow'
import './drivers-board.css'

// redesign drivers-dashboard B3 (decision 3): Online / Offline tabs (same keys and counts as the filter of today), under them a single-value
// «All · Not busy · Busy» control and the summary line. The tabs count every driver of their state; the summary counts the tab on screen.
export const DriverLoadFilter = ({ tab, onTabChange, onlineCount, offlineCount, load, onLoadChange, counts }) => {
  const [, t] = useLanguage()
  const items = [
    { value: 'online', label: t('ONLINE', 'Online'), count: onlineCount },
    { value: 'offline', label: t('INACTIVE_DRIVERS', 'Offline'), count: offlineCount }
  ]
  // The options are strings: SegmentedControl does not take nodes.
  const options = [
    { value: 'all', label: t('ALL', 'All') },
    { value: 'notBusy', label: t('NOT_BUSY', 'Not busy') },
    { value: 'busy', label: t('BUSY', 'Busy') }
  ]
  return (
    <div className='odd-filter'>
      <Tabs label={t('DRIVERS', 'Drivers')} value={tab} onValueChange={onTabChange} items={items} />
      <div className='odd-load'>
        <SegmentedControl label={t('STATUS', 'Status')} value={load} onValueChange={onLoadChange} options={options} />
        <p className='odd-summary' aria-live='polite'>
          {fillTemplate(
            // redesign drivers-dashboard R1-05: a singular for one driver
            (counts?.all ?? 0) === 1
              ? t('DRIVERS_LOAD_SUMMARY_ONE', '_all_ driver · _notBusy_ not busy · _busy_ busy')
              : t('DRIVERS_LOAD_SUMMARY_OTHER', '_all_ drivers · _notBusy_ not busy · _busy_ busy'),
            { _all_: figure(counts?.all ?? 0), _notBusy_: figure(counts?.notBusy ?? 0), _busy_: figure(counts?.busy ?? 0) }
          )}
        </p>
      </div>
    </div>
  )
}
