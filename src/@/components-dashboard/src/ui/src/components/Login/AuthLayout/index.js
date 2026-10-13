import React from 'react'
import { useTheme } from 'styled-components'
import { useConfig, useLanguage } from '../../../../../index'
import { OrderingBrandFonts } from '../../../styles/OrderingBrand'
import { getDashboardLogoUrl } from '../../../utils'
import {
  LoginContainer,
  LoginHeroContainer,
  HeroLogo,
  HeroBody,
  HeroCaption,
  Route,
  FormSide,
  FormPanel,
  MobileLogo
} from './styles'

/**
 * Shared shell for login, forgot password and reset password:
 * Ordering.co brand panel on the left (lg+), form on the right. The panel
 * shows the project logo and login background when the project set them.
 */
export const AuthLayout = ({ isPopup, children }) => {
  const [, t] = useLanguage()
  const [{ configs } = {}] = useConfig()
  const theme = useTheme()
  const tenantLogo = configs?.dashboard_logo?.value
  const background = configs?.dashboard_login_background?.value
  const logoAlt = tenantLogo ? t('LOGO', 'Logo') : 'Ordering.co'
  const logos = theme?.images?.logos || {}

  return (
    <LoginContainer $isPopup={isPopup}>
      <OrderingBrandFonts />
      <LoginHeroContainer bgimage={background}>
        <HeroLogo src={getDashboardLogoUrl(configs, logos.logotypeInvert)} alt={logoAlt} />
        <HeroBody>
          {!background && (
            <Route aria-label={t('LOGIN_PAGE_ROUTE', 'From order to delivery')}>
              <li>{t('ORDER', 'Order')}</li>
              <li>{t('STORE', 'Store')}</li>
              <li>{t('DRIVER', 'Driver')}</li>
              <li>{t('CUSTOMER', 'Customer')}</li>
            </Route>
          )}
          <HeroCaption>{t('LOGIN_PAGE_HERO', 'Run orders, stores and drivers from one dashboard.')}</HeroCaption>
        </HeroBody>
      </LoginHeroContainer>

      <FormSide>
        <FormPanel>
          <MobileLogo>
            {tenantLogo
              ? <img src={getDashboardLogoUrl(configs)} alt={logoAlt} />
              : (
                <picture>
                  <source media='(prefers-color-scheme: dark)' srcSet={logos.logotypeInvert} />
                  <img src={logos.logotype} alt={logoAlt} />
                </picture>
                )}
          </MobileLogo>
          {children}
        </FormPanel>
      </FormSide>
    </LoginContainer>
  )
}
