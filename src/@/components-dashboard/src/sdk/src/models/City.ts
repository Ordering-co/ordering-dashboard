import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface CityProps {
  id?: number
  name?: string
  country_id?: number
  administrator_id?: number
  enabled?: boolean
  [metadata: string]: any
}

export class City extends Model implements ModelProps {
  public id: number
  public key: string
  public value: string
  [metadata: string]: any

  constructor (city: CityProps = {}, api: TypeApi) {
    super(city, api)
    Object.entries(city).map(([key, value]) => {
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
