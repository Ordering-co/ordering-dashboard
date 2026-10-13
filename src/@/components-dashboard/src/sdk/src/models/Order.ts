import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface OrderProps {
  id?: number
  paymethod_id?: number
  business_id?: number
  customer_id?: number
  delivery_type?: number
  delivery_datetime?: string
  service_fee?: number
  tax_type?: number
  tax?: number
  delivery_zone_price?: number
  offer?: number
  offer_type?: number
  offer_rate?: number
  discount?: number
  coupon?: string
  status?: number
  comment?: string
  driver_id?: number
  driver_tip?: number
  pay_data?: string
  refund_data?: string
  to_print?: boolean
  language_id?: number
  app_id?: string
  cash?: number
  delivery_zone_id?: number
  locked?: boolean
  order_group_id?: number
  logistic_status?: number
  created_at?: string
  updated_at?: string
  offer_id?: number
  business?: object
  products?: Array<object>
  customer?: object
  [metadata: string]: any
}

export class Order extends Model implements ModelProps {
  public id: number
  public paymethod_id: number
  public business_id: number
  public customer_id: number
  public delivery_type: number
  public delivery_datetime: string
  public service_fee: number
  public tax_type: number
  public tax: number
  public delivery_zone_price: number
  public offer: number
  public offer_type: number
  public offer_rate: number
  public discount: number
  public coupon: string
  public status: number
  public comment: string
  public driver_id: number
  public driver_tip: number
  public pay_data: string
  public refund_data: string
  public to_print: boolean
  public language_id: number
  public app_id: string
  public cash: number
  public delivery_zone_id: number
  public locked: boolean
  public order_group_id: number
  public logistic_status: number
  public created_at: string
  public updated_at: string
  public offer_id: number
  public business: object
  public products: Array<object>
  public customer: object
  [metadata: string]: any

  constructor (order: OrderProps = {}, api: TypeApi) {
    super(order, api, ['customer', 'business'])
    const excludeProps = ['total', 'subtotal']
    Object.entries(order).map(([key, value]) => {
      if (!excludeProps.includes(key)) {
        this[key] = value
      }
    })
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }

  get subtotal () {
    if (!this.products) {
      return 0
    }

    const subtotal = this.products.reduce((total: number, product: any) => {
      const totaloptions = product.options.reduce((totalOption: number, option: any) => {
        const totalSuboptions = option.suboptions.reduce((totalSuboption: number, suboption: any) => {
          const price = (suboption.position && suboption.position !== 'whole') ? suboption.half_price : suboption.price
          const quantity = (option.allow_suboption_quantity && suboption.quantity > 1) ? suboption.quantity : 1
          return totalSuboption + (price * quantity)
        }, 0)
        return totalOption + totalSuboptions
      }, 0)
      return total + ((product.price + totaloptions) * product.quantity)
    }, 0)

    return subtotal
  }

  get deliveryFee (): number {
    return (!this.delivery_type || this.delivery_type === 1) ? this.delivery_zone_price : 0
  }

  get serviceFee (): number {
    return (this.subtotal - this.discount) * (this.service_fee / 100)
  }

  get totalTax (): number {
    return (this.subtotal * this.tax) / (this.tax + 100)
  }

  get totalDriverTip (): number {
    return (this.subtotal - this.totalTax) * (this.driver_tip / 100)
  }

  get total () {
    return this.subtotal + this.serviceFee + this.deliveryFee + this.totalDriverTip + (this.tax_type === 2 ? this.totalTax : 0) - this.discount
  }

}
