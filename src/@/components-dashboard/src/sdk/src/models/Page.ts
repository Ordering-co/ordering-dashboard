import { Model, ModelProps } from './Model'
import { TypeApi } from '../types'

export interface PageProps {
  id?: number
  name?: string
  slug?: string
  body?: string
  enabled?: boolean
  author_id?: number
  updated_at?: Date
  created_at?: Date
  [metadata: string]: any
}

export class Page extends Model implements ModelProps {
  public id: number
  public name: string
  public slug: string
  public body: string
  public enabled: boolean
  public author_id: number
  public updated_at: Date
  public created_at: Date
  [metadata: string]: any

  constructor (config: PageProps = {}, api: TypeApi) {
    super(config, api, ['created_at', 'updated_at'])
    Object.entries(config).map(([key, value]) => {
      this[key] = value
      if (['updated_at', 'created_at'].includes(key)) {
        this[key] = new Date(value)
      }
    })
  }

  /**
   * Get indentifier of model
   */
  getId () {
    return this.id
  }
}
