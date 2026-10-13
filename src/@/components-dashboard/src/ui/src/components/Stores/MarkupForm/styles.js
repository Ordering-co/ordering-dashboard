import styled, { css } from 'styled-components'

export const DetailsContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
`

export const DetailsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;

  ${props => props.theme?.rtl
    ? css`
    margin-left: 35px;
  `
    : css`
    margin-right: 35px;
  `}

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 90%;
    }

    > label {
      margin: 0;
    }
  }
`

export const RightHeader = styled.div`
  display: flex;
  align-items: center;
`

export const FormSection = styled.div`
  margin-bottom: 16px;
`

export const SectionTitle = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.colors.grayColor};
  text-transform: uppercase;
`

export const FieldsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const FieldsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  > div {
    flex: 1;
    min-width: 240px;
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 14px;
  }

  .select, .multi-select {
    background: ${props => props.theme.colors.secundary};
    border: none;

    > div:first-child {
      padding-top: 5px;
      padding-bottom: 5px;
    }
  }

  .select {
    ${props => props.maxWidthForFirstElement
    ? css`
      > div {
        max-height: 300px;
      }
    `
    : css`
    div {
        max-height: 300px;
      }
    `}
  }
`

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};
`

export const FormActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
`
