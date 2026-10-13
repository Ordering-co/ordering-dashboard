import styled, { css } from 'styled-components'

export const ModalBody = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Subtitle = styled.p`
  margin: 0 0 8px;
  font-size: 13px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const FieldLabel = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const FieldLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const ClearFieldButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    text-decoration: none;
  }
`

export const FieldHelper = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
  line-height: 1.4;
`

export const FieldError = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${props => props.theme.colors.danger || '#E63757'};
`

export const BusinessSummary = styled.div`
  padding: 12px 14px;
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary || '#F8F9FA'};
  border: 1px solid ${props => props.theme.colors.borderColor};

  p {
    margin: 0;
  }

  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${props => props.theme.colors.lightGray || '#909BA9'};
    margin-bottom: 4px;
  }

  .name {
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
  }
`

export const StructuredFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
`

export const StructuredHint = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const OrDivider = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};

  button {
    min-height: 40px;
  }
`

export const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);

  p {
    margin: 0;
    font-size: 13px;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const SuccessBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;

  p {
    margin: 0;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const StyledInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  height: 42px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }

  ${({ $mono }) => $mono && css`
    font-family: monospace;
    font-size: 13px;
  `}
`
