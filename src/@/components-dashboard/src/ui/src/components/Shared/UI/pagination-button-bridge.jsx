import React from 'react'

import { Button } from './Button'

// A styled native button treats `as` and `forwardedAs` differently: `as`
// replaces the element, while `forwardedAs` remains a literal attribute on the
// button. Preserve that public contract while routing the default root through
// the shared Base UI Button wrapper.
export const PaginationButtonBridge = React.forwardRef((componentProps, ref) => {
  const props = { ...componentProps }
  const literalAs = props.as ?? props.forwardedAs
  delete props.as
  delete props.forwardedAs
  return <Button {...props} ref={ref} compatibility='legacy' literalAs={literalAs} />
})

PaginationButtonBridge.displayName = 'OrderingPaginationButtonBridge'
