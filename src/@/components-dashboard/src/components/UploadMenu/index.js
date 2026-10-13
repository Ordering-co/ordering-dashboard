import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage upload menu behavior without UI component
 */
export const UploadMenu = (props) => {
  const {
    UIComponent,
    handleSuccess,
    business,
    getBusiness
  } = props

  const [{ token, user }] = useSession()
  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ changes: {}, loading: false, error: null })

  /**
   * Method to send message with file or URL
   */
  const handleUploadMenu = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const res = await fetch('https://plugins-development.ordering.co/roy_globalfood/pull_menu.php', {
        method: 'post',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: JSON.stringify({
          res_key: formState?.changes?.res_key,
          mas_key: formState?.changes?.mas_key,
          res_id: business?.id,
          project_name: ordering?.project,
          user_id: user?.id,
          token
        })
      })
      const content = await res.json()
      if (content.status === true) {
        showToast(ToastType.Success, content.message)
        handleSuccess && handleSuccess()
        getBusiness()
      } else {
        setFormState({ ...formState, loading: false, error: content.message })
      }
    } catch (err) {
      setFormState({ ...formState, loading: false, error: [err.message] })
    }
  }

  const changeFormState = (changes) => {
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
          handleUploadMenu={handleUploadMenu}
          changeFormState={changeFormState}
        />
      )}
    </>
  )
}

UploadMenu.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
