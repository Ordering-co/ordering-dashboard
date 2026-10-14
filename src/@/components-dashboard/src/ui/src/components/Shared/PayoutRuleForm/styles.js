import styled, { css } from 'styled-components'

export const RuleCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.theme.colors.backgroundPage};
`

export const RuleCardHeader = styled.div`
  padding-bottom: 12px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const RuleCardTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: ${props => props.theme.colors.headingColor};
`

export const RuleCardHelp = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const RuleNotice = styled.p`
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.headingColor};
  background: ${props => props.theme.colors.backgroundInfo};
`

export const RuleToggle = styled.div`
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary};
`

export const RuleToggleButton = styled.button`
  appearance: none;
  border: 0;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
  background: transparent;
  cursor: pointer;

  ${({ $active }) => $active && css`
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    background: ${props => props.theme.colors.backgroundPage};
    box-shadow: 0 0 0 1px ${props => props.theme.colors.borderColor};
  `}
`

export const RuleRows = styled.div`
  display: flex;
  flex-direction: column;
`

export const RuleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:first-child {
    padding-top: 0;
  }
`

export const RuleRowNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  color: ${props => props.theme.colors.secundaryContrast};
  background: ${props => props.theme.colors.secundary};
`

export const RuleRowText = styled.div`
  flex: 1 1 200px;
  min-width: 0;
`

export const RuleRowTitle = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: ${props => props.theme.colors.headingColor};
`

export const RuleRowHelp = styled.p`
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const RuleRowControl = styled.div`
  flex: 1 1 280px;
  max-width: 340px;
  min-width: 0;
`

export const RuleInputs = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  ${({ $readOnly }) => $readOnly && css`
    .select {
      pointer-events: none;
      opacity: 0.65;
    }
  `}

  input[type='text'] {
    flex: 0 0 96px;
    width: 96px;
    font-size: 14px;
    height: 44px;
    border: 1px solid ${({ $invalid, theme }) => $invalid ? theme.colors.danger : '#DEE2E6'};
    box-sizing: border-box;
    border-radius: 7.6px;
  }

  .select {
    flex: 1 1 150px;
    min-width: 0;
    border: none;
    line-height: 26px;
    padding: 0;

    > div:first-child {
      min-width: 0;
      padding: 8px 15px;
      border-radius: 7.6px;
      border: 1px solid ${props => props.theme.colors.borderColor};
      font-size: 14px;
    }

    .header {
      flex: 1;
      min-width: 0;
    }
  }
`

export const RuleUnit = styled.span`
  flex: 1 1 110px;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const RuleExample = styled.div`
  padding: 12px 14px;
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary};
`

export const RuleExampleTitle = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: ${props => props.theme.colors.headingColor};
`

export const RuleExampleLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};

  &:first-of-type {
    margin-top: 8px;
  }
`

export const RuleExampleTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid ${props => props.theme.colors.gray};
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};

  strong {
    font-size: 18px;
    font-weight: 600;
  }
`

export const RuleFieldError = styled.span`
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 16px;
  color: ${props => props.theme.colors.danger};
`

export const RuleOption = styled.div`
  font-size: 13px;
  line-height: 2;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const RuleActions = styled.div`
  display: flex;
  justify-content: flex-end;

  button {
    height: 44px;
    border-radius: 8px;
    font-size: 14px;
  }
`
