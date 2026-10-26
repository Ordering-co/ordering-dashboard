import styled, { keyframes } from 'styled-components'

const spin = keyframes`
  to { transform: rotate(360deg); }
`

export const Box = styled.div`
  position: relative;
  width: 100%;
  transition: height 150ms ease;
`

export const Loading = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${({ theme }) => theme.colors.secundaryContrast};
  font-size: 14px;
`

export const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.colors.lightPrimary};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`

export const Frame = styled.iframe`
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  opacity: ${({ $loaded }) => $loaded ? 1 : 0};
  transition: opacity 150ms ease;
`
