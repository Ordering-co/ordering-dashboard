import styled, { css } from 'styled-components'

export const AutoassignContainer = styled.div`
  width: 100%;
  padding: 20px;

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 30px;
  }
`

export const AutoassignItem = styled.div`
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  font-family: inherit;
  padding: 0;
  margin-inline-end: 20px;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  span {
    white-space: nowrap;
    font-size: var(--od-type-secondary-size);
    margin-top: 10px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  }
  ${({ active }) => active && css`
    span {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    }
    > div {
      background-color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    }
  `}
`

export const IconImage = styled.div`
  -webkit-mask: url(${({ url }) => url}) no-repeat center;
  mask: url(${({ url }) => url}) no-repeat center;
  width: 95px;
  height: 95px;
  background-color: ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
`

export const CustomItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0px 10px;

  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    }

    span {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    }
  `}
`

export const ForcedAssignSettingWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 30px;

  label {
    margin-bottom: 0px;
    font-size: var(--od-type-control-size);
    margin-inline-start: 15px;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
`

export const MaxDistanceCustomerContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;

  > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-bottom: 12px;

    label {
      margin-bottom: 0px;
      font-size: var(--od-type-control-size);
    }

    p {
      margin-bottom: 0px;
      font-size: var(--od-type-secondary-size);
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    }
  }
`

export const RowGroupContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  > div {
    width: calc(50% - 10px);
  }

  @media (max-width: 620px) {
    flex-direction: column;

    > div {
      width: 100%;
    }
  }
`

export const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;

  ${({ isPadding }) => isPadding && css`
    padding-bottom: 20px;
  `}

  label {
    font-size: var(--od-type-control-size);
    margin-bottom: 0px;
    margin-inline-start: 15px;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
`

export const FieldContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 25px;
  border: none;
  padding: 0;
  min-width: 0;

  label,
  legend {
    font-size: var(--od-type-control-size);
    margin-bottom: 12px;
    padding: 0;
    float: none;
    width: auto;
  }

  ${({ isPink }) => isPink && css`
    input {
      &:focus {
        border-color: #ff0095;
      }
    }
  `}
  ${({ isGreen }) => isGreen && css`
    input {
      &:focus {
        border-color: #0b720b;
      }
    }
  `}
  ${({ isBlue }) => isBlue && css`
    input {
      &:focus {
        border-color: ${props => props.theme.colors.primary};
      }
    }
  `}
`

export const InputsGroup = styled.div`
  display: flex;
  align-items: center;
  input {
    width: 75px;
  }

  strong {
    margin: 0 20px;
  }
`

export const AreaWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 70%;
  min-height: 160px;
  margin: auto 0;
`

export const LargeArea = styled.div`
  width: 100%;
  height: 100%;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: 50%;
  position: absolute;

  ${({ active }) => active && css`
    border-color: #ff0095;
  `}
`

export const MediumArea = styled.div`
  width: 70%;
  height: 70%;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: 50%;
  position: absolute;
  ${({ active }) => active && css`
    border-color: #0b720b;
  `}
`

// The three concentric radius indicators are one categorical set that maps to
// the three radius fields below them. They keep their reviewed hues instead of
// splitting across the semantic palette; changing one reopens the whole set.
export const SmallArea = styled.div`
  width: 40%;
  height: 40%;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: 50%;
  position: absolute;
  ${({ active }) => active && css`
    border-color: ${props => props.theme.colors.primary};
  `}
`
export const CheckboxContainer = styled.div`
  display: flex;
  flex-direction: column;

  > div {
    &:not(:first-child) {
      margin-top: 5px;
    }
  }
`
