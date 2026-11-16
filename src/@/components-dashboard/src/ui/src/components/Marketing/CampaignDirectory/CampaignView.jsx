import React, { useEffect, useId, useRef } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { formatVisibleDay } from '../../../../../utils/dateRange'
import { Button, InlineNotice } from '../../Shared/Product'
import { CampaignEmail } from '../CampaignEmail'
import { CampaignSMS } from '../CampaignSMS'
import { CampaignNotification } from '../CampaignNotification'
import { CampaignWhatsapp } from '../CampaignWhatsapp'
import { CampaignPopup } from '../CampaignPopup'
import { CampaignWebHook } from '../CampaignWebHook'
import { hasText } from './campaignDraft'
import { asConditions, audienceLabel, campaignStatus, channelLabel, formatCount, formatWhen, hasOrderStats, ruleSummary } from './campaignData'
import './campaign-panel.css'

// redesign CA-B6 (decisions 1 and 4; defects M-CA3, M-CA10; auditor #1, #4): the read-only view of a campaign that has been created. What
// the mouse could do on a campaign with a status in `main` (the switch of a dynamic one, Delete, the list of opens) lives in the panel's
// header and here (the opens link); nothing here looks editable, because nothing is: no input, no Save, no rule controls, no SettingsList.
//
// Props: what K/CampaignDetail gives its UI (`campaignState`, `contactState`, … the channel editors read them) plus
//   - `onOpenOpens(campaign)`: the Opens figure, when above zero, is a link-button that asks the host for the list of opens.
// The record is `campaignState.campaign`; the panel puts the freshest row of the list over it before it gets here.

const PREVIEWS = {
  email: CampaignEmail,
  sms: CampaignSMS,
  notification: CampaignNotification,
  whatsapp: CampaignWhatsapp,
  popup: CampaignPopup,
  webhook: CampaignWebHook
}

const NONE = '—'

// What can take focus inside a facsimile (CA-B6)
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]'

// The arithmetic and the N/A rule of M/CampaignList:281-303, literally (the same ones the table uses). Push campaigns are stored as
// «notification», so only «sms» and the literal «push» are N/A: a push campaign shows its sent and opens figures and the opens list.
const inQueueOf = (campaign) => (
  (typeof campaign?.audience_count !== 'undefined' && typeof campaign?.sent_count !== 'undefined')
    ? (campaign.audience_count - campaign.sent_count)
    : 0
)
const hasNoStats = (campaign) => campaign?.contact_type === 'sms' || campaign?.contact_type === 'push'

const hasCount = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

// A number or a date goes in a node of its own (decision 11) and keeps its direction in RTL
const figure = (value, key) => <bdi key={key} dir='ltr' className='odc-figure'>{value}</bdi>

// «Scheduled for _when_»: the marker becomes a figure node, the words around it stay the translation's
const fillFigure = (template, name, value) => {
  const marker = `_${name}_`
  const [before, ...rest] = template.split(marker)
  if (rest.length === 0) return template
  return (
    <>
      {before}
      {figure(value)}
      {rest.join(marker)}
    </>
  )
}

// The figures of a rule line, each in its own node: `values` come in order from ruleSummary
const withFigures = (text, values) => {
  const out = []
  let rest = text
  values.forEach((value, index) => {
    const at = rest.indexOf(value)
    if (at < 0) return
    if (at > 0) out.push(rest.slice(0, at))
    out.push(figure(value, index))
    rest = rest.slice(at + value.length)
  })
  if (rest) out.push(rest)
  return out
}

const Block = ({ title, children }) => {
  const id = useId()
  return (
    <section className='odc-campaign-view-block' aria-labelledby={id}>
      <h3 id={id} className='odc-campaign-view-title'>{title}</h3>
      {children}
    </section>
  )
}

export const CampaignView = (props) => {
  const { campaignState, onOpenOpens } = props
  const [languageState, t] = useLanguage()
  const [{ parseDate, parsePrice } = {}] = useUtils() || []
  // redesign CA-R1 (live check): every count is written in the number format of the person's language («1,240» / «1.240»)
  const locale = languageState?.language?.code
  const fmt = (value) => formatCount(value, locale)

  const campaign = campaignState?.campaign ?? {}
  const status = campaignStatus(campaign, t)
  const ended = campaign.status === 'ended'

  // ---- Audience ----
  const formatDate = (stamp) => (parseDate ? formatVisibleDay(typeof stamp === 'string' ? stamp.slice(0, 10) : '', parseDate) : null)
  const rules = asConditions(campaign.conditions)
  const description = campaign.audience_type === 'fixed'
    ? t('CAMPAIGN_FIXED_DESCRIPTION', 'Only people who match rules right now')
    : campaign.audience_type === 'dynamic'
      ? t('CAMPAIGN_DYNAMIC_DESCRIPTION', 'People who match rules now and in the future')
      : null
  // The figure the API recorded for this campaign, not a live count: `main` hides the live one for pending and ended campaigns, and it is
  // not who the message went to (auditor #4). Nothing when the record has none.
  const reach = hasCount(campaign.audience_count) ? Number(campaign.audience_count) : null

  // ---- Delivery ----
  const when = (value) => formatWhen(value, parseDate) ?? NONE
  const deliveryLines = []
  if (campaign.audience_type === 'fixed') {
    deliveryLines.push(
      campaign.scheduled_at
        ? fillFigure(t('CAMPAIGNS_DELIVERY_SCHEDULED_FOR', 'Scheduled for _when_'), 'when', when(campaign.scheduled_at))
        : t('CAMPAIGNS_DELIVERY_ASAP', 'As soon as possible')
    )
  } else if (campaign.audience_type === 'dynamic') {
    deliveryLines.push(status.label)
    if (campaign.end_at) deliveryLines.push(fillFigure(t('CAMPAIGNS_DELIVERY_UNTIL', 'Until _when_'), 'when', when(campaign.end_at)))
  }

  // ---- Message ----
  // redesign CA-B6 (M-CA3): a facsimile is not a control surface, so nothing inside it may take focus; it is still read as text. Runs after
  // every render of the campaign or the channel (the new facsimile brings its own controls).
  const previewRef = useRef(null)
  useEffect(() => {
    previewRef.current?.querySelectorAll(FOCUSABLE).forEach(node => node.setAttribute('tabindex', '-1'))
  }, [campaign.id, campaign.contact_type])
  const Preview = Object.prototype.hasOwnProperty.call(PREVIEWS, campaign.contact_type) ? PREVIEWS[campaign.contact_type] : null
  // redesign CA-R2 (P6): a record whose `contact_data` has no title and no body has no message to show; the empty window of the facsimile says
  // nothing. A record that does not carry `contact_data` at all is not judged (the editors read their own copy of it, in `contactState`).
  // A webhook's address is part of its message.
  const message = campaign.contact_data
  const hasMessage = message === undefined || hasText(message?.title) || hasText(message?.body) || hasText(message?.webhook)

  // ---- Results ----
  const noStats = hasNoStats(campaign)
  const na = <span className='odc-campaign-na'>{t('NA', 'N/A')}</span>
  const opens = Number(campaign.open_count) || 0
  const opensCell = () => {
    if (noStats) return na
    if (!(opens > 0)) return figure(fmt(0))
    const name = t(opens === 1 ? 'CAMPAIGNS_OPENS_LINK_ONE' : 'CAMPAIGNS_OPENS_LINK_OTHER', opens === 1 ? '_count_ open of _name_' : '_count_ opens of _name_')
      .replace('_count_', fmt(opens))
      .replace('_name_', () => campaign.name ?? '')
    return (
      <Button variant='link' size='sm' className='odc-campaign-opens-link' aria-label={name} onClick={() => onOpenOpens?.(campaign)}>
        {figure(fmt(opens))}
      </Button>
    )
  }

  // Orders and revenue are attributed to emails (tagged links) and push notifications (opened in the app); the other channels have nothing to attribute, so their 0 would be a lie
  const hasOrders = hasOrderStats(campaign)
  // one literal t() per key: a key picked inside the call is not found by the catalog scan and stays untranslated
  const ordersHelp = campaign.contact_type === 'notification'
    ? t('CAMPAIGNS_RESULTS_ORDERS_HELP_PUSH', 'Orders and revenue come from customers who ordered after opening this notification in the app.')
    : t('CAMPAIGNS_RESULTS_ORDERS_HELP', 'Orders and revenue come from customers who ordered after clicking a link in this email.')
  const revenue = Number(campaign.orders_total) || 0
  const revenueCell = () => {
    if (!hasOrders) return na
    // without the project's formatter, not `fmt`: formatCount rounds the cents away
    return figure(parsePrice ? parsePrice(revenue) : revenue.toLocaleString(locale))
  }

  return (
    <div className='odc-root odc-campaign-view'>
      <InlineNotice tone='info'>
        {ended
          ? t('CAMPAIGN_ENDED_INFO', 'Information not editable when campaign has ended')
          : t('CAMPAIGNS_VIEW_READONLY', "Campaigns can't be edited after they're created.")}
      </InlineNotice>

      <Block title={t('CHANNEL', 'Channel')}>
        <p className='odc-campaign-view-value'>{channelLabel(t, campaign.contact_type)}</p>
      </Block>

      <Block title={t('AUDIENCE', 'Audience')}>
        <p className='odc-campaign-view-value'>{audienceLabel(t, campaign.audience_type)}</p>
        {description && <p className='odc-campaign-view-muted'>{description}</p>}
        {rules.length > 0
          ? (
            <ul className='odc-campaign-chips' aria-label={t('CAMPAIGNS_RULES', 'Rules')}>
              {rules.map((rule, index) => {
                const summary = ruleSummary(t, rule, formatDate)
                return (
                  <li key={`${rule?.id ?? 'rule'}:${index}`} className='odc-campaign-chip'>
                    {summary.label}{': '}{withFigures(summary.text, summary.values)}
                  </li>
                )
              })}
            </ul>
            )
          : <p className='odc-campaign-view-muted'>{t('CAMPAIGNS_NO_RULES', 'No rules')}</p>}
        {reach !== null && (
          <p className='odc-campaign-view-reach'>
            {fillFigure(
              reach === 1
                ? t('CAMPAIGNS_AUDIENCE_COUNT_ONE', 'Audience: _count_ customer')
                : t('CAMPAIGNS_AUDIENCE_COUNT_OTHER', 'Audience: _count_ customers'),
              'count',
              fmt(reach)
            )}
          </p>
        )}
      </Block>

      <Block title={t('DELIVERY', 'Delivery')}>
        {deliveryLines.length > 0
          ? deliveryLines.map((line, index) => <p key={index} className='odc-campaign-view-value'>{line}</p>)
          : <p className='odc-campaign-view-value'>{NONE}</p>}
      </Block>

      <Block title={t('MESSAGE', 'Message')}>
        {Preview && hasMessage
          // The facsimile of the channel, whole and read-only. No `inert`: it would hide the message from screen readers, and the message is the
          // point of the block. The wrapper stays readable; its controls (the popup's «Done» and the like) leave the tab order (see above).
          ? (
            <div ref={previewRef} role='group' aria-label={t('CAMPAIGNS_MESSAGE_PREVIEW', 'Message preview')} className='odc-campaign-view-message'>
              <Preview {...props} previewOnly />
            </div>
            )
          : Preview
            ? <p className='odc-campaign-view-muted'>{t('CAMPAIGNS_NO_MESSAGE', 'No message')}</p> // redesign CA-R2 (P6)
            : <p className='odc-campaign-view-value'>{NONE}</p>}
      </Block>

      <Block title={t('CAMPAIGNS_RESULTS', 'Results')}>
        <dl className='odc-campaign-results'>
          <div className='odc-campaign-result'>
            <dt>{t('IN_QUEUE', 'In queue')}</dt>
            <dd>{figure(fmt(inQueueOf(campaign)))}</dd>
          </div>
          <div className='odc-campaign-result'>
            <dt>{t('SENT', 'Sent')}</dt>
            <dd>{noStats ? na : figure(fmt(campaign.sent_count || 0))}</dd>
          </div>
          <div className='odc-campaign-result'>
            <dt>{t('OPENS', 'Opens')}</dt>
            <dd>{opensCell()}</dd>
          </div>
          <div className='odc-campaign-result'>
            <dt>{t('ORDERS', 'Orders')}</dt>
            <dd>{hasOrders ? figure(fmt(campaign.orders_count || 0)) : na}</dd>
          </div>
          <div className='odc-campaign-result'>
            <dt>{t('CAMPAIGNS_COL_REVENUE', 'Revenue')}</dt>
            <dd>{revenueCell()}</dd>
          </div>
        </dl>
        {hasOrders && (
          <p className='odc-campaign-view-muted'>{ordersHelp}</p>
        )}
      </Block>
    </div>
  )
}
