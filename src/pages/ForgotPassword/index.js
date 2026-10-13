import React from 'react'
import { ForgotPasswordForm } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'
import settings from '../../config'

export const ForgotPassword = (props) => {
  const forgotPasswordProps = {
    ...props,
    useProjectDomain: settings?.use_project_domain
  }

  return (
    <>
      <HelmetTags page='forgotpassword' />
      <ForgotPasswordForm {...forgotPasswordProps} />
    </>
  )
}
