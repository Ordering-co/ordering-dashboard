import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface OrderMessageProps {
  id?: number
  order_id?: number
  author_id?: number
  type?: number
  change?: any
  source?: string
  comment?: string
  driver_id?: number
  ip?: string
  can_see?: string
  location?: any
  user_agent?: string
  app_id?: string
  created_at?: string
  updated_at?: string
  [metadata: string]: any
}

export class OrderMessage extends Model implements ModelProps {
  public id: number
  public order_id: number
  public author_id: number
  public type: number
  public change: any
  public source: string
  public comment: string
  public driver_id: number
  public ip: string
  public can_see: string
  public location: any
  public user_agent: string
  public app_id: string
  public created_at: string
  public updated_at: string
  [metadata: string]: any

  constructor (orderMessage: OrderMessageProps = {}, api: TypeApi = null) {
    super(orderMessage, api)
    Object.entries(orderMessage).map(([key, value]) => {
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
