import React from 'react'

import { useLanguage, BusinessLogs as BusinessLogsController } from '../../../../../index'
import { ChangeLogView } from '../../Shared/ChangeLog'

// redesign stores 5.16 (; G2-33, G2-34): the logs of a store on Product, in place of the legacy table, Modal and Pagination.
// The same controller and the same request; what changes is how the screen says things.
// redesign settings-logs: the view (table, cards, detail and schedule dialogs, failure, pages) now lives in
// Shared/ChangeLog, shared with the project's settings logs; this file keeps the store's texts and its section frame.
// Nothing changes for the store: same columns (Date, User, Event, Changes, User agent), same dialogs, same keys.

export const BusinessLogsUI = (props) => {
  const {
    logsList,
    paginationProps,
    getBusinessLogs,
    reload
  } = props

  const [, t] = useLanguage()
  const listLabel = t('LOGS', 'Logs')

  return (
    <ChangeLogView
      frame='section'
      header={<h1 className='odc-cl-title'>{listLabel}</h1>}
      logsList={logsList}
      paginationProps={paginationProps}
      onPageChange={(page, size) => getBusinessLogs?.(page, size)}
      onReload={reload}
      listLabel={listLabel}
      scrollLabel={t('LOGS_TABLE_SCROLL_REGION', 'Logs table, scrolls sideways')}
      emptyTitle={t('LOGS_EMPTY', 'No changes yet')}
      emptyDescription={t('LOGS_EMPTY_DESCRIPTION', 'Changes made to this store will appear here.')}
      loadFailedLabel={t('LOGS_LOAD_FAILED', 'The changes could not be loaded.')}
    />
  )
}

export const BusinessLogs = (props) => {
  const businessLogsProps = {
    ...props,
    UIComponent: BusinessLogsUI
  }
  return <BusinessLogsController {...businessLogsProps} />
}
