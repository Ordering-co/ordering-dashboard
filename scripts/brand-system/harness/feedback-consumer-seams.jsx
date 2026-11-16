import React from 'react'
export { useLanguage, useUtils } from './language'

export const UsersExportCSV = ({ UIComponent }) => {
  const props = globalThis.__OD_FEEDBACK_EXPORT__
  if (!props) throw new Error('Missing local export fixture contract')
  return <UIComponent {...props} />
}
