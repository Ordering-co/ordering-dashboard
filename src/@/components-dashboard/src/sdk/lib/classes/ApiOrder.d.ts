import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { OrderProps } from '../models/Order';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { ApiOrderMessage } from './ApiOrderMessage';
/**
 * Class to orders api control
 */
export declare class ApiOrder extends ApiBase implements ApiBaseInterface {
    private orderId;
    constructor(ordering: Ordering, orderId: number | string);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get an order if orderId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update an order if orderId is set else create order
     * @param {OrderProps} order Attributes to create or update order
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(order: OrderProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete an order by orderId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Get order summary
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    summary(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Return messages api
     * @param {number} orderId Order id is optional
     */
    messages(messagesId: number): ApiOrderMessage;
    /**
     * Reorder an order by orderId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    reorder(options?: RequestOptionsProps): Promise<ApiResponse>;
}
