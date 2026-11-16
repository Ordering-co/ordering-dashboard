import React from 'react'

import { useLanguage, useUtils, DriversGroupLogs as DriversGroupLogsController } from '../../../../../index'
import { ChangeLogView, sideOf } from '../../Shared/ChangeLog'

// (row 85 a of batch D): the logs of a driver group and the logs of a driver (the driver panel and the driver details
// Logs tab; they only change the controller) are drawn by Shared/ChangeLog, the view of the store's and the settings' logs, in place
// of the legacy table, Modal and Pagination. Same controllers, same request. What the legacy table showed and the view does not do on
// its own is passed through its props:
// - the Date: `formatDates` (opt-in, DG-B2b) writes created_at through parseDate as UTC; without it the raw value stays;
// - `last_available_at` reads as a date in UTC, on both sides of the change (the legacy New / Old columns);
// - the event is the view's (the upper-case key in the dictionary, else its words: ), and so are the attribute names,
//   the «See changes» dialog of a schedule and the pages (the view's foot also asks for the last page when the current one is past
//   the end, which was this file's effect).
// The Details / New / Old columns are the view's «Changes» (one line per change, «Name: old → new»): the table fits its panel, so
// the Date no longer waits behind a horizontal scroll (L-2 of bugs D). The empty state keeps «No data» and says whose changes they are.

export const DriversGroupLogsUI = (props) => {
  const {
    logsList,
    paginationProps,
    getDriversGroupLogs,
    actionDisabled,
    formatDates,
    userId
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()

  const listLabel = t('LOGS', 'Logs')
  const isDriver = userId != null

  // opt-in: the same piece is shared by the panels, and a caller that does not ask keeps the value as the API sends it
  const formatDate = formatDates
    ? (stamp) => parseDate(stamp, { utc: true })
    : (stamp) => stamp

  const sideText = (item, side) => {
    const direct = item?.[side]
    return item?.attribute === 'last_available_at' && direct != null ? parseDate(direct, { utc: true }) : sideOf(item, side, t)
  }

  const getChanges = (log, { defaultChanges }) => defaultChanges(log).map(line => {
    if (line.schedule || line.attribute !== 'last_available_at') return line
    return { ...line, text: `${line.name}: ${sideText(line.raw, 'old')} → ${sideText(line.raw, 'new')}` }
  })

  return (
    <div inert={actionDisabled ? '' : undefined} aria-disabled={actionDisabled ? 'true' : undefined}>
      <ChangeLogView
        frame='section'
        logsList={logsList}
        paginationProps={paginationProps}
        onPageChange={(page, size) => getDriversGroupLogs?.(page, size)}
        listLabel={listLabel}
        scrollLabel={t('LOGS_TABLE_SCROLL_REGION', 'Logs table, scrolls sideways')}
        emptyTitle={t('NO_DATA', 'No data')}
        emptyDescription={isDriver
          ? t('DRIVER_LOGS_EMPTY_DESCRIPTION', 'Changes made to this driver will appear here.')
          : t('DRIVERS_GROUP_LOGS_EMPTY_DESCRIPTION', 'Changes made to this driver group will appear here.')}
        loadFailedLabel={t('LOGS_LOAD_FAILED', 'The changes could not be loaded.')}
        getChanges={getChanges}
        formatDate={formatDate}
      />
    </div>
  )
}

export const DriversGroupLogs = (props) => {
  const driversGroupLogsProps = {
    ...props,
    UIComponent: DriversGroupLogsUI
  }
  return <DriversGroupLogsController {...driversGroupLogsProps} />
}
