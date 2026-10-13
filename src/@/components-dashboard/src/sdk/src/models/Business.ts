import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface BusinessProps {
  id?: number
  name?: string
  email?: string
  slug?: string
  schedule?: any
  description?: string
  about?: string
  logo?: string
  header?: string
  phone?: string
  cellphone?: string
  owner_id?: number
  city_id?: number
  address?: string
  address_notes?: string
  zipcode?: string
  location?: any
  featured?: boolean
  timezone?: string
  currency?: string
  food?: boolean
  alcohol?: boolean
  groceries?: boolean
  laundry?: boolean
  use_printer?: boolean
  printer_id?: number
  minimum?: number
  delivery_price?: number
  always_deliver?: boolean
  tax_type?: number
  tax?: number
  delivery_time?: string
  pickup_time?: string
  service_fee?: number
  fixed_usage_fee?: number
  percentage_usage_fee?: number
  enabled?: boolean
  open?: boolean
  lazy_load_products_recommended?: boolean
  distance?: number
  valid_service?: boolean
  [metadata: string]: any
}

export class Business extends Model implements ModelProps {
  public id?: number
  public name?: string
  public email?: string
  public slug?: string
  public schedule?: any
  public description?: string
  public about?: string
  public logo?: string
  public header?: string
  public phone?: string
  public cellphone?: string
  public owner_id?: number
  public city_id?: number
  public address?: string
  public address_notes?: string
  public zipcode?: string
  public location?: any
  public featured?: boolean
  public timezone?: string
  public currency?: string
  public food?: boolean
  public alcohol?: boolean
  public groceries?: boolean
  public laundry?: boolean
  public use_printer?: boolean
  public printer_id?: number
  public minimum?: number
  public delivery_price?: number
  public always_deliver?: boolean
  public tax_type?: number
  public tax?: number
  public delivery_time?: string
  public pickup_time?: string
  public service_fee?: number
  public fixed_usage_fee?: number
  public percentage_usage_fee?: number
  public enabled?: boolean
  public open?: boolean
  public lazy_load_products_recommended?: boolean
  public distance?: number
  public valid_service: boolean
  [metadata: string]: any

  constructor (business: BusinessProps = {}, api: TypeApi) {
    super(business, api, [])
    Object.entries(business).map(([key, value]) => {
      this[key] = value
    })
  }

  /**
   * Get indentifier of model
   */
  getId (): number {
    return this.id || 0
  }
}
