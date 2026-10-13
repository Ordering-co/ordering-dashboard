import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Ordering } from './Ordering'
import { Translation, TranslationProps } from '../models/Translation'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiResponse } from './ApiResponse'

export class ApiTranslation extends ApiBase implements ApiBaseInterface {
  public translationId: number

  constructor (ordering: Ordering, translationId: number) {
    super(ordering)
    this.translationId = translationId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.translationId = id
  }

  /**
   * Get a translation if translationId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.translationId && this.conditions) {
      throw new Error('The `where` function is not compatible with translations(translationId). Example ordering.translations().where(contitions).get()')
    }
    const url = '/translations' + (this.translationId ? `/${this.translationId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Translation, options)
    return response
  }

  /**
   * Update a translation if translationId is set else create translation
   * @param {TranslationProps} translation Attributes to create or update translation
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (translation: TranslationProps, options: RequestOptionsProps = {}) {
    const url = '/translations' + (this.translationId ? `/${this.translationId}` : '')
    const response: ApiResponse = await this.makeRequest(!this.translationId ? 'POST' : 'PUT', url, translation, Translation, options)
    const { content: { error, result } } = response
    if (!error && !this.translationId) {
      this.translationId = result.id
    }
    return response
  }

  /**
   * Delete a translation by translationId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.translationId) {
      throw new Error('`translationId` is require to delete. Example: ordering.translations(translationId).delete()')
    }
    const url = `/translations/${this.translationId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, Translation, options)
    return response
  }
}
