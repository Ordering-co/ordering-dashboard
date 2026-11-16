import React, { useEffect, useState } from 'react'
import { useProjectState } from '../../../contexts/ProjectContext'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { useUpgradeOffer } from '../../../contexts/UpgradeOfferContext'
import { Button, Dialog } from '../../Shared/Product'
import './upgrade-offer-modal.css'

// the one-time "move off your legacy plan" offer, shown once a day per project/offer
// while there is one. The offer always speaks the language it was created in (`offer.language`),
// never the Dashboard user's own language, so its copy is fixed EN/ES here instead of going
// through useLanguage()/the i18n catalog.
// (sidebar follow-up): the fetch and the open/close flag now live in
// UpgradeOfferContext, shared with the sidebar card; this modal only reads them.

const INCLUDED_EN = [
  'All products',
  'All features',
  'All integrations',
  'AI Ordering agents',
  'AI Ordering and Delivery Suite',
  'API & MCP access',
  'White-label branding and custom domains',
  'Web, mobile web and all native apps',
  'Menus, orders, delivery, payments and loyalty',
  'Multi-business and multi-location',
  'Frontend source code',
  'Platform updates and standard support',
  'And a lot more'
]

const INCLUDED_ES = [
  'Todos los productos',
  'Todas las funciones',
  'Todas las integraciones',
  'Agentes de AI Ordering',
  'AI Ordering y Delivery Suite',
  'Acceso a API y MCP',
  'Marca blanca y dominios propios',
  'Web, web móvil y todas las apps nativas',
  'Menús, pedidos, delivery, pagos y lealtad',
  'Varios negocios y varias sucursales',
  'Código fuente del frontend',
  'Actualizaciones y soporte estándar',
  'Y mucho más'
]

// `current_plan.name` cut on " - ", first segment only (copy spec).
export const legacyPlanLabel = (name) => {
  if (typeof name !== 'string' || !name.trim()) return null
  return name.split(' - ')[0].trim()
}

// Exported so the sidebar card (follow-up) uses the same "is there anything to show"
// rule as the modal, instead of a second copy of it.
export const isValidOffer = (offer) =>
  Boolean(offer) &&
  typeof offer === 'object' &&
  offer.id != null &&
  Boolean(offer.project?.name) &&
  Boolean(offer.featured?.name) &&
  typeof offer.featured?.periods === 'object' &&
  (Boolean(offer.featured.periods.annual) || Boolean(offer.featured.periods.monthly)) &&
  Boolean(offer.link) &&
  Boolean(offer.due_at_label)

// (sidebar follow-up): the sidebar card's "N days left" phrase. `days` is already
// `Math.ceil`-ed by the caller (buildUpgradeCardProps); 1 and <=0 read as singular/"last day".
const sidebarDaysPhrase = (days, lang) => {
  if (lang === 'es') {
    if (days <= 0) return 'Último día'
    if (days === 1) return 'Queda 1 día'
    return `Quedan ${days} días`
  }
  if (days <= 0) return 'Last day'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

// Fixed bilingual copy for one offer. `lang` is whatever the API sent; anything but 'es' reads as English.
export const buildOfferCopy = (offer) => {
  const lang = offer?.language === 'es' ? 'es' : 'en'
  const say = (enText, esText) => (lang === 'es' ? esText : enText)

  const save = Number(offer?.save) || 0
  const hasSave = save > 0
  const project = offer?.project?.name || ''
  const legacy = legacyPlanLabel(offer?.current_plan?.name)
  const dueAtLabel = offer?.due_at_label || ''

  return {
    lang,
    hasSave,
    included: lang === 'es' ? INCLUDED_ES : INCLUDED_EN,
    pill: say('Special offer · Legacy customers only', 'Oferta especial · Solo para clientes legacy'),
    title: hasSave
      ? say(`Upgrade ${project} and save up to ${save}%`, `Actualiza ${project} y ahorra hasta un ${save}%`)
      : say(`Your upgrade options for ${project}`, `Tus opciones para actualizar ${project}`),
    paragraph: say(
      `${project} is on a legacy one-time plan that no longer gets updates or support. ` +
        (hasSave
          ? `As a legacy customer, you can move to a current plan for up to ${save}% less than the regular price.`
          : 'Moving to a current plan takes a couple of minutes.'),
      `${project} está en un plan legacy de pago único que ya no recibe actualizaciones ni soporte. ` +
        (hasSave
          ? `Como cliente legacy, puedes pasarte a un plan vigente pagando hasta un ${save}% menos que el precio regular.`
          : 'Pasarte a un plan vigente toma un par de minutos.')
    ),
    strip: legacy
      ? say(`Today: ${legacy} · no updates, no new features, no support`, `Hoy: ${legacy} · sin actualizaciones, sin funciones nuevas, sin soporte`)
      : null,
    ribbon: hasSave
      ? say(`Save ${save}% · Legacy customers only · Until ${dueAtLabel}`, `Ahorra ${save}% · Solo para clientes legacy · Hasta el ${dueAtLabel}`)
      : say('Recommended', 'Recomendado'),
    includedTitle: say('Everything is included', 'Todo incluido'),
    finePrint: say(
      'AI usage, delivery, payment processing and other third-party fees are separate. Integrations depend on provider and regional availability.',
      'El uso de AI, delivery, procesamiento de pagos y otros cargos de terceros se cobran aparte. Las integraciones dependen del proveedor y de la región.'
    ),
    othersTitle: hasSave
      ? say('Regular prices, for reference', 'Precios regulares, como referencia')
      : say('Other plans', 'Otros planes'),
    othersNote: say('You can also pick one of these on the upgrade page.', 'También puedes elegir uno de estos en la página de actualización.'),
    validUntilLead: say('This offer is valid until', 'La oferta es válida hasta el'),
    validUntilTrail: hasSave ? say('After that, the regular prices apply.', 'Después, aplican los precios regulares.') : null,
    notNow: say('Not now', 'Ahora no'),
    upgradeCta: hasSave
      ? say(`Upgrade with ${save}% off`, `Actualizar con ${save}% de descuento`)
      : say('Upgrade my plan', 'Actualizar mi plan'),
    ctaFootnote: hasSave ? say('The discounted price stays as long as you keep this plan.', 'El precio con descuento se mantiene mientras conserves este plan.') : null,
    close: say('Close', 'Cerrar'),
    annualPerYear: say('per year', 'al año'),
    aboutPerMonth: (perMonth) => say(`About ${perMonth} a month`, `Unos ${perMonth} al mes`),
    saveEveryYear: (saving) => say(`You save ${saving} every year`, `Ahorras ${saving} cada año`),
    orPayMonthly: say('Or pay monthly:', 'O paga mensual:'),
    perMonthPrice: (price) => say(`${price} per month`, `${price} al mes`),
    saveParens: (periodSave) => say(`(save ${periodSave}%)`, `(ahorra ${periodSave}%)`),
    planCol: say('Plan', 'Plan'),
    annualCol: say('Annual', 'Anual'),
    monthlyCol: say('Monthly', 'Mensual'),
    perYearRow: (price) => say(`${price} / year`, `${price} / año`),
    perMonthRow: (price) => say(`${price} / month`, `${price} / mes`),
    // (sidebar follow-up): the sidebar card, which never shows the dialog's full copy.
    cardTitle: say('Upgrade your plan', 'Actualiza tu plan'),
    cardCta: say('See offer', 'Ver oferta'),
    cardSubtitle: (days) => {
      const daysPhrase = sidebarDaysPhrase(days, lang)
      return hasSave ? say(`Save ${save}% · ${daysPhrase}`, `Ahorra ${save}% · ${daysPhrase}`) : daysPhrase
    },
    cardRailLabel: hasSave
      ? say(`Upgrade your plan · Save ${save}%`, `Actualiza tu plan · Ahorra ${save}%`)
      : say('Upgrade your plan', 'Actualiza tu plan')
  }
}

const seenKey = (projectCode, offerId) => `upgrade_offer_seen:${projectCode}:${offerId}`

// Local date (not UTC): "once a day" means the visitor's own day.
const todayLocal = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const safeStorageGet = (key) => {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    return null
  }
}

const safeStorageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    // Storage can throw (Safari private mode, quota, disabled cookies): the offer still shows,
    // once for this page load, it just won't remember it across reloads.
  }
}

export const UpgradeOfferModalUI = (props) => {
  const { offer, projectCode, trialModalOpen, isModalOpen, openModal, closeModal } = props
  const [marked, setMarked] = useState(false)

  const valid = isValidOffer(offer) && Boolean(projectCode)
  const offerId = offer?.id

  // Marks "seen" and opens together, once, the first time the offer is both valid and the trial
  // extension modal (which takes priority) is not open. If the trial modal is open when the offer
  // arrives, this waits for it to close instead of showing both at once. The open flag itself
  // lives in UpgradeOfferContext, shared with the sidebar card's "See offer" button.
  useEffect(() => {
    if (!valid || marked || trialModalOpen) return
    const key = seenKey(projectCode, offerId)
    if (safeStorageGet(key) === todayLocal()) {
      setMarked(true)
      return
    }
    safeStorageSet(key, todayLocal())
    setMarked(true)
    openModal()
  }, [valid, marked, trialModalOpen, projectCode, offerId, openModal])

  if (!valid) return null

  const copy = buildOfferCopy(offer)
  const close = closeModal
  const annual = offer.featured.periods?.annual
  const monthly = offer.featured.periods?.monthly
  const others = Array.isArray(offer.others) ? offer.others : []
  const half = Math.ceil(copy.included.length / 2)

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(next) => { if (!next) close() }}
      size='lg'
      title={copy.title}
      closeLabel={copy.close}
      className='odc-upgrade-offer'
      footer={(
        <>
          <Button onClick={close}>{copy.notNow}</Button>
          <a
            className='odc-btn odc-upgrade-offer-cta'
            data-variant='primary'
            data-size='md'
            href={offer.link}
            target='_blank'
            rel='noopener noreferrer'
            onClick={close}
          >
            {copy.upgradeCta}
          </a>
          {copy.ctaFootnote && <p className='odc-upgrade-offer-cta-note'>{copy.ctaFootnote}</p>}
        </>
      )}
    >
      <p className='odc-upgrade-offer-pill'>{copy.pill}</p>
      <p className='odc-upgrade-offer-lead'>{copy.paragraph}</p>
      {copy.strip && <p className='odc-upgrade-offer-strip'>{copy.strip}</p>}

      <section className='odc-upgrade-offer-card'>
        <span className='odc-upgrade-offer-ribbon'>{copy.ribbon}</span>
        <h3 className='odc-upgrade-offer-plan-name'>{offer.featured.name}</h3>

        {annual && (
          <div className='odc-upgrade-offer-period'>
            <div className='odc-upgrade-offer-price-row'>
              {annual.reference && <span className='odc-upgrade-offer-strike'>{annual.reference}</span>}
              <span className='odc-upgrade-offer-price'>{annual.price}</span>
              <span className='odc-upgrade-offer-price-unit'>{copy.annualPerYear}</span>
            </div>
            {annual.per_month && <p className='odc-upgrade-offer-permonth'>{copy.aboutPerMonth(annual.per_month)}</p>}
            {annual.saving && <p className='odc-upgrade-offer-saving'>{copy.saveEveryYear(annual.saving)}</p>}
          </div>
        )}

        {monthly && (
          <div className='odc-upgrade-offer-period'>
            {annual && <p className='odc-upgrade-offer-or'>{copy.orPayMonthly}</p>}
            <div className='odc-upgrade-offer-price-row'>
              {monthly.reference && <span className='odc-upgrade-offer-strike'>{monthly.reference}</span>}
              <span className='odc-upgrade-offer-price-sm'>{copy.perMonthPrice(monthly.price)}</span>
              {Number(monthly.save) > 0 && <span className='odc-upgrade-offer-save-parens'>{copy.saveParens(monthly.save)}</span>}
            </div>
          </div>
        )}
      </section>

      <h4 className='odc-upgrade-offer-included-title'>{copy.includedTitle}</h4>
      <div className='odc-upgrade-offer-included'>
        <ul>{copy.included.slice(0, half).map(item => <li key={item}>{item}</li>)}</ul>
        <ul>{copy.included.slice(half).map(item => <li key={item}>{item}</li>)}</ul>
      </div>

      <p className='odc-upgrade-offer-fineprint'>{copy.finePrint}</p>

      {others.length > 0 && (
        <div className='odc-upgrade-offer-others'>
          <h4 className='odc-upgrade-offer-others-title'>{copy.othersTitle}</h4>
          <table className='odc-upgrade-offer-table'>
            <thead>
              <tr>
                <th scope='col'>{copy.planCol}</th>
                <th scope='col'>{copy.annualCol}</th>
                <th scope='col'>{copy.monthlyCol}</th>
              </tr>
            </thead>
            <tbody>
              {others.map((plan, index) => (
                <tr key={plan?.name ? `${plan.name}-${index}` : index}>
                  <td>{plan?.name}</td>
                  <td>{plan?.periods?.annual?.price ? copy.perYearRow(plan.periods.annual.price) : '—'}</td>
                  <td>{plan?.periods?.monthly?.price ? copy.perMonthRow(plan.periods.monthly.price) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className='odc-upgrade-offer-others-note'>{copy.othersNote}</p>
        </div>
      )}

      <p className='odc-upgrade-offer-validuntil'>
        {copy.validUntilLead} <strong>{offer.due_at_label}</strong>.
        {copy.validUntilTrail && ` ${copy.validUntilTrail}`}
      </p>
    </Dialog>
  )
}

export const UpgradeOfferModal = (props) => {
  const [projectState] = useProjectState()
  const { isModalOpen: trialModalOpen } = useTrialExtension()
  const { offer, isModalOpen, openModal, closeModal } = useUpgradeOffer()

  const upgradeOfferProps = {
    ...props,
    offer,
    projectCode: projectState?.project?.code || null,
    trialModalOpen,
    isModalOpen,
    openModal,
    closeModal
  }
  return <UpgradeOfferModalUI {...upgradeOfferProps} />
}
