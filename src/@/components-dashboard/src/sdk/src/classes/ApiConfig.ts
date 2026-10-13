import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { Config, ConfigProps } from '../models/Config'
import { ApiBase, ApiBaseInterface } from './ApiBase'

/**
 * Class to configs api control
 */
export class ApiConfig extends ApiBase implements ApiBaseInterface {
  private configId: number | null

  constructor (ordering: Ordering, configId: number | null) {
    super(ordering)
    this.configId = configId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.configId = id
  }

  /**
   * Get a config if configId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.configId && this.conditions) {
      throw new Error('The `where` function is not compatible with configs(configId). Example ordering.configs().where(contitions).get()')
    }
    const url = '/configs' + (this.configId ? `/${this.configId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Config, options)
    return response
  }

  /**
   * Update a config if configId is set else create config
   * @param {ConfigProps} config Attributes to create or update config
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (config: ConfigProps, options: RequestOptionsProps = {}) {
    const url = '/configs' + (this.configId ? `/${this.configId}` : '')
    const response: ApiResponse = await this.makeRequest(this.configId ? 'PUT' : 'POST', url, config, Config, options)
    const { content: { error, result } } = response
    if (!error && !this.configId) {
      this.configId = result.id
    }
    return response
  }

  /**
   * Delete a config by configId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.configId) {
      throw new Error('`configId` is require to delete. Example: ordering.configs(configId).delete()')
    }
    const url = `/configs/${this.configId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, null, options)
    return response
  }
}
