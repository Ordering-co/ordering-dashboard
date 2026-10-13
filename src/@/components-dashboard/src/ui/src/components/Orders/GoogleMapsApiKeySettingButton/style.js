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
  background: ${props => props.theme.colors.warning100 || '#fff8e6'};
  border: 1px solid ${props => props.theme.colors.warning || '#f9b959'};
  font-size: 13px;
  line-height: 18px;

  span {
    color: ${props => props.theme.colors.headingColor};
  }

  a {
    font-weight: 600;
    color: ${props => props.theme.colors.primary};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`
export const ModalBody = styled.form`
  display: flex;
  flex-direction: column;

  h2 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 12px;
  }
  p {
    font-size: 14px;
    line-height: 24px;
    margin-bottom: 38px;

    &.error {
      color: ${props => props.theme.colors.danger};
      margin-top: 10px;
    }
  }
  button {
    height: 44px;
    width: fit-content;
    margin-top: 60px;
  }
`
