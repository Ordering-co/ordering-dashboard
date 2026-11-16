import { normalizeSettingsSearch } from './settingsIa'

/**
 * Single registry of the 22 Enterprise reports (/intelligence/reports). Pure data, no React and
 * no `t`: the page and the command palette (⌘K) read the same list (before, two hand-kept lists).
 * Texts go through `t` where they are painted, with the maps of literal calls exported below
 * (the i18n scanner only sees literals).
 */

// redesign reports FA1 (D2, RP-02, RP-17): order of the catalog groups
export const ADVANCED_REPORT_GROUPS = ['sales', 'service', 'delivery', 'drivers', 'customers']

/**
 * Column rules (D8) a report can declare in `columns`. The map is keyed by the cell's
 * `value_refers`; the rule wins over `value_unit` when a cell is formatted:
 * - `count`: the cell is a count although the API calls it distance (report 2).
 * - `km2`: kilometres with 2 decimals (report 1, `value_refers: 'average'`).
 * - `meterToKm`: the API sends metres (`value_unit: 'meter'`), the table shows km with 2 decimals (report 10).
 */
export const COLUMN_RULES = ['count', 'km2', 'meterToKm']

const FILTER_PILLS = ['brand', 'stores', 'country', 'zone', 'period']

// redesign reports FA1 (D2, RP-02): the 22 reports, in the order of the catalog of decisions.md › Nombres nuevos.
// `pills` are the filters main showed, in main's order (00-common.md › matrix). `csv.files` are the file prefixes
// (D11); the ones main got wrong are fixed: 11, 17, 20 and 21. `png` is the image download of the charts of main.
const REPORT_LIST = [
  {
    id: 13,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_13_NAME',
    name: 'Orders over time',
    descriptionKey: 'ENTERPRISE_REPORT_13_DESCRIPTION',
    description: 'Orders per period, with the total.',
    legacyKey: 'ORDERS',
    legacyName: 'Orders',
    aliases: ['reporte de ordenes', 'orders report'],
    endpoint: 'orders_v2',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'line',
    csv: { files: ['orders_'] }
  },
  {
    id: 14,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_14_NAME',
    name: 'Sales over time',
    descriptionKey: 'ENTERPRISE_REPORT_14_DESCRIPTION',
    description: 'Sales per period, with the total.',
    legacyKey: 'SALES',
    legacyName: 'Sales',
    aliases: ['ventas', 'reporte de ventas', 'sales report'],
    endpoint: 'sales_v2',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'line',
    csv: { files: ['sales_'] }
  },
  {
    id: 18,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_18_NAME',
    name: 'Average ticket by site and order type',
    descriptionKey: 'ENTERPRISE_REPORT_18_DESCRIPTION',
    description: 'Orders, sales and average ticket per site and per order type, for each period.',
    legacyKey: 'AVERAGE_SALES',
    legacyName: 'Average sales',
    aliases: ['ticket promedio', 'ventas promedio'],
    endpoint: 'sites_sales_average',
    endpoint1: 'order_types_sales_average',
    pills: ['driverGroup', 'brand', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: false,
    body: 'pivot2',
    csv: { files: ['site_sales_average_', 'order_type_sales_average_'] }
  },
  {
    id: 19,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_19_NAME',
    name: 'Sales by brand',
    descriptionKey: 'ENTERPRISE_REPORT_19_DESCRIPTION',
    description: 'Orders, sales, average ticket and share of orders per brand, for each period.',
    legacyKey: 'GENERAL_SALES',
    legacyName: 'General sales',
    aliases: ['ventas generales'],
    endpoint: 'franchises_sales_average',
    pills: ['driverGroup', 'brand', 'stores', 'country', 'zone', 'period'],
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    csv: { files: ['general_sales_'] }
  },
  {
    id: 17,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_17_NAME',
    name: 'Sales by payment method',
    descriptionKey: 'ENTERPRISE_REPORT_17_DESCRIPTION',
    description: 'Orders and sales per payment method, for each period.',
    legacyKey: 'PAYMETHOD_SALES',
    legacyName: 'Paymethod sales',
    aliases: ['ventas por metodo de pago'],
    endpoint: 'paymethods_count_sales',
    pills: ['driverGroup', 'brand', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: false,
    body: 'pivot',
    // main saved this one as completed_orders_
    csv: { files: ['paymethod_sales_'] }
  },
  {
    id: 20,
    group: 'sales',
    nameKey: 'ENTERPRISE_REPORT_20_NAME',
    name: 'Top products and categories',
    descriptionKey: 'ENTERPRISE_REPORT_20_DESCRIPTION',
    description: 'The best-selling products and categories, ranked by quantity sold.',
    legacyKey: 'TOP_SELLING_AND_CATEOGRY',
    legacyName: 'Top selling and category',
    aliases: ['mas vendidos', 'top productos', 'best sellers'],
    endpoint: 'top_selling_v2',
    endpoint1: 'top_categories_v2',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'ranking2',
    // main wrote top_cagegory_ (typo)
    csv: { files: ['top_selling_', 'top_category_'] }
  },
  {
    id: 8,
    group: 'service',
    nameKey: 'ENTERPRISE_REPORT_8_NAME',
    name: 'Orders and rejections by store and brand',
    descriptionKey: 'ENTERPRISE_REPORT_8_DESCRIPTION',
    description: 'Orders, sales and rejected orders, per store and per brand, for each period.',
    legacyKey: 'ORDER_STATUS_TEXT',
    legacyName: 'Order status',
    aliases: ['estado de ordenes'],
    endpoint: 'business_orders_count_sales',
    endpoint1: 'franchise_orders_count_sales',
    pills: ['brand', 'stores', 'orderType', 'country', 'zone', 'period'],
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot2',
    csv: { files: ['business_orders_count_sales_', 'franchise_orders_count_sales_'] }
  },
  {
    id: 21,
    group: 'service',
    nameKey: 'ENTERPRISE_REPORT_21_NAME',
    name: 'Orders by SLA status',
    descriptionKey: 'ENTERPRISE_REPORT_21_DESCRIPTION',
    description: 'Completed and cancelled orders on time, at risk or delayed.',
    legacyKey: 'SLA_ORDERS',
    legacyName: 'SLA orders',
    aliases: ['sla', 'ordenes sla'],
    endpoint: 'sla_orders',
    pills: ['driverGroup', 'driver', 'stores', 'zone', 'period'],
    storesByBrand: true,
    driversByGroup: true,
    body: 'pivot',
    // main saved this one as completed_orders_
    csv: { files: ['sla_orders_'] }
  },
  {
    id: 3,
    group: 'service',
    nameKey: 'ENTERPRISE_REPORT_3_NAME',
    name: 'Service times by store',
    descriptionKey: 'ENTERPRISE_REPORT_3_DESCRIPTION',
    description: 'Orders, sales and the times between order statuses, per store.',
    legacyKey: 'DISTANCE_STORE_CUSTOMER_RANGE_KM',
    legacyName: 'Distance in KM from the store to customer (Range KM)',
    aliases: ['rango km'],
    endpoint: 'business_spend_times',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    csv: { files: ['service_times_'] }
  },
  {
    id: 2,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_2_NAME',
    name: 'Orders by delivery distance',
    descriptionKey: 'ENTERPRISE_REPORT_2_DESCRIPTION',
    description: 'Orders and their share in each distance range from the store to the customer.',
    legacyKey: 'DISTANCE_STORE_CUSTOMER',
    legacyName: 'Distance in KM from the store to customer',
    aliases: ['distancia tienda cliente'],
    endpoint: 'order_distance_ranges',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    chart: 'bars',
    // D8: the API calls the cells of this report distance, but they are counts
    columns: { distance: 'count' },
    csv: { files: ['order_delivery_'], png: { key: 'ORDERS_DELIVERY', name: 'Orders delivery' } }
  },
  {
    id: 1,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_1_NAME',
    name: 'Average delivery distance by store',
    descriptionKey: 'ENTERPRISE_REPORT_1_DESCRIPTION',
    description: 'Average distance from each store to its customers, in km, for each period.',
    legacyKey: 'DISTANCE',
    legacyName: 'Distance',
    aliases: ['distancia'],
    endpoint: 'business_distance_average',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    chart: 'bars',
    // D8: kilometres with 2 decimals, as main
    columns: { average: 'km2' },
    csv: { files: ['distance_per_brand_'], png: { key: 'DISTANCE_PER_BRAND', name: 'Distance per brand' } }
  },
  {
    id: 6,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_6_NAME',
    name: 'Orders and sales by delivery company',
    descriptionKey: 'ENTERPRISE_REPORT_6_DESCRIPTION',
    description: 'Orders and sales of each delivery company, with their share of the total, for each period.',
    legacyKey: 'NUMBER_ORDERS_SPECIFIC_RANGE',
    legacyName: 'Number of orders within a specific range',
    aliases: ['cantidad de ordenes por rango'],
    endpoint: 'driver_companies_orders',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    csv: { files: ['number_of_orders_'] }
  },
  {
    id: 5,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_5_NAME',
    name: 'Service times by delivery company',
    descriptionKey: 'ENTERPRISE_REPORT_5_DESCRIPTION',
    description: 'Orders, sales and the times between order statuses, per delivery company.',
    legacyKey: 'DETAIL_COMPLETED_ORDERS',
    legacyName: 'Detail of the completed orders of each delivery agency',
    aliases: ['ordenes completadas por agencia'],
    endpoint: 'driver_companies_spend_times',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    csv: { files: ['completed_orders_'] }
  },
  {
    id: 4,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_4_NAME',
    name: 'Service time ranges by delivery company',
    descriptionKey: 'ENTERPRISE_REPORT_4_DESCRIPTION',
    description: 'Orders of each delivery company grouped by time range, for each period.',
    legacyKey: 'SERVICE_TIMES',
    legacyName: 'Service Times',
    aliases: ['tiempos de servicio'],
    endpoint: 'driver_companies_order_time_ranges',
    pills: FILTER_PILLS,
    storesByBrand: true,
    driversByGroup: false,
    body: 'pivot',
    csv: { files: ['service_times_'] }
  },
  {
    id: 9,
    group: 'delivery',
    nameKey: 'ENTERPRISE_REPORT_9_NAME',
    name: 'Order heat map',
    descriptionKey: 'ENTERPRISE_REPORT_9_DESCRIPTION',
    description: 'Where orders were placed, on a map, as a heat map or grouped.',
    legacyKey: 'HEAT_MAP_WITH',
    legacyName: 'Heat map with',
    aliases: ['mapa de calor', 'heatmap'],
    endpoint: 'orders_heat_map',
    pills: ['brand', 'stores', 'driverGroup', 'driver', 'country', 'zone', 'period'],
    storesByBrand: true,
    driversByGroup: true,
    body: 'map',
    // main has no download in this report
    csv: { files: [] }
  },
  {
    id: 11,
    group: 'drivers',
    nameKey: 'ENTERPRISE_REPORT_11_NAME',
    name: 'Service times by driver',
    descriptionKey: 'ENTERPRISE_REPORT_11_DESCRIPTION',
    description: 'Orders and the times between order statuses of each driver, with total vs ideal and rank.',
    legacyKey: 'DRIVER_TIME',
    legacyName: 'Driver Time',
    aliases: ['tiempo de repartidores'],
    endpoint: 'drivers_spent_times_v2',
    pills: ['driverGroup', 'driver', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: true,
    body: 'pivot',
    // main saved this one as completed_orders_
    csv: { files: ['driver_spent_times_'] }
  },
  {
    id: 12,
    group: 'drivers',
    nameKey: 'ENTERPRISE_REPORT_12_NAME',
    name: 'Top drivers by orders',
    descriptionKey: 'ENTERPRISE_REPORT_12_DESCRIPTION',
    description: 'Drivers ranked by their number of orders.',
    legacyKey: 'TOP_DRIVERS',
    legacyName: 'Top drivers',
    aliases: ['mejores repartidores'],
    endpoint: 'drivers_top_orders_v2',
    pills: ['driverGroup', 'driver', 'zone', 'period'],
    storesByBrand: false,
    // redesign (row 5, P7, D-31): main did not narrow the drivers by group here; now it does, like 7, 10, 11 and 21
    driversByGroup: true,
    body: 'ranking',
    csv: { files: ['top_orders_'] }
  },
  {
    id: 10,
    group: 'drivers',
    nameKey: 'ENTERPRISE_REPORT_10_NAME',
    name: 'Distance by driver',
    descriptionKey: 'ENTERPRISE_REPORT_10_DESCRIPTION',
    description: 'Distance covered by each driver, in km, for each period.',
    legacyKey: 'DRIVER_DISTANCE',
    legacyName: 'Driver distance',
    aliases: ['distancia de repartidores'],
    endpoint: 'driver_distances',
    pills: ['stores', 'driverGroup', 'driver', 'country', 'zone', 'period'],
    // main does not narrow the stores by brand in this report (auditor 7)
    storesByBrand: false,
    driversByGroup: true,
    body: 'pivot',
    // D8: the API sends metres, the table shows km with 2 decimals
    columns: { distance: 'meterToKm' },
    csv: { files: ['driver_distance_'] }
  },
  {
    id: 7,
    group: 'drivers',
    nameKey: 'ENTERPRISE_REPORT_7_NAME',
    name: 'Driver schedule',
    descriptionKey: 'ENTERPRISE_REPORT_7_DESCRIPTION',
    description: 'The shifts and events of each driver during one day.',
    legacyKey: 'DRIVER_SCHEDULE',
    legacyName: 'Driver schedule',
    aliases: ['horario de repartidores'],
    endpoint: 'drivers_operation_events',
    pills: ['driverGroup', 'driver', 'zone', 'day'],
    storesByBrand: false,
    driversByGroup: true,
    body: 'timeline',
    // main only downloads the image of the chart, with this fixed name
    csv: { files: [], png: { key: null, name: 'driver_schedule' } }
  },
  {
    id: 15,
    group: 'customers',
    nameKey: 'ENTERPRISE_REPORT_15_NAME',
    name: 'Registered users',
    descriptionKey: 'ENTERPRISE_REPORT_15_DESCRIPTION',
    description: 'New registered users per period, by channel.',
    legacyKey: 'REGISTER_USERS',
    legacyName: 'Register users',
    aliases: ['usuarios registrados', 'registros'],
    endpoint: 'users_v2',
    pills: ['channel', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: false,
    body: 'line',
    csv: { files: ['registers_users_'] }
  },
  {
    id: 16,
    group: 'customers',
    nameKey: 'ENTERPRISE_REPORT_16_NAME',
    name: 'Customer satisfaction',
    descriptionKey: 'ENTERPRISE_REPORT_16_DESCRIPTION',
    description: 'Customer scores for quality, delivery, service and package, with the general score.',
    legacyKey: 'CUSTOMER_SATISFACTION',
    legacyName: 'Customer safisfaction',
    aliases: ['satisfaccion', 'customer satisfaction'],
    endpoint: 'customer_satisfaction_v2',
    pills: ['channel', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: false,
    body: 'satisfaction',
    csv: { files: ['customer_satisfaction_'] }
  },
  // redesign (n.º 21, P2 of ecommerce-reports): the Clicks report of /intelligence/ecommerce_reports is report 22 of Enterprise reports.
  // `kind: 'clicks'` has the page open the clicks view (cards of its own, not `ReportBody`); `pills` are the ones that view shows (the channels
  // row is its own control, `app_id`). Name and description are the ones the ecommerce page already had; main's «Real time» stays as its legacy name.
  {
    id: 22,
    kind: 'clicks',
    group: 'customers',
    nameKey: 'ECOMMERCE_REPORT_CLICKS_NAME',
    name: 'Clicks on stores, products and categories',
    descriptionKey: 'ECOMMERCE_REPORT_CLICKS_DESCRIPTION',
    description: 'What customers opened most in the apps and websites, in the period.',
    legacyKey: 'REAL_TIME',
    legacyName: 'Real time',
    aliases: ['tiempo real', 'en vivo', 'clics'],
    endpoint: 'tracking_events',
    pills: ['country', 'brand', 'zone', 'period'],
    storesByBrand: false,
    driversByGroup: false,
    body: 'clicks',
    // one CSV per kind of click (ecommerce D7): clicks_<type>_<ts>.csv
    csv: { files: ['clicks_business_', 'clicks_product_', 'clicks_category_'] }
  }
]

export const ADVANCED_REPORTS = REPORT_LIST

const REPORTS_BY_ID = new Map(REPORT_LIST.map(report => [report.id, report]))

/**
 * The report of an id (number or string), or null when it is none of the 22:
 * `'0'`, `'abc'`, `'23'`, `'1.5'`, `null`.
 */
export const getAdvancedReport = (id) => {
  if (typeof id === 'string' && !/^[1-9]\d*$/.test(id)) return null
  if (typeof id !== 'string' && typeof id !== 'number') return null
  return REPORTS_BY_ID.get(Number(id)) || null
}

/**
 * The text the catalog searches in: new name, description, the name of main (translated)
 * and the Spanish aliases; lowercase, without accents.
 * `extraAliases`: more terms from outside the registry. redesign the catalog passes the search terms of the retired Ecommerce page
 * (`getEcommerceLegacyAliases` of ecommerceReports.js, which ⌘K already uses); they are an argument, not an import, because ecommerceReports.js
 * imports this file.
 */
export const reportSearchText = (report, t, extraAliases = []) => {
  if (!report) return ''
  const translate = typeof t === 'function' ? t : (_key, fallback) => fallback
  return normalizeSettingsSearch([
    report.name,
    report.description,
    translate(report.legacyKey, report.legacyName),
    ...(report.aliases || []),
    ...(Array.isArray(extraAliases) ? extraAliases : [])
  ].join(' '))
}

/**
 * Name of the image file main saves from the chart of reports 1, 2 and 7 (without `.png`), or null.
 * Literal calls: the keys already exist in the catalog (BI/ReportsBusinessDistance, BI/ReportsOrderDistance).
 */
export const reportPngName = (report, t) => {
  if (!report?.csv?.png) return null
  if (report.id === 1) return t('DISTANCE_PER_BRAND', 'Distance per brand')
  if (report.id === 2) return t('ORDERS_DELIVERY', 'Orders delivery')
  return report.csv.png.name
}

// redesign reports FA1 (D2): literal t() calls of the 22 reports (name, description and the name of main).
// The i18n scanner only sees literals. Same texts as the registry above; the test compares them.
// redesign the descriptions of the two distance reports (1, 10) take an optional second argument, the distance unit of the project ('MI' or
// 'KM', as `distanceUnitOf` gives it). Without it, or with anything but 'MI', they are the km texts of the registry, so the keys already translated stay valid.
export const REPORT_TEXTS = {
  1: (t, distanceUnit) => ({
    name: t('ENTERPRISE_REPORT_1_NAME', 'Average delivery distance by store'),
    description: distanceUnit === 'MI'
      ? t('ENTERPRISE_REPORT_1_DESCRIPTION_MI', 'Average distance from each store to its customers, in miles, for each period.')
      : t('ENTERPRISE_REPORT_1_DESCRIPTION', 'Average distance from each store to its customers, in km, for each period.'),
    legacyName: t('DISTANCE', 'Distance')
  }),
  2: (t) => ({
    name: t('ENTERPRISE_REPORT_2_NAME', 'Orders by delivery distance'),
    description: t('ENTERPRISE_REPORT_2_DESCRIPTION', 'Orders and their share in each distance range from the store to the customer.'),
    legacyName: t('DISTANCE_STORE_CUSTOMER', 'Distance in KM from the store to customer')
  }),
  3: (t) => ({
    name: t('ENTERPRISE_REPORT_3_NAME', 'Service times by store'),
    description: t('ENTERPRISE_REPORT_3_DESCRIPTION', 'Orders, sales and the times between order statuses, per store.'),
    legacyName: t('DISTANCE_STORE_CUSTOMER_RANGE_KM', 'Distance in KM from the store to customer (Range KM)')
  }),
  4: (t) => ({
    name: t('ENTERPRISE_REPORT_4_NAME', 'Service time ranges by delivery company'),
    description: t('ENTERPRISE_REPORT_4_DESCRIPTION', 'Orders of each delivery company grouped by time range, for each period.'),
    legacyName: t('SERVICE_TIMES', 'Service Times')
  }),
  5: (t) => ({
    name: t('ENTERPRISE_REPORT_5_NAME', 'Service times by delivery company'),
    description: t('ENTERPRISE_REPORT_5_DESCRIPTION', 'Orders, sales and the times between order statuses, per delivery company.'),
    legacyName: t('DETAIL_COMPLETED_ORDERS', 'Detail of the completed orders of each delivery agency')
  }),
  6: (t) => ({
    name: t('ENTERPRISE_REPORT_6_NAME', 'Orders and sales by delivery company'),
    description: t('ENTERPRISE_REPORT_6_DESCRIPTION', 'Orders and sales of each delivery company, with their share of the total, for each period.'),
    legacyName: t('NUMBER_ORDERS_SPECIFIC_RANGE', 'Number of orders within a specific range')
  }),
  7: (t) => ({
    name: t('ENTERPRISE_REPORT_7_NAME', 'Driver schedule'),
    description: t('ENTERPRISE_REPORT_7_DESCRIPTION', 'The shifts and events of each driver during one day.'),
    legacyName: t('DRIVER_SCHEDULE', 'Driver schedule')
  }),
  8: (t) => ({
    name: t('ENTERPRISE_REPORT_8_NAME', 'Orders and rejections by store and brand'),
    description: t('ENTERPRISE_REPORT_8_DESCRIPTION', 'Orders, sales and rejected orders, per store and per brand, for each period.'),
    legacyName: t('ORDER_STATUS_TEXT', 'Order status')
  }),
  9: (t) => ({
    name: t('ENTERPRISE_REPORT_9_NAME', 'Order heat map'),
    description: t('ENTERPRISE_REPORT_9_DESCRIPTION', 'Where orders were placed, on a map, as a heat map or grouped.'),
    legacyName: t('HEAT_MAP_WITH', 'Heat map with')
  }),
  10: (t, distanceUnit) => ({
    name: t('ENTERPRISE_REPORT_10_NAME', 'Distance by driver'),
    description: distanceUnit === 'MI'
      ? t('ENTERPRISE_REPORT_10_DESCRIPTION_MI', 'Distance covered by each driver, in miles, for each period.')
      : t('ENTERPRISE_REPORT_10_DESCRIPTION', 'Distance covered by each driver, in km, for each period.'),
    legacyName: t('DRIVER_DISTANCE', 'Driver distance')
  }),
  11: (t) => ({
    name: t('ENTERPRISE_REPORT_11_NAME', 'Service times by driver'),
    description: t('ENTERPRISE_REPORT_11_DESCRIPTION', 'Orders and the times between order statuses of each driver, with total vs ideal and rank.'),
    legacyName: t('DRIVER_TIME', 'Driver Time')
  }),
  12: (t) => ({
    name: t('ENTERPRISE_REPORT_12_NAME', 'Top drivers by orders'),
    description: t('ENTERPRISE_REPORT_12_DESCRIPTION', 'Drivers ranked by their number of orders.'),
    legacyName: t('TOP_DRIVERS', 'Top drivers')
  }),
  13: (t) => ({
    name: t('ENTERPRISE_REPORT_13_NAME', 'Orders over time'),
    description: t('ENTERPRISE_REPORT_13_DESCRIPTION', 'Orders per period, with the total.'),
    legacyName: t('ORDERS', 'Orders')
  }),
  14: (t) => ({
    name: t('ENTERPRISE_REPORT_14_NAME', 'Sales over time'),
    description: t('ENTERPRISE_REPORT_14_DESCRIPTION', 'Sales per period, with the total.'),
    legacyName: t('SALES', 'Sales')
  }),
  15: (t) => ({
    name: t('ENTERPRISE_REPORT_15_NAME', 'Registered users'),
    description: t('ENTERPRISE_REPORT_15_DESCRIPTION', 'New registered users per period, by channel.'),
    legacyName: t('REGISTER_USERS', 'Register users')
  }),
  16: (t) => ({
    name: t('ENTERPRISE_REPORT_16_NAME', 'Customer satisfaction'),
    description: t('ENTERPRISE_REPORT_16_DESCRIPTION', 'Customer scores for quality, delivery, service and package, with the general score.'),
    legacyName: t('CUSTOMER_SATISFACTION', 'Customer safisfaction')
  }),
  17: (t) => ({
    name: t('ENTERPRISE_REPORT_17_NAME', 'Sales by payment method'),
    description: t('ENTERPRISE_REPORT_17_DESCRIPTION', 'Orders and sales per payment method, for each period.'),
    legacyName: t('PAYMETHOD_SALES', 'Paymethod sales')
  }),
  18: (t) => ({
    name: t('ENTERPRISE_REPORT_18_NAME', 'Average ticket by site and order type'),
    description: t('ENTERPRISE_REPORT_18_DESCRIPTION', 'Orders, sales and average ticket per site and per order type, for each period.'),
    legacyName: t('AVERAGE_SALES', 'Average sales')
  }),
  19: (t) => ({
    name: t('ENTERPRISE_REPORT_19_NAME', 'Sales by brand'),
    description: t('ENTERPRISE_REPORT_19_DESCRIPTION', 'Orders, sales, average ticket and share of orders per brand, for each period.'),
    legacyName: t('GENERAL_SALES', 'General sales')
  }),
  20: (t) => ({
    name: t('ENTERPRISE_REPORT_20_NAME', 'Top products and categories'),
    description: t('ENTERPRISE_REPORT_20_DESCRIPTION', 'The best-selling products and categories, ranked by quantity sold.'),
    legacyName: t('TOP_SELLING_AND_CATEOGRY', 'Top selling and category')
  }),
  21: (t) => ({
    name: t('ENTERPRISE_REPORT_21_NAME', 'Orders by SLA status'),
    description: t('ENTERPRISE_REPORT_21_DESCRIPTION', 'Completed and cancelled orders on time, at risk or delayed.'),
    legacyName: t('SLA_ORDERS', 'SLA orders')
  }),
  // redesign (n.º 21): the keys and texts of the clicks report of the ecommerce page, which is now this one
  22: (t) => ({
    name: t('ECOMMERCE_REPORT_CLICKS_NAME', 'Clicks on stores, products and categories'),
    description: t('ECOMMERCE_REPORT_CLICKS_DESCRIPTION', 'What customers opened most in the apps and websites, in the period.'),
    legacyName: t('REAL_TIME', 'Real time')
  })
}

// redesign reports FA1 (D2): the five groups of the catalog
export const GROUP_TEXTS = {
  sales: (t) => t('ENTERPRISE_REPORTS_GROUP_SALES', 'Sales'),
  service: (t) => t('ENTERPRISE_REPORTS_GROUP_SERVICE', 'Stores and service'),
  delivery: (t) => t('ENTERPRISE_REPORTS_GROUP_DELIVERY', 'Delivery'),
  drivers: (t) => t('ENTERPRISE_REPORTS_GROUP_DRIVERS', 'Drivers'),
  customers: (t) => t('ENTERPRISE_REPORTS_GROUP_CUSTOMERS', 'Customers')
}
