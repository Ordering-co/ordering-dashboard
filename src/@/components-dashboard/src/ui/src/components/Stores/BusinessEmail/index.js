import React from 'react'
import { useLanguage } from '../../../../../index'
import { TextField } from '../../Shared/Product'
import '../BusinessNotifications/notifications.css'

// redesign stores 5.4: a controlled field of the Notifications form. It saves nothing by itself: the form keeps
// the draft, checks the address when Save is pressed (an empty one is valid and clears it) and hands the error back as `emailError`.
export const BusinessEmail = (props) => {
  const {
    email,
    emailError,
    onChangeEmail
  } = props

  const [, t] = useLanguage()

  return (
    <>
      <section className='odc-store-notif-block'>
        <h2 className='odc-store-notif-section'>{t('EMAILS_NOTIFICATIONS', 'Email notifications')}</h2>
        <TextField
          type='email'
          label={t('EMAIL_RECEIVE_ORDERS', 'Email to receive orders')}
          value={email ?? ''}
          error={emailError || undefined}
          autoComplete='off'
          onChange={(value) => onChangeEmail && onChangeEmail(value)}
        />
      </section>

      <section className='odc-store-notif-block odc-store-notif-push'>
        <h2 className='odc-store-notif-section'>{t('ORDERS_APP_PUSH', 'Orders app push')}</h2>
        <p>{t('ORDERS_APP_PUSH_DESC', 'You can download our apps and receive push notifications directly in there, it is easy and free.')}</p>
      </section>
    </>
  )
}
