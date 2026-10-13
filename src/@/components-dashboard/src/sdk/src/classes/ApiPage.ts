import { ApiResponse } from './ApiResponse'
import { Ordering } from './Ordering'
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps'
import { ApiBase, ApiBaseInterface } from './ApiBase'
import { Page, PageProps } from '../models/Page'

/**
 * Class to pages api control
 */
export class ApiPage extends ApiBase implements ApiBaseInterface {
  private pageId: number

  constructor (ordering: Ordering, pageId: number) {
    super(ordering)
    this.pageId = pageId
  }

  /**
   * Replace current modelId
   * @param id ID to replace current api modelId
   */
  setModelId (id: number) {
    this.pageId = id
  }

  /**
   * Get a page if pageId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get (options: RequestOptionsProps = {}) {
    if (this.pageId && this.conditions) {
      throw new Error('The `where` function is not compatible with pages(pageId). Example ordering.pages().where(contitions).get()')
    }
    const url = '/pages' + (this.pageId ? `/${this.pageId}` : '')
    const response: ApiResponse = await this.makeRequest('GET', url, undefined, Page, options)
    return response
  }

  /**
   * Update a page if pageId is set else create page
   * @param {PageProps} page Attributes to create or update page
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async save (page: PageProps, options: RequestOptionsProps = {}) {
    const url = '/pages' + (this.pageId ? `/${this.pageId}` : '')
    const response: ApiResponse = await this.makeRequest(this.pageId ? 'PUT' : 'POST', url, page, Page, options)
    const { content: { error, result } } = response
    if (!error && !this.pageId) {
      this.pageId = result.id
    }
    return response
  }

  /**
   * Delete a page by pageId
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async delete (options: RequestOptionsProps = {}) {
    if (!this.pageId) {
      throw new Error('`pageId` is require to delete. Example: ordering.pages(pageId).delete()')
    }
    const url = `/pages/${this.pageId}`
    const response: ApiResponse = await this.makeRequest('DELETE', url, undefined, null, options)
    return response
  }
}
