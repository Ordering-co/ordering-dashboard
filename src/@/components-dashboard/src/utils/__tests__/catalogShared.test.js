// (bugs H, lane 4): wrong translations in the shared catalog keys (#44), «controlador» for drivers,
// «órdenes» (W0-D-01) and the month and day words dayjs paints from MONTHn / DAYn (W0-F-01).
// The repo catalog is the source the final i18n:sync:live sends to the API.
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import catalog from '../../../../../../i18n/translations.json'

const LOCALES = ['ar', 'bg', 'da', 'de', 'el', 'es', 'fr', 'it', 'nl', 'pt', 'tr']
const DRIVER_KEYS = Object.entries(catalog).filter(([, v]) => /driver/i.test(v.en)).map(([k]) => k)
const AR_SOFTWARE_DRIVER = /برنامج التشغيل|برامج التشغيل|برامج تشغيل|مجموعات التشغيل/

describe('drivers are repartidores / سائقين, not software drivers', () => {
  it('has driver keys to check', () => {
    expect(DRIVER_KEYS.length).toBeGreaterThan(100)
  })

  it.each(DRIVER_KEYS)('%s has no «controlador» in es and no software driver in ar', (key) => {
    expect(catalog[key].es).not.toMatch(/controlador/i)
    expect(catalog[key].ar).not.toMatch(AR_SOFTWARE_DRIVER)
  })

  it.each([
    ['ADD_DRIVER', 'es', 'Agregar repartidor'],
    ['ADD_DRIVER_GROUP', 'es', 'Agregar grupo de repartidores'],
    ['DRIVERS_LOADING', 'es', 'Cargando repartidores'],
    ['REJECT_REASON_UNAVAILABLE_DRIVER', 'es', 'Repartidor no disponible'],
    ['WITHOUT_ONLINE_DRIVERS', 'es', 'sin repartidores en línea'],
    ['NO_DRIVERS_AVAILABLE_FOR_ORDER', 'es', 'No hay repartidores disponibles para el pedido'],
    ['DRIVERS_LOADING', 'ar', 'تحميل السائقين'],
    ['SELECT_DRIVERS', 'ar', 'حدد السائقين'],
    ['REMOVE_DRIVER', 'ar', 'إزالة السائق المعين'],
    ['NO_DRIVERS_AVAILABLE_FOR_ORDER', 'ar', 'لا يوجد سائقون متاحون للطلب']
  ])('%s in %s reads «%s»', (key, locale, value) => {
    expect(catalog[key][locale]).toBe(value)
  })

  it('keeps the placeholders and tags of the log lines', () => {
    expect(catalog.LOG_LOGISTIC_DRIVER_FOUND.es).toBe('<strong>Logística:</strong> Repartidor _driver_ encontrado en _distance_.')
    expect(catalog.LOG_LOGISTIC_DRIVER_FOUND.ar).toContain('السائق _driver_ في _distance_')
    expect(catalog.LOG_LOGISTIC_DRIVER_FOUND_IN_COVERAGE.ar).toContain('<strong>_driver_</strong>')
    expect(catalog.LOG_LOGISTIC_DRIVER_COMPANY_WAITING_FOR_DRIVERS.ar).toBe('في انتظار سائقي <b>_driver_company_</b>.')
  })
})

describe('orders are pedidos in es (W0-D-01)', () => {
  it('ORDERS_COUNT says pedidos, like ORDERS_COUNT_ONE', () => {
    expect(catalog.ORDERS_COUNT.es).toBe('_count_ pedidos')
    expect(catalog.ORDERS_COUNT_ONE.es).toBe('1 pedido')
    expect(catalog.ORDERS_COUNT.es).not.toMatch(/órdenes/i)
  })

  // (bugs H, W2-5): the catalog term for an order is «pedido» (ORDER, ORDERS, ORDERS_EMPTY_NONE…). «orden» as
  // a purchase order is the same defect as «órdenes»; «orden» as sequence or tidiness is Spanish and stays.
  const ORDER_WORD = /(^|[^\p{L}])[óo]rdenes?(?![\p{L}])|pre-?[óo]rdenes?|pre orden/iu
  const KEPT_AS_SORT_ORDER = [
    'HOME_ATTENTION_ALL_CLEAR', // «Todo en orden»: all is in order
    'IMPORTER_INSTRUCTIONS_4_CONTENT', // the order of the CSV columns
    'IMPORTER_INSTRUCTIONS_5_CONTENT' // the order of the CSV fields
  ]

  it('no es value says «orden/órdenes» for an order, apart from the sort-order sentences kept', () => {
    const offenders = Object.entries(catalog)
      .filter(([key, v]) => ORDER_WORD.test(v.es || '') && !KEPT_AS_SORT_ORDER.includes(key))
      .map(([key]) => key)
    expect(offenders).toEqual([])
  })

  it('the sentences kept talk about sequence or tidiness, not about a purchase order', () => {
    expect(catalog.HOME_ATTENTION_ALL_CLEAR.en).toBe('All clear: nothing is waiting for you.')
    expect(catalog.IMPORTER_INSTRUCTIONS_4_CONTENT.en).toMatch(/same order/)
    expect(catalog.IMPORTER_INSTRUCTIONS_5_CONTENT.en).toMatch(/fields and order of your CSV/)
  })

  it.each([
    ['CSV_ORDERS', 'Pedidos csv'],
    ['GROUP_ORDERS', 'Pedidos grupales'],
    ['ORDERS_LOAD_ERROR_TITLE', 'No pudimos cargar los pedidos'],
    ['ORDERS_SELECTION_ACTIONS', 'Acciones para los pedidos seleccionados'],
    ['ORDER_DELETED', 'Pedido eliminado'],
    ['ORDER_TYPE', 'Tipo de pedido'],
    ['CUSTOM_ORDER', 'Pedido personalizado']
  ])('%s in es reads «%s»', (key, value) => {
    expect(catalog[key].es).toBe(value)
  })
})

describe('the empty-tab and export keys of Orders are in the catalog in every locale (bugs H)', () => {
  const NEW_KEYS = ['ORDERS_EMPTY_PENDING', 'ORDERS_EMPTY_IN_PROGRESS', 'ORDERS_EMPTY_COMPLETED', 'ORDERS_EMPTY_CANCELLED', 'EXPORT_FAILED_CODE', 'EXPORT_SCOPE_ALL_PROJECT']

  it.each(NEW_KEYS)('%s has a text in en and in the 11 locales', (key) => {
    expect(catalog[key]).toBeDefined()
    ;['en', ...LOCALES].forEach(l => expect((catalog[key][l] || '').trim()).not.toBe(''))
  })

  it('EXPORT_FAILED_CODE keeps the _code_ placeholder in every locale', () => {
    ;['en', ...LOCALES].forEach(l => expect(catalog.EXPORT_FAILED_CODE[l]).toContain('_code_'))
  })

  it('the export copy says what the owner asked', () => {
    expect(catalog.EXPORT_SCOPE_ALL_PROJECT.es).toBe('Todos los pedidos del proyecto, sin acotar por la pestaña ni por los filtros en pantalla.')
    expect(catalog.EXPORT_FAILED_CODE.es).toBe('No se pudo exportar (error _code_)')
  })

  it('the key scanner sees the four empty-tab keys (a table of [KEY, text] pairs hid them)', () => {
    const { scanKeys } = createRequire(import.meta.url)('../../../../../../i18n/scanKeys.cjs')
    const found = new Set(scanKeys().rows.map(row => row.key))
    ;['ORDERS_EMPTY_PENDING', 'ORDERS_EMPTY_IN_PROGRESS', 'ORDERS_EMPTY_COMPLETED', 'ORDERS_EMPTY_CANCELLED'].forEach(key => expect(found.has(key)).toBe(true))
  })
})

describe('drivers are not software drivers in de, bg, fr, el and nl (follow-up)', () => {
  const SOFTWARE_DRIVER = {
    de: /treiber/i,
    bg: /драйвер/i,
    fr: /pilote/i,
    el: /προγράμματ\S*\s+οδήγησ/i,
    nl: /stuurprogramma/i
  }

  it.each(Object.keys(SOFTWARE_DRIVER))('no %s value uses the software word for a delivery driver', (locale) => {
    const offenders = Object.entries(catalog)
      .filter(([, v]) => SOFTWARE_DRIVER[locale].test(v[locale] || ''))
      .map(([key]) => key)
    expect(offenders).toEqual([])
  })

  it.each([
    ['DRIVERS', 'de', 'Fahrer'],
    ['ADD_DRIVER', 'de', 'Fahrer hinzufügen'],
    ['DRIVER_GROUP_UPDATED', 'de', 'Fahrergruppe aktualisiert'],
    ['DRIVERS', 'fr', 'Livreurs'],
    ['ADD_DRIVER', 'fr', 'Ajouter un livreur'],
    ['REJECT_REASON_UNAVAILABLE_DRIVER', 'fr', 'Livreur indisponible'],
    ['DRIVERS_LOADING', 'nl', 'Bezorgers worden geladen'],
    ['ADD_DRIVER', 'el', 'Προσθήκη οδηγού'],
    ['DRIVERS_LOADING', 'bg', 'Зареждане на шофьори']
  ])('%s in %s reads «%s»', (key, locale, value) => {
    expect(catalog[key][locale]).toBe(value)
  })

  it('keeps the placeholders and tags of the log lines', () => {
    expect(catalog.LOG_LOGISTIC_DRIVER_FOUND.fr).toMatch(/^<strong>Logistique\s:<\/strong> Livreur _driver_ trouvé à _distance_\.$/)
    expect(catalog.LOG_LOGISTIC_DRIVER_COMPANY_WAITING_FOR_DRIVERS.de).toContain('<b>_driver_company_</b>')
    expect(catalog.LOG_LOGISTIC_DRIVER_COMPANY_WAITING_FOR_DRIVERS.el).toContain('<b>_driver_company_</b>')
    expect(catalog.LOG_LOGISTIC_DRIVER_FOUND_IN_COVERAGE.el).toContain('<strong>_driver_</strong>')
  })
})

describe('month and day words that dayjs paints (W0-F-01)', () => {
  const MARCH = { ar: 'مارس', bg: 'март', da: 'marts', de: 'März', el: 'Μάρτιος', es: 'Marzo', fr: 'Mars', it: 'Marzo', nl: 'Maart', pt: 'Março', tr: 'Mart' }
  const MAY = { ar: 'مايو', bg: 'май', da: 'maj', de: 'Mai', el: 'Μάιος', es: 'Mayo', fr: 'Mai', it: 'Maggio', nl: 'Mei', pt: 'Maio', tr: 'Mayıs' }

  it.each(LOCALES)('MONTH3 is March in %s', (locale) => {
    expect(catalog.MONTH3[locale]).toBe(MARCH[locale])
  })

  it.each(LOCALES)('MONTH5 is May in %s', (locale) => {
    expect(catalog.MONTH5[locale]).toBe(MAY[locale])
  })

  it('no month is a common word instead of its name', () => {
    const WRONG = /^(puede|peut|poderia|kunnen|يمكن|marsch|marchar|يمشي|πορεία)$/i
    const offenders = []
    for (let i = 1; i <= 12; i++) LOCALES.forEach(l => WRONG.test(catalog[`MONTH${i}`][l]) && offenders.push(`MONTH${i}.${l}`))
    expect(offenders).toEqual([])
  })

  it.each([
    ['DAY1', 'it', 'Lunedì'],
    ['DAY2', 'ar', 'الثلاثاء'],
    ['DAY4', 'ar', 'الخميس'],
    ['DAY5', 'ar', 'الجمعة']
  ])('%s in %s is the weekday name «%s»', (key, locale, value) => {
    expect(catalog[key][locale]).toBe(value)
  })
})

describe('shared keys with wrong translations (#44)', () => {
  it.each([
    ['CONNECT_CLOVER', 'es', 'Conectar Clover'],
    ['CONNECT_CLOVER', 'fr', 'Connecter Clover'],
    ['CONNECT_CLOVER', 'de', 'Clover verbinden'],
    ['CONNECT_CLOVER', 'tr', 'Clover’ı bağlayın'],
    ['OWNER_ID', 'es', 'Propietario'],
    ['AGENTS', 'bg', 'Агенти'],
    ['STORE', 'de', 'Geschäft'],
    ['IMPORTER_MODAL_BUSINESS_LABEL', 'de', 'Geschäft'],
    ['NAME', 'el', 'Όνομα'],
    ['GENERAL', 'bg', 'Общи'],
    ['GENERAL', 'el', 'Γενικά'],
    ['GENERAL', 'pt', 'Geral'],
    ['GENERAL', 'da', 'Generelt'],
    ['CANCEL', 'de', 'Abbrechen'],
    ['SUPPORT', 'bg', 'Поддръжка'],
    ['DAY', 'es', 'Día'],
    ['DAY', 'da', 'Dag'],
    ['DAY', 'bg', 'Ден'],
    ['WEEK', 'da', 'Uge'],
    ['WEEK', 'bg', 'Седмица'],
    ['MONTH', 'bg', 'Месец'],
    ['DAYS', 'es', 'días'],
    ['APPOINTMENTS', 'da', 'Aftaler'],
    ['APPOINTMENTS', 'bg', 'Срещи'],
    ['ADDON_APPOINTMENTS', 'da', 'Aftaler'],
    ['ADDON_APPOINTMENTS_DESCRIPTION', 'bg', 'Срещи'],
    ['ADDON_APPOINTMENTS_FULL_DESCRIPTION', 'da', 'Aftaler'],
    ['APPOINTMENT', 'da', 'Aftale'],
    ['APPOINTMENT', 'bg', 'Среща']
  ])('%s in %s is «%s»', (key, locale, value) => {
    expect(catalog[key][locale]).toBe(value)
  })

  it.each(['ID', 'INVOICE_ID'])('%s is «ID» in de, es, fr, nl and tr, not an identity card', (key) => {
    ;['de', 'es', 'fr', 'nl', 'tr'].forEach(l => expect(catalog[key][l]).toBe('ID'))
  })

  it.each(LOCALES)('Clover is a brand, not a plant, in %s', (locale) => {
    expect(catalog.CLOVER[locale]).toBe('Clover')
    expect(catalog.CLOVER_POS[locale]).toContain('Clover')
    expect(catalog.CONNECT_CLOVER[locale]).toContain('Clover')
  })

  it.each(Object.entries(catalog).filter(([, v]) => /stripe/i.test(v.en)).map(([k]) => k))(
    '%s keeps the brand Stripe in every locale', (key) => {
      LOCALES.forEach(l => expect(catalog[key][l]).toContain('Stripe'))
    }
  )
})

// bugs H review R-5: meanings that were still wrong in keys this batch touched
describe('bugs H review R-5', () => {
  it.each([
    ['DRIVER_STORE_STATUS', 'de', /speicher/i],
    ['LEARN_IMPORT_ORDERS', 'es', /de importación/],
    ['AUTO_ASSIGN_GROUP_ORDERS_TO_DRIVERS', 'ar', /ترتيب/],
    ['AUTO_ASSIGN_GROUP_ORDERS_TO_DRIVERS', 'fr', /l'ordre/],
    ['AUTO_ASSIGN_GROUP_ORDERS_TO_DRIVERS', 'bg', /реда/]
  ])('%s in %s does not read %s', (key, locale, wrong) => {
    expect(catalog[key][locale]).not.toMatch(wrong)
  })
})
