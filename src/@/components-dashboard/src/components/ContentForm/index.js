import React, { useState } from 'react'
import PropTypes from 'prop-types'

export const ContentForm = (props) => {
  const {
    UIComponent,
    type,
    handleChangeContent,
    onClose
  } = props

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleChangeFormState = (field, value) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [field]: value
      }
    })
  }

  const handleSave = (value) => {
    const editValue = value ?? formState?.changes?.body
    handleChangeContent(type, editValue)
    onClose()
  }

  const handleDelete = () => {
    handleChangeContent(type, '')
    onClose()
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleChangeFormState={handleChangeFormState}
          handleSave={handleSave}
          handleDelete={handleDelete}
        />
      )}
    </>
  )
}

ContentForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
