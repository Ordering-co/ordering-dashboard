/**
 * «What's new»: the features the dashboard announces on the Home, newest first, and the «New» tag their page gets in
 * the sidebar while the announcement runs. Announcing a feature is adding an entry here; the Home and the sidebar need no change.
 *
 * Each entry:
 *  - `id`: stable; the dismissal is kept under it.
 *  - `texts(t)`: the card's `title`, `description` and `action`, through the translator of useLanguage (literal keys, so the
 *    catalog generator finds them).
 *  - `url`: where its button leads; the card shows only when the person's level can open it. The sidebar item with this url
 *    gets the «New» tag.
 *  - `until` (`YYYY-MM-DD`, inclusive, UTC): after it the card and the tag go by themselves.
 *  - `when(context)`: whether this project offers it; `context` is what the hook knows (see `useFeatureAnnouncements`).
 */
export const FEATURE_ANNOUNCEMENTS = [
  {
    id: 'order_with_google',
    texts: (t) => ({
      title: t('ORDER_WITH_GOOGLE', 'Order with Google'),
      description: t('FEATURE_ORDER_WITH_GOOGLE_DESCRIPTION', 'Show an “Order online” button for your stores on Google Search and Maps.'),
      action: t('FEATURE_SET_IT_UP', 'Set it up')
    }),
    url: '/connect/order-with-google',
    until: '2027-02-28',
    when: ({ googleActions }) => googleActions?.can_activate === true
  }
]

const isRunning = (announcement, now) => !announcement.until || now <= Date.parse(`${announcement.until}T23:59:59Z`)

/**
 * The announcements running for this project and person, newest first: not past `until`, offered (`when`), with a page the
 * person can open (`canOpen(url)`) and not dismissed.
 */
export const getActiveAnnouncements = ({ now = Date.now(), context = {}, canOpen = () => true, dismissed = [], list = FEATURE_ANNOUNCEMENTS } = {}) =>
  list.filter(announcement =>
    isRunning(announcement, now) &&
    announcement.when(context) &&
    canOpen(announcement.url) &&
    !dismissed.includes(announcement.id))

/**
 * The urls whose sidebar item carries «New»: every running and offered announcement, dismissed or not (dismissing hides the
 * Home card, the tag stays until `until`).
 */
export const getNewFeatureUrls = ({ now = Date.now(), context = {}, list = FEATURE_ANNOUNCEMENTS } = {}) =>
  list.filter(announcement => isRunning(announcement, now) && announcement.when(context)).map(announcement => announcement.url)
