import styled from 'styled-components'

export const DetailsContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`

export const DetailsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

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

export const FormSection = styled.div`
  flex: 1;
  margin-bottom: 20px;
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
    min-width: 200px;
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  .select, .multi-select {
    background: ${props => props.theme.colors?.secundary || '#F8F9FA'};
    border: none;

    > div:first-child {
      padding-top: 5px;
      padding-bottom: 5px;
    }
  }
`

export const FormActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 20px;
  justify-content: flex-end;
`

export const RecurrentSwitchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  margin-bottom: 15px;

  span {
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }
`
