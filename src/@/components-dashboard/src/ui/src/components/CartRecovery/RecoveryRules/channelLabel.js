// redesign RA-B2 (decision 2; M-RA8): the visible name of a channel of a recovery rule. The API stores `email`, `sms` and `notification`;
// the old screens drew the raw value or its own words. Every name is a literal `t()` call, so the key extractor and the catalog see it.
//
// `short` is for the chips of the list: the push notification is «Push» there. RA-B3 (the panel) and RA-B4 (the dialog) import this
// helper and use the full name.
//
// Any other value goes as it came, so a channel the dashboard does not know yet is still readable.

export const channelLabel = (t, channel, { short = false } = {}) => {
  const labels = {
    email: t('EMAIL', 'Email'),
    sms: t('SMS', 'SMS'),
    notification: short
      ? t('RECOVERY_RULES_CHANNEL_PUSH_SHORT', 'Push')
      : t('PUSH_NOTIFICATION', 'Push notification')
  }
  return Object.prototype.hasOwnProperty.call(labels, channel) ? labels[channel] : String(channel ?? '')
}
