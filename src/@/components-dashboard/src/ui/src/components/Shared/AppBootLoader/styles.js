import styled, { css, keyframes } from 'styled-components'

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`

export const Shell = styled.div`
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: ${props => props.theme.colors.backgroundPage || '#F8F9FA'};
  color: ${props => props.theme.colors.headingColor};
`

export const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

export const Sidebar = styled.aside`
  display: none;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 240px;
  padding: 20px 16px;
  border-right: 1px solid ${props => props.theme.colors.borderColor};
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};

  ${props => props.theme?.rtl && css`
    border-right: 0;
    border-left: 1px solid ${props.theme.colors.borderColor};
  `}

  @media (min-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 100vh;
    min-height: 100dvh;
  }

  @media (max-width: 767px) {
    display: none;
  }
`

export const SidebarLogo = styled.div`
  width: 112px;
  height: 28px;
`

export const SidebarNav = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SidebarNavRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
`

export const SidebarFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
`

export const SidebarFooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
`

export const Main = styled.main`
  flex: 1;
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 20px 25px;
  }

  @media (min-width: 800px) {
    padding-right: 80px;
  }
`

export const BreadcrumbRow = styled.div`
  width: 88px;
  height: 22px;
  margin: 10px 0 36px;
`

export const WelcomeBlock = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 180px;
  margin-bottom: 28px;
  padding: 20px 24px;
  box-sizing: border-box;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  box-shadow: 0 1px 4px ${props => props.theme.colors.borderColor};

  @media (min-width: 768px) {
    padding: 20px 30px;
    min-height: 200px;
  }
`

export const WelcomeCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-width: 0;
`

export const WelcomeTitle = styled.div`
  width: min(360px, 80%);
  height: 36px;
`

export const WelcomeLine = styled.div`
  width: min(420px, 90%);
  height: 16px;
`

export const WelcomeActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
`

export const WelcomeIllustration = styled.div`
  display: none;
  width: min(280px, 36%);
  height: 148px;
  flex-shrink: 0;

  @media (min-width: 768px) {
    display: block;
  }
`

export const MetricsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`

export const MetricCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 108px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 7.6px;
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  box-shadow: 0 1px 4px ${props => props.theme.colors.borderColor};
  box-sizing: border-box;
`

export const MetricCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
`

export const MetricLabel = styled.div`
  width: 110px;
  height: 14px;
`

export const MetricValue = styled.div`
  width: 88px;
  height: 28px;
`

export const MetricIcon = styled.div`
  width: 63px;
  height: 63px;
  border-radius: 7.6px;
  flex-shrink: 0;
`

export const ReportsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 28px;

  @media (min-width: 800px) {
    flex-direction: row;
    align-items: stretch;
  }
`

export const ChartPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 360px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 7.6px;
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  box-shadow: 0 1px 4px ${props => props.theme.colors.borderColor};
  box-sizing: border-box;

  @media (min-width: 800px) {
    width: 49%;
  }
`

export const ChartHeader = styled.div`
  width: 160px;
  height: 14px;
  margin-bottom: 12px;
`

export const ChartBody = styled.div`
  width: 100%;
  flex: 1;
  min-height: 300px;
  height: 300px;
  border-radius: 6px;
`

export const TilesColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 800px) {
    width: 46%;

    > * {
      flex: 1;
    }
  }
`

export const LowerRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 28px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: stretch;
  }
`

export const ServiceCard = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 150px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  box-shadow: 0 1px 4px ${props => props.theme.colors.borderColor};
  box-sizing: border-box;
`

export const ServiceCardBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
`

export const ServiceIcon = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 10px;
  flex-shrink: 0;
`

export const ServiceCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
`

export const ServiceCardFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
`

export const Bone = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${props => props.$radius || '6px'};
  background: ${props => props.theme.colors.gray || '#DEE2E6'};
  width: ${props => props.$width || '100%'};
  height: ${props => props.$height || '100%'};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      ${props => props.theme.colors.secundary || '#F8F9FA'} 50%,
      transparent 100%
    );
    animation: ${shimmer} 1.4s ease-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      background: none;
    }
  }
`
