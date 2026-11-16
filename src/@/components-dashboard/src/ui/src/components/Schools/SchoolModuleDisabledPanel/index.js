import React from 'react'
import { useLanguage } from '../../../../../index'
import { GraduationCap } from '../../Shared/Icon'
import { EmptyState } from '../../Shared/Product'
import { SchoolModuleToggle } from '../SchoolModuleToggle'
import '../SchoolsManagement/schools-page.css'

/**
 * Shown on the Schools page while the School module is off. The config
 * `name` comes from the API dictionary when present; the description is
 * always the translated copy because the dictionary hides it.
 *
 * redesign SC-B5 (decision 4): a centred Product EmptyState. An administrator (level 0) gets the switch as its action; anyone else, the line
 * that says only an administrator can enable it. Same conditions as main.
 *
 * without the `school_module_enabled` row the switch cannot save (it only updates the row), so an administrator reads why
 * and whom to ask instead of a panel with no action.
 */
export const SchoolModuleDisabledPanel = (props) => {
  const { config, isAdmin } = props
  const [, t] = useLanguage()

  const missingConfig = isAdmin && !config?.id
  const description = t('SCHOOL_MODULE_DESCRIPTION', 'Enable the School module to run school meal programs on this project. It adds the School vertical for businesses and lets you manage grades, classrooms, students and their guardians, and daily meals with allergen and dietary information.')

  return (
    <EmptyState
      className='odc-school-disabled'
      icon={GraduationCap}
      title={t('SCHOOL_MODULE_NAME', config?.name || 'School module')} // the translation first; the API name (English) is only the fallback
      description={isAdmin && !missingConfig
        ? description
        : (
          <>
            <span className='odc-school-disabled-line'>{description}</span>
            <span className='odc-school-disabled-line'>
              {missingConfig
                ? t('SCHOOL_MODULE_CONFIG_MISSING', 'This project is missing the School module setting, so it cannot be enabled here. Ask support to add it.')
                : t('SCHOOL_MODULE_ONLY_ADMIN', 'Only an administrator can enable this module.')}
            </span>
          </>
          )}
      action={isAdmin && !missingConfig ? <SchoolModuleToggle /> : undefined}
    />
  )
}
