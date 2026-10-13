import { ApiResponse } from './ApiResponse'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { Ordering } from './Ordering'

export interface ApiBaseInterface {
  setModelId(id: number): void
  get(options?: RequestOptionsProps): Promise<ApiResponse>
  save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse>
  delete(options?: RequestOptionsProps): Promise<ApiResponse>
}

interface SubconditionInterface {
  condition: string,
  value: string | boolean | number | number[] | string[]
}

export interface ConditionInterface {
  attribute: string
  value: string | boolean | number | number[] | string[] | SubconditionInterface
}

export class ApiBase {
  public ordering: Ordering
  public attributes: string[] = []
  public conditions: any
  public query: any = {}
  public mode: string

  constructor (ordering: Ordering) {
    this.ordering = ordering
  }

  /**
   * Select the attributes to get from Ordering API
   * @param attributes List of attributes
   */
  public select (attributes: string[]) {
    this.attributes = attributes
    return this
  }

  /**
   * Conditions to get from Ordering API
   * @param conditions List of conditions
   */
  public where (conditions: any) {
    this.conditions = conditions
    return this
  }

  /**
   * Change request mode
   * @param mode Request mode
   */
  public setMode (mode: string) {
    this.mode = mode
    return this
  }

  /**
   * Change request mode to dashboard
   */
  public asDashboard () {
    this.setMode('dashboard')
    return this
  }

  /**
   * Change request mode to dashboard
   */
  public asDictionary () {
    this.setMode('dictionary')
    return this
  }

  /**
   * Change request mode to dashboard
   */
  public parameters (parameters: any) {
    this.query = Object.assign(this.query, parameters)
    return this
  }

  /**
   * Make request by options
   * @param method HTTP method
   */
  public async makeRequest (method: string, url: string, data: any, model: any, options: RequestOptionsProps) {
    const _options = Object.assign({ CastClass: model, json: true, api: this }, options)
    if (method === 'GET') {
      _options.attributes = this.attributes
      _options.conditions = this.conditions
      _options.mode = this.mode

      if (!_options.query) {
        _options.query = {}
      }

      Object.assign(_options.query, this.query)

      if (data) {
        for (const key in data) {
          _options.query[key] = data[key]
        }
      }
    }
    switch (method) {
      case 'GET':
        return await this.ordering.get(url, _options)
      case 'POST':
        return await this.ordering.post(url, data, _options)
      case 'PUT':
        return await this.ordering.put(url, data, _options)
      case 'DELETE':
        return await this.ordering.delete(url, _options)
      default:
        throw Error(`The \`${method}\` methos is not supported.`)
    }
  }
}
