import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface TranslationProps {
  id?: number
  key?: string
  text?: string
  [metadata: string]: any
}

export class Translation extends Model implements ModelProps {
  public id: number
  public key: string
  public text: string
  [metadata: string]: any

  constructor (translation: TranslationProps = {}, api: TypeApi) {
    super(translation, api)
    Object.entries(translation).map(([key, value]) => {
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
