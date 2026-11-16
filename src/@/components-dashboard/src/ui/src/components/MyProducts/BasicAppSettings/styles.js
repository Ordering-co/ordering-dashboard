import styled from 'styled-components'

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
      font-size: var(--od-type-content-size);
      margin: 0;
    }
  }

  &.drop-container:hover .drop-title,
  &.drop-container.drag-active .drop-title {
    color: #222;
  }

  .drop-title {
    font-size: var(--od-type-section-title-size);
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
