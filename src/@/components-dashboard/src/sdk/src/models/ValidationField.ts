import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface ValidationFieldProps {
  id?: number
  name?: string
  code?: string
  validate?: string
  type?: string
  required?: boolean
  enabled?: boolean
  [metadata: string]: any
}

export class ValidationField extends Model implements ModelProps {
  public id: number
  public name: string
  public code: string
  public validate: string
  public type: string
  public required: boolean
  public enabled: boolean
  [metadata: string]: any

  constructor (field: ValidationFieldProps = {}, api: TypeApi) {
    super(field, api)
    Object.entries(field).map(([key, value]) => {
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
