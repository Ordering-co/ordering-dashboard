import styled from 'styled-components'

export const BANNER_MOBILE_BREAKPOINT = '768px'

/**
 * In normal document flow (not fixed/sticky, no z-index): it scrolls away with the page and
 * never sits above modals. Compact on mobile: a single line with the days remaining plus the
 * actions (the long sentence would be truncated before reaching the days).
 */
export const BannerBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 20px;
  background-color: ${props => props.theme.colors.backgroundInfo || props.theme.colors.lightPrimary};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  @media print {
    display: none;
  }

  @media (max-width: ${BANNER_MOBILE_BREAKPOINT}) {
    gap: 8px;
    padding: 4px 8px 4px 16px;
  }
`

export const BannerIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;

  @media (max-width: ${BANNER_MOBILE_BREAKPOINT}) {
    display: none;
  }
`

export const BannerText = styled.p`
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  color: ${props => props.theme.colors.headingColor};

  strong {
    font-weight: 600;
  }

  @media (max-width: ${BANNER_MOBILE_BREAKPOINT}) {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export const BannerTextFull = styled.span`
  @media (max-width: ${BANNER_MOBILE_BREAKPOINT}) {
    display: none;
  }
`

export const BannerTextShort = styled.span`
  display: none;
  font-weight: 600;

  @media (max-width: ${BANNER_MOBILE_BREAKPOINT}) {
    display: inline;
  }
`

export const BannerActions = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
`
