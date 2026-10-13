import styled, { css } from 'styled-components'

export const PageContainer = styled.div`
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 0px;

    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
    `
: css`
      margin-right: 20px;
    `}
  }
`

export const InputGroup = styled.div`
  display: flex;
  justify-content: space-between;

  .seo-container {
    width: ${({ isAddMode }) => isAddMode ? '100%' : '50%'};

    ${({ isAddMode }) => isAddMode && css`
      > div {
        width: 100%;
      }
    `}
  }
`

export const InputWrapper = styled.div`
  width: calc(50% - 10px);
  display: flex;
  flex-direction: column;
  margin-top: 20px;

  ${({ isFullWidth }) => isFullWidth && css`
    width: calc(100% - 10px);
  `}

  label {
    font-size: 14px;
    margin-bottom: 9px;
  }

  textarea {
    height: 115px;
  }
`

export const WrapperEditor = styled.div`
  margin-top: 40px;

  .note-editor {
    border-radius: 8px;
    border: 1px solid ${props => props.theme.colors.borderColor};

    .note-toolbar {
      border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    }

    .note-btn {
      &:hover,
      &:focus {
        background-color: ${props => props.theme.colors.secundaryDarkContrast};
        box-shadow: none;
      }
    }

    .note-dropdown-menu {
      a {
        color: #000;
      }

      h1 {
        font-size: 36px;
      }
    }
  }
`

export const ButtonGroupWrapper = styled.div`
  margin-top: 25px;
  display: flex;
  align-items: center;
  > button {
    height: 44px;
    &:last-child {
      ${props => props.theme?.rtl
? css`
        margin-right: 14px;
      `
: css`
        margin-left: 14px;
      `}
    }
  }
`

export const WrapperShortDescription = styled.div`
  label {
    color: ${props => props.theme.colors.headingColor};
    font-size: 14px;
    margin-bottom: 5px;
  }
  input,
  textarea {
    color: ${props => props.theme.colors.headingColor};
    width: 100%;
  }
`

export const WrapperImage = styled(WrapperShortDescription)`
  width: 50%;
  margin-top: 20px;
  padding-bottom: 0px;

  > div {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
`
export const SEOImage = styled.div`
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
  background-color: ${props => props.theme.colors.borderColor};
  ${({ isImage }) => isImage && css`
    opacity: 0.2;
  `}
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
  color: #ADB5BD;
  span {
    margin: 0;
  }

  svg {
    color: #CED4DA;
    ${({ small }) => small
? css`
      width: 25px;
      height: 25px;
    `
: css`
      width: 40px;
      height: 35px;
    `}
  }
`
export const CameraWrapper = styled.span`
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  border-radius: 8px;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  position: absolute;
  ${props => props.theme?.rtl
? css`
    left: 8px;
  `
: css`
    right: 8px;
  `}
  svg {
    font-size: 18px;
    color: ${props => props.theme.colors.secundaryContrast};
  }
`
