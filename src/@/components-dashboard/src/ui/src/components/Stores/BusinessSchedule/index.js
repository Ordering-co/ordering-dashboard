import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  BusinessSchedule as BusinessScheduleController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SaveBar, ScheduleEditor, useLeaveGuard } from '../../Shared/Product'
// redesign DL-B3 (decision 6): the labels now live in utils so the driver panel shares them
import { getScheduleLabels } from '../../../utils/scheduleLabels'

import {
  ScheduleContainer,
  Title,
  ScheduleSection
} from './styles'

// redesign stores 5.4: the editor saves through the Product SaveBar (the schedule counts as one change) and
// registers in the leave guard.
const SAVED_MS = 2500

// The first text of an API error: a string, `{ message }`, or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const BusinessScheduleUI = (props) => {
  const {
    business,
    formState,
    handleChangeScheduleState,
    handleUpdateSchedule,
    handleDiscardSchedule
  } = props
  const [, t] = useLanguage()
  const [editorKey, setEditorKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef(null)
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const count = Object.keys(formState?.changes || {}).length > 0 ? 1 : 0
  const errorText = formState?.result?.error
    ? translateApiMessage(t, firstMessage(formState.result.result), t('STORES_CHANGE_FAILED', "We couldn't save the change."))
    : null

  const save = async () => {
    if (formState?.loading) return { ok: false }
    setSaved(false)
    clearTimeout(savedTimer.current)
    const result = await handleUpdateSchedule({ inlineError: true, silentSuccess: true })
    if (result?.ok) {
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_MS)
    }
    return result
  }

  // Back to the saved schedule: the controller drops the changes and the editor starts again from `business.schedule`.
  const discard = () => {
    handleDiscardSchedule()
    setEditorKey(key => key + 1)
    setSaved(false)
  }

  useLeaveGuard({ dirty: count > 0, count, save, discard })

  return (
    <>
      <ScheduleContainer>
        <Title>{t('SCHEDULE', 'Schedule')}</Title>
        <ScheduleSection>
          {/* redesign SL-F3 (C) */}
          <ScheduleEditor
            key={editorKey}
            scheduleList={business?.schedule}
            handleChangeScheduleState={handleChangeScheduleState}
            labels={getScheduleLabels(t)}
          />
        </ScheduleSection>
        <SaveBar
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={(count === 1 ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change') : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)}
          names={count > 0 ? [t('SCHEDULE', 'Schedule')] : []}
          moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
          saving={Boolean(formState?.loading)}
          errorText={errorText}
          onRetry={save}
          retryLabel={t('RETRY', 'Retry')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={t('SAVE', 'Save')}
          onDiscard={discard}
          onSave={save}
        />
      </ScheduleContainer>
    </>
  )
}

export const BusinessSchedule = (props) => {
  const businessScheduleProps = {
    ...props,
    UIComponent: BusinessScheduleUI
  }
  return <BusinessScheduleController {...businessScheduleProps} />
}
