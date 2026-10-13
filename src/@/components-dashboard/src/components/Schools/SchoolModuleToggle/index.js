import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../../contexts/ApiContext'
import { useConfig } from '../../../contexts/ConfigContext'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useSession } from '../../../contexts/SessionContext'
import { ToastType, useToast } from '../../../contexts/ToastContext'
import { SCHOOL_MODULE_CONFIG_KEY, isDashboardFeatureEnabled } from '../../../utils/dashboardFeatureAccess'

const ENABLED_VALUE = '1'
const DISABLED_VALUE = '0'

/**
 * Turns the School module on or off through the `school_module_enabled`
 * project config. Only administrators (level 0) with an existing config row
 * can toggle; everyone else only reads the state.
 */
export const SchoolModuleToggle = (props) => {
  const { UIComponent } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [{ configs }, { refreshConfigs }] = useConfig()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [saving, setSaving] = useState(false)

  const config = configs?.[SCHOOL_MODULE_CONFIG_KEY]
  const isEnabled = isDashboardFeatureEnabled({ featureKey: 'schools', configs })
  const canToggle = user?.level === 0 && !!config?.id

  const saveValue = async (value) => {
    if (!canToggle || saving) return false
    setSaving(true)
    try {
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .configs(config.id)
        .save({ value })
      if (error) {
        const message = Array.isArray(result) ? result[0] : result
        throw new Error(message || t('ERROR_CONFIG_UPDATE', 'Error updating the config'))
      }
      await refreshConfigs()
      return true
    } catch (err) {
      showToast(ToastType.Error, err?.message || t('ERROR', 'Error'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleEnable = () => saveValue(ENABLED_VALUE)
  const handleDisable = () => saveValue(DISABLED_VALUE)

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          isEnabled={isEnabled}
          canToggle={canToggle}
          config={config}
          saving={saving}
          handleEnable={handleEnable}
          handleDisable={handleDisable}
        />
      )}
    </>
  )
}

SchoolModuleToggle.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
