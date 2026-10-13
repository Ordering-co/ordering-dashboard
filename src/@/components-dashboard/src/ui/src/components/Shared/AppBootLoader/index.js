import React from 'react'
import { SpinnerLoader } from '../SpinnerLoader'
import {
  Bone,
  BreadcrumbRow,
  ChartBody,
  ChartHeader,
  ChartPanel,
  LowerRow,
  Main,
  MetricCard,
  MetricCopy,
  MetricIcon,
  MetricLabel,
  MetricValue,
  MetricsRow,
  ReportsRow,
  ServiceCard,
  ServiceCardBody,
  ServiceCardFooter,
  ServiceCopy,
  ServiceIcon,
  Shell,
  Sidebar,
  SidebarFooter,
  SidebarFooterRow,
  SidebarLogo,
  SidebarNav,
  SidebarNavRow,
  SrOnly,
  TilesColumn,
  WelcomeActions,
  WelcomeBlock,
  WelcomeCopy,
  WelcomeIllustration,
  WelcomeLine,
  WelcomeTitle
} from './styles'

const HOME_VARIANT = 'home'
const AUTH_VARIANT = 'auth'
const FULL_DENSITY = 'full'
const LIGHT_DENSITY = 'light'

export const readPersistedSessionToken = () => {
  try {
    return window?.localStorage?.getItem('token')
  } catch {
    return null
  }
}

export const resolveBootDensity = (auth, persistedToken = readPersistedSessionToken()) => {
  if (auth) return FULL_DENSITY
  if (auth === false) return LIGHT_DENSITY
  return persistedToken ? FULL_DENSITY : LIGHT_DENSITY
}
/**
 * Signed in (or a stored session while it loads): the dashboard shell.
 * Nobody signed in: the sign-in layout, since the next screen is the login.
 */
export const resolveBootVariant = (auth, persistedToken = readPersistedSessionToken()) =>
  resolveBootDensity(auth, persistedToken) === FULL_DENSITY ? HOME_VARIANT : AUTH_VARIANT

const OFFICIAL_HOST = /^(dashboard|dashboardcf)\.(ordering\.co|orderingplus\.com|tryordering\.com)$/

const isBrandHost = () => {
  try {
    const host = window.location.hostname.toLowerCase()
    return OFFICIAL_HOST.test(host) || host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * Same splash as the one in index.html, so the page keeps one
 * loading screen from the first paint until the login is ready. Styles live
 * in index.html; `od-boot__inner--static` skips the fade-in so taking over
 * from the HTML splash does not flicker. White-label hosts get the bar only.
 */
const BootSplash = () => {
  const classes = ['od-boot', 'od-boot--auto', isBrandHost() ? 'od-boot--brand' : ''].filter(Boolean).join(' ')
  return (
    <div className={classes} role='status' aria-live='polite' data-testid='boot-auth'>
      <div className='od-boot__inner od-boot__inner--static'>
        <svg className='od-boot__logo' viewBox='0 0 512 512' aria-hidden='true' focusable='false' data-testid='boot-auth-logo'>
          <path fill='#32B45F' d='M243 46.402767A210 210 0 0 0 46.402767 243L94.522447 243A162 162 0 0 1 243 94.522447Z' />
          <path fill='#266DF0' d='M269 46.402767A210 210 0 0 1 465.597233 243L417.477553 243A162 162 0 0 0 269 94.522447Z' />
          <path fill='#FF9418' d='M243 465.597233A210 210 0 0 1 46.402767 269L94.522447 269A162 162 0 0 0 243 417.477553Z' />
          <path fill='#E91D63' d='M465.597233 269A210 210 0 0 1 269 465.597233L269 417.477553A162 162 0 0 0 417.477553 269Z' />
        </svg>
        <div className='od-boot__bar' />
        <span className='od-boot__sr'>Loading</span>
      </div>
    </div>
  )
}

const NAV_ROW_COUNT = 10
const LIGHT_METRIC_COUNT = 2
const FULL_TILE_COUNT = 2

const isFullDensity = (density) => density === FULL_DENSITY

const HomeBootSkeleton = ({ density }) => {
  const isFull = isFullDensity(density)

  return (
    <Shell
      role='status'
      aria-busy='true'
      aria-live='polite'
      data-testid='boot-home'
    >
      <SrOnly>Loading dashboard</SrOnly>
      <Sidebar data-testid='boot-sidebar'>
        <SidebarLogo>
          <Bone $height='28px' />
        </SidebarLogo>
        <SidebarNav data-testid='boot-sidebar-nav'>
          {Array.from({ length: NAV_ROW_COUNT }, (_, index) => (
            <SidebarNavRow key={index}>
              <Bone $height='16px' $width='16px' $radius='4px' />
              <Bone $height='14px' $width={index % 3 === 0 ? '78%' : index % 3 === 1 ? '62%' : '48%'} />
            </SidebarNavRow>
          ))}
        </SidebarNav>
        <SidebarFooter data-testid='boot-sidebar-footer'>
          <SidebarFooterRow data-testid='boot-sidebar-user'>
            <Bone $height='30px' $width='30px' $radius='50%' />
            <Bone $height='14px' $width='72%' />
          </SidebarFooterRow>
          <SidebarFooterRow data-testid='boot-sidebar-help'>
            <Bone $height='16px' $width='16px' $radius='4px' />
            <Bone $height='12px' $width='42%' />
          </SidebarFooterRow>
          <SidebarFooterRow data-testid='boot-sidebar-logout'>
            <Bone $height='16px' $width='16px' $radius='4px' />
            <Bone $height='12px' $width='54%' />
          </SidebarFooterRow>
        </SidebarFooter>
      </Sidebar>
      <Main>
        <BreadcrumbRow>
          <Bone $height='22px' />
        </BreadcrumbRow>
        <WelcomeBlock data-testid='boot-welcome'>
          <WelcomeCopy>
            <WelcomeTitle>
              <Bone $height='36px' />
            </WelcomeTitle>
            <WelcomeLine>
              <Bone $height='16px' />
            </WelcomeLine>
            <WelcomeActions>
              <Bone $height='40px' $width='120px' $radius='8px' />
              <Bone $height='44px' $width='148px' $radius='8px' />
            </WelcomeActions>
          </WelcomeCopy>
          <WelcomeIllustration>
            <Bone $height='148px' $radius='8px' />
          </WelcomeIllustration>
        </WelcomeBlock>
        {!isFull && (
          <MetricsRow data-testid='boot-metrics'>
            {Array.from({ length: LIGHT_METRIC_COUNT }, (_, index) => (
              <MetricCard key={index}>
                <MetricCopy>
                  <MetricLabel>
                    <Bone $height='14px' />
                  </MetricLabel>
                  <MetricValue>
                    <Bone $height='28px' />
                  </MetricValue>
                </MetricCopy>
                <MetricIcon>
                  <Bone $height='63px' $radius='7.6px' />
                </MetricIcon>
              </MetricCard>
            ))}
          </MetricsRow>
        )}
        {isFull && (
          <>
            <ReportsRow>
              <ChartPanel data-testid='boot-chart'>
                <ChartHeader>
                  <Bone $height='14px' />
                </ChartHeader>
                <ChartBody>
                  <Bone $height='300px' />
                </ChartBody>
              </ChartPanel>
              <TilesColumn data-testid='boot-tiles'>
                {Array.from({ length: FULL_TILE_COUNT }, (_, index) => (
                  <MetricCard key={index}>
                    <MetricCopy>
                      <MetricLabel>
                        <Bone $height='14px' />
                      </MetricLabel>
                      <MetricValue>
                        <Bone $height='28px' />
                      </MetricValue>
                    </MetricCopy>
                    <MetricIcon>
                      <Bone $height='63px' $radius='7.6px' />
                    </MetricIcon>
                  </MetricCard>
                ))}
              </TilesColumn>
            </ReportsRow>
            <LowerRow data-testid='boot-lower'>
              {Array.from({ length: FULL_TILE_COUNT }, (_, index) => (
                <ServiceCard key={index}>
                  <ServiceCardBody>
                    <ServiceIcon>
                      <Bone $height='72px' $radius='10px' />
                    </ServiceIcon>
                    <ServiceCopy>
                      <Bone $height='14px' $width='70%' />
                      <Bone $height='12px' $width='92%' />
                      <Bone $height='12px' $width='58%' />
                    </ServiceCopy>
                  </ServiceCardBody>
                  <ServiceCardFooter>
                    <Bone $height='44px' $width='120px' $radius='8px' />
                  </ServiceCardFooter>
                </ServiceCard>
              ))}
            </LowerRow>
          </>
        )}
      </Main>
    </Shell>
  )
}

export const AppBootLoader = (props) => {
  const { variant, density, ...spinnerProps } = props

  if (variant === HOME_VARIANT) {
    return <HomeBootSkeleton density={density} />
  }

  if (variant === AUTH_VARIANT) {
    return <BootSplash />
  }

  return <SpinnerLoader {...spinnerProps} />
}
