import React from 'react'

import { useConfig, AllSettings as AllSettingsController } from '../../../../../index'
import { SettingsHub } from '../SettingsHub'

const AllSettingsUI = (props) => {
  const {
    categoryLists,
    loadingCategories,
    categoriesError
  } = props
  const [{ configs }] = useConfig()

  return (
    <SettingsHub
      categoryLists={categoryLists}
      loadingCategories={loadingCategories}
      categoriesError={categoriesError}
      configs={configs}
    />
  )
}

export const AllSettings = (props) => {
  const allSettingsProps = {
    ...props,
    UIComponent: AllSettingsUI
  }

  return (
    <AllSettingsController {...allSettingsProps} />
  )
}
