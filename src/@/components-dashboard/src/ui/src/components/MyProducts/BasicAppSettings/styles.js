import styled, { css } from 'styled-components'

export const FormWrapper = styled.div`
  > button {
    height: 44px;
    margin-top: 20px;
  }

  .loader::after {
    content: "";
    position: absolute;
    width: 20px;
    height: 20px;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto 10%;
    border: 4px solid ${props => props.theme.colors.primary};
    border-top-color: ${props => props.theme.colors.backgroundInfo};
    border-radius: 50%;
    animation: spinner 1s ease infinite;
  }

  @keyframes spinner {
    from {
      transform: rotate(0turn);
    }

    to {
      transform: rotate(1turn);
    }
  }
`

export const InputFormWrapper = styled.div`
  padding: 25px 38px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
  border-radius: 7.6px;
  margin-bottom: 30px;
  h4 {
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0px;
  }

  #light-text {
    color: ${props => props.theme.colors.lightGray};
    font-size: 12px;
  }
`

export const InnerBlock = styled.div`
  width: 100%;
`

export const FormGroup = styled.div`
  margin-top: 27px;
  ${({ isCheckbox }) => isCheckbox && css`
    display: flex;
    align-items: center;
    label {
      order: 2;
      margin-bottom: 0 !important;
      margin-left: 10px;
    }
    #checkbox {
      order: 1;
    }
  `}
  label {
    display: block;
    margin-bottom: 12px;
    font-weight: 400;
    font-size: 14px;
    line-height: 24px;
  }
  > input, textarea {
    width: 100%;
  }
  .custom-domain {
    width: 330px;
  }
  button {
    height: 44px;
  }

  #current-file {
    font-style: italic;
    word-wrap: break-word;
  }
`

export const FormGroupGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

export const TemporalDomail = styled.div`
  font-weight: 400;
  font-size: 14px;
  line-height: 24px;
  > a {
    color: ${props => props.theme.colors.primary};
  }

  ${({ isDisabled }) => isDisabled && css`
    pointer-events: none;
    color: ${props => props.theme.colors.disabled};
    > a {
      color: ${props => props.theme.colors.disabled};
    }
  `}

  ${({ marginBottom }) => marginBottom && css`
    margin-bottom: 10px;
  `}
`

export const ImageFormGroup = styled.div`
  margin-top: 30px;
`

export const LogoImage = styled.div`
  max-width: 450px;
  width: 100%;
  height: 100px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: -webkit-grab;
  cursor: grab;
  filter: drop-shadow(0px 1px 4px rgba(0, 0, 0, 0.1));

  img,
  div {
    width: 100%;
    border-radius: 8px;
    height: 100%;
    overflow: hidden;
  };

  img{
    object-fit: contain;
  }
`

export const BackgroundImage = styled(LogoImage)`
  height: 213px;
  max-width: 320px;

  @media (min-width: 768px) {
    height: 427px;
    max-width: 640px;
  }
`

export const UploadImageIconContainer = styled.div`
  position: absolute;
  top: 0px;
  background: ${props => props.theme.colors.secundaryDarkContrast};
  ${({ bgimage }) => bgimage && css`
    background: transparent;
    svg, span {
      color: ${props => props.theme.colors.white};
    }
    border: 1px dashed ${props => props.theme.colors.secundaryDarkContrast};
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
  color: ${props => props.theme.colors.disabled};
  span {
    margin-top: 14px;
    font-size: 14px;
  }

  svg {
    width: 52px;
    height: 45px;
  }
`

export const ImgInfoWrapper = styled.div`
  margin-top: 15px;
  h4 {
    font-size: 14px;
    line-height: 24px;
    font-weight: 400;
    margin: 0px;
  }
  p {
    font-size: 12px;
    line-height: 18px;
    margin-top: 2px;
    margin-bottom: 0px;
    color: ${props => props.theme.colors.secundaryContrast};
  }
`

export const CheckBoxWrapper = styled.div`
  margin-top: 30px;
  display: flex;
  align-items: center;
  cursor: pointer;
  width: fit-content;
  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
    &.active {
      color: ${props => props.theme.colors.primary};
    }
    margin-right: 20px;
    ${props => props.theme.rtl && css`
      margin-left: 20px;
      margin-right: 0px;
    `}
  }
  span {
    font-weight: 400;
    font-size: 14px;
    line-height: 24px;
    user-select: none;
  }
`

export const ColorPickerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  > div {
    > p {
      font-weight: 400;
      font-size: 14px;
      line-height: 24px;
      margin-top: 0px;
      margin-bottom: 9px;
    }
  }

  @media (min-width: 769px) {
    flex-direction: row;
  }
`

export const ContentWrapper = styled.div`
  padding-top: 25px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  > div {
    margin-top: 25px;
    display: flex;
    flex-direction: column;
    align-items: center;
    > p {
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
      margin-top: 0px;
      margin-bottom: 20px;
    }
    button {
      width: 200px;
      height: 44px;
    }
  }
  @media (min-width: 769px) {
    flex-direction: row;
  }
`

export const RadioItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 0;
  cursor: pointer;

  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
    &.active {
      color: ${props => props.theme.colors.primary};
    }
    margin-right: 20px;
    ${props => props.theme.rtl && css`
      margin-left: 20px;
      margin-right: 0px;
    `}
  }
  span {
    font-weight: 400;
    font-size: 14px;
    line-height: 24px;
  }
`

export const CustomeDomainDesc = styled.p`
  margin-top: 5px;
  margin-bottom: 0px;
  font-weight: 400;
  font-size: 12px;
`

export const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  ${({ isMargin }) => isMargin && css`
    margin-bottom: 20px;
  `}
`

export const CustomDomainInfo = styled.div`
  position: relative;

  > button {
    height: 21px;
    svg {
      width: 13px;
      height: 13px;
      color: ${props => props.theme.colors.headingColor};
    }
  }
  &:hover > div {
    visibility: visible;
    opacity: 1;
  }
`

export const CustomDomainInfoContent = styled.div`
  position: absolute;
  top: 100%;
  z-index: 999;
  background: ${props => props.theme.colors.backgroundInfo};
  border: 1px solid ${props => props.theme.colors.primary};
  box-sizing: border-box;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
  border-radius: 7.6px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 18px;
  min-width: 150px;
  transition: all 0.3s linear;
  visibility: hidden;
  opacity: 0;
  right: -100px;
  ${props => props.theme.rtl && css`
    left: 0px;s
    right: initial;
  `}

  span {
    display: block;
  }

  a {
    color: ${props => props.theme.colors.primary};
    padding-left: 5px;
  }

  @media (min-width: 576px) {
    min-width: 350px;
    padding: 10px 16px;
    left: 0px;
    ${props => props.theme.rtl && css`
      right: 0px;
      left: initial;
    `}
  }
`
export const Option = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 7.6px;
  img {
    min-height: 38px;
    min-width: 38px;
    height: 38px;
    width: 38px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
    `
: css`
      margin-right: 8px;
    `}
  }
  > span {
    max-width: 200px;
    font-size: 14px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    > span {
      max-width: 560px;
    }
  }
`
export const SelectWrapper = styled.div`
  margin-bottom: 20px;

  .select {
    width: 100%;
    background: ${props => props.theme.colors.secundary};
    border: none;
    font-size: 14px;

    > div:first-child {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
`

export const StatusText = styled.div`
  background-color: ${props => props.color}33;
  padding: 10px;
  button {
    margin: 0 5px;
  }
  span {
    font-size: 12px;
  }
  svg {
    font-weight: bold;
    margin-left: 5px;
    font-size: 18px;
  }
  .error-code {
    font-size: 14px;
    margin-top: 15px;
  }
`

export const WebsiteThemeBlock = styled.div`
  display: flex;
  flex-direction: column-reverse;
  margin-top: 20px;

  .select {
    .list {
      left: 0;
      right: initial;
    }
  }

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`

export const WebsitePriviewImageWrapper = styled.div`
  box-shadow: 0px 1px 4px rgba(0,0,0,0.1);
  img {
    height: auto;
    width: 100%;
    margin-bottom: 15px;
  }
  @media (min-width: 768px) {
    img {
      height: 200px;
      margin-bottom: 0;
    }
  }
`

export const BuildContainer = styled.div`
  display: grid;
  grid-template-rows: repeat(2, 1fr);
  grid-template-columns: repeat(2, 1fr);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

export const BuildBlock = styled.div`
  margin: 10px 0;
  text-align: left;

  span {
    font-size: 12px;
  }
`

export const BuildBoldText = styled.p`
  font-weight: bold;
  margin: 0;
  line-height: 30px;
  font-size: 14px;
`

export const UpdatedAppContainer = styled.div`
  display: flex;
  margin-top: 20px;
`

export const UpdatedAppBar = styled.div`
  background-color: ${props => props.color};
  width: 8px;
`

export const UpdatedAppContent = styled.div`
  padding: 20px 10px 20px 20px;
  width: 100%;
  text-align: left;
  background-color: ${props => props.theme.colors.secundary};

  p {
    font-size: 16px;
    margin: 5px 0;

    &:nth-child(1) {
      font-weight: bold;
    }

    &:nth-child(2) {
      font-size: 14px;
    }
  }
`

export const QRContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: flex-start;
  justify-content: flex-start;
  margin: 40px 0 20px;

  #typeText {
    text-align: center;
    font-weight: bold;
  }

  .invisible-margin {
    height: 24px;
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

export const ButtonCustom = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-evenly;
  margin: 15px 0 30px;
  padding: 10px;
  background-color: ${props => props.color ?? props.theme.colors.backgroundInfo};
  border: 1px solid ${props => props.color ?? props.theme.colors.backgroundInfo};
  border-radius: 8px;
  cursor: pointer;
  position: relative;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  p, svg {
    margin: 0;
    color: ${props => props.textColor ?? props.theme.colors.primary};
    font-size: 14px;
  }

  p > span {
    margin-left: 25px;
  }
`

export const AppBuildButtons = styled.div`
  display: flex;
  gap: 10px;
  margin: 30px 0 20px;

  button {
    height: 44px;
  }

  @media (max-width: 768px) {
    flex-direction: column;

    button {
      width: fit-content;
    }
  }
`

export const WrapperCredentialsInputs = styled.div`
  padding: 40px 0;
`

export const InputFileContainer = styled.label`
  &.drop-container {
    position: relative;
    display: flex;
    gap: 10px;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 20px;
    border-radius: 10px;
    border: 2px dashed ${props => props.isError ? props.theme.colors.danger : props.theme.colors.gray};
    color: #444;
    cursor: pointer;
    transition: background .2s ease-in-out, border .2s ease-in-out;

    &:hover,
    &:active {
      background-color: ${props => props.isError ? `${props.theme.colors.danger}1A` : `${props.theme.colors.gray}1A`};
    }
  }

  .file-details {
    p {
      font-size: 14px;
      margin: 0;
    }
  }

  &.drop-container:hover .drop-title,
  &.drop-container.drag-active .drop-title {
    color: #222;
  }

  .drop-title {
    font-size: 18px;
    font-weight: bold;
    text-align: center;
    transition: color .2s ease-in-out;
  }
`

export const InputFileStyle = styled.input`
  &[type=file] {
    width: 350px;
    max-width: 100%;
    padding: 5px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #DEE2E6;
  }

  &[type=file]::file-selector-button {
    margin-right: 20px;
    border: none;
    background: ${props => props.theme.colors.primary};
    padding: 10px 20px;
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: background .2s ease-in-out;
  }
`

export const ThemeContainerList = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 40px 0;

  p.color {
    text-transform: capitalize;
  }

  @media (max-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    font-size: 14px;
  }
  @media (max-width: 420px) {
    grid-template-columns: repeat(1, 1fr);
  }
`

export const ImageContainerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0;
`

export const ImageWrapSection = styled.div`
  display: flex;
  flex-direction: column;
`

export const ImageSectionTitle = styled.h4`
  margin-bottom: 10px;
`

export const ImageSection = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
`

export const WrapperCheckbox = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
`

export const LogsBtn = styled.a`
  margin-left: 15px;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
`
