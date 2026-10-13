import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface ConfigProps {
  id?: number
  key?: string
  value?: string
  [metadata: string]: any
}

export class Config extends Model implements ModelProps {
  public id: number
  public key: string
  public value: string
  [metadata: string]: any

  constructor (config: ConfigProps = {}, api: TypeApi) {
    super(config, api)
    Object.entries(config).map(([key, value]) => {
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
