import React from 'react'
export { useLanguage } from './entity-selector-language'

export const useConfig = () => [{ configs: { addon_points_and_levels: { value: true } } }]
export const EnterprisePromotionDetails = ({ UIComponent, ...props }) => {
  const state = globalThis.__OD_ENTITY_PROMOTION__
  if (!state) throw new Error('Missing synthetic promotion selection contract')
  return <UIComponent {...props} {...state} />
}
export const EnterprisePromotionGeneralDetails = () => <p data-testid='excluded-general-panel'>General fields are outside this selection fixture.</p>
export const EnterprisePromotionConditions = () => <p data-testid='excluded-conditions-panel'>Condition editing is outside this selection fixture.</p>
