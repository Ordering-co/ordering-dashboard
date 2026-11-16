import { useLanguage } from '../../../../../index'

// redesign AB-B2 (decision 1; defect M-AB26): the six places a banner can be shown, as data. Every batch of the page imports this
// file (the list, the panel, the image dialog, the host). The values are the ones `M/AdBannersListing/index.js` has on `main`:
// the keys, the titles and descriptions (their keys and English defaults), the recommended size, the crop ratio, the crop box of
// the three app positions and the two «Business page» positions (the ones that choose businesses and had the search).
//
//   key                 the value the API stores in `banner.position`
//   group               'web' | 'app'
//   titleKey/Default    the title of the position (main's keys)
//   descriptionKey/Default  what the position is for (main's keys; the listing and page texts are shared by web and app)
//   size                the recommended image size, in pixels ('1440 x 300' | '300 x 300')
//   aspectRatio         the crop ratio the image dialog gives ImageCrop (1440/300 | 1)
//   showAspectRatioBox  the app positions only: ImageCrop offers «Use web aspect ratio»
//   isBusinessPage      the positions that choose the businesses a banner is shown in (and the Businesses column)
//
// `BANNER_POSITIONS` keeps main's order. What the person sees is `positionsOfGroup(group)` for each group of `POSITION_GROUPS`:
// home, business listing, business page inside Web and then App (main listed the app ones listing, page, home).
//
// The `t()` calls of the texts are literal in `usePositionText` (the i18n scanner reads them; a key built at run time is not seen).

const WEB_SIZE = '1440 x 300'
const APP_SIZE = '300 x 300'

const position = (fields) => Object.freeze({ showAspectRatioBox: false, isBusinessPage: false, ...fields })

export const BANNER_POSITIONS = Object.freeze([
  position({
    key: 'web_home_page',
    group: 'web',
    titleKey: 'WEB_HOME',
    titleDefault: 'Web home',
    descriptionKey: 'HOME_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner to your home page and inform everyone about the latest news in your marketplace.',
    size: WEB_SIZE,
    aspectRatio: 1440 / 300
  }),
  position({
    key: 'web_business_listing',
    group: 'web',
    titleKey: 'WEB_BUSINESS_LISTING',
    titleDefault: 'Web business listing',
    descriptionKey: 'BUSINESS_LISTING_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.',
    size: WEB_SIZE,
    aspectRatio: 1440 / 300
  }),
  position({
    key: 'web_business_page',
    group: 'web',
    titleKey: 'WEB_BUSINESS_PAGE',
    titleDefault: 'Web business page',
    descriptionKey: 'BUSINESS_PAGE_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.',
    size: WEB_SIZE,
    aspectRatio: 1440 / 300,
    isBusinessPage: true
  }),
  position({
    key: 'app_business_listing',
    group: 'app',
    titleKey: 'APP_BUSINESS_LISTING',
    titleDefault: 'App business listing',
    descriptionKey: 'BUSINESS_LISTING_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.',
    size: APP_SIZE,
    aspectRatio: 300 / 300,
    showAspectRatioBox: true
  }),
  position({
    key: 'app_business_page',
    group: 'app',
    titleKey: 'APP_BUSINESS_PAGE',
    titleDefault: 'App business page',
    descriptionKey: 'BUSINESS_PAGE_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.',
    size: APP_SIZE,
    aspectRatio: 300 / 300,
    showAspectRatioBox: true,
    isBusinessPage: true
  }),
  position({
    key: 'app_home_page',
    group: 'app',
    titleKey: 'APP_HOME_PAGE',
    titleDefault: 'App home page',
    descriptionKey: 'HOME_BANNER_DESCRIPTION',
    descriptionDefault: 'Add a banner to your home page and inform everyone about the latest news in your marketplace.',
    size: APP_SIZE,
    aspectRatio: 300 / 300,
    showAspectRatioBox: true
  })
])

// The position of a key, or undefined (a key the API stores that is none of the six, or nothing)
export const positionByKey = (key) => BANNER_POSITIONS.find(item => item.key === key)

// The order of the groups on the page
export const POSITION_GROUPS = Object.freeze(['web', 'app'])

// Inside a group: home, business listing, business page
const DISPLAY_ORDER = Object.freeze([
  'web_home_page', 'web_business_listing', 'web_business_page',
  'app_home_page', 'app_business_listing', 'app_business_page'
])

export const positionsOfGroup = (group) => DISPLAY_ORDER
  .map(positionByKey)
  .filter(item => item && item.group === group)

// `(position) => ({ title, description, size, dimensions })`, translated.
//   size        the sentence main wrote («Recommended size 1440 x 300»), for a place that prints it as text
//   dimensions  the measure alone («1440 x 300»), for a place that draws it as a figure
// A position that is none of the six gets empty texts.
export const usePositionText = () => {
  const [, t] = useLanguage()
  // one literal t() per text: the scanner and the catalog see every key
  const texts = {
    web_home_page: {
      title: t('WEB_HOME', 'Web home'),
      description: t('HOME_BANNER_DESCRIPTION', 'Add a banner to your home page and inform everyone about the latest news in your marketplace.')
    },
    web_business_listing: {
      title: t('WEB_BUSINESS_LISTING', 'Web business listing'),
      description: t('BUSINESS_LISTING_BANNER_DESCRIPTION', 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.')
    },
    web_business_page: {
      title: t('WEB_BUSINESS_PAGE', 'Web business page'),
      description: t('BUSINESS_PAGE_BANNER_DESCRIPTION', 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.')
    },
    app_business_listing: {
      title: t('APP_BUSINESS_LISTING', 'App business listing'),
      description: t('BUSINESS_LISTING_BANNER_DESCRIPTION', 'Add a banner inside your business listing to let everyone know about your latest promotions inside your businesses listed.')
    },
    app_business_page: {
      title: t('APP_BUSINESS_PAGE', 'App business page'),
      description: t('BUSINESS_PAGE_BANNER_DESCRIPTION', 'Add a banner inside the business page, and inform news and promotions specifically of the stores customers are ordering from.')
    },
    app_home_page: {
      title: t('APP_HOME_PAGE', 'App home page'),
      description: t('HOME_BANNER_DESCRIPTION', 'Add a banner to your home page and inform everyone about the latest news in your marketplace.')
    }
  }
  const sizeTemplate = t('RECOMMENDED_IMAGE_SIZE', 'Recommended size _size_')

  return (item) => {
    const known = positionByKey(item?.key)
    if (!known) return { title: '', description: '', size: '', dimensions: '' }
    return {
      title: texts[known.key].title,
      description: texts[known.key].description,
      size: sizeTemplate.replace('_size_', () => known.size),
      dimensions: known.size
    }
  }
}
