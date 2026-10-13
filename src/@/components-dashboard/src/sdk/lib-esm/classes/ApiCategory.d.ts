import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { CategoryProps } from '../models/Category';
import { ApiProduct } from './ApiProduct';
/**
 * Class to category api control
 */
export declare class ApiCategory extends ApiBase implements ApiBaseInterface {
    businessId: number;
    categoryId: number;
    constructor(ordering: Ordering, businessId: number, categoryId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a category if categoryId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a category if categoryId is set else create category
     * @param {CategoryProps} category Attributes to create or update category
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(category: CategoryProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a category by categoryId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Return products api
     * @param {number} productId Product id is optional
     */
    products(productId: number): ApiProduct;
}
