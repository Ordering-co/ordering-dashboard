import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface CountryProps {
  id?: number
  name?: string
  enabled?: boolean
  [metadata: string]: any
}

export class Country extends Model implements ModelProps {
  public id: number
  public key: string
  public value: string
  [metadata: string]: any

  constructor (country: CountryProps = {}, api: TypeApi) {
    super(country, api)
    Object.entries(country).map(([key, value]) => {
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
