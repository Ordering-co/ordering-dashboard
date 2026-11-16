import React from 'react'

import { useLanguage } from '../../../../index'
import { translateApiMessage } from '../../../../utils/translateApiMessage'
import { TriangleAlert } from '../Shared/Icon'
import { Button, EmptyState } from '../Shared/Product'

// redesign SC-B1 (M-SC03): a list that could not be loaded says so and offers «Retry». It is never painted as «No … yet»: main swallowed the
// error and showed the empty state of a list that was not empty.
//
// @param {string|true|null} [props.message] What the API said (or `true`/null when it said nothing usable): translated if it is text.
// @param {Function}         props.onRetry   `() => void`
export const SchoolListError = ({ message, onRetry }) => {
  const [, t] = useLanguage()
  return (
    <EmptyState
      tone='error'
      icon={TriangleAlert}
      title={t('SCHOOL_LOAD_FAILED', 'This could not be loaded')}
      description={translateApiMessage(t, message, t('SCHOOL_LOAD_FAILED_HINT', 'Check your connection and try again.'))}
      action={<Button onClick={onRetry}>{t('RETRY', 'Retry')}</Button>}
    />
  )
}
