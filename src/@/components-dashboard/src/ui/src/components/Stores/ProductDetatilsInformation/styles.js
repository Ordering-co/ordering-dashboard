import styled, { css } from 'styled-components'

// batch O, row 11: at phone width (max-width: 767px) the controls of this legacy form reach the 44px minimum. The shared
// rules (fields.css, switch.css) open that size for `pointer: coarse` only, so a mouse or an emulated phone got 32px inputs and 25x14
// switches. The switch keeps its 25x14 drawing, centred in a 44x44 box (the same pattern as the coarse block of switch.css); nothing
// moves or hides, and above 767px nothing changes.
export const FormInput = styled.form`
  @media (max-width: 767px) {
    .od-switch {
      width: var(--od-x-target-coarse);
      height: var(--od-x-target-coarse);
    }

    .od-switch > .od-switch-thumb {
      width: 25px;
      height: 14px;
      top: 50%;
      left: 50%;
      right: auto;
      bottom: auto;
      transform: translate(-50%, -50%);
    }
  }
`

export const ProductImage = styled.div`
  width: 200px;
  height: 200px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: -webkit-grab;
  cursor: grab;
  filter: drop-shadow(0px 1px 4px rgba(0, 0, 0, 0.1));

  ${({ isEdit }) => !isEdit && css`
    pointer-event: none;
  `}

  img,
  div {
    width: 100%;
    border-radius: 8px;
    height: 100%;
    overflow: hidden;
  };

  img{
    object-fit: cover;
  }
`

export const SkeletonWrapper = styled.div`
  span{
    height: 100%;
    position: relative;
    top: -2.5px;
  }
`
export const UploadImageIconContainer = styled.div`
  position: absolute;
  top: 0px;
  background: rgba(0,0,0,0.2);
  ${({ small }) => small
? css`
    padding: 4px;
  `
: css`
    padding: 8px;
  `}
`

export const UploadImageIcon = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: #FFF;
  border: 1px dashed #fff;
  span {
    margin: 0;
    text-align: center;
    font-size: var(--od-type-control-size);
  }

  svg {   
    ${({ small }) => small
? css`
      width: 25px;
      height: 25px;
    `
: css`
      width: 45px;
      height: 45px;
    `}
  }
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 24px;
  justify-content: flex-end;

  label {
    color: ${props => props.theme.colors.headingColor};
    margin-bottom: 10px;
    font-size: var(--od-type-control-size);
  }

  input,
  textarea {
    color: ${props => props.theme.colors.headingColor};
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type=number] {
    -moz-appearance: textfield;
  }

  @media (max-width: 767px) {
    input,
    textarea {
      min-height: var(--od-x-target-coarse);
    }
  }
`

export const ActionsForm = styled.div`
  margin-top: 30px;
  /* redesign SP-F2 (D2): Save stays at the foot of the panel's scroll area */
  position: sticky;
  bottom: 0;
  z-index: var(--od-x-layer-raised);
  padding-block: var(--od-space-3);
  background-color: var(--od-bg);
  border-block-start: var(--od-x-hairline) solid var(--od-border);
  > button {
    height: 42px;
    @media (max-width: 767px) {
      min-height: var(--od-x-target-coarse);
    }
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
export const InventoryWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-top: 35px;

  > span {
    font-size: var(--od-type-control-size);
    font-weight: 600;

    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
    `
: css`
      margin-right: 20px;
    `}
  }
`
export const Wrapper = styled.div`
  display: flex;
  align-items: center;

  button {
    height: 44px;
    margin-top: 10px;
  }
  
  > span {
    font-size: var(--od-type-control-size);
    font-weight: 600;

    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
    `
: css`
      margin-right: 20px;
    `}
  }
`
export const RegularWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  
  label {
    margin-bottom: 0;
  }
  > span {
    font-size: var(--od-type-control-size);
    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
    `
: css`
      margin-right: 20px;
    `}
  }
`
export const FieldRow = styled.div`
  display: flex;
  justify-content: space-between;

  > div {
    width: calc(50% - 10px);
  }
`

export const ColorShapeWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
`

export const ColorWrapper = styled.div`
  margin-top: 24px;

  > label {
    font-weight: 400;
    font-size: var(--od-type-control-size);
    margin-bottom: 7px;
  }
`

export const ShapeWrapper = styled(ColorWrapper)`
  > label {
    font-weight: 400;
    font-size: var(--od-type-control-size);
  }
`

export const ShapeContentWrapper = styled.div`
  display: flex;
  align-items: center;
`

export const ShapeBoxWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;

  > div {
    width: 76px;
    height: 36px;
    border: 1px solid ${props => props.theme.colors.borderColor};
    margin-bottom: 15px;
    transition: all 0.3s linear;
  }

  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
    transition: all 0.3s linear;
  }

  ${({ shapeRect }) => shapeRect && css`
     > div {
       border-radius: 7.6px;
     }
    margin: 0px 20px;
  `}

  ${({ round }) => round && css`
     > div {
       border-radius: 50px;
     }
  `}

  ${({ active }) => active && css`
    > div {
      border: 1px solid ${props => props.theme.colors.primary};
    }

    svg {
      color: ${props => props.theme.colors.primary};
    }
  `}
`
