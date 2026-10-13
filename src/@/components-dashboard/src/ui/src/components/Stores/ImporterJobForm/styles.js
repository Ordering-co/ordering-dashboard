import styled, { css, keyframes } from 'styled-components'

export const FormWrapper = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 35px 20px;
  position: relative;
  overflow-x: hidden;
`

export const Header = styled.div`
  display: inline-flex;
  color: ${props => props.theme.colors.headingColor};
  font-size: 20px;
  margin: 0px;
  font-weight: 700;
  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
`

export const FormInput = styled.form`
  margin-top: 20px;
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  position: relative;

  label {
    color: ${props => props.theme.colors.headingColor};
    margin-bottom: 10px;
    font-size: 14px;
  }

  input,
  textarea {
    color: ${props => props.theme.colors.headingColor};
  }

  button {
    position: absolute;
    bottom: 0;
    right: 0;
    font-size: 14px;
    line-height: 21px;
    padding: 10px 15px;
  }

  .select {
    background-color: ${props => props.theme.colors.secundary};
    border: none;

    div {
      font-size: 14px;
      color: ${props => props.theme.colors.secundaryContrast};
    }

     >div:first-child {
      padding: 5px 15px;
     }
  }
`

export const ActionsForm = styled.div`
  margin-top: 100px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  > button {
    height: 42px;
    &:first-child {
      ${props => props.theme?.rtl
? css`
        margin-left: 10px;
      `
: css`
        margin-right: 10px;
      `}
    }
  }
`

export const UploadCsvInputContainer = styled.div`
  position: absolute;
  top: 0px;
  width: 100%;
  input {
    width: 100%;
    &:read-only{
      cursor: pointer;
      color: #748194;
    }
  }
`

export const AdvancedOptionsButton = styled.span`
  cursor: pointer;
  color: ${props => props.theme.colors.primary};
  font-size: 14px;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`

export const JobStatusWrapper = styled.div`
  margin-top: 30px;
  padding: 16px;
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundInfo || '#F5F9FF'};
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const JobStatusHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
  color: ${props => {
    if (props.$kind === 'success') return props.theme.colors.success
    if (props.$kind === 'failed') return props.theme.colors.danger
    return props.theme.colors.info
  }};

  svg {
    ${props => props.$spinning
? css`
      animation: ${spin} 1s linear infinite;
    `
: props.$kind === 'pending' && css`
      animation: ${pulse} 1.6s ease-in-out infinite;
    `}
  }
`

export const JobStatusDetail = styled.div`
  font-size: 13px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};
  word-break: break-word;
`

export const JobStatusActions = styled.div`
  margin-top: 4px;
  display: flex;
  justify-content: flex-end;
`
