import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Simplified Custom Domain controller used by the White Label flow.
 *
 * Backend handles the SSL provisioning automatically once the domain is set
 * via `POST /sites/{id}` with `{ domain }`. The frontend only listens to
 * `sites_update` websocket events to reflect status — no `re-issue` and no
 * "Verify SSL" step.
 */
export const WhiteLabelCustomDomain = (props) => {
  const {
    UIComponent,
    site,
    setSite,
    onClose
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleChangeCustomDomain = async () => {
    if (!site?.id) return
    try {
      setFormState((prev) => ({ ...prev, loading: true, error: null }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ domain: formState?.changes?.domain })
      }
      const response = await fetch(`${ordering.root}/sites/${site.id}`, requestOptions)
      const { error, result } = await response.json()
      if (error) {
        setFormState((prev) => ({ ...prev, loading: false, error: result }))
        showToast(ToastType.Error, result)
        return
      }
      setSite({ ...site, ...(result || {}), domain: formState?.changes?.domain })
      setFormState({ loading: false, changes: {}, error: null })
      showToast(ToastType.Success, t('DOMAIN_IS_CHANGED', 'The domain is changed'))
      onClose && onClose()
    } catch (err) {
      setFormState((prev) => ({ ...prev, loading: false, error: [err.message] }))
      showToast(ToastType.Error, err.message)
    }
  }

  const handleChangeFormState = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState?.changes,
        ...changes
      }
    })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleChangeFormState={handleChangeFormState}
          handleChangeCustomDomain={handleChangeCustomDomain}
        />
      )}
    </>
  )
}

WhiteLabelCustomDomain.propTypes = {
  UIComponent: PropTypes.elementType,
  site: PropTypes.object,
  setSite: PropTypes.func,
  onClose: PropTypes.func
}
