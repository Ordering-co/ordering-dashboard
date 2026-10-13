import React from 'react'
import styled from 'styled-components'

const Loading = styled.div`
  display: inline-block;
  width: ${(props) => props.width ?? '50px'};
  height: ${(props) => props.height ?? '50px'};
  border: 1px solid rgba(255,255,255,.3);
  border-radius: 50%;
  border-top-color: ${(props) => props.btc ?? '#fff'};
  animation: spin 1s ease-in-out infinite;
  -webkit-animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to { -webkit-transform: rotate(360deg); }
  }
  @-webkit-keyframes spin {
    to { -webkit-transform: rotate(360deg); }
  }
`

export const SimpleSpinner = (props) => {
  return (
    <Loading {...props} id='loading' />
  )
}
