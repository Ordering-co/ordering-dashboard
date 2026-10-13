import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'
import { Product } from './Product'

export interface MenuProps {
  id?: number
  business_id?: number
  name?: string
  comment?: string
  schedule?: string
  pickup?: boolean
  delivery?: boolean
  enabled?: boolean
  eatin?: boolean
  products?: Product[]
  [metadata: string]: any
}

export class Menu extends Model implements ModelProps {
  public id: number
  public business_id: number
  public name: string
  public comment: string
  public schedule: string
  public pickup: boolean
  public delivery: boolean
  public enabled: boolean
  public eatin: boolean
  public products: Product[]
  [metadata: string]: any

  constructor (menu: MenuProps = {}, api: TypeApi = null) {
    super(menu, api, ['products'])
    Object.entries(menu).map(([key, value]) => {
      this[key] = value
    })
    this.products = this.products?.map(product => new Product(product))
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
