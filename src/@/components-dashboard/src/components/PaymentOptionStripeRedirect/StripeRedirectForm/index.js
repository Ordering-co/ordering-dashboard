import React from 'react'
import PropTypes from 'prop-types'

/**
 * Component to manage stripe redirect form behavior without UI component
 */
export const StripeRedirectForm = (props) => {
  const {
    UIComponent,
    handleStripeRedirect
  } = props

  /**
   * Method to handle all workflow about stripe redirect page
   * @param {Object} param0 object with name, email and paydata from stripe form
   */
  const handleSubmitPaymentMethod = async ({ type, name, email }) => {
    handleStripeRedirect && handleStripeRedirect({
      type,
      owner: {
        name,
        email
      }
    })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleSubmitPaymentMethod={handleSubmitPaymentMethod}
        />
      )}
    </>
  )
}

StripeRedirectForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
