import styled from 'styled-components'

export const StandardField = styled.div`
  .select {
    width: 100%;
    box-sizing: border-box;
    font-size: 14px;
  }

  .select > div:first-child {
    width: 100%;
    min-height: 43px;
    justify-content: space-between;
  }

  .multi-select {
    width: 100%;
    box-sizing: border-box;
    font-size: 14px;
  }

  .multi-select > div:first-child {
    width: 100%;
    min-height: 43px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
`
