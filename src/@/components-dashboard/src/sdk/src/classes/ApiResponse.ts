import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { Pagination } from './Pagination'
import { TypeApi } from '../types'

interface ResponseProps {
  error?: boolean
  result?: string | object | object[]
  pagination?: object
}

export class ApiResponse {
  private response: any
  private options: RequestOptionsProps
  private api: TypeApi | undefined
  constructor (response: any, options: RequestOptionsProps = {}, api: TypeApi | undefined = undefined) {
    this.response = response
    this.options = options
    this.api = api
  }

  get content () {
    if (this.options.json) {
      const json = this.response.data
      if (this.response.status === 200) {
        if (json.pagination) {
          json.pagination = new Pagination(json.pagination)
        }
        if (this.options.CastClass) {
          if (json.result === null) {
            json.result = null
          } else if (Array.isArray(json.result)) {
            json.result = json.result.map((model: any) => {
              return new this.options.CastClass(model, this.api)
            })
          } else if (typeof json === 'object') {
            if (this.options.mode === 'dictionary') {
              for (const key in json.result) {
                if (typeof json.result[key] === 'object') {
                  json.result[key] = new this.options.CastClass(json.result[key], this.api)
                }
              }
            } else {
              json.result = new this.options.CastClass(json.result, this.api)
            }
          }
        }
      }
      return json
    }
    return this.response.data
  }

  get status (): number {
    return this.response.status
  }
}
