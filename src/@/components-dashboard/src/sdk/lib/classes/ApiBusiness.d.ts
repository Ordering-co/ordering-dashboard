import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { RequestOptionsBusinessProps } from '../interfaces/RequestOptionsBusinessProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { BusinessProps } from '../models/Business';
import { ApiCategory } from './ApiCategory';
import { ApiMenu } from './ApiMenu';
import { ApiBusinessProduct } from './ApiBusinessProduct';
/**
 * Class to configs api control
 */
export declare class ApiBusiness extends ApiBase implements ApiBaseInterface {
    private businessId;
    constructor(ordering: Ordering, businessId: number | string);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a business if businessId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsBusinessProps): Promise<ApiResponse>;
    /**
     * Update a business if configId is set else create business
     * @param {BusinessProps} business Attributes to create or update business
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(business: BusinessProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a business by configId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    validateCart(cart: any, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Return products api
     */
    products(): ApiBusinessProduct;
    /**
     * Return categories api
     * @param {number} categoryId Category id is optional
     */
    categories(categoryId: number): ApiCategory;
    /**
     * Return menus api
     * @param {number} menuId Menu id is optional
     */
    menus(menuId: number): ApiMenu;
}
