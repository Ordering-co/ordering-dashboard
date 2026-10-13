import React from 'react'
import { useLanguage } from '../../../../../index'
import { SchoolModuleToggle } from '../SchoolModuleToggle'
import {
  SchoolModuleDisabledStage,
  SchoolModulePanel,
  SchoolModulePanelTitle,
  SchoolModulePanelText,
  SchoolModulePanelActions
} from '../styles'

/**
 * Shown on the Schools page while the School module is off. The config
 * `name` comes from the API dictionary when present; the description is
 * always the translated copy because the dictionary hides it.
 */
export const SchoolModuleDisabledPanel = (props) => {
  const { config, isAdmin } = props
  const [, t] = useLanguage()

  return (
    <SchoolModuleDisabledStage>
      <SchoolModulePanel>
        <SchoolModulePanelTitle>
          {config?.name || t('SCHOOL_MODULE_NAME', 'School module')}
        </SchoolModulePanelTitle>
        <SchoolModulePanelText>
          {t('SCHOOL_MODULE_DESCRIPTION', 'Enable the School module to run school meal programs on this project. It adds the School vertical for businesses and lets you manage grades, classrooms, students and their guardians, and daily meals with allergen and dietary information.')}
        </SchoolModulePanelText>
        {!isAdmin && (
          <SchoolModulePanelText>
            {t('SCHOOL_MODULE_ONLY_ADMIN', 'Only an administrator can enable this module.')}
          </SchoolModulePanelText>
        )}
        {isAdmin && (
          <SchoolModulePanelActions>
            <SchoolModuleToggle />
          </SchoolModulePanelActions>
        )}
      </SchoolModulePanel>
    </SchoolModuleDisabledStage>
  )
}
