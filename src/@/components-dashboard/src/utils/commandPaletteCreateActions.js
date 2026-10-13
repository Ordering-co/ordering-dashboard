/**
 * "Create" entries of the command palette (full coverage). Pure.
 *
 * Each one opens an empty add form through the page's own one-shot query
 * (`?add=`, `?template=`, `?setup=`, read by `useOpenFromQuery`). Nothing is
 * saved until the person submits the form. Every entry follows the rule of
 * the button it stands for; the page re-checks it before opening.
 */

const CREATE_ACTIONS = [
  { key: 'custom_order', url: '/orders', query: { add: 'custom_order' }, labelKey: 'CREATE_CUSTOM_ORDER', label: 'Create custom order', aliases: ['crear orden', 'nueva orden', 'orden manual', 'pedido manual', 'new order'], when: ({ level, isReadOnly }) => level === 0 && !isReadOnly },
  { key: 'customer', url: '/users/customers', query: { add: '1' }, labelKey: 'ADD_USER', label: 'Add user', parentKey: 'CUSTOMERS', parent: 'Customers', aliases: ['crear cliente', 'nuevo cliente', 'agregar cliente', 'new customer'] },
  { key: 'business_owner', url: '/users/business-owners', query: { add: '1' }, labelKey: 'ADD_USER', label: 'Add user', parentKey: 'BUSINESS_OWNERS', parent: 'Business Owners', aliases: ['crear dueno', 'nuevo propietario', 'new owner'] },
  { key: 'callcenter_agent', url: '/users/callcenter-agents', query: { add: '1' }, labelKey: 'ADD_USER', label: 'Add user', parentKey: 'CALL_CENTER_AGENTS', parent: 'Call Center Agents', aliases: ['crear agente', 'nuevo agente'] },
  { key: 'admin', url: '/users/admins', query: { add: '1' }, labelKey: 'ADD_USER', label: 'Add user', parentKey: 'ADMINS', parent: 'Admins', aliases: ['crear administrador', 'nuevo admin', 'invitar admin'] },
  { key: 'professional', url: '/users/professionals', query: { add: '1' }, labelKey: 'ADD_PROFESSIONAL', label: 'Add professional', aliases: ['crear profesional', 'nuevo profesional'] },
  { key: 'driver', url: '/delivery/drivers-list', query: { add: '1' }, labelKey: 'ADD_DRIVER', label: 'Add driver', aliases: ['crear repartidor', 'nuevo repartidor', 'nuevo conductor', 'new driver'] },
  { key: 'driver_manager', url: '/delivery/drivers-managers', query: { add: '1' }, labelKey: 'ADD_DRIVER_MANAGER', label: 'Add driver manager', aliases: ['crear gerente de repartidores'] },
  { key: 'driver_group', url: '/delivery/drivers-groups', query: { add: '1' }, labelKey: 'ADD_DRIVER_GROUP', label: 'Add driver group', aliases: ['crear grupo de repartidores', 'nuevo grupo de entrega'] },
  { key: 'driver_company', url: '/delivery/drivers-companies', query: { add: '1' }, labelKey: 'ADD_DRIVER_COMPANY', label: 'Add driver company', aliases: ['crear empresa de reparto', 'nueva empresa de entrega'] },
  { key: 'recovery_action', url: '/cart-recovery/recovery-actions', query: { add: '1' }, labelKey: 'ADD_RECOVERY_ACTION', label: 'Add recovery action', aliases: ['crear regla de recuperacion', 'carrito abandonado', 'recuperar carritos'] },
  { key: 'campaign', url: '/marketing/campaign', query: { add: '1' }, labelKey: 'ADD_CAMPAIGN', label: 'Add Campaign', aliases: ['crear campana', 'nueva campana', 'enviar email', 'enviar sms', 'notificacion push'] },
  { key: 'promotion', url: '/marketing/promotions-enterprise', query: { view: 'advanced_offers', add: '1' }, labelKey: 'COMMAND_PALETTE_ADD_PROMOTION', label: 'Add promotion', aliases: ['crear promocion', 'nuevo cupon', 'crear descuento', 'new coupon'] },
  { key: 'builder_app', url: '/builder', query: { add: '1' }, labelKey: 'BUILDER_CREATE_APP', label: 'Create app', parentKey: 'BUILDER', parent: 'Builder', aliases: ['crear app', 'nueva app', 'nueva aplicacion', 'crear aplicacion', 'new app'] },
  { key: 'markup', url: '/stores/markups', query: { add: '1' }, labelKey: 'ADD_MARKUP', label: 'Add markup', aliases: ['crear recargo', 'nuevo margen'] },
  { key: 'gift_cards_setup', url: '/gift-cards', query: { setup: '1' }, labelKey: 'SETUP_GIFT_CARDS', label: 'Setup Gift Cards', aliases: ['configurar tarjetas de regalo', 'crear tarjeta de regalo', 'gift card'] }
]

const QUICK_OFFERS = [
  { key: 'first_order', labelKey: 'QUICK_OFFER_FIRST_PURCHASE', label: 'First purchase', aliases: ['primera compra', 'bienvenida', 'nuevos clientes'] },
  { key: 'second_order', labelKey: 'QUICK_OFFER_SECOND_PURCHASE', label: 'Second purchase', aliases: ['segunda compra', 'recompra'] },
  { key: 'free_delivery', labelKey: 'QUICK_OFFER_FREE_DELIVERY', label: 'Free delivery', aliases: ['envio gratis', 'delivery gratis'] },
  { key: 'minimum_purchase', labelKey: 'QUICK_OFFER_MINIMUM_PURCHASE', label: 'Minimum purchase reward', aliases: ['compra minima', 'descuento por monto'] },
  { key: 'buy_x_get_y', labelKey: 'QUICK_OFFER_BUY_X_GET_Y', label: 'Buy X, get Y', aliases: ['2x1', 'compra y lleva', 'bogo'] },
  { key: 'loyalty_reward', labelKey: 'QUICK_OFFER_LOYALTY_REWARD', label: 'Loyalty level reward', aliases: ['recompensa de lealtad', 'nivel de lealtad'] },
  { key: 'slow_hours', labelKey: 'QUICK_OFFER_HAPPY_HOUR', label: 'Happy hour', aliases: ['hora feliz', 'horas bajas'] },
  { key: 'winback', labelKey: 'QUICK_OFFER_WE_MISS_YOU', label: 'We miss you', aliases: ['te extranamos', 'clientes inactivos', 'reactivar clientes'] }
]

const withQuery = (path, params) => `${path}?${new URLSearchParams(params).toString()}`

/**
 * `can(url)`: the user sees and can open that page (sidebar rule + guard).
 */
export const buildCreateActionEntries = ({ t = (_key, fallback) => fallback, can = () => false, user, configs = {} } = {}) => {
  const level = user?.level
  const isReadOnly = !!(user?.readOnlyAdmin || user?.readOnlyDeliveryManager || user?.readOnlyBusinessOwner || user?.viewOnlyBusinessOwner)
  const context = { level, isReadOnly, configs }
  const entries = []
  // Read-only roles never get a create form
  if (isReadOnly) return entries

  CREATE_ACTIONS
    .filter(action => can(action.url) && (!action.when || action.when(context)))
    .forEach(action => entries.push({
      id: `create:${action.key}`,
      group: 'actions',
      title: t(action.labelKey, action.label),
      subtitle: action.parentKey ? t(action.parentKey, action.parent) : undefined,
      path: withQuery(action.url, action.query),
      aliases: [...action.aliases, 'crear', 'nuevo', 'agregar', 'create', 'add', 'new'],
      icon: 'create'
    }))

  if (can('/marketing/promotions-enterprise')) {
    const quickOffersLabel = t('QUICK_OFFERS', 'Quick offers')
    QUICK_OFFERS
      .filter(offer => !offer.when || offer.when(context))
      .forEach(offer => entries.push({
        id: `create:quick-offer-${offer.key}`,
        group: 'actions',
        title: t(offer.labelKey, offer.label),
        subtitle: quickOffersLabel,
        path: withQuery('/marketing/promotions-enterprise', { view: 'journeys', template: offer.key }),
        aliases: [...offer.aliases, 'oferta rapida', 'quick offer', 'promocion'],
        icon: 'marketing'
      }))
  }

  return entries
}
