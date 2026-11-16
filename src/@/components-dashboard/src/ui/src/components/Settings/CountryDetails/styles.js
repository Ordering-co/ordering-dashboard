import styled, { css } from 'styled-components'

export const Container = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 35px;

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 0;

    /* focus lands here when the panel opens (tabIndex -1): the ring tells where */
    &:focus-visible {
      outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color);
      outline-offset: var(--od-focus-ring-offset);
    }
    ${props => props.theme?.rtl
? css`
      margin-left: 15px;
    `
: css`
      margin-right: 15px;
    `}
  }
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 25px;

  label {
    font-size: var(--od-type-control-size);
  }

  div {
    font-size: var(--od-type-control-value-size);
  }
`

export const FormContainer = styled.form`
  button {
    height: 42px;
    margin-top: 20px;
  }
`
