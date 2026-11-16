import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const Contatiner = styled.div`
  display: flex;
  align-items: center;

  > button {
    height: 41px;
    ${({ isDegraded }) => isDegraded && css`
      border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? '#E63757'} !important;
    `}
  }

  @media (min-width: 576px) {
    margin-inline-end: 10px;
  }
`

export const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  > span:first-child {
    margin-inline-end: 6px;
  }
`

export const WebsocketStatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;

  ${({ status }) => status === 0 && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? '#FF9922'};
  `}
  ${({ status }) => status === 1 && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.success?.signal ?? '#00D27A'};
  `}
  ${({ status }) => status === 2 && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? '#E63757'};
  `}

  ${({ isDegraded, status }) => isDegraded && status === 2 && css`
    animation: ws-dot-pulse 1.5s ease-in-out infinite;

    @keyframes ws-dot-pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(230, 55, 87, 0.6);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(230, 55, 87, 0);
      }
    }
  `}
`
export const DateWrapper = styled.div`
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  direction: ltr;
  unicode-bidi: isolate;
  text-align: center;
`
export const InfoWrapper = styled.div`
  position: relative;
  margin-inline-end: 4px;

  > button {
    height: 25px;
    svg {
      width: 16px;
      height: 16px;
    }
  }
  &:hover > div {
    visibility: visible;
    opacity: 1;
  }
`

export const InfoContent = styled.div`
  position: absolute;
  ${props => props.position !== 'RB' && css`
    top: calc(100% - 50px);
  `}
  z-index: calc(var(--od-x-layer-chrome) - 1);
  background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.backgroundInfo};
  border: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
  box-sizing: border-box;
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};
  padding: 8px 12px;
  font-size: var(--od-type-secondary-size);
  line-height: 18px;
  min-width: 150px;
  transition: all 0.3s linear;
  visibility: hidden;
  opacity: 0;
  /* display: none; */
  left: 0px;
  ${props => props.theme.rtl && css`
    left: 0px;
    right: initial;
  `}

  a {
    color: ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
    transition: all 0.3s linear;
    cursor: pointer;
    margin-inline-start: 5px;
    &:hover {
      text-decoration: underline;
    }
  }

  @media (min-width: 798px) {
    min-width: 350px;
    padding: 12px 15px;
    right: 25px;
    ${props => props.position !== 'RB' && css`
      left: auto;
    `}
    ${props => props.theme.rtl && css`
      right: 0px;
      left: initial;
    `}
  }

  @media (min-width: 993px) {
    min-width: 535px;
  }
`
export const DetailContainer = styled.div`
  h2 {
    font-weight: 700;
    font-size: var(--od-type-section-title-size);
    line-height: 30px;
  }

  > span {
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    font-weight: 100;
    position: absolute;

    @media (min-width: 769px) {
      top: calc(10% + 8px);
    }

  }

  > p {
    margin-top: 25px;
    font-size: var(--od-type-content-size);
  }
`
export const StatusItemWrapper = styled.div`
  padding: 8px 12px;
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
  margin-bottom: 4px;
  transition: background-color 0.2s ease;

  ${({ isActive }) => isActive && css`
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary ?? '#f0f4ff'};
    border-inline-start: 3px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};

    > div > span:last-child {
      font-weight: 700;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    }

    p {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    }
  `}

  > div {
    display: flex;
    align-items: center;

    > span:first-child {
      margin-inline-end: 16px;
    }
  }
  p {
    font-weight: 400;
    font-size: var(--od-type-secondary-size);
    line-height: 18px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    margin-inline-start: 24px;
  }
`

export const TroubleshootingSection = styled.div`
  margin-top: 20px;
  padding: 16px;
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
  background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.soft ?? props.theme.colors.warning100 ?? '#fff8e6'};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? props.theme.colors.warning ?? '#ffc107'};

  h3 {
    font-size: var(--od-type-content-size);
    font-weight: 700;
    margin: 0 0 8px;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }

  p {
    font-size: var(--od-type-secondary-size);
    line-height: 18px;
    margin: 0 0 8px;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }

  button {
    background: none;
    border: none;
    padding: 0;
    font-size: var(--od-type-control-size);
    font-weight: 600;
    color: ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
    cursor: pointer;
    text-decoration: underline;

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
      outline-offset: 2px;
    }
  }
`
export const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 40px;

  > button {
    border-radius: ${props => props.theme?.ordering?.radius?.control ?? '8px'};
    height: 40px;
    &:last-child {
      margin: 0 10px;
    }
  }
`
