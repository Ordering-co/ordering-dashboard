import React from 'react'
import styled from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'
import { useLanguage } from '../../../../../index'
import { ChevronLeft, ChevronRight } from '../Icon'
import { PaginationButtonBridge } from './pagination-button-bridge'
import './pagination-button.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-compact-pagination-${key}`, String(value)])
)

export const compactPaginationStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    text: roles.text,
    muted: roles.textMuted,
    border: roles.border,
    action: roles.action,
    'action-foreground': roles.actionForeground,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    'radius-round': roles.radiusRound,
    duration: roles.duration,
    easing: roles.easing
  })
}

export const WrapperPagination = styled.div.attrs({
  className: 'od-ui od-compact-pagination',
  'data-slot': 'compact-pagination'
})`
  ${props => compactPaginationStyle(props.theme)}
`

export const WrapperPageState = styled.div.attrs({
  className: 'od-ui od-compact-pagination-state',
  'data-slot': 'compact-pagination-state'
})`
  ${props => compactPaginationStyle(props.theme)}
`

// The legacy compact control deliberately has no type attribute. Inside a form
// it remains the browser's implicit submit button while Base UI stays wrapped.
export const PageButton = styled(PaginationButtonBridge).attrs({
  className: 'od-ui od-compact-pagination-button',
  compatibility: 'legacy'
})`
  ${props => compactPaginationStyle(props.theme)}
`

export const PaginationButton = ({ pageSize, total, currentPage, totalPages, prevPaginate, nextPaginate }) => {
  const [, t] = useLanguage()
  const indexOfLastOrders = currentPage * pageSize < total ? currentPage * pageSize : total
  const indexOfFirstOrders = (currentPage - 1) * pageSize + 1

  return (
    <WrapperPagination>
      <WrapperPageState>{indexOfFirstOrders}-{indexOfLastOrders} of {total}</WrapperPageState>
      <PageButton
        disabled={currentPage === 1}
        aria-label={t('PREVIOUS_PAGE', 'Previous page')}
        onClick={() => prevPaginate()}
      >
        <ChevronLeft />
      </PageButton>
      <PageButton
        onClick={() => nextPaginate()}
        disabled={currentPage === totalPages || totalPages === 1}
        aria-label={t('NEXT_PAGE', 'Next page')}
      >
        <ChevronRight />
      </PageButton>
    </WrapperPagination>
  )
}
