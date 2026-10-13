import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface OrderOptionProps {
  id?: number
  user_id?: number
  address_id?: number
  type?: number
  moment?: string
  created_at?: string
  updated_at?: string
  [metadata: string]: any
}

export class OrderOption extends Model implements ModelProps {
  public id: number
  public user_id: number
  public address_id: number
  public type: number
  public moment: string
  public created_at: string
  public updated_at: string
  [metadata: string]: any

  constructor (orderOption: OrderOptionProps = {}, api: TypeApi = null) {
    super(orderOption, api)
    Object.entries(orderOption).map(([key, value]) => {
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
