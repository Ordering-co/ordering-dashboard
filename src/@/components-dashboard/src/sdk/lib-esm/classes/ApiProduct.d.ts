import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { ProductProps } from '../models/Product';
/**
 * Class to product api control
 */
export declare class ApiProduct extends ApiBase implements ApiBaseInterface {
    businessId: number;
    categoryId: number;
    productId: number;
    constructor(ordering: Ordering, businessId: number, categoryId: number, productId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a product if productId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a product if productId is set else create product
     * @param {ProductProps} product Attributes to create or update product
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(product: ProductProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a product by productId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
