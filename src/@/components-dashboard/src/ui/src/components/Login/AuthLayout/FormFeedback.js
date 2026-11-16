import React from 'react'
import styled from 'styled-components'
import { InlineNotice } from '../../Shared/Product'
import { CircleAlert, CircleCheck, TriangleAlert } from '../../Shared/Icon'
import { getApiMessageDefault, translateApiMessage } from '../../../../../utils/translateApiMessage'
import { orderingFocusRing } from '../../../styles/OrderingBrand'
import { SecondaryButton } from './styles'

/**
 * how the access forms (login, forgot password, reset password) say what went wrong or right, without the
 * legacy modal. A validation message sits under its field (`FieldError`), what the API answered goes in a notice inside the form
 * (`ApiErrorNotice`), and a success is a notice too (`SuccessNotice`). The three forms share these pieces, so they read the same.
 */

export const asMessages = (content) => [].concat(content).filter(Boolean)

// What the user reads when the API gave no message: the SDK throws an event without one when the request never got an answer.
export const networkErrorMessage = (t) => t('AUTH_NETWORK_ERROR', "Couldn't connect. Check your connection and try again.")

// The messages of a refused request: the network message when the API said nothing, its strings otherwise. On a 200 the SDK can turn
// `result` into a model object, which is not a message (React cannot render it, and main's modal skipped it): the generic error then.
export const apiErrorMessages = (t, result) => {
  if (!result) return [networkErrorMessage(t)]
  const messages = asMessages(result).filter(message => typeof message === 'string')
  return messages.length ? messages : [t('ERROR_UNKNOWN', 'An error has occurred')]
}

// The same translation the modal Alert (Shared/UI/Confirm) gave every message it listed: by its slug, the message itself when the
// dictionary has no entry, and what is not a string as it came. The notice and the field errors say what the modal said.
export const translateFormMessage = (t, message) => {
  if (typeof message !== 'string') return message
  return translateApiMessage(t, message, message, getApiMessageDefault(message))
}

// The control of the first field with an error, in the order the fields are on the page (`order` is [name, control id] pairs; the
// library would use registration order).
export const focusFirstError = (order, fieldErrors) => {
  const controls = order.filter(([name]) => fieldErrors?.[name]).map(([, id]) => document.getElementById(id))
  controls.find(Boolean)?.focus()
}

// A validation message under its field. It reuses the class of the Product field error (`.odc-field-error`: icon, words and the
// danger colour, never colour alone); the control points at it with aria-describedby.
export const FieldError = ({ id, children }) => (
  <p id={id} role='alert' className='odc-root odc-field-error'>
    <CircleAlert className='odc-icon odc-field-error-icon' aria-hidden='true' />
    <span>{children}</span>
  </p>
)

/**
 * The notice of the access forms (P/InlineNotice). `.odc-notice` brings the page gutter as an inline margin and a bottom margin for
 * the filter bar; the form column already has its width and its own gap, so both go. `&&` wins over the single-class rule of product
 * CSS whatever the order the stylesheets load in.
 */
export const FormNotice = styled(InlineNotice)`
  && {
    margin: 0;
    align-items: flex-start;
  }

  .login-notice-messages {
    display: flex;
    flex-direction: column;
    gap: var(--od-space-1);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
`

// What the API (or a step of the form) answered, as the messages of a danger notice above the submit button.
export const ApiErrorNotice = ({ messages, translate }) => (
  <FormNotice tone='danger' role='alert' icon={TriangleAlert}>
    <span className='login-notice-messages'>
      {messages.map((message, index) => <span key={`${index}-${message}`}>{translate(message)}</span>)}
    </span>
  </FormNotice>
)

// InlineNotice has no `success` tone (it takes warning, info or danger, and P/ is not changed here): the success notice is an `info`
// one whose own wrapper paints it with the success tokens and a check icon. TODO: a plain `tone='success'` when P/ gets one.
const SuccessNoticeBox = styled(FormNotice)`
  && {
    flex-wrap: wrap;
    align-items: center;
    background: var(--od-success-soft);
  }

  && .odc-icon {
    color: var(--od-success-functional);
  }

  /* the text stays beside the icon and shrinks; only the action button drops to its own line when there is no room */
  && .odc-notice-text {
    flex: 1 1 12rem;
    min-inline-size: 0;
  }

  &&:focus-visible {
    ${orderingFocusRing}
  }
`

// A success notice (role status) inside the form. `children` is its text; `action` an optional button at the end.
export const SuccessNotice = ({ children, action, ...props }) => (
  <SuccessNoticeBox tone='info' role='status' icon={CircleCheck} action={action} {...props}>
    <span className='login-notice-messages'>{children}</span>
  </SuccessNoticeBox>
)

// The button of a notice: the size of its text, not the full width of the form (still 44px tall, from the button base).
export const NoticeActionButton = styled(SecondaryButton)`
  && {
    width: auto;
  }
`
