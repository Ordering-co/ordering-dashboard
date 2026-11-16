import styled, { css } from 'styled-components'

export const Container = styled.div`
  display: flex;
  align-items: center;
  ${props => props.theme?.rtl
? css`
    margin-left: 8px;
  `
    : css`
    margin-right: 8px;
  `}
`

export const WarningBanner = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 360px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--od-warning-soft); /* redesign W1-2 (T1-2-4) */
  border: 1px solid var(--od-warning-signal);
  font-size: var(--od-type-content-size);
  line-height: 18px;

  span {
    color: var(--od-text);
  }

  a {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-block-size: var(--od-x-target-fine);
    font-weight: 600;
    color: var(--od-action-content);
    text-decoration: none;

    @media (pointer: coarse) {
      min-block-size: var(--od-x-control-height);

      &::after {
        content: '';
        position: absolute;
        inset: var(--od-x-target-inset);
      }
    }

    &:hover {
      text-decoration: underline;
    }
  }
`
