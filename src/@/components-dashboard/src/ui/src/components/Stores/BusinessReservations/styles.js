import styled, { css } from 'styled-components'

export const Container = styled.div`
  padding: 20px;
  height: 100%;

  h1 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 5px;
  }

  > button {
    position: sticky;
    top: 100%;
    height: 44px;
    margin-bottom: 20px;
  }
`

export const BusinessOrderingChannelsContainer = styled.div`
  box-sizing: border-box;
  ${({ enabled }) => enabled && css`
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  `}
`

export const Title = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors?.headingColor};
  margin-bottom: 25px;
`

export const BusinessCustomSlugContainer = styled.div`
  button {
    border-radius: 7.6px;
    height: 44px;
  }
`

export const FormControl = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  input[type=text] {
    border: 1px solid #DEE2E6;
    box-sizing: border-box;
    border-radius: 7.6px;
    height: 44px;
    width: 40%;
  }
`

export const Label = styled.p`
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: ${props => props.theme?.colors.headingColor};
  width: 50%;
`

export const Tabs = styled.div`
  display: flex;
  width: 100%;
  margin-bottom: 25px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const Tab = styled.div`
  user-select: none;
  padding: 10px 0px;
  cursor: pointer;
  color: ${props => props.theme.colors?.headingColor};
  font-size: 14px;
  white-space: nowrap;
  color: ${props => props.theme.colors.lightGray};
  ${props => props.theme?.rtl
    ? css`
    margin-left: 30px;
  `
    : css`
    margin-right: 30px;
  `}

  ${({ active }) => active && css`
    border-bottom: 1px solid;
    font-weight: 500;
    color: ${props => props.theme.colors.headingColor};
  `}
`

export const SwitchWrapper = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ disableBorder }) => disableBorder ? '20px 0px 20px' : '40px 0px 20px'};
  ${({ disableBorder }) => !disableBorder && css`
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  `}
  padding-bottom: 25px;
  p {
    margin-top: 0;
    margin-bottom: 0;
    font-size: 14px;
    ${props => props.theme?.rtl
    ? css`
      margin-left: 40px;
    `
    : css`
      margin-right: 40px;
    `}
  }
`
