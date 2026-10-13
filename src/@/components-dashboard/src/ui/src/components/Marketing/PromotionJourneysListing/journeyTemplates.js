import {
  BagCheck,
  Basket,
  ClockHistory,
  Gift,
  PersonCheck,
  Repeat,
  Star,
  Truck
} from 'react-bootstrap-icons'

export const JOURNEY_TEMPLATES = [
  {
    key: 'first_order',
    objective: 'acquisition',
    title: 'First purchase',
    description: 'Welcome customers who have not placed an order yet.',
    audience: 'Customers with exactly 0 orders',
    icon: PersonCheck,
    fields: { orderCount: 0, orderCountCondition: '=', rateType: 1, limitPerUser: 1, hideLimit: true }
  },
  {
    key: 'second_order',
    objective: 'repeat',
    title: 'Second purchase',
    description: 'Give first-time buyers a reason to order again.',
    audience: 'Customers with exactly 1 order',
    icon: Repeat,
    fields: { orderCount: 1, orderCountCondition: '=', rateType: 1, limitPerUser: 1, hideLimit: true }
  },
  {
    key: 'free_delivery',
    objective: 'acquisition',
    title: 'Free delivery',
    description: 'Remove the delivery fee after a minimum purchase.',
    audience: 'Customers who meet the minimum purchase',
    icon: Truck,
    fields: { target: 2, rateType: 1, requiredRate: 100, rate: 100, hideRate: true }
  },
  {
    key: 'minimum_purchase',
    objective: 'basket',
    title: 'Minimum purchase reward',
    description: 'Encourage customers to reach a higher subtotal.',
    audience: 'Orders that meet the minimum subtotal',
    icon: Basket,
    fields: { rateType: 1 }
  },
  {
    key: 'buy_x_get_y',
    objective: 'basket',
    title: 'Buy X, get Y',
    description: 'Make items free from the same product selection used to qualify.',
    audience: 'Orders containing selected products',
    icon: Gift,
    fields: { conditionType: 2, rateType: 2, minimum: 2, rate: 1 }
  },
  {
    key: 'loyalty_reward',
    objective: 'repeat',
    title: 'Loyalty level reward',
    description: 'Offer a benefit to selected loyalty levels.',
    audience: 'Customers in selected loyalty levels',
    icon: Star,
    requiresLoyalty: true,
    fields: { rateType: 1 }
  },
  {
    key: 'slow_hours',
    objective: 'operations',
    title: 'Happy hour',
    description: 'Drive demand during selected days and hours.',
    audience: 'Orders placed during the configured schedule',
    icon: ClockHistory,
    requiresSchedule: true,
    fields: { rateType: 1 }
  },
  {
    key: 'winback',
    objective: 'repeat',
    title: 'We miss you',
    description: 'Reward customers after a period without ordering.',
    audience: 'Customers inactive for the configured number of days',
    icon: BagCheck,
    requiresInactivity: true,
    fields: { orderCount: 0, orderCountCondition: '>', rateType: 1 }
  }
]

export const getJourneyTemplate = (key) => JOURNEY_TEMPLATES.find(template => template.key === key)
