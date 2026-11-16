import { buildOfferCopy, isValidOffer } from '../../Billing/UpgradeOfferModal'

// (sidebar follow-up): days left until `due_at`, rounded up — "1 day left" still
// shows while there is any part of that day remaining.
export const daysUntilDue = (dueAt, now = Date.now()) =>
  Math.ceil((new Date(dueAt).getTime() - now) / (24 * 60 * 60 * 1000))

/**
 * Pure props for the sidebar's upgrade card/rail button, or `null` when there is nothing to
 * show. `offer` is the same shape the modal validates (`isValidOffer`); the card additionally
 * needs `due_at` for its day count and progress ring, which the modal never reads.
 *
 * shortcut: the offer has no "sent at" date, so the ring's total is a fixed 30 days (the
 * offer's default window) — fraction = min(days, 30) / 30. If the window is ever made
 * configurable, read it from the offer instead of this constant.
 */
export const buildUpgradeCardProps = (offer, now = Date.now()) => {
  if (!isValidOffer(offer) || !offer.due_at) return null

  const copy = buildOfferCopy(offer)
  const days = daysUntilDue(offer.due_at, now)

  return {
    title: copy.cardTitle,
    subtitle: copy.cardSubtitle(days),
    ctaLabel: copy.cardCta,
    railLabel: copy.cardRailLabel,
    fraction: Math.max(0, Math.min(days, 30)) / 30
  }
}
