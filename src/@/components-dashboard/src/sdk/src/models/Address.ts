import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface AddressProps {
  id?: number
  user_id?: number
  name?: string
  middle_name?: string
  lastname?: string
  second_lastname?: string
  address?: string
  address_notes?: string
  internal_number?: string
  phone?: string
  cellphone?: string
  zipcode?: string
  location?: object
  tag?: string
  map_data?: object
  default?: boolean
  [metadata: string]: any
}

export class Address extends Model implements ModelProps {
  public id: number
  public user_id: number
  public name: string
  public middle_name: string
  public lastname: string
  public second_lastname: string
  public address: string
  public address_notes: string
  public internal_number: string
  public phone: string
  public cellphone: string
  public zipcode: string
  public location: object
  public tag: string
  public map_data: object
  public default: boolean
  [metadata: string]: any

  // Use name 'address' because has 'default' attribute and is a javascript keyword
  constructor (address: AddressProps = {}, api: TypeApi) {
    super(address, api, [])
    Object.entries(address).map(([key, value]) => {
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
