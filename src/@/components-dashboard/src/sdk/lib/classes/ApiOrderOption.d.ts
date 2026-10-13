import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { OrderOptionProps } from '../models/OrderOption';
/**
 * Class to order option api control
 */
export declare class ApiOrderOption extends ApiBase implements ApiBaseInterface {
    private orderOptionId;
    constructor(ordering: Ordering, orderOptionId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a order options if orderOptionId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a order options if orderOptionId is set
     * @param {OrderOptionProps} orderOption Attributes to update order options
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(orderOption: OrderOptionProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a country by orderOptionId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
