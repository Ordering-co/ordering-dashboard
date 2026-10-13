import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { Appointments as AppointmentsController } from '~ui'

export const Appointments = (props) => {
  return (
    <>
      <HelmetTags page='appointments' />
      <AppointmentsController {...props} />
    </>
  )
}
