import React from 'react'

import { CircleAlert } from '../../Shared/Icon'

// (P-2 of batch R): the message of a local check, under its field. It is the markup and the classes of a Product field's error
// (`odc-field-error`, as in DriversCompaniesDirectory/TimezoneSelect): icon and words, never colour alone, and a `role="alert"` so it is
// announced when it appears. The field points `aria-describedby` at `id`. A `<p>`, not a `<div>`: the legacy wrappers of these forms
// size every `div` in them as a control value. The gap to the field is the Product field's own (`--od-x-space-1-5`).
export const FieldError = ({ id, children }) => (
  <p id={id} className='odc-field-error' role='alert' style={{ marginBlockStart: 'var(--od-x-space-1-5)' }}>
    <CircleAlert className='odc-icon odc-field-error-icon' aria-hidden='true' />
    <span>{children}</span>
  </p>
)
