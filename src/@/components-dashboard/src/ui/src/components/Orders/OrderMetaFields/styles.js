import styled from 'styled-components'

export const WrapMetaFields = styled.div`
  box-sizing: border-box;
`
export const MetaTitle = styled.p`
  font-size: var(--od-type-section-title-size);
  font-weight: 600;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
`
export const MetaContainer = styled.div`
  display: flex;
  margin-bottom: 20px;
  min-width: 0;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};

  .meta_type {
    width: 25%;
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
  }
  .meta_key {
    width: 25%;
    padding-inline: 10px;
    box-sizing: border-box;
    min-width: 0;
  }

  .meta_value {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
    display: flex;
    column-gap: 10px;
    > div {
      width: 100%;
    }
    svg {
      font-size: 20px;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      cursor: pointer;
    }

    > button {
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (max-width: 576px) {
    flex-wrap: wrap;
    row-gap: 8px;

    .meta_type,
    .meta_key,
    .meta_value {
      width: 100%;
      flex-basis: 100%;
    }

    .meta_key {
      padding-inline: 0;
    }
  }

`
export const MetaAddContainer = styled(MetaContainer)`
  input {
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#c2c2c2'};
    border-radius: 5px;
    padding: 5px 10px;
    outline: none;
    font-size: var(--od-type-control-value-size);
    box-sizing: border-box;
    width: 100%;
    background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.backgroundPage};
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }

  button {
    svg {
      color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary} !important;
    }
  }
`
export const RoundBorder = styled.div`
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#c2c2c2'};
  border-radius: 5px;
  padding: 5px 10px;
  font-size: var(--od-type-content-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.backgroundPage};
  overflow-wrap: anywhere;
  word-break: break-word;
`
export const IdentifierBorder = styled(RoundBorder)`
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  direction: ltr;
  unicode-bidi: isolate;
`
export const NoMetaField = styled.p`
  font-size: var(--od-type-content-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
`
export const MetaAddForm = styled.form`
  button[type='submit'] {
    background: transparent;
    border: none;
    padding: 0px;
    min-width: 44px;
    min-height: 44px;

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }

  .select-input {
    width: 100%;

    svg {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? '#000'};
    }
  }
  
  .json_editor {
    width: 100%;
    height: 300px;
    > div {
      height: 100%;
    }
    .jsoneditor {
      border: 1px solid ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      > div.jsoneditor-menu {
        background-color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
        border-bottom: 1px solid ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      }
    }
    .jsoneditor-search {
      display: none;
    }
  }
`

export const SkeletonItem = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;

  span {
    border-radius: 5px;
  }
`

export const WrapperSpinnerLoader = styled.div`
  > div {
    position: absolute;
    top: 0px;
  }
`
