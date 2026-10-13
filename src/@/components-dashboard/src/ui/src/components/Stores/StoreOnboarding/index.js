import React, { useEffect, useRef, useState } from 'react'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { StoreOnboarding as Controller } from '../../../../../components/StoreOnboarding'
import { getDashboardLogoUrl } from '../../../utils'
import { useTheme } from '../../../contexts/ThemeContext'
import logo from '~/assets/images/ordering-lockup-color.svg'
import { Shop } from 'react-bootstrap-icons'
import { InputPhoneNumber } from '../../../components/Shared/InputPhoneNumber'
import { HoursEditor } from './HoursEditor'
import { BusinessAddressEditor } from './BusinessAddressEditor'
import { WebsitePreview } from './WebsitePreview'
import dashboardTheme from '~/theme.json'
import { validWebsiteColor, normalizeWebsiteColor } from '../../../../../utils/storeOnboardingAppearance'
import { ZoneEditor } from './ZoneEditor'
import { MenuEditor } from './MenuEditor'
import { TestOrderGuide } from './TestOrderGuide'
import { timezones } from '../../../config/constants'
import { Input, Shell, Aside, Main, Header, Content, Reassurance, Grid, Card, Field, Fields, Row, Button, TextButton, Footer, Choice, ErrorBox, Success, PreviewLogo, PaymentHint, MenuOptionButton, WebsiteColorRow, OnboardingSupportOffset } from './styles'

export const StoreOnboardingUI = ({ mediaReady = true, draft, update, updateMenu, move, chooseMenu, publish, publishing, errors, notice, meta, retryMetadata, site, refreshSite, onComplete, project, testOrder, appearance = {}, retryAppearance }) => {
  const [, t] = useStoreOnboardingLanguage()
  const [theme] = useTheme()
  const { form: f, journal } = draft
  const step = draft.step === 4 ? 3 : draft.step
  const visibleSteps = [0, 1, 2, 3, 5]
  const position = visibleSteps.indexOf(step)
  const header = useRef(null)
  const [supportTop, setSupportTop] = useState(120)
  useEffect(() => {
    const measure = () => { const rect = header.current?.getBoundingClientRect(); if (rect?.height) setSupportTop(Math.ceil(rect.top + Math.max(0, (rect.height - 48) / 2))) }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (header.current) observer?.observe(header.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const [previewOpen, setPreviewOpen] = useState(false)
  const websiteColor = validWebsiteColor(f.websiteColor) ? f.websiteColor : appearance.color || normalizeWebsiteColor(theme.colors?.primary) || dashboardTheme.colors.primary
  const setWebsiteColor = value => update({ websiteColor: value, websiteAppearanceTarget: { siteId: appearance.siteId, themeId: appearance.themeId } })
  const [menuEditing, setMenuEditing] = useState(false)
  const frozen = publishing || journal.started || !mediaReady
  const logoReader = useRef(null)
  const cancelLogoRead = () => {
    const pending = logoReader.current
    logoReader.current = null
    if (pending?.readyState === 1) pending.abort()
  }
  useEffect(() => () => cancelLogoRead(), [])
  useEffect(() => { if (frozen) cancelLogoRead() }, [frozen])
  const heading = useRef(null)
  const alert = useRef(null)
  useEffect(() => { heading.current?.focus() }, [step])
  useEffect(() => { if (errors.length || notice) alert.current?.focus() }, [errors, notice])
  const steps = [t('STORE_ONBOARDING_STEP_DETAILS', 'Your restaurant'), t('STORE_ONBOARDING_STEP_LOCATION', 'Location and logo'), t('STORE_ONBOARDING_STEP_HOURS', 'Opening hours'), t('STORE_ONBOARDING_STEP_DELIVERY', 'Orders and delivery'), t('PAYMENT_METHODS', 'Payment methods'), t('STORE_ONBOARDING_STEP_MENU', 'Your menu')]
  const titles = [t('STORE_ONBOARDING_WELCOME', 'Let’s start with your restaurant'), t('STORE_ONBOARDING_LOCATION_TITLE', 'Where can customers find you?'), t('STORE_ONBOARDING_HOURS_TITLE', 'When are you open?'), t('STORE_ONBOARDING_DELIVERY_TITLE', 'How will customers order?'), t('STORE_ONBOARDING_PAYMENTS_TITLE', 'How will customers pay?'), t('STORE_ONBOARDING_MENU_TITLE', 'Let’s create your first menu')]
  const subtitles = [t('STORE_ONBOARDING_DETAILS_HINT', 'Just the essentials to get your restaurant ready.'), t('STORE_ONBOARDING_LOCATION_HINT', 'Confirm your address on the map. Add a logo if you have one.'), t('STORE_ONBOARDING_HOURS_HINT', 'Set the days and times when you can receive orders.'), t('STORE_ONBOARDING_DELIVERY_HINT', 'Choose how you serve customers and where you deliver.'), t('STORE_ONBOARDING_PAYMENTS_HINT', 'Choose the payment methods you accept when receiving an order.'), t('STORE_ONBOARDING_MENU_HINT', 'Start small: a category, your products and their prices.')]
  const orderNames = [t('DELIVERY', 'Delivery'), t('PICKUP', 'Pick up'), t('DINE_IN', 'Dine-in'), t('CURBSIDE', 'Curbside'), t('DRIVE_THRU', 'Drive-through')]
  const currency = meta.configs.format_number_currency?.value || ''
  const errorLabels = { websiteColor: t('STORE_ONBOARDING_PRIMARY_COLOR', 'Primary color'), name: t('NAME', 'Name'), phone: t('PHONE', 'Phone'), email: t('EMAIL', 'Email'), address: t('ADDRESS', 'Address'), hours: t('SCHEDULE', 'Schedule'), timezone: t('TIMEZONE', 'Timezone'), orderTypes: t('ORDER_TYPES', 'Order types'), zoneName: t('NAME', 'Name'), zoneMinimum: t('MINIMUM_PURCHASE', 'Minimum purchase'), zonePrice: t('DELIVERY_FEE', 'Delivery fee'), zoneGeometry: t('STORE_ONBOARDING_ZONE_GEOMETRY', 'Delivery area'), payments: t('PAYMENT_METHODS', 'Payment methods'), menu: t('MENU', 'Menu') }
  const toggle = (list, value) => list.includes(value) ? list.filter(x => x !== value) : [...list, value]
  const zone = patch => update({ zone: patch })
  const field = (name, label, type = 'text', hint) => <Field>{label}<Input name={name} type={type} value={f[name]} disabled={frozen} aria-invalid={errors.includes(name)} onChange={e => update({ [name]: e.target.value })} />{hint && <small>{hint}</small>}</Field>
  const tenantLogo = meta.configs.dashboard_logo?.value
  const paymentChoices = <Fields>{[['cash', t('CASH', 'Cash')], ['card_delivery', t('CARD_ON_DELIVERY', 'Card on delivery')]].map(([gateway, label]) => <Choice key={gateway} $checked={f.payments.includes(gateway)}><Input type='checkbox' checked={f.payments.includes(gateway)} disabled={frozen || (!f.payments.includes(gateway) && !meta.paymethods.some(p => p.gateway === gateway))} onChange={() => update({ payments: toggle(f.payments, gateway) })} /><span>{label}{!meta.loading && !meta.paymethods.some(p => p.gateway === gateway) && <small> — {t('UNAVAILABLE', 'Unavailable')}</small>}</span></Choice>)}</Fields>
  return (
    <Shell>
      <OnboardingSupportOffset $top={supportTop} $hide={previewOpen} />
      <Aside>
        <img src={getDashboardLogoUrl(meta.configs, theme.images?.logos?.logotype || logo)} alt={tenantLogo ? project : 'Dashboard'} />
        <div className='project'><strong>{f.name || project}</strong><br /><small>{t('STORE_ONBOARDING_PROJECT', 'Restaurant setup')}</small></div>
        <nav aria-label={t('STORE_ONBOARDING_PROGRESS', 'Setup progress')}><small>{t('STORE_ONBOARDING_CONFIGURE', 'Set up your store')}</small><ol>{visibleSteps.map((i, number) => <li key={i} aria-current={step === i ? 'step' : undefined}><span aria-label={i < step ? t('COMPLETED', 'Completed') : undefined}>{i < step ? '✓' : number + 1}</span><b>{steps[i]}</b></li>)}</ol></nav>
        <p>{t('STORE_ONBOARDING_LOCAL_SAVE', 'Your progress is saved in this browser.')}</p>
      </Aside>
      <Main>
        <Header ref={header}><span>{t('STORES', 'Stores')} / {t('CREATE_STORE', 'Create store')}</span>{step >= 1 && step < 6 && <Button data-onboarding-preview aria-label={t('STORE_ONBOARDING_WEBSITE_PREVIEW', 'Website preview')} disabled={menuEditing || !mediaReady} onClick={() => setPreviewOpen(true)}>{t('PREVIEW', 'Preview')}</Button>}</Header>
        <Content data-onboarding-content>
          {step < 6 && <><h1 tabIndex={-1} ref={heading}>{titles[step]}</h1><p>{subtitles[step]}</p></>}
          <Reassurance><span aria-hidden='true'>✓</span>{t('STORE_ONBOARDING_CHANGE_LATER', 'You can change this later.')}</Reassurance>
          {meta.error && <ErrorBox role='alert'>{t('STORE_ONBOARDING_METADATA_ERROR', 'We could not load your project settings. Try again before publishing.')} <Button onClick={retryMetadata}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button></ErrorBox>}
          {(errors.length > 0 || notice) && <ErrorBox role='alert' tabIndex={-1} ref={alert}>{errors.length > 0 ? <>{t('STORE_ONBOARDING_FIX_FIELDS', 'Complete or check these fields:')} {errors.map(e => errorLabels[e]).join(', ')}</> : notice === 'storage' ? <>{t('STORE_ONBOARDING_STORAGE_ERROR', 'Your browser could not save your progress. Free up browser storage and try again.')} {!mediaReady && <Button onClick={retryMetadata}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button>}</> : t('STORE_ONBOARDING_PUBLISH_ERROR', 'We could not finish publishing. Your progress is saved. Try again to complete the same store.')}</ErrorBox>}
          {journal.started && !journal.published && !publishing && <ErrorBox>{t('STORE_ONBOARDING_RESUME_PUBLICATION', 'Publication has started. We have kept your settings so you can safely retry without creating another store.')}</ErrorBox>}
          {step === 0 && <Grid><Card><Fields>{field('name', t('STORE_NAME', 'Restaurant name'))}<Field>{t('PHONE', 'Phone')}<InputPhoneNumber value={f.phone} disabled={frozen} handleIsValid={valid => { if (f.phoneValid !== valid) update({ phoneValid: valid }) }} setValue={(value, valid) => update({ phone: value || '', phoneValid: Boolean(valid) })} /></Field>{field('email', t('EMAIL', 'Email'), 'email')}</Fields></Card><Card $muted><h2>{t('STORE_ONBOARDING_PREVIEW', 'Your restaurant preview')}</h2><PreviewLogo>{f.logo ? <img src={f.logo} alt={t('LOGO', 'Logo')} /> : <Shop aria-hidden='true' />}</PreviewLogo><h3>{f.name || t('STORE_ONBOARDING_RESTAURANT_PLACEHOLDER', 'Your restaurant name')}</h3><p>{f.phone || t('STORE_ONBOARDING_PHONE_PLACEHOLDER', 'Your contact phone')}</p></Card></Grid>}
          {step === 1 && <Grid><Card><Fields><BusinessAddressEditor address={f.address} location={f.location} disabled={frozen} onChange={patch => update(patch)} /></Fields></Card><Card><h2>{t('STORE_ONBOARDING_LOGO_OPTIONAL', 'Your logo (optional)')}</h2><p>{t('STORE_ONBOARDING_LOGO_HINT', 'A square image works best. JPG or PNG, up to 1 MB.')}</p>{f.logo && <img src={f.logo} alt={t('LOGO', 'Logo')} style={{ width: 100, height: 100, objectFit: 'contain', margin: '20px 0' }} />}<Field>{t('UPLOAD_LOGO', 'Upload logo')}<Input type='file' accept='image/png,image/jpeg' disabled={frozen} onChange={e => {
            cancelLogoRead()
            const file = e.target.files[0]
            if (!file) return
            if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) { e.target.setCustomValidity(t('STORE_ONBOARDING_LOGO_HINT', 'A square image works best. JPG or PNG, up to 1 MB.')); e.target.reportValidity(); return }
            e.target.setCustomValidity('')
            const reader = new FileReader()
            logoReader.current = reader
            reader.onload = () => {
              if (logoReader.current !== reader) return
              logoReader.current = null
              update({ logo: reader.result })
            }
            reader.readAsDataURL(file)
          }} /></Field>{f.logo && <TextButton disabled={frozen} onClick={() => { cancelLogoRead(); update({ logo: '' }) }}>{t('REMOVE', 'Remove')}</TextButton>}<Field>{t('STORE_ONBOARDING_PRIMARY_COLOR', 'Primary color')}<WebsiteColorRow><Input aria-label={t('STORE_ONBOARDING_PRIMARY_COLOR', 'Primary color')} type='color' value={websiteColor} disabled={frozen || appearance.loading || !appearance.siteId || !appearance.themeId} onChange={e => setWebsiteColor(e.target.value)} /><Input aria-label={t('STORE_ONBOARDING_COLOR_CODE', 'Color code')} value={f.websiteAppearanceTarget ? f.websiteColor : f.websiteColor || websiteColor} disabled={frozen || appearance.loading || !appearance.siteId || !appearance.themeId} aria-invalid={errors.includes('websiteColor')} onChange={e => setWebsiteColor(e.target.value)} /></WebsiteColorRow></Field>{appearance.error && <p role='alert'>{t('STORE_ONBOARDING_APPEARANCE_ERROR', 'We could not load your website appearance. Try again to choose its color.')} <TextButton disabled={frozen} onClick={retryAppearance}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</TextButton></p>}</Card></Grid>}
          {step === 2 && <Card><Fields><HoursEditor form={f} disabled={frozen} onChange={schedule => update({ schedule })} /><details open={errors.includes('timezone') || undefined}><summary>{t('TIMEZONE', 'Timezone')}: {f.timezone}</summary><Field>{t('TIMEZONE', 'Timezone')}<select value={f.timezone} disabled={frozen} onChange={e => update({ timezone: e.target.value })}>{[...new Set([f.timezone, ...timezones])].map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select><small>{t('STORE_ONBOARDING_TIMEZONE_HINT', 'Check that this timezone matches your restaurant.')}</small></Field></details></Fields></Card>}
          {step === 3 && <Fields><Card><details open={errors.includes('orderTypes') || undefined}><summary>{t('ORDER_TYPES', 'Order types')}: {orderNames.filter((_, i) => f.orderTypes.includes(i + 1)).join(', ')}</summary><Fields>{orderNames.map((label, i) => <Choice key={i} $checked={f.orderTypes.includes(i + 1)}><Input type='checkbox' checked={f.orderTypes.includes(i + 1)} disabled={frozen} onChange={() => update({ orderTypes: toggle(f.orderTypes, i + 1) })} />{label}</Choice>)}</Fields></details></Card>{f.orderTypes.includes(1) && <Card $spacedTitle><h2>{t('STORE_ONBOARDING_ZONE_TITLE', 'Your delivery area')}</h2><Fields><Row>{[[4, t('STORE_ONBOARDING_EVERYWHERE', 'Everywhere')], [1, t('STORE_ONBOARDING_RADIUS', 'Radius')], [2, t('STORE_ONBOARDING_POLYGON', 'Draw an area')]].map(([type, label]) => <Button key={type} type='button' $primary={f.zone.type === type} aria-pressed={f.zone.type === type} disabled={frozen} onClick={() => zone({ type, data: type === 1 ? { center: f.location, radio: 5 } : null })}>{label}</Button>)}</Row><ZoneEditor distanceUnit={meta.configs.distance_unit?.value} apiKey={meta.configs.google_maps_api_key?.value} type={f.zone.type} data={f.zone.data} location={f.location} disabled={frozen} onRefresh={retryMetadata} onChange={data => zone({ data })} /><Field>{t('NAME', 'Name')}<Input value={f.zone.name} disabled={frozen} onChange={e => zone({ name: e.target.value })} /></Field><Row><Field>{t('MINIMUM_PURCHASE', 'Minimum purchase')} {currency}<Input type='number' min='0' step='any' value={f.zone.minimum} disabled={frozen} onChange={e => zone({ minimum: e.target.value })} /></Field><Field>{t('DELIVERY_FEE', 'Delivery fee')} {currency}<Input type='number' min='0' step='any' value={f.zone.price} disabled={frozen} onChange={e => zone({ price: e.target.value })} /></Field></Row></Fields></Card>}<Card $spacedTitle><h2>{t('PAYMENT_METHODS', 'Payment methods')}</h2>{paymentChoices}<PaymentHint>{t('STORE_ONBOARDING_CARD_PAYMENTS_LATER', 'You can select card payments once you finish setting up your store.')}</PaymentHint></Card></Fields>}
          {step === 5 && <Fields>{!f.menuMode ? <Grid $equal><Card className='menu-choice'><h2>{t('STORE_ONBOARDING_MANUAL_MENU', 'Create my menu')}</h2><p>{t('STORE_ONBOARDING_MANUAL_MENU_HINT', 'Add your first category and a few products. You can grow your menu later.')}</p><Button $primary disabled={frozen} onClick={() => chooseMenu(false)}>{t('STORE_ONBOARDING_MANUAL_MENU', 'Create my menu')}</Button></Card><Card className='menu-choice'><h2>{t('STORE_ONBOARDING_SAMPLE_MENU', 'Use a sample menu')}</h2><p>{t('STORE_ONBOARDING_SAMPLE_MENU_HINT', 'Start with a ready-to-use menu. Edit the names and prices, or publish it as it is.')}</p><Button disabled={frozen} onClick={() => chooseMenu(true)}>{t('STORE_ONBOARDING_SAMPLE_MENU', 'Use a sample menu')}</Button></Card></Grid> : <><MenuOptionButton disabled={frozen || menuEditing} onClick={() => chooseMenu(null)}>{t('STORE_ONBOARDING_CHANGE_MENU', 'Change menu option')}</MenuOptionButton><MenuEditor key={f.menuMode} categories={f.categories} mode={f.menuMode} disabled={frozen} onChange={updateMenu} onEditingChange={setMenuEditing} /></>}</Fields>}
          {step === 6 && journal.published && <Success><div className='check' aria-hidden='true'>✓</div><h1 tabIndex={-1} ref={heading}>{t('STORE_ONBOARDING_CONGRATULATIONS', 'Congratulations! Your restaurant is ready.')}</h1><p>{f.name}</p>{site.url ? <><a href={site.url} target='_blank' rel='noopener noreferrer'>{t('STORE_ONBOARDING_VIEW_RESTAURANT', 'View my restaurant')} ↗</a><p style={{ overflowWrap: 'anywhere' }}>{site.url}</p></> : <Card $muted><p>{site.loading ? t('STORE_ONBOARDING_CHECKING_LINK', 'Checking your restaurant link…') : site.error ? t('STORE_ONBOARDING_WEBSITE_ERROR', 'We could not check your restaurant link. Try again.') : t('STORE_ONBOARDING_WEBSITE_PENDING', 'Your website is not available yet. You can continue and open your restaurant when the website is ready.')}</p>{!site.loading && <Button onClick={refreshSite}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button>}</Card>}<p style={{ marginTop: 24 }}>{t('STORE_ONBOARDING_SUCCESS_HINT', 'You can now manage orders, your menu and your settings from the dashboard.')}</p><TestOrderGuide testOrder={testOrder} /></Success>}
        </Content>
        <Footer>{step < 6 ? <><TextButton disabled={step === 0 || frozen || menuEditing} onClick={() => move(visibleSteps[position - 1])}>← {t('BACK', 'Back')}</TextButton><Button $primary disabled={publishing || !mediaReady || menuEditing || meta.loading || (step === 5 && meta.error)} onClick={() => step === 5 ? publish() : move(visibleSteps[position + 1])}>{publishing ? t('STORE_ONBOARDING_PUBLISHING', 'Publishing…') : step === 5 ? t('STORE_ONBOARDING_PUBLISH', 'Publish my restaurant') : t('CONTINUE', 'Continue')} {publishing ? '' : '→'}</Button></> : <><span /><Button $primary onClick={() => onComplete()}>{t('STORE_ONBOARDING_CONTINUE_HOME', 'Continue to Home')} →</Button></>}</Footer>
      </Main>
      <WebsitePreview open={previewOpen} onClose={() => { setPreviewOpen(false); queueMicrotask(() => document.querySelector('[data-onboarding-preview]')?.focus()) }} form={f} color={websiteColor} currency={currency} appearance={appearance} retryAppearance={retryAppearance} />
    </Shell>
  )
}
export const StoreOnboarding = props => <Controller {...props} UIComponent={StoreOnboardingUI} />
