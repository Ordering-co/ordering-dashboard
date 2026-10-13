import React, { useLayoutEffect, useRef, useState } from 'react'
import { InfoCircle } from 'react-bootstrap-icons'

import { useApi, useLanguage } from '../../../../index'
import { useTheme } from 'styled-components'

import {
  DisabledFeatureAlertContainer,
  Wrapper,
  CommentContainer,
  Comment,
  MoreInfo
} from './styles'

export const DisabledFeatureAlert = (props) => {
  const [, t] = useLanguage()
  const theme = useTheme()
  const [, { configurations }] = useApi()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(true)

  useLayoutEffect(() => {
    containerRef.current && setContainerWidth(containerRef.current.offsetWidth)
  }, [])

  return (
    <DisabledFeatureAlertContainer ref={containerRef} containerWidth={containerWidth}>
      <Wrapper>
        <InfoCircle color={theme.colors.primary} />
        <CommentContainer>
          <Comment>{t('PACKAGE_DOSE_NOT_INCLUDE_FUNCTIONS', 'Your package does not include this function')}</Comment>
          <MoreInfo href={`https://www.${configurations?.subdomain}.com/ordering-sales`} target='_blank'>{t('GET_FEATURE', 'Get this feature')}</MoreInfo>
        </CommentContainer>
        {/* <XCircle style={{ cursor: 'pointer' }} color={theme.colors.primary} /> */}
      </Wrapper>
    </DisabledFeatureAlertContainer>
  )
}
