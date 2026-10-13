import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { PageProps } from '../models/Page';
/**
 * Class to pages api control
 */
export declare class ApiPage extends ApiBase implements ApiBaseInterface {
    private pageId;
    constructor(ordering: Ordering, pageId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a page if pageId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a page if pageId is set else create page
     * @param {PageProps} page Attributes to create or update page
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(page: PageProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a page by pageId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
