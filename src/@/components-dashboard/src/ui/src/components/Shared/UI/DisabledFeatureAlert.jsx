import React, { useLayoutEffect, useRef, useState } from 'react'
import { Info as InfoCircle } from '../Icon'

import { useLanguage } from '../../../../../index'
import { useTheme } from 'styled-components'

import {
  DisabledFeatureAlertContainer,
  Wrapper,
  CommentContainer,
  Comment,
  MoreInfo
} from './disabled-feature-alert-styles'

export const DisabledFeatureAlert = (props) => {
  const [, t] = useLanguage()
  const theme = useTheme()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(true)

  useLayoutEffect(() => {
    containerRef.current && setContainerWidth(containerRef.current.offsetWidth)
  }, [])

  return (
    <DisabledFeatureAlertContainer ref={containerRef} containerWidth={containerWidth} role='status'>
      <Wrapper>
        <InfoCircle color={theme.ordering?.semantic?.action?.content ?? theme.colors.primary} />
        <CommentContainer>
          <Comment>{t('PACKAGE_DOSE_NOT_INCLUDE_FUNCTIONS', 'Your package does not include this function')}</Comment>
          <MoreInfo href='https://www.ordering.co/pricing/' target='_blank' rel='noreferrer'>{t('GET_FEATURE', 'Get this feature')}</MoreInfo>
        </CommentContainer>
        {/* <XCircle style={{ cursor: 'pointer' }} color={theme.colors.primary} /> */}
      </Wrapper>
    </DisabledFeatureAlertContainer>
  )
}
