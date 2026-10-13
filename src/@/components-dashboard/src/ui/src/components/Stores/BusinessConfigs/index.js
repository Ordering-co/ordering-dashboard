import React from 'react'
import { useLanguage, BusinessConfigs as BusinessConfigsController } from '../../../../../index'
import { SettingsList } from '../../Settings'
import { getBusinessConfigSections } from '../../../../../utils/businessConfigSections'
import {
  Container,
  SectionCard,
  SectionHeader,
  SectionTitle,
  EmptyState
} from './styles'

export const BusinessConfigsUI = (props) => {
  const {
    business,
    saveBusinessConfig
  } = props

  const [, t] = useLanguage()
  const sections = getBusinessConfigSections(business?.configs)

  return (
    <Container>
      <h1>{t('INTEGRATIONS_SETTINGS', 'Integrations settings')}</h1>
      {sections.length === 0 && (
        <EmptyState>{t('BUSINESS_INTEGRATIONS_SETTINGS_EMPTY', 'No integrations settings available for this business.')}</EmptyState>
      )}
      {sections.map(section => (
        <SectionCard key={section.key} aria-labelledby={`business-configs-${section.key}`}>
          <SectionHeader>
            <SectionTitle id={`business-configs-${section.key}`}>{t(section.labelKey, section.label)}</SectionTitle>
          </SectionHeader>
          <SettingsList
            isRemoveGeneralTitle
            staticConfigs={section.configs}
            saveConfigRequest={saveBusinessConfig}
          />
        </SectionCard>
      ))}
    </Container>
  )
}

export const BusinessConfigs = (props) => {
  const businessConfigsProps = {
    ...props,
    UIComponent: BusinessConfigsUI
  }
  return <BusinessConfigsController {...businessConfigsProps} />
}
