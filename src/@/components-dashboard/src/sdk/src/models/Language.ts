import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface LanguageProps {
  id?: number
  name?: string
  code?: string
  default?: boolean
  enabled?: boolean
  rtl?: boolean
  [metadata: string]: any
}

export class Language extends Model implements ModelProps {
  public id: number
  public name: string
  public code: string
  public default: boolean
  public enabled: boolean
  public rtl: boolean
  [metadata: string]: any

  // Use name 'language' because has 'default' attribute and is a javascript keyword
  constructor (language: LanguageProps = {}, api: TypeApi) {
    super(language, api)
    Object.entries(language).map(([key, value]) => {
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
