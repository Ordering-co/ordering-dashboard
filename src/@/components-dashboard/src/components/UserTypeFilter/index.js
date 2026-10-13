import React, { useState } from 'react'
import PropTypes from 'prop-types'

export const UserTypeFilter = (props) => {
  const {
    userTypes,
    onChangeUserType,
    defaultUserTypes,
    UIComponent
  } = props

  /**
   * This property is used to set in state the current value
   */
  const [typesSelected, setTypesSelected] = useState(defaultUserTypes)

  /**
   * Handle when select value changes
   * @param {number} userType Select a userType
   */
  const handleChangeUserType = (userTypes) => {
    setTypesSelected(userTypes)
    onChangeUserType(userTypes)
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          userTypes={userTypes}
          currentTypesSelected={typesSelected}
          handleChangeUserType={handleChangeUserType}
        />
      )}
    </>
  )
}

UserTypeFilter.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array that contains user types to filter
   */
  userTypes: PropTypes.arrayOf(PropTypes.object),
  /**
   * Default user type to show
   */
  defaultUserTypes: PropTypes.arrayOf(PropTypes.number),
  /**
   * Function to get userType clicked
   */
  onChangeUserType: PropTypes.func
}
