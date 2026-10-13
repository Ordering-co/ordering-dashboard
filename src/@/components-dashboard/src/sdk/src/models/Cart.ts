import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface CartProps {
  id?: number
  uuid?: string
  status?: number
  business_id?: number
  user_id?: number
  offer_id?: number
  driver_tip_rate?: number
  paymethod_id?: number
  pay_reference?: any
  paymethod_data?: any
  delivery_zone_id?: number
  address_id?: number
  address?: any
  order_type?: number
  moment?: string
  order_id?: number
  created_at?: string
  updated_at?: string
  [metadata: string]: any
}

export class Cart extends Model implements ModelProps {
  public id: number
  public uuid: string
  public status: number
  public business_id: number
  public user_id: number
  public offer_id: number
  public driver_tip_rate: number
  public paymethod_id: number
  public pay_reference: any
  public paymethod_data: any
  public delivery_zone_id: number
  public address_id: number
  public address: any
  public order_type: number
  public moment: string
  public order_id: number
  public created_at: string
  public updated_at: string
  [metadata: string]: any

  constructor (cart: CartProps = {}, api: TypeApi | null = null) {
    super(cart, api)
    Object.entries(cart).map(([key, value]) => {
      this[key] = value
    })
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
