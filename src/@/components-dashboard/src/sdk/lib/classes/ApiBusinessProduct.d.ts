import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
/**
 * Class to category api control
 */
export declare class ApiBusinessProduct extends ApiBase implements ApiBaseInterface {
    businessId: number;
    productId: number;
    constructor(ordering: Ordering, businessId: number, productId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get all products of a business
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    save(_changes: any, options?: RequestOptionsProps): Promise<ApiResponse>;
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
