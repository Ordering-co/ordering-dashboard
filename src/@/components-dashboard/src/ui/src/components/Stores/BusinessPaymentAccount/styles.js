import styled, { css } from 'styled-components'

export const Container = styled.div`
  padding: 20px;
  flex: 1;
  overflow: initial;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`

export const HeaderTitleContainer = styled.div`
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
`

export const SectionCard = styled.div`
  margin-top: 20px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  background: ${props => props.theme.colors?.backgroundPage || '#fff'};
`

export const FormField = styled.div`
  margin-top: 20px;
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors?.headingColor || '#344054'};

    span {
      color: #DC3545;
      margin-left: 2px;
    }
  }

  input, select {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s ease;
    background: ${props => props.theme.colors?.backgroundPage || '#fff'};

    &:focus {
      outline: none;
      border-color: ${props => props.theme.colors?.primary || '#E63757'};
    }

    &::placeholder {
      color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
    }

    &:disabled {
      background: ${props => props.theme.colors?.secundary || '#F8F9FA'};
      cursor: not-allowed;
    }
  }
`

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 15px;
  padding-top: 10px;
`

export const AccountDetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};

  &:last-child {
    border-bottom: none;
  }
`

export const AccountDetailLabel = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors?.headingColor || '#344054'};
`

export const AccountDetailValue = styled.span`
  font-size: 14px;
  color: ${props => props.theme.colors?.textColor || '#344054'};
`

export const EmptyWrapper = styled.div`
  padding: 40px 20px 20px;
  text-align: center;
  color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
  font-size: 14px;
`

export const MethodBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  background-color: #E7F1FF;
  color: #0D6EFD;
`

export const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;

  ${({ enabled }) => enabled
    ? css`
      background-color: #D1F2EB;
      color: #198754;
    `
    : css`
      background-color: #FFEBE9;
      color: #DC3545;
    `
  }
`

export const ReadOnlyNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 15px;
  padding: 10px 12px;
  background: #FFF3CD;
  border-radius: 6px;
  font-size: 13px;
  color: #856404;
`

export const EnabledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  p {
    margin: 0;
    font-size: 14px;
  }
`

export const SelectWrapper = styled.div`
  > div {
    min-width: 300px;
    width: 100%;
  }
`

export const OptionCardsWrapper = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 10px;

  @media (max-width: 576px) {
    flex-direction: column;
  }
`

export const OptionCard = styled.div`
  flex: 1;
  padding: 20px;
  border: 2px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;

  &:hover {
    border-color: ${props => props.theme.colors?.primary || '#E63757'};
    background: ${props => props.theme.colors?.primaryContrast || '#FFF2F4'};
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  p {
    font-size: 13px;
    margin: 0;
    color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
  }
`
