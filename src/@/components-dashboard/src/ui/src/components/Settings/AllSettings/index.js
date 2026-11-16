import React, { useState } from 'react'

import { useConfig, AllSettings as AllSettingsController } from '../../../../../index'
import { SettingsHub } from '../SettingsHub'

const AllSettingsUI = (props) => {
  const {
    categoryLists,
    loadingCategories,
    categoriesError,
    onRetry
  } = props
  const [{ configs }] = useConfig()

  return (
    <SettingsHub
      categoryLists={categoryLists}
      loadingCategories={loadingCategories}
      categoriesError={categoriesError}
      configs={configs}
      onRetry={onRetry}
    />
  )
}

export const AllSettings = (props) => {
  // redesign settings A (decision 9): Retry on a failed catalog mounts the controller again, which fetches
  // the catalog once more (one request, as on the first load).
  const [attempt, setAttempt] = useState(0)
  const allSettingsProps = {
    ...props,
    UIComponent: AllSettingsUI,
    onRetry: () => setAttempt(value => value + 1)
  }

  return (
    <AllSettingsController key={attempt} {...allSettingsProps} />
  )
}
